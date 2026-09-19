'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { RollingIntervalType, TierLevel, UserRole } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

export interface TeacherQueueItemInput {
  slotIndex: number;
  teacherId: string;
  substituteTeacherId?: string | null;
}

export interface TeacherQueueStepInput {
  stepOrder: number;
  title?: string | null;
  items: TeacherQueueItemInput[];
}

export interface TeacherRollingInput {
  name: string;
  description?: string | null;
  rollingType: RollingIntervalType;
  teachersPerSession: number;
  queues: TeacherQueueStepInput[];
}

export interface ServerUserContext {
  userId: string;
  organizationId?: string | null;
  roleCodes: UserRole[];
}

/**
 * Mengambil daftar Rolling Pengajar dalam lingkup organisasi user
 */
export async function getTeacherRollings(userCtx?: ServerUserContext) {
  let organizationId = userCtx?.organizationId;
  let roleCodes = userCtx?.roleCodes;

  if (!organizationId || !roleCodes) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Anda harus login untuk mengakses data ini.', data: [] };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        organization: true,
      },
    });

    if (!userProfile?.organizationId) {
      return { error: 'Pengguna tidak terdaftar dalam wilayah.', data: [] };
    }

    organizationId = userProfile.organizationId;
    roleCodes = userProfile.roles.map((r) => r.role as UserRole);
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, organizationId);

  const whereClause: any = {};
  if (scopedOrgIds !== null) {
    whereClause.organizationId = { in: scopedOrgIds };
  }

  if (!(prisma as any).teacherRolling) {
    console.warn('prisma.teacherRolling is not loaded yet in this process. Please restart dev server.');
    return { data: [], error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    const rollings = await prisma.teacherRolling.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        queues: {
          orderBy: { stepOrder: 'asc' },
          include: {
            items: {
              orderBy: { slotIndex: 'asc' },
              include: {
                teacher: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    gender: true,
                    phoneNumber: true,
                    organization: {
                      select: { id: true, name: true, type: true },
                    },
                    roles: {
                      select: { role: true },
                    },
                  },
                },
                substituteTeacher: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    gender: true,
                    phoneNumber: true,
                    organization: {
                      select: { id: true, name: true, type: true },
                    },
                    roles: {
                      select: { role: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: rollings };
  } catch (err: any) {
    console.error('Error fetching teacher rollings:', err);
    return { error: err.message || 'Gagal memuat rolling pengajar.', data: [] };
  }
}

/**
 * Mengambil daftar pengajar/ustadz yang tersedia untuk dipilih ke dalam antrean
 */
export async function getAvailableTeachersForRolling(tierFilter?: string, roleFilter?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengakses data pengajar.', data: [] };
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      organization: {
        include: {
          parent: true,
        },
      },
    },
  });

  if (!userProfile?.organization) {
    return { error: 'Wilayah pengguna tidak ditemukan.', data: [] };
  }

  const currentUserRoles = userProfile.roles.map((r) => r.role as UserRole);
  const scopedOrgIds = await getScopedOrganizationIds(currentUserRoles, userProfile.organizationId);

  // Daftar role yang diizinkan mengajar
  const allowedTeacherRoles = ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH'];
  const targetRoles = roleFilter && allowedTeacherRoles.includes(roleFilter)
    ? [roleFilter as UserRole]
    : (allowedTeacherRoles as UserRole[]);

  const whereClause: any = {
    status: 'ACTIVE',
    roles: {
      some: {
        role: { in: targetRoles },
      },
    },
  };

  if (scopedOrgIds !== null) {
    whereClause.OR = [{ organizationId: { in: scopedOrgIds } }, { organizationId: null }];
  }

  if (tierFilter && tierFilter !== 'ALL') {
    whereClause.organization = {
      type: tierFilter as TierLevel,
    };
  }

  try {
    const rawTeachers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        gender: true,
        avatarUrl: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        roles: {
          select: {
            role: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return { data: rawTeachers };
  } catch (err: any) {
    console.error('Error fetching available teachers:', err);
    return { error: err.message || 'Gagal memuat daftar pengajar.', data: [] };
  }
}

/**
 * Membuat data Rolling Pengajar baru beserta antrean dan slot pengajarnya
 */
export async function createTeacherRolling(input: TeacherRollingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk membuat rolling pengajar.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama rolling pengajar wajib diisi.' };
  }

  if (input.teachersPerSession < 1) {
    return { error: 'Jumlah pengajar per sesi minimal 1.' };
  }

  if (!input.queues || input.queues.length < 2) {
    return { error: 'Daftar antrean pengajar minimal harus memiliki 2 antrean.' };
  }

  // Validasi setiap antrean harus memiliki pengajar utama di slotnya
  for (let i = 0; i < input.queues.length; i++) {
    const q = input.queues[i];
    if (!q.items || q.items.length === 0) {
      return { error: `Antrean ke-${i + 1} belum memiliki pengajar yang dipilih.` };
    }
    for (let s = 0; s < q.items.length; s++) {
      if (!q.items[s].teacherId) {
        return { error: `Antrean ke-${i + 1} pada Slot ${s + 1} belum memilih pengajar.` };
      }
    }
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      organization: true,
      roles: true,
    },
  });

  if (!userProfile?.organization) {
    return { error: 'Organisasi wilayah pengguna tidak ditemukan.' };
  }

  const tierLevel = userProfile.organization.type as TierLevel;

  if (!(prisma as any).teacherRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    const createdRolling = await prisma.$transaction(
      async (tx) => {
        // 1. Buat master rolling pengajar
        const rolling = await tx.teacherRolling.create({
          data: {
            name,
            description: input.description?.trim() || null,
            rollingType: input.rollingType || RollingIntervalType.PER_PENGAJIAN,
            teachersPerSession: input.teachersPerSession,
            tierLevel,
            organizationId: userProfile.organizationId!,
          },
        });

        // 2. Buat antrean (queues) dan item slot via createMany
        for (let qIdx = 0; qIdx < input.queues.length; qIdx++) {
          const qInput = input.queues[qIdx];
          const queue = await tx.teacherRollingQueue.create({
            data: {
              rollingId: rolling.id,
              stepOrder: qIdx + 1,
              title: qInput.title || `Antrean #${qIdx + 1}`,
            },
          });

          const validItems = qInput.items
            .map((it, sIdx) => ({
              queueId: queue.id,
              slotIndex: sIdx,
              teacherId: it.teacherId,
              substituteTeacherId: it.substituteTeacherId || null,
            }))
            .filter((it) => !!it.teacherId);

          if (validItems.length > 0) {
            await tx.teacherRollingQueueItem.createMany({
              data: validItems,
            });
          }
        }

        return rolling;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajar');
    return { success: true, data: createdRolling };
  } catch (err: any) {
    console.error('Error creating teacher rolling:', err);
    return { error: err.message || 'Gagal menyimpan rolling pengajar.' };
  }
}

/**
 * Mengedit data Rolling Pengajar beserta antrean dan slot pengajarnya
 */
export async function updateTeacherRolling(id: string, input: TeacherRollingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengedit rolling pengajar.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama rolling pengajar wajib diisi.' };
  }

  if (input.teachersPerSession < 1) {
    return { error: 'Jumlah pengajar per sesi minimal 1.' };
  }

  if (!input.queues || input.queues.length < 2) {
    return { error: 'Daftar antrean pengajar minimal harus memiliki 2 antrean.' };
  }

  for (let i = 0; i < input.queues.length; i++) {
    const q = input.queues[i];
    if (!q.items || q.items.length === 0) {
      return { error: `Antrean ke-${i + 1} belum memiliki pengajar yang dipilih.` };
    }
    for (let s = 0; s < q.items.length; s++) {
      if (!q.items[s].teacherId) {
        return { error: `Antrean ke-${i + 1} pada Slot ${s + 1} belum memilih pengajar.` };
      }
    }
  }

  if (!(prisma as any).teacherRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Update master rolling
        await tx.teacherRolling.update({
          where: { id },
          data: {
            name,
            description: input.description?.trim() || null,
            rollingType: input.rollingType,
            teachersPerSession: input.teachersPerSession,
          },
        });

        // 2. Hapus queues lama (cascade items)
        await tx.teacherRollingQueue.deleteMany({
          where: { rollingId: id },
        });

        // 3. Masukkan queues dan items baru via createMany
        for (let qIdx = 0; qIdx < input.queues.length; qIdx++) {
          const qInput = input.queues[qIdx];
          const queue = await tx.teacherRollingQueue.create({
            data: {
              rollingId: id,
              stepOrder: qIdx + 1,
              title: qInput.title || `Antrean #${qIdx + 1}`,
            },
          });

          const validItems = qInput.items
            .map((it, sIdx) => ({
              queueId: queue.id,
              slotIndex: sIdx,
              teacherId: it.teacherId,
              substituteTeacherId: it.substituteTeacherId || null,
            }))
            .filter((it) => !!it.teacherId);

          if (validItems.length > 0) {
            await tx.teacherRollingQueueItem.createMany({
              data: validItems,
            });
          }
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajar');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating teacher rolling:', err);
    return { error: err.message || 'Gagal memperbarui rolling pengajar.' };
  }
}

/**
 * Menghapus data Rolling Pengajar
 */
export async function deleteTeacherRolling(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk menghapus rolling pengajar.' };
  }

  if (!(prisma as any).teacherRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.teacherRolling.delete({
      where: { id },
    });

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-pengajar');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting teacher rolling:', err);
    return { error: err.message || 'Gagal menghapus rolling pengajar.' };
  }
}
