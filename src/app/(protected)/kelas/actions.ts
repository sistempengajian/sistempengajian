'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TierLevel, UserRole } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

const classSchema = z.object({
  name: z
    .string()
    .min(3, 'Nama kelas minimal 3 karakter.')
    .max(255, 'Nama kelas maksimal 255 karakter.')
    .trim(),
  academicYear: z
    .string()
    .min(4, 'Tahun ajaran wajib diisi (contoh: 2026/2027).')
    .max(50, 'Tahun ajaran maksimal 50 karakter.')
    .trim(),
  organizationId: z.string().uuid('Wilayah binaan tidak valid.'),
  generationId: z.string().uuid('Jenjang generasi tidak valid.'),
  homeroomTeacherId: z
    .string()
    .uuid('Wali kelas tidak valid.')
    .optional()
    .or(z.literal(''))
    .nullable(),
});

export interface ClassFormState {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Membuat data kelas baru
 */
export async function createClass(
  prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });

    if (!currentUser) {
      return { success: false, message: 'Pengguna tidak ditemukan di sistem.' };
    }

    const currentUserRoles = currentUser.roles.map((r) => r.role);
    const isManager =
      currentUserRoles.includes('ADMIN_MASTER') ||
      currentUserRoles.includes('PJ_DAERAH') ||
      currentUserRoles.includes('PJ_DESA') ||
      currentUserRoles.includes('PJ_KELOMPOK');

    if (!isManager) {
      return { success: false, message: 'Anda tidak memiliki hak akses untuk membuat kelas pengajian.' };
    }

    const rawData = {
      name: formData.get('name') as string,
      academicYear: formData.get('academicYear') as string,
      organizationId: formData.get('organizationId') as string,
      generationId: formData.get('generationId') as string,
      homeroomTeacherId: (formData.get('homeroomTeacherId') as string) || null,
    };

    const validated = classSchema.safeParse(rawData);
    if (!validated.success) {
      return {
        success: false,
        message: 'Terdapat kesalahan pada input formulir.',
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const { name, academicYear, organizationId, generationId, homeroomTeacherId } = validated.data;

    // 1. Verifikasi Organisasi Target & Scoped RBAC
    const targetOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!targetOrg) {
      return { success: false, message: 'Wilayah binaan yang dipilih tidak ditemukan.' };
    }

    const scopedOrgIds = await getScopedOrganizationIds(
      currentUserRoles,
      currentUser.organizationId
    );

    if (scopedOrgIds !== null && !scopedOrgIds.includes(organizationId)) {
      return {
        success: false,
        message: 'Anda tidak berwenang membuat kelas di luar wilayah binaan kekuasaan Anda.',
      };
    }

    // 2. Verifikasi Jenjang Generasi
    const targetGeneration = await prisma.generation.findUnique({
      where: { id: generationId },
    });

    if (!targetGeneration) {
      return { success: false, message: 'Jenjang generasi yang dipilih tidak valid.' };
    }

    // 3. Tentukan TierLevel berdasarkan tipe organisasi
    let tierLevel: TierLevel = TierLevel.KELOMPOK;
    if (targetOrg.type === 'DAERAH') tierLevel = TierLevel.DAERAH;
    else if (targetOrg.type === 'DESA') tierLevel = TierLevel.DESA;
    else tierLevel = TierLevel.KELOMPOK;

    // 4. Verifikasi Wali Kelas jika ditunjuk
    let cleanTeacherId: string | null = null;
    if (homeroomTeacherId && homeroomTeacherId.trim() !== '') {
      const teacher = await prisma.user.findUnique({
        where: { id: homeroomTeacherId },
        include: { roles: true },
      });

      if (!teacher) {
        return { success: false, message: 'Ustadz/Ustadzah yang dipilih tidak ditemukan.' };
      }

      const hasTeacherRole = teacher.roles.some((r) =>
        ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH'].includes(r.role)
      );

      if (!hasTeacherRole) {
        return {
          success: false,
          message: 'Pengguna yang ditunjuk sebagai wali kelas harus memiliki peran Pengajar atau Wali Kelas.',
        };
      }

      cleanTeacherId = teacher.id;
    }

    // 5. Simpan Kelas ke Database
    const newClass = await prisma.class.create({
      data: {
        name,
        tierLevel,
        academicYear,
        organizationId,
        generationId,
        homeroomTeacherId: cleanTeacherId,
      },
    });

    // Sinkronisasi Peran WALI_KELAS jika ditunjuk
    if (cleanTeacherId) {
      try {
        await prisma.userRoleAssignment.upsert({
          where: {
            userId_role: {
              userId: cleanTeacherId,
              role: UserRole.WALI_KELAS,
            },
          },
          update: {},
          create: {
            userId: cleanTeacherId,
            role: UserRole.WALI_KELAS,
          },
        });
      } catch (roleErr) {
        console.error('Gagal sinkronisasi peran WALI_KELAS saat createClass:', roleErr);
      }
    }

    // 6. Rekam Jejak Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          userId: currentUser.id,
          action: 'CREATE_CLASS',
          entityName: 'Class',
          entityId: newClass.id,
          newValues: {
            name,
            tierLevel,
            academicYear,
            organizationId,
            generationId,
            homeroomTeacherId: cleanTeacherId,
          },
        },
      });
    } catch (e) {
      console.error('Failed to write audit log for createClass:', e);
    }

    revalidatePath('/kelas');
    revalidatePath('/dashboard');
    return { success: true, message: `Kelas "${name}" berhasil dibuat.` };
  } catch (error: any) {
    console.error('Error creating class:', error);
    return { success: false, message: error?.message || 'Terjadi kesalahan sistem saat membuat kelas.' };
  }
}

