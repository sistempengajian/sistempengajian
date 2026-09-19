'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationWithStats,
} from '@/components/organisasi/types';
import {
  getScopedOrganizationIds,
  canManageOrganizationItem,
} from '@/lib/scoped-access';

/**
 * Membuat tingkatan wilayah organisasi baru (Daerah, Desa, atau Kelompok)
 * Khusus Pengelola dengan validasi lingkup wilayah ketat (Scoped RBAC)
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<{ success: boolean; message: string; organization?: OrganizationWithStats }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        organizationId: true,
        roles: { select: { role: true } },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const isAdmin = roleCodes.includes('ADMIN_MASTER');
    const isPjDaerah = roleCodes.includes('PJ_DAERAH');
    const isPjDesa = roleCodes.includes('PJ_DESA');

    if (!isAdmin && !isPjDaerah && !isPjDesa) {
      return {
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk menambah tingkatan wilayah.',
      };
    }

    // Validasi Nama
    const trimmedName = (input.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama tingkatan wilayah minimal harus 2 karakter.' };
    }

    const scopedOrgIds = await getScopedOrganizationIds(
      roleCodes,
      userProfile?.organizationId || null
    );

    let parentId = input.parentId ? input.parentId.trim() : null;

    if (input.type === 'DAERAH') {
      if (!isAdmin) {
        return {
          success: false,
          message: 'Akses ditolak: Hanya Admin Master yang berhak membuat tingkatan Daerah baru.',
        };
      }
      parentId = null; // Tingkat Daerah adalah root
    } else if (input.type === 'DESA') {
      if (!isAdmin && !isPjDaerah) {
        return {
          success: false,
          message: 'Akses ditolak: Hanya Admin Master dan PJ Daerah yang berhak membuat tingkatan Desa.',
        };
      }
      if (!parentId) {
        return {
          success: false,
          message: 'Tingkatan Desa wajib memilih Induk Wilayah tingkat Daerah.',
        };
      }

      // Validasi: PJ Daerah hanya boleh membuat Desa di bawah Daerah miliknya sendiri
      if (!isAdmin && isPjDaerah && parentId !== userProfile?.organizationId) {
        return {
          success: false,
          message: 'Akses ditolak: Anda hanya dapat membuat Desa di bawah wilayah Daerah binaan Anda.',
        };
      }

      const parentDaerah = await prisma.organization.findUnique({
        where: { id: parentId },
      });
      if (!parentDaerah || parentDaerah.type !== 'DAERAH') {
        return {
          success: false,
          message: 'Induk wilayah yang dipilih untuk Desa harus bertipe Daerah yang valid.',
        };
      }
    } else if (input.type === 'KELOMPOK') {
      if (!parentId) {
        return {
          success: false,
          message: 'Tingkatan Kelompok binaan wajib memilih Induk Wilayah tingkat Desa.',
        };
      }

      // Validasi: Induk Desa harus berada dalam lingkup wilayah pengguna
      if (!isAdmin) {
        if (isPjDesa && parentId !== userProfile?.organizationId) {
          return {
            success: false,
            message: 'Akses ditolak: Anda hanya dapat membuat Kelompok di bawah Desa binaan Anda.',
          };
        }
        if (isPjDaerah && scopedOrgIds && !scopedOrgIds.includes(parentId)) {
          return {
            success: false,
            message: 'Akses ditolak: Induk Desa yang dipilih berada di luar wilayah binaan Daerah Anda.',
          };
        }
      }

      const parentDesa = await prisma.organization.findUnique({
        where: { id: parentId },
      });
      if (!parentDesa || parentDesa.type !== 'DESA') {
        return {
          success: false,
          message: 'Induk wilayah yang dipilih untuk Kelompok harus bertipe Desa yang valid.',
        };
      }
    } else {
      return { success: false, message: 'Tipe tingkatan wilayah tidak valid.' };
    }

    const created = await prisma.organization.create({
      data: {
        name: trimmedName,
        type: input.type,
        parentId,
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    revalidatePath('/organisasi');
    revalidatePath('/dashboard');
    revalidatePath('/kurikulum');
    revalidatePath('/jadwal');
    revalidatePath('/tugas');

    return {
      success: true,
      message: `Tingkatan wilayah "${created.name}" (${created.type}) berhasil dibuat.`,
      organization: {
        id: created.id,
        name: created.name,
        type: created.type,
        parentId: created.parentId,
        parentName: created.parent?.name || null,
        parentType: created.parent?.type || null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        childrenCount: 0,
        userCount: 0,
        studentCount: 0,
        teacherCount: 0,
        classCount: 0,
        materialCount: 0,
        scheduleCount: 0,
      },
    };
  } catch (err: any) {
    console.error('Gagal membuat organisasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menyimpan tingkatan wilayah.',
    };
  }
}

/**
 * Memperbarui data tingkatan wilayah (nama dan induk wilayah)
 * Khusus Pengelola dengan validasi lingkup wilayah ketat (Scoped RBAC)
 */
