'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { UserRole, ParentRelationType, Gender } from '@prisma/client';
import { CreateUserInput, UpdateUserInput } from '@/components/users/types';
import { getEffectiveAuthUser } from '@/lib/auth';
import {
  getScopedOrganizationIds,
  getManageableRoles,
  canManageTargetUser,
  validateUserOrganizationRoleMatch,
} from '@/lib/scoped-access';
import { getUsersOverview } from './queries';

/**
 * Validasi otentikasi dan peran pengelola menggunakan resolusi akun terpadu
 */
async function getAuthenticatedManager() {
  const { authUser, dbUser } = await getEffectiveAuthUser();

  if (!authUser || !dbUser) {
    throw new Error('Sesi tidak valid atau profil pengelola tidak ditemukan. Silakan login kembali.');
  }

  const currentUser = dbUser;
  const roles = currentUser.roles.map((r) => r.role);
  const isAdmin = roles.includes('ADMIN_MASTER');
  const isPj =
    roles.includes('PJ_DAERAH') ||
    roles.includes('PJ_DESA') ||
    roles.includes('PJ_KELOMPOK');

  if (!isAdmin && !isPj) {
    throw new Error('Anda tidak memiliki wewenang untuk mengelola data pengguna.');
  }

  return { currentUser, isAdmin, isPj, roles, authUser };
}

/**
 * Helper sinkronisasi kredensial pengguna ke Supabase Auth (auth.users)
 * Menggunakan pencocokan cerdas (by target email, by old email, dan by userId)
 * untuk menjamin kata sandi baru dan email custom langsung aktif dan dapat digunakan untuk login.
 */