/**
 * Memperbarui data kelas
 */
export async function updateClass(
  classId: string,
  prevState: ClassFormState,
  formData: FormData
): Promise<ClassFormState> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });

    if (!currentUser) {
      return { success: false, message: 'Pengguna tidak ditemukan di sistem.' };
    }

    const currentUserRoles = currentUser.roles.map((r) => r.role);
    const isManager =
      currentUserRoles.includes('ADMIN_MASTER') ||
      currentUserRoles.includes('PJ_DAERAH') ||
      currentUserRoles.includes('PJ_DESA') ||
      currentUserRoles.includes('PJ_KELOMPOK');

    if (!isManager) {
      return { success: false, message: 'Anda tidak memiliki hak akses untuk mengubah kelas pengajian.' };
    }

    const existingClass = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!existingClass) {
      return { success: false, message: 'Kelas yang ingin diubah tidak ditemukan.' };
    }

    // Cek Scoped RBAC kelas awal
    const scopedOrgIds = await getScopedOrganizationIds(
      currentUserRoles,
      currentUser.organizationId
    );

    if (scopedOrgIds !== null && !scopedOrgIds.includes(existingClass.organizationId)) {
      return { success: false, message: 'Anda tidak berwenang mengelola kelas ini.' };
    }

    const rawData = {
      name: formData.get('name') as string,
      academicYear: formData.get('academicYear') as string,
      organizationId: formData.get('organizationId') as string,
      generationId: formData.get('generationId') as string,
      homeroomTeacherId: (formData.get('homeroomTeacherId') as string) || null,
    };

    const validated = classSchema.safeParse(rawData);
    if (!validated.success) {
      return {
        success: false,
        message: 'Terdapat kesalahan pada input formulir.',
        errors: validated.error.flatten().fieldErrors,
      };
    }

    const { name, academicYear, organizationId, generationId, homeroomTeacherId } = validated.data;

    // Verifikasi Organisasi Baru
    const targetOrg = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!targetOrg) {
      return { success: false, message: 'Wilayah binaan yang dipilih tidak ditemukan.' };
    }

    if (scopedOrgIds !== null && !scopedOrgIds.includes(organizationId)) {
      return { success: false, message: 'Anda tidak berwenang memindahkan kelas ke wilayah di luar binaan Anda.' };
    }

    let tierLevel: TierLevel = TierLevel.KELOMPOK;
    if (targetOrg.type === 'DAERAH') tierLevel = TierLevel.DAERAH;
    else if (targetOrg.type === 'DESA') tierLevel = TierLevel.DESA;
    else tierLevel = TierLevel.KELOMPOK;

    let cleanTeacherId: string | null = null;
    if (homeroomTeacherId && homeroomTeacherId.trim() !== '') {
      const teacher = await prisma.user.findUnique({
        where: { id: homeroomTeacherId },
        include: { roles: true },
      });

      if (!teacher) {
        return { success: false, message: 'Ustadz/Ustadzah yang dipilih tidak ditemukan.' };
      }
      cleanTeacherId = teacher.id;
    }

    const updated = await prisma.class.update({
      where: { id: classId },
      data: {
        name,
        tierLevel,
        academicYear,
        organizationId,
        generationId,
        homeroomTeacherId: cleanTeacherId,
      },
    });

    // Sinkronisasi Peran WALI_KELAS
    const oldHomeroomTeacherId = existingClass.homeroomTeacherId;
    if (oldHomeroomTeacherId && oldHomeroomTeacherId !== cleanTeacherId) {
      try {
        const remainingClasses = await prisma.class.count({
          where: { homeroomTeacherId: oldHomeroomTeacherId },
        });
        if (remainingClasses === 0) {
          await prisma.userRoleAssignment.deleteMany({
            where: {
              userId: oldHomeroomTeacherId,
              role: UserRole.WALI_KELAS,
            },
          });
        }
      } catch (roleErr) {
        console.error('Gagal mencabut peran WALI_KELAS dari guru lama:', roleErr);
      }
    }
    if (cleanTeacherId) {
      try {
        await prisma.userRoleAssignment.upsert({
          where: {
            userId_role: {
              userId: cleanTeacherId,
              role: UserRole.WALI_KELAS,
            },
          },
          update: {},
          create: {
            userId: cleanTeacherId,
            role: UserRole.WALI_KELAS,
          },
        });
      } catch (roleErr) {
        console.error('Gagal memberikan peran WALI_KELAS ke guru baru:', roleErr);
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: currentUser.id,
          action: 'UPDATE_CLASS',
          entityName: 'Class',
          entityId: classId,
          oldValues: {
            name: existingClass.name,
            tierLevel: existingClass.tierLevel,
            academicYear: existingClass.academicYear,
            organizationId: existingClass.organizationId,
            generationId: existingClass.generationId,
            homeroomTeacherId: existingClass.homeroomTeacherId,
          },
          newValues: {
            name,
            tierLevel,
            academicYear,
            organizationId,
            generationId,
            homeroomTeacherId: cleanTeacherId,
          },
        },
      });
    } catch (e) {
      console.error('Failed to write audit log for updateClass:', e);
    }

    revalidatePath('/kelas');
    revalidatePath(`/kelas/${classId}`);
    revalidatePath('/dashboard');
    return { success: true, message: `Kelas "${name}" berhasil diperbarui.` };
  } catch (error: any) {
    console.error('Error updating class:', error);
    return { success: false, message: error?.message || 'Terjadi kesalahan sistem saat memperbarui kelas.' };
  }
}