export async function updateOrganization(
  id: string,
  input: UpdateOrganizationInput
): Promise<{ success: boolean; message: string; organization?: OrganizationWithStats }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        organizationId: true,
        roles: { select: { role: true } },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const isAdmin = roleCodes.includes('ADMIN_MASTER');
    const isPjDaerah = roleCodes.includes('PJ_DAERAH');
    const isPjDesa = roleCodes.includes('PJ_DESA');
    const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');

    const canEdit = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;
    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk memperbarui tingkatan wilayah.',
      };
    }

    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        children: { select: { id: true } },
        parent: { select: { id: true, name: true, type: true } },
        _count: {
          select: {
            children: true,
            users: true,
            classes: true,
            materials: true,
            schedules: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, message: 'Tingkatan wilayah tidak ditemukan di sistem.' };
    }

    // Validasi otorisasi item organisasi
    const accessCheck = await canManageOrganizationItem(
      { roles: roleCodes, organizationId: userProfile?.organizationId || null },
      existing,
      'EDIT'
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason || 'Akses ditolak: Anda tidak memiliki wewenang untuk mengedit wilayah ini.',
      };
    }

    const trimmedName = (input.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama tingkatan wilayah minimal harus 2 karakter.' };
    }

    const scopedOrgIds = await getScopedOrganizationIds(
      roleCodes,
      userProfile?.organizationId || null
    );

    let parentId = input.parentId !== undefined ? input.parentId : existing.parentId;

    if (existing.type === 'DAERAH') {
      parentId = null;
    } else {
      // PJ Kelompok tidak boleh memindahkan induk Kelompoknya
      if (isPjKelompok && parentId !== existing.parentId) {
        return {
          success: false,
          message: 'Akses ditolak: PJ Kelompok tidak dapat memindahkan induk Desa.',
        };
      }

      // Validasi anti-circular: parent tidak boleh diri sendiri
      if (parentId === id) {
        return {
          success: false,
          message: 'Organisasi tidak boleh memilih dirinya sendiri sebagai induk wilayah.',
        };
      }

      if (parentId) {
        // Validasi: parent baru harus berada di dalam lingkup wilayah pengguna
        if (!isAdmin && scopedOrgIds && !scopedOrgIds.includes(parentId)) {
          return {
            success: false,
            message: 'Akses ditolak: Induk wilayah baru berada di luar wilayah binaan Anda.',
          };
        }

        const parentOrg = await prisma.organization.findUnique({
          where: { id: parentId },
        });

        if (!parentOrg) {
          return { success: false, message: 'Induk wilayah yang dipilih tidak ditemukan.' };
        }

        if (existing.type === 'DESA' && parentOrg.type !== 'DAERAH') {
          return { success: false, message: 'Induk wilayah untuk Desa harus bertipe Daerah.' };
        }

        if (existing.type === 'KELOMPOK' && parentOrg.type !== 'DESA') {
          return { success: false, message: 'Induk wilayah untuk Kelompok harus bertipe Desa.' };
        }
      } else {
        return {
          success: false,
          message: `Tingkatan ${existing.type} wajib memiliki induk wilayah.`,
        };
      }
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        name: trimmedName,
        parentId,
      },
      include: {
        parent: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    revalidatePath('/organisasi');
    revalidatePath('/dashboard');
    revalidatePath('/kurikulum');
    revalidatePath('/jadwal');
    revalidatePath('/tugas');

    return {
      success: true,
      message: `Tingkatan wilayah "${updated.name}" berhasil diperbarui.`,
      organization: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        parentId: updated.parentId,
        parentName: updated.parent?.name || null,
        parentType: updated.parent?.type || null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        childrenCount: existing._count.children,
        userCount: existing._count.users,
        studentCount: 0,
        teacherCount: 0,
        classCount: existing._count.classes,
        materialCount: existing._count.materials,
        scheduleCount: existing._count.schedules,
      },
    };
  } catch (err: any) {
    console.error('Gagal memperbarui organisasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat memperbarui tingkatan wilayah.',
    };
  }
}