export async function syncUserSupabaseAuth(params: {
  userId: string;
  email?: string | null;
  oldEmail?: string | null;
  password?: string | null;
  fullName?: string | null;
  username?: string | null;
  phoneNumber?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createAdminClient();
    const targetEmail =
      params.email?.trim().toLowerCase() ||
      (params.username?.trim().toLowerCase()
        ? `${params.username.trim().toLowerCase()}@pengajian.app`
        : `${params.userId}@pengajian.app`);

    const userMetadata = {
      full_name: params.fullName?.trim() || undefined,
      username: params.username?.trim().toLowerCase() || undefined,
    };

    // Cek keberadaan akun auth secara langsung (O(1) lookup, bukan O(N) list semua)
    const { data: authByIdData } = await supabaseAdmin.auth.admin.getUserById(params.userId);
    const authById = authByIdData?.user || null;

    // Cek apakah email target sudah cocok dengan akun yang ditemukan berdasarkan ID
    const authByTargetEmail = authById?.email?.toLowerCase() === targetEmail.toLowerCase()
      ? authById
      : null;
    const authByOldEmail = params.oldEmail?.trim() && authById?.email?.toLowerCase() === params.oldEmail.trim().toLowerCase()
      ? authById
      : null;

    // KASUS 1: targetEmail sudah ada di Supabase Auth -> update password & metadata pada akun tersebut
    if (authByTargetEmail) {
      const updatePayload: any = {
        email_confirm: true,
        user_metadata: {
          ...authByTargetEmail.user_metadata,
          ...userMetadata,
        },
      };

      if (params.password && params.password.length >= 6) {
        updatePayload.password = params.password;
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        authByTargetEmail.id,
        updatePayload
      );

      if (updateErr) {
        console.warn(`[syncUserSupabaseAuth] Gagal update authByTargetEmail ${authByTargetEmail.id}:`, updateErr.message);
        return { success: false, error: updateErr.message };
      }

      return { success: true };
    }

    // KASUS 2: Akun auth ditemukan berdasarkan ID atau Email Lama -> update email menjadi targetEmail dan update password
    const candidateAuth = authById || authByOldEmail;
    if (candidateAuth) {
      const updatePayload: any = {
        email: targetEmail,
        email_confirm: true,
        user_metadata: {
          ...candidateAuth.user_metadata,
          ...userMetadata,
        },
      };

      if (params.password && params.password.length >= 6) {
        updatePayload.password = params.password;
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        candidateAuth.id,
        updatePayload
      );

      if (updateErr) {
        console.warn(`[syncUserSupabaseAuth] Gagal update candidateAuth ${candidateAuth.id}:`, updateErr.message);
        return { success: false, error: updateErr.message };
      }

      return { success: true };
    }

    // KASUS 3: Akun auth belum pernah ada sama sekali -> Buat akun baru di Supabase Auth
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      id: params.userId,
      email: targetEmail,
      password: (params.password && params.password.length >= 6) ? params.password : 'DemoPassword2026!',
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (createErr) {
      console.warn(`[syncUserSupabaseAuth] Gagal createUser ${params.userId}:`, createErr.message);
      return { success: false, error: createErr.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[syncUserSupabaseAuth Exception]:', err);
    return { success: false, error: err.message || 'Gagal menyelaraskan akun otentikasi Supabase.' };
  }
}

/**
 * Server Action: Buat Pengguna Baru dengan validasi Scoped RBAC ketat
 */
export async function createUser(input: CreateUserInput) {
  try {
    const { currentUser, isAdmin, roles } = await getAuthenticatedManager();

    // Validasi field wajib
    const trimmedName = input.fullName?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama lengkap wajib diisi minimal 2 karakter.' };
    }

    if (!input.roles || input.roles.length === 0) {
      return { success: false, message: 'Pilih minimal satu peran (role) untuk pengguna ini.' };
    }

    if (input.password && input.password.length < 6) {
      return { success: false, message: 'Kata sandi awal wajib minimal 6 karakter.' };
    }

    // Validasi peran: Semua peran yang ditugaskan harus berada dalam batas wewenang pengelola
    const manageableRoles = getManageableRoles(roles);
    for (const role of input.roles) {
      if (!manageableRoles.includes(role)) {
        return {
          success: false,
          message: `Akses ditolak: Anda tidak memiliki wewenang untuk menugaskan peran "${role}".`,
        };
      }
    }

    // Validasi wilayah: Organisasi yang dipilih harus berada dalam lingkup wilayah binaan pengelola
    const scopedOrgIds = await getScopedOrganizationIds(
      roles,
      currentUser.organizationId
    );

    if (scopedOrgIds !== null) {
      if (input.organizationId && !scopedOrgIds.includes(input.organizationId)) {
        return {
          success: false,
          message:
            'Akses ditolak: Wilayah organisasi yang dipilih berada di luar kewenangan wilayah Anda.',
        };
      }
    }

    // Validasi kesesuaian tingkatan wilayah dengan peran pengguna dan tingkatan PJ
    if (input.organizationId) {
      const targetOrg = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { type: true },
      });
      const orgMatch = validateUserOrganizationRoleMatch(
        roles,
        input.roles,
        targetOrg?.type || null
      );
      if (!orgMatch.allowed) {
        return {
          success: false,
          message: orgMatch.reason || 'Kombinasi peran dan tingkatan wilayah tidak valid.',
        };
      }
    } else {
      const orgMatch = validateUserOrganizationRoleMatch(roles, input.roles, null);
      if (!orgMatch.allowed) {
        return {
          success: false,
          message: orgMatch.reason || 'Pengguna wajib bernaung pada wilayah binaan.',
        };
      }
    }

    const trimmedUsername = input.username?.trim().toLowerCase() || null;
    const trimmedEmail = input.email?.trim().toLowerCase() || null;
    const trimmedPhone = input.phoneNumber?.trim() || null;

    // Cek duplikasi email jika ada (case-insensitive)
    if (trimmedEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: { equals: trimmedEmail, mode: 'insensitive' } },
      });
      if (existingEmail) {
        return { success: false, message: `Email "${trimmedEmail}" sudah terdaftar pada akun lain.` };
      }
    }

    // Cek duplikasi username jika ada (case-insensitive)
    if (trimmedUsername) {
      const existingUsername = await prisma.user.findFirst({
        where: { username: { equals: trimmedUsername, mode: 'insensitive' } },
      });
      if (existingUsername) {
        return { success: false, message: `Username "${trimmedUsername}" sudah digunakan.` };
      }
    }

    // Buat User di Prisma terlebih dahulu
    const createdUser = await prisma.user.create({
      data: {
        fullName: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        phoneNumber: trimmedPhone,
        gender: input.gender || 'MALE',
        birthPlace: input.birthPlace || null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        status: input.status || 'ACTIVE',
        organizationId: input.organizationId || null,
        generationId: input.generationId || null,
        roles: {
          create: input.roles.map((role) => ({
            role,
          })),
        },
      },
    });

    // Sinkronkan akun login ke Supabase Auth
    await syncUserSupabaseAuth({
      userId: createdUser.id,
      email: trimmedEmail,
      password: input.password || null,
      fullName: trimmedName,
      username: trimmedUsername,
      phoneNumber: trimmedPhone,
    });

    // Handle relasi Orang Tua jika ini adalah Santri dan data ortu disertakan
    if (input.roles.includes('SANTRI') && input.parentRelation) {
      const rel = input.parentRelation;
      let targetParentId = rel.parentId;

      // Jika membuat data Orang Tua baru sekaligus
      if (!targetParentId && rel.newParentName?.trim()) {
        const newParent = await prisma.user.create({
          data: {
            fullName: rel.newParentName.trim(),
            phoneNumber: rel.newParentPhone?.trim() || null,
            gender: rel.relationshipType === 'IBU' ? 'FEMALE' : 'MALE',
            organizationId: input.organizationId || null,
            roles: {
              create: [{ role: 'ORANG_TUA' }],
            },
          },
        });
        targetParentId = newParent.id;
      }

      // Hubungkan jika targetParentId ada
      if (targetParentId) {
        await prisma.studentParentRelation.create({
          data: {
            studentUserId: createdUser.id,
            parentUserId: targetParentId,
            relationshipType: rel.relationshipType || 'WALI',
          },
        });
      }
    }

    revalidatePath('/users');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Pengguna "${trimmedName}" berhasil ditambahkan ke dalam sistem.`,
      userId: createdUser.id,
    };
  } catch (error: any) {
    console.error('Error createUser:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan sistem saat membuat pengguna baru.',
    };
  }
}

/**
 * Server Action: Perbarui Data Pengguna dengan validasi Scoped RBAC ketat
 */
export async function updateUser(userId: string, input: UpdateUserInput) {
  try {
    const { currentUser, roles } = await getAuthenticatedManager();

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!existingUser) {
      return { success: false, message: 'Data pengguna yang akan diubah tidak ditemukan.' };
    }

    // Validasi otorisasi target user via helper terpusat
    const accessCheck = await canManageTargetUser(
      {
        id: currentUser.id,
        roles: currentUser.roles.map((r) => r.role),
        organizationId: currentUser.organizationId,
      },
      {
        id: existingUser.id,
        roles: existingUser.roles.map((r) => r.role),
        organizationId: existingUser.organizationId,
      }
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message:
          accessCheck.reason ||
          'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah data pengguna ini.',
      };
    }

    const trimmedName = input.fullName?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama lengkap wajib diisi minimal 2 karakter.' };
    }

    if (!input.roles || input.roles.length === 0) {
      return { success: false, message: 'Pengguna harus memiliki minimal satu peran.' };
    }

    // Validasi peran baru: seluruh peran harus berada dalam wewenang pengelola
    const manageableRoles = getManageableRoles(roles);
    for (const role of input.roles) {
      if (!manageableRoles.includes(role)) {
        return {
          success: false,
          message: `Akses ditolak: Anda tidak dapat menugaskan peran "${role}".`,
        };
      }
    }

    // Validasi perpindahan wilayah: tidak boleh memindahkan user ke luar wilayah binaan
    const scopedOrgIds = await getScopedOrganizationIds(
      roles,
      currentUser.organizationId
    );

    if (scopedOrgIds !== null) {
      if (input.organizationId && !scopedOrgIds.includes(input.organizationId)) {
        return {
          success: false,
          message:
            'Akses ditolak: Tidak dapat memindahkan pengguna ke organisasi di luar wilayah binaan Anda.',
        };
      }
    }

    // Validasi kesesuaian tingkatan wilayah dengan peran pengguna dan tingkatan PJ
    if (input.organizationId) {
      const targetOrg = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { type: true },
      });
      const orgMatch = validateUserOrganizationRoleMatch(
        roles,
        input.roles,
        targetOrg?.type || null
      );
      if (!orgMatch.allowed) {
        return {
          success: false,
          message: orgMatch.reason || 'Kombinasi peran dan tingkatan wilayah tidak valid.',
        };
      }
    } else {
      const orgMatch = validateUserOrganizationRoleMatch(roles, input.roles, null);
      if (!orgMatch.allowed) {
        return {
          success: false,
          message: orgMatch.reason || 'Pengguna wajib bernaung pada wilayah binaan.',
        };
      }
    }

    const trimmedUsername = input.username?.trim().toLowerCase() || null;
    const trimmedEmail = input.email?.trim().toLowerCase() || null;
    const trimmedPhone = input.phoneNumber?.trim() || null;

    // Validasi panjang password baru jika diisi
    if (input.password && input.password.length < 6) {
      return { success: false, message: 'Kata sandi baru wajib minimal 6 karakter.' };
    }

    // Cek duplikasi email (selain milik user ini) secara case-insensitive
    if (trimmedEmail && trimmedEmail !== existingUser.email?.toLowerCase()) {
      const duplicateEmail = await prisma.user.findFirst({
        where: {
          email: { equals: trimmedEmail, mode: 'insensitive' },
          id: { not: userId },
        },
      });
      if (duplicateEmail) {
        return { success: false, message: `Email "${trimmedEmail}" sudah digunakan akun lain.` };
      }
    }

    // Cek duplikasi username (selain milik user ini) secara case-insensitive
    if (trimmedUsername && trimmedUsername !== existingUser.username?.toLowerCase()) {
      const duplicateUsername = await prisma.user.findFirst({
        where: {
          username: { equals: trimmedUsername, mode: 'insensitive' },
          id: { not: userId },
        },
      });
      if (duplicateUsername) {
        return { success: false, message: `Username "${trimmedUsername}" sudah digunakan akun lain.` };
      }
    }

    // Sinkronisasi pembaruan kredensial (email & password baru) ke Supabase Auth
    const authSync = await syncUserSupabaseAuth({
      userId,
      email: trimmedEmail,
      oldEmail: existingUser.email,
      password: input.password?.trim() || null,
      fullName: trimmedName,
      username: trimmedUsername,
      phoneNumber: trimmedPhone,
    });

    if (!authSync.success && authSync.error) {
      if (
        authSync.error.toLowerCase().includes('already registered') ||
        authSync.error.toLowerCase().includes('already exists')
      ) {
        return {
          success: false,
          message: `Email "${trimmedEmail}" sudah terdaftar pada sistem otentikasi akun lain. Silakan gunakan email yang berbeda.`,
        };
      }
      console.warn(`[updateUser] Notice Supabase Auth sync for ${userId}:`, authSync.error);
    }

    // Transaksi database: Update data profil & sinkronisasi relasi peran
    await prisma.$transaction(async (tx) => {
      // 1. Update profil dasar
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: trimmedName,
          username: trimmedUsername,
          email: trimmedEmail,
          phoneNumber: trimmedPhone,
          gender: input.gender,
          birthPlace: input.birthPlace !== undefined ? input.birthPlace : undefined,
          birthDate: input.birthDate !== undefined ? (input.birthDate ? new Date(input.birthDate) : null) : undefined,
          status: input.status,
          organizationId: input.organizationId || null,
          generationId: input.generationId || null,
        },
      });

      // 2. Sinkronisasi roles: Hapus role lama dan masukkan role baru
      await tx.userRoleAssignment.deleteMany({
        where: { userId },
      });

      await tx.userRoleAssignment.createMany({
        data: input.roles.map((role) => ({
          userId,
          role,
        })),
      });
    });

    revalidatePath('/users');
    revalidatePath(`/users/${userId}/edit`);
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Data pengguna "${trimmedName}" berhasil diperbarui.`,
    };
  } catch (error: any) {
    console.error('Error updateUser:', error);
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan sistem saat memperbarui data pengguna.',
    };
  }
}