/**
 * Menghapus data kelas dengan proteksi relasi integritas
 */
export async function deleteClass(
  classId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { roles: true },
    });

    if (!currentUser) {
      return { success: false, message: 'Pengguna tidak ditemukan di sistem.' };
    }

    const currentUserRoles = currentUser.roles.map((r) => r.role);
    const isManager =
      currentUserRoles.includes('ADMIN_MASTER') ||
      currentUserRoles.includes('PJ_DAERAH') ||
      currentUserRoles.includes('PJ_DESA') ||
      currentUserRoles.includes('PJ_KELOMPOK');

    if (!isManager) {
      return { success: false, message: 'Anda tidak memiliki hak akses untuk menghapus kelas pengajian.' };
    }

    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        _count: {
          select: {
            schedules: true,
            assignments: true,
          },
        },
      },
    });

    if (!targetClass) {
      return { success: false, message: 'Kelas tidak ditemukan atau sudah dihapus sebelumnya.' };
    }

    // Scoped RBAC
    const scopedOrgIds = await getScopedOrganizationIds(
      currentUserRoles,
      currentUser.organizationId
    );

    if (scopedOrgIds !== null && !scopedOrgIds.includes(targetClass.organizationId)) {
      return { success: false, message: 'Anda tidak berwenang menghapus kelas di wilayah ini.' };
    }

    // Proteksi dependensi integritas
    const activeDependencies: string[] = [];
    if (targetClass._count.schedules > 0) {
      activeDependencies.push(`${targetClass._count.schedules} jadwal sesi pengajian`);
    }
    if (targetClass._count.assignments > 0) {
      activeDependencies.push(`${targetClass._count.assignments} tugas santri`);
    }

    if (activeDependencies.length > 0) {
      return {
        success: false,
        message: `Kelas "${targetClass.name}" tidak dapat dihapus karena masih memiliki relasi aktif: ${activeDependencies.join(', ')}. Silakan hapus atau pindahkan data terkait terlebih dahulu.`,
      };
    }

    // Hapus kelas
    await prisma.class.delete({
      where: { id: classId },
    });

    // Sinkronisasi peran WALI_KELAS jika kelas yang dihapus memiliki wali kelas
    if (targetClass.homeroomTeacherId) {
      try {
        const remainingClasses = await prisma.class.count({
          where: { homeroomTeacherId: targetClass.homeroomTeacherId },
        });
        if (remainingClasses === 0) {
          await prisma.userRoleAssignment.deleteMany({
            where: {
              userId: targetClass.homeroomTeacherId,
              role: UserRole.WALI_KELAS,
            },
          });
        }
      } catch (roleErr) {
        console.error('Gagal mencabut peran WALI_KELAS saat deleteClass:', roleErr);
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: currentUser.id,
          action: 'DELETE_CLASS',
          entityName: 'Class',
          entityId: classId,
          oldValues: {
            name: targetClass.name,
            tierLevel: targetClass.tierLevel,
            organizationId: targetClass.organizationId,
            generationId: targetClass.generationId,
          },
        },
      });
    } catch (e) {
      console.error('Failed to write audit log for deleteClass:', e);
    }

    revalidatePath('/kelas');
    revalidatePath('/dashboard');
    return { success: true, message: `Kelas "${targetClass.name}" berhasil dihapus secara permanen.` };
  } catch (error: any) {
    console.error('Error deleting class:', error);
    return { success: false, message: error?.message || 'Gagal menghapus kelas karena kendala sistem.' };
  }
}