/**
 * Menghapus tingkatan wilayah dengan Safety Guard ketat dan validasi Scoped RBAC
 * Menolak penghapusan jika berada di luar wewenang atau masih ada data terkait.
 */
export async function deleteOrganization(
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        organizationId: true,
        roles: { select: { role: true } },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const isAdmin = roleCodes.includes('ADMIN_MASTER');
    const isPjDaerah = roleCodes.includes('PJ_DAERAH');
    const isPjDesa = roleCodes.includes('PJ_DESA');

    if (!isAdmin && !isPjDaerah && !isPjDesa) {
      return {
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk menghapus tingkatan wilayah.',
      };
    }

    const existing = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            children: true,
            users: true,
            classes: true,
            materials: true,
            schedules: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, message: 'Tingkatan wilayah tidak ditemukan atau sudah dihapus.' };
    }

    // Validasi otorisasi hapus via helper terpusat
    const accessCheck = await canManageOrganizationItem(
      { roles: roleCodes, organizationId: userProfile?.organizationId || null },
      existing,
      'DELETE'
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        message: accessCheck.reason || 'Akses ditolak: Anda tidak berhak menghapus organisasi ini.',
      };
    }

    // Safety Guard: Periksa seluruh keterkaitan data
    const childrenCount = existing._count.children;
    const userCount = existing._count.users;
    const classCount = existing._count.classes;
    const materialCount = existing._count.materials;
    const scheduleCount = existing._count.schedules;

    const hasRelations =
      childrenCount > 0 ||
      userCount > 0 ||
      classCount > 0 ||
      materialCount > 0 ||
      scheduleCount > 0;

    if (hasRelations) {
      const reasons: string[] = [];
      if (childrenCount > 0) reasons.push(`${childrenCount} sub-wilayah di bawahnya`);
      if (userCount > 0) reasons.push(`${userCount} pengguna/santri terdaftar`);
      if (classCount > 0) reasons.push(`${classCount} kelas binaan`);
      if (materialCount > 0) reasons.push(`${materialCount} modul kurikulum`);
      if (scheduleCount > 0) reasons.push(`${scheduleCount} jadwal pengajian`);

      return {
        success: false,
        message: `Tidak dapat menghapus "${existing.name}". Masih terdapat data terkait: ${reasons.join(
          ', '
        )}. Silakan pindahkan atau hapus data terkait terlebih dahulu demi menjaga keutuhan data sistem.`,
      };
    }

    await prisma.organization.delete({
      where: { id },
    });

    revalidatePath('/organisasi');
    revalidatePath('/dashboard');
    revalidatePath('/kurikulum');
    revalidatePath('/jadwal');
    revalidatePath('/tugas');

    return {
      success: true,
      message: `Tingkatan wilayah "${existing.name}" berhasil dihapus dari sistem.`,
    };
  } catch (err: any) {
    console.error('Gagal menghapus organisasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menghapus tingkatan wilayah.',
    };
  }
}