/**
 * Server Action: Ubah Status Pengguna (Aktif / Nonaktif / Suspend) dengan validasi Scoped RBAC
 */
export async function toggleUserStatus(userId: string, newStatus: string) {
  try {
    const { currentUser } = await getAuthenticatedManager();

    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, message: 'Status tidak valid.' };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!targetUser) {
      return { success: false, message: 'Data pengguna tidak ditemukan.' };
    }

    const accessCheck = await canManageTargetUser(
      {
        id: currentUser.id,
        roles: currentUser.roles.map((r) => r.role),
        organizationId: currentUser.organizationId,
      },
      {
        id: targetUser.id,
        roles: targetUser.roles.map((r) => r.role),
        organizationId: targetUser.organizationId,
      }
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason || 'Akses ditolak: Anda tidak memiliki wewenang untuk mengubah status akun ini.',
      };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
      select: { fullName: true, status: true },
    });

    revalidatePath('/users');
    return {
      success: true,
      message: `Status akun "${updated.fullName}" berhasil diubah menjadi ${newStatus}.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Gagal memperbarui status akun pengguna.',
    };
  }
}

/**
 * Server Action: Tautkan Orang Tua ke Santri dengan validasi wilayah
 */
export async function linkParentChild(
  studentUserId: string,
  parentUserId: string,
  relationshipType: ParentRelationType = 'WALI'
) {
  try {
    const { currentUser } = await getAuthenticatedManager();

    if (studentUserId === parentUserId) {
      return { success: false, message: 'Santri dan Orang Tua tidak boleh akun yang sama.' };
    }

    const studentUser = await prisma.user.findUnique({
      where: { id: studentUserId },
      include: { roles: true },
    });

    if (!studentUser) {
      return { success: false, message: 'Data santri tidak ditemukan.' };
    }

    const accessCheck = await canManageTargetUser(
      {
        id: currentUser.id,
        roles: currentUser.roles.map((r) => r.role),
        organizationId: currentUser.organizationId,
      },
      {
        id: studentUser.id,
        roles: studentUser.roles.map((r) => r.role),
        organizationId: studentUser.organizationId,
      }
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason || 'Akses ditolak: Santri berada di luar kewenangan wilayah Anda.',
      };
    }

    // Cek apakah relasi sudah ada
    const existing = await prisma.studentParentRelation.findUnique({
      where: {
        studentUserId_parentUserId: {
          studentUserId,
          parentUserId,
        },
      },
    });

    if (existing) {
      await prisma.studentParentRelation.update({
        where: { id: existing.id },
        data: { relationshipType },
      });
      revalidatePath('/users');
      return { success: true, message: 'Tipe hubungan orang tua dan santri berhasil diperbarui.' };
    }

    // Buat relasi baru
    await prisma.studentParentRelation.create({
      data: {
        studentUserId,
        parentUserId,
        relationshipType,
      },
    });

    // Pastikan akun ortu memiliki peran ORANG_TUA
    const parentHasRole = await prisma.userRoleAssignment.findFirst({
      where: { userId: parentUserId, role: 'ORANG_TUA' },
    });

    if (!parentHasRole) {
      await prisma.userRoleAssignment.create({
        data: { userId: parentUserId, role: 'ORANG_TUA' },
      });
    }

    revalidatePath('/users');
    return { success: true, message: 'Santri berhasil ditautkan ke akun orang tua.' };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Gagal menautkan akun orang tua ke santri.',
    };
  }
}

/**
 * Server Action: Putuskan Tautan Orang Tua dan Santri
 */
export async function unlinkParentChild(relationId: string) {
  try {
    await getAuthenticatedManager();

    await prisma.studentParentRelation.delete({
      where: { id: relationId },
    });

    revalidatePath('/users');
    return { success: true, message: 'Hubungan tautan orang tua berhasil diputuskan.' };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Gagal memutuskan hubungan orang tua.',
    };
  }
}

/**
 * Server Action: Cari opsi orang tua untuk modal tautkan (dalam batas wilayah binaan)
 */
export async function searchParentCandidates(query: string) {
  try {
    const { currentUser, roles } = await getAuthenticatedManager();

    const q = query.trim();
    if (!q || q.length < 2) return [];

    const scopedOrgIds = await getScopedOrganizationIds(
      roles,
      currentUser.organizationId
    );

    const where: any = {
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { phoneNumber: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    };

    if (scopedOrgIds !== null) {
      where.organizationId = { in: scopedOrgIds };
    }

    const parents = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        email: true,
        roles: {
          select: { role: true },
        },
      },
      take: 10,
    });

    return parents.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      phoneNumber: p.phoneNumber,
      email: p.email,
      isOrangTua: p.roles.some((r) => r.role === 'ORANG_TUA'),
    }));
  } catch (error) {
    console.error('Error searchParentCandidates:', error);
    return [];
  }
}

/**
 * Server Action: Hapus Pengguna (Dengan Safety Guard Ketat & Validasi Scoped RBAC)
 */
export async function deleteUser(userId: string) {
  try {
    const { currentUser } = await getAuthenticatedManager();

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        _count: {
          select: {
            attendanceRecords: true,
            assignmentSubmissions: true,
            assignmentsCreated: true,
            homeroomClasses: true,
            materialsCreated: true,
            scheduleAssignments: true,
          },
        },
      },
    });

    if (!targetUser) {
      return { success: false, message: 'Data pengguna tidak ditemukan.' };
    }

    // Validasi otorisasi target user via helper terpusat
    const accessCheck = await canManageTargetUser(
      {
        id: currentUser.id,
        roles: currentUser.roles.map((r) => r.role),
        organizationId: currentUser.organizationId,
      },
      {
        id: targetUser.id,
        roles: targetUser.roles.map((r) => r.role),
        organizationId: targetUser.organizationId,
      }
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason || 'Akses ditolak: Anda tidak memiliki wewenang untuk menghapus akun ini.',
      };
    }

    // Safety Guard: Periksa relasi penting
    const hasHistory =
      targetUser._count.attendanceRecords > 0 ||
      targetUser._count.assignmentSubmissions > 0 ||
      targetUser._count.assignmentsCreated > 0 ||
      targetUser._count.homeroomClasses > 0 ||
      targetUser._count.materialsCreated > 0 ||
      targetUser._count.scheduleAssignments > 0;

    if (hasHistory) {
      return {
        success: false,
        message:
          'Pengguna ini tidak dapat dihapus permanen karena telah memiliki rekam jejak aktif (presensi, tugas, atau kelas). Demi menjaga integritas data historis, silakan ubah status akun menjadi Nonaktif / Ditangguhkan.',
        hasHistory: true,
      };
    }

    // Hapus di Prisma (relasi cascade ke roles & parent/child terhapus otomatis)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Coba hapus di Supabase Auth jika memungkinkan
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (authErr: any) {
      console.warn('Supabase Auth user delete skipped or failed:', authErr.message);
    }

    revalidatePath('/users');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Akun "${targetUser.fullName}" berhasil dihapus dari sistem.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Terjadi kesalahan sistem saat menghapus pengguna.',
    };
  }
}

/**
 * Server Action: Mengambil data pengguna secara dinamis untuk infinite scroll dan live search
 */
export async function fetchUsersOverviewAction(params: {
  page?: number;
  limit?: number;
  role?: string;
  organizationId?: string;
  generationId?: string;
  status?: string;
  search?: string;
}) {
  try {
    const { authUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !effectiveUserId) {
      return { success: false, message: 'Sesi telah berakhir. Silakan login kembali.' };
    }

    const overview = await getUsersOverview(effectiveUserId, {
      page: params.page ? String(params.page) : '1',
      limit: params.limit ? String(params.limit) : '20',
      role: params.role || undefined,
      organizationId: params.organizationId || undefined,
      generationId: params.generationId || undefined,
      status: params.status || undefined,
      search: params.search || undefined,
    });

    return {
      success: true,
      data: overview,
    };
  } catch (err: any) {
    console.error('Error in fetchUsersOverviewAction:', err);
    return {
      success: false,
      message: err.message || 'Gagal memuat data pengguna.',
    };
  }
}

