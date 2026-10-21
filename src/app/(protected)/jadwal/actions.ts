'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ScheduleType, TierLevel, ScheduleStatus, RollingTargetScope, UserRole, ApprovalStatus } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { getEffectiveAuthUser } from '@/lib/auth';
import { formatZodError } from '@/lib/security-utils';
import {
  notifyScheduleChangeIfHariH,
  broadcastScheduleReminder,
  checkScheduleChangeNotificationEligibility,
  getScheduleChangeNotificationPreview,
  dispatchConfirmedScheduleChangeNotification,
} from '@/lib/whatsapp/scheduleNotificationService';

const scheduleIdSchema = z.string().uuid('ID jadwal tidak valid.');
const substituteTeacherIdSchema = z.string().uuid('ID ustadz badal tidak valid.');
const rejectionReasonSchema = z.string().min(1, 'Alasan penolakan pengajuan jadwal wajib diisi.').max(500);
const notesSchema = z.string().max(1000).optional().nullable();
const updateStatusSchema = z.nativeEnum(ScheduleStatus, {
  errorMap: () => ({ message: 'Status jadwal tidak valid.' }),
});
const confirmNotificationSchema = z.object({
  scheduleId: z.string().uuid('ID jadwal tidak valid.'),
  changeDescription: z.string().min(1, 'Deskripsi perubahan wajib diisi.'),
});

const createScheduleSchema = z.object({
  title: z.string({ required_error: 'Judul wajib diisi.' }).min(1, 'Judul wajib diisi.').max(150),
  venuePlaceName: z.string({ required_error: 'Tempat wajib diisi.' }).min(1, 'Tempat wajib diisi.').max(150),
  venueType: z.string().default('MASJID'),
  startTime: z.string({ required_error: 'Waktu mulai wajib diisi.' }),
  endTime: z.string({ required_error: 'Waktu selesai wajib diisi.' }),
  primaryTeacherId: z.string({ required_error: 'Ustadz utama wajib diisi.' }).uuid('ID Ustadz utama tidak valid.'),
  substituteTeacherId: z.string().uuid().optional().nullable().or(z.literal('')),
  targetScope: z.nativeEnum(RollingTargetScope).default(RollingTargetScope.WILAYAH_UMUM),
  organizationId: z.string().uuid().optional().nullable().or(z.literal('')),
  notes: z.string().max(1000).optional().nullable(),
  isRecurringWeekly: z.boolean().default(false),
  recurringWeeks: z.number().int().min(1).max(12).default(4),
});

const updateScheduleSchema = z.object({
  scheduleId: z.string().uuid('ID jadwal tidak valid.'),
  title: z.string({ required_error: 'Judul wajib diisi.' }).min(1, 'Judul wajib diisi.').max(150),
  venuePlaceName: z.string({ required_error: 'Tempat wajib diisi.' }).min(1, 'Tempat wajib diisi.').max(150),
  venueType: z.string().default('MASJID'),
  startTime: z.string({ required_error: 'Waktu mulai wajib diisi.' }),
  endTime: z.string({ required_error: 'Waktu selesai wajib diisi.' }),
  primaryTeacherId: z.string({ required_error: 'Ustadz utama wajib diisi.' }).uuid('ID Ustadz utama tidak valid.'),
  substituteTeacherId: z.string().uuid().optional().nullable().or(z.literal('')),
  targetScope: z.nativeEnum(RollingTargetScope).default(RollingTargetScope.WILAYAH_UMUM),
  status: z.nativeEnum(ScheduleStatus).default(ScheduleStatus.SCHEDULED),
  notes: z.string().max(1000).optional().nullable(),
});

function parseArrayField(formData: FormData, fieldName: string): string[] {
  const val = formData.get(fieldName) as string;
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.filter((x): x is string => typeof x === 'string' && x.trim() !== '')));
    }
  } catch {
    // fallback comma separated
  }
  return Array.from(new Set(val.split(',').map((s) => s.trim()).filter(Boolean)));
}

export async function createSchedule(formData: FormData) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk membuat jadwal.' };
  }

  let selectedTeacherIds = parseArrayField(formData, 'selectedTeacherIds');
  let primaryTeacherId = (formData.get('primaryTeacherId') as string)?.trim();

  if (!primaryTeacherId && selectedTeacherIds.length > 0) {
    primaryTeacherId = selectedTeacherIds[0];
  } else if (primaryTeacherId && !selectedTeacherIds.includes(primaryTeacherId)) {
    selectedTeacherIds.unshift(primaryTeacherId);
  }

  const rawInput = {
    title: (formData.get('title') as string)?.trim(),
    venuePlaceName: (formData.get('venuePlaceName') as string)?.trim(),
    venueType: (formData.get('venueType') as string) || 'MASJID',
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string,
    primaryTeacherId,
    substituteTeacherId: (formData.get('substituteTeacherId') as string)?.trim() || null,
    targetScope: ((formData.get('targetScope') as string) || 'WILAYAH_UMUM') as RollingTargetScope,
    organizationId: (formData.get('organizationId') as string)?.trim() || null,
    notes: (formData.get('notes') as string)?.trim() || null,
    isRecurringWeekly: formData.get('isRecurringWeekly') === 'true',
    recurringWeeks: parseInt((formData.get('recurringWeeks') as string) || '4', 10),
  };

  const validation = createScheduleSchema.safeParse(rawInput);
  if (!validation.success) {
    return { error: formatZodError(validation.error) };
  }

  const {
    title,
    venuePlaceName,
    venueType,
    startTime: startTimeStr,
    endTime: endTimeStr,
    substituteTeacherId,
    targetScope,
    notes,
    isRecurringWeekly,
    recurringWeeks,
  } = validation.data;

  // Target Scope & Target Items
  const selectedClassIds = parseArrayField(formData, 'selectedClassIds');
  const selectedGenerationIds = parseArrayField(formData, 'selectedGenerationIds');
  const selectedMaterialIds = parseArrayField(formData, 'selectedMaterialIds').slice(0, 3); // Maks. 3 materi

  // Jenis kegiatan default REGULAR_ROUTINE
  const scheduleType = ScheduleType.REGULAR_ROUTINE;

  const startDate = new Date(startTimeStr);
  const endDate = new Date(endTimeStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: 'Format tanggal dan waktu tidak valid.' };
  }

  if (endDate <= startDate) {
    return { error: 'Waktu selesai harus lebih lambat dari waktu mulai.' };
  }

  if (!userProfile?.organizationId) {
    return { error: 'Anda belum terdaftar dalam organisasi wilayah.' };
  }

  // Validasi wewenang organisasi target
  const roleCodes = userProfile.roles.map((r) => r.role) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));
  const isTeacher = roleCodes.includes('PENGAJAR');
  const isWaliKelas = roleCodes.includes('WALI_KELAS');

  if (!isManager && !isTeacher && !isWaliKelas) {
    return { error: 'Hanya pengurus wilayah, pengajar, atau wali kelas yang dapat membuat/mengajukan jadwal pengajian.' };
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile.organizationId);

  let targetOrganizationId = (formData.get('organizationId') as string)?.trim();
  if (!targetOrganizationId) {
    targetOrganizationId = userProfile.organizationId;
  }

  if (scopedOrgIds !== null && !scopedOrgIds.includes(targetOrganizationId)) {
    return { error: 'Anda tidak memiliki hak akses untuk membuat jadwal pada unit wilayah tersebut.' };
  }

  const targetOrg = await prisma.organization.findUnique({
    where: { id: targetOrganizationId },
    select: { id: true, type: true, name: true },
  });

  if (!targetOrg) {
    return { error: 'Organisasi wilayah sasaran tidak ditemukan.' };
  }

  const tierLevel = (targetOrg.type as TierLevel) || TierLevel.KELOMPOK;

  // Konfigurasi status persetujuan berdasarkan peran pembuat:
  // - PJ Wilayah: langsung APPROVED
  // - Pengajar / Wali Kelas: status PENDING untuk diverifikasi oleh PJ Wilayah
  const approvalStatus = isManager ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
  const requestedByUserId = isManager ? null : user.id;
  const requesterType = isManager ? null : isWaliKelas ? 'WALI_KELAS' : 'PENGAJAR';
  const approvedByPjId = isManager ? user.id : null;

  try {
    const weeksToGenerate = isRecurringWeekly ? Math.min(Math.max(recurringWeeks, 1), 12) : 1;
    const durationMs = endDate.getTime() - startDate.getTime();

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < weeksToGenerate; i++) {
        const sessionStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const sessionEnd = new Date(sessionStart.getTime() + durationMs);

        // Susun daftar guru pengampu
        const teacherCreations: { teacherId: string; isPrimary: boolean; isSubstitute: boolean }[] = [];
        for (const tId of selectedTeacherIds) {
          teacherCreations.push({
            teacherId: tId,
            isPrimary: tId === primaryTeacherId,
            isSubstitute: false,
          });
        }

        // Tambahkan badal jika ada
        if (substituteTeacherId && !selectedTeacherIds.includes(substituteTeacherId)) {
          teacherCreations.push({
            teacherId: substituteTeacherId,
            isPrimary: false,
            isSubstitute: true,
          });
        }

        const sch = await tx.schedule.create({
          data: {
            title,
            scheduleType,
            tierLevel,
            targetScope,
            organizationId: targetOrganizationId,
            classId: selectedClassIds[0] || undefined,
            venuePlaceName,
            venueType,
            startTime: sessionStart,
            endTime: sessionEnd,
            recurringRule: isRecurringWeekly ? 'FREQ=WEEKLY;INTERVAL=1' : undefined,
            status: ScheduleStatus.SCHEDULED,
            notes,
            approvalStatus,
            requestedByUserId,
            requesterType,
            approvedByPjId,
            teachers: {
              create: teacherCreations,
            },
          },
        });

        // Simpan relasi multi-kelas jika target scope KELAS
        if (targetScope === RollingTargetScope.KELAS && selectedClassIds.length > 0) {
          await tx.scheduleClass.createMany({
            data: selectedClassIds.map((cId) => ({
              scheduleId: sch.id,
              classId: cId,
            })),
            skipDuplicates: true,
          });
        }

        // Simpan relasi multi-jenjang jika target scope GENERASI
        if (targetScope === RollingTargetScope.GENERASI && selectedGenerationIds.length > 0) {
          await tx.scheduleGeneration.createMany({
            data: selectedGenerationIds.map((gId) => ({
              scheduleId: sch.id,
              generationId: gId,
            })),
            skipDuplicates: true,
          });
        }

        // Simpan relasi materi pengajian (maks 3)
        if (selectedMaterialIds.length > 0) {
          await tx.scheduleMaterial.createMany({
            data: selectedMaterialIds.map((mId, idx) => ({
              scheduleId: sch.id,
              materialId: mId,
              slotIndex: idx,
            })),
            skipDuplicates: true,
          });
        }

        createdIds.push(sch.id);
      }
    });

    revalidatePath('/jadwal');
    revalidatePath('/dashboard');
    return {
      success: true,
      count: createdIds.length,
      message: !isManager
        ? 'Pengajuan jadwal pengajian berhasil dikirim. Menunggu peninjauan dan persetujuan PJ Wilayah.'
        : createdIds.length > 1
          ? `Berhasil membuat ${createdIds.length} sesi pengajian rutin mingguan.`
          : 'Berhasil membuat jadwal pengajian baru.',
    };
  } catch (err: any) {
    console.error('Error in createSchedule:', err);
    return { error: err.message || 'Gagal menyimpan jadwal pengajian.' };
  }
}

export async function updateSchedule(formData: FormData) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mengedit jadwal.' };
  }

  let selectedTeacherIds = parseArrayField(formData, 'selectedTeacherIds');
  let primaryTeacherId = (formData.get('primaryTeacherId') as string)?.trim();

  if (!primaryTeacherId && selectedTeacherIds.length > 0) {
    primaryTeacherId = selectedTeacherIds[0];
  } else if (primaryTeacherId && !selectedTeacherIds.includes(primaryTeacherId)) {
    selectedTeacherIds.unshift(primaryTeacherId);
  }

  const rawInput = {
    scheduleId: (formData.get('scheduleId') as string)?.trim(),
    title: (formData.get('title') as string)?.trim(),
    venuePlaceName: (formData.get('venuePlaceName') as string)?.trim(),
    venueType: (formData.get('venueType') as string) || 'MASJID',
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string,
    primaryTeacherId,
    substituteTeacherId: (formData.get('substituteTeacherId') as string)?.trim() || null,
    targetScope: ((formData.get('targetScope') as string) || 'WILAYAH_UMUM') as RollingTargetScope,
    status: (formData.get('status') as ScheduleStatus) || ScheduleStatus.SCHEDULED,
    notes: (formData.get('notes') as string)?.trim() || null,
  };

  const validation = updateScheduleSchema.safeParse(rawInput);
  if (!validation.success) {
    return { error: formatZodError(validation.error) };
  }

  const {
    scheduleId,
    title,
    venuePlaceName,
    venueType,
    startTime: startTimeStr,
    endTime: endTimeStr,
    substituteTeacherId,
    targetScope,
    status,
    notes,
  } = validation.data;

  // Target Scope & Target Items
  const selectedClassIds = parseArrayField(formData, 'selectedClassIds');
  const selectedGenerationIds = parseArrayField(formData, 'selectedGenerationIds');
  const selectedMaterialIds = parseArrayField(formData, 'selectedMaterialIds').slice(0, 3); // Maks. 3 materi

  const startDate = new Date(startTimeStr);
  const endDate = new Date(endTimeStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { error: 'Format tanggal dan waktu tidak valid.' };
  }

  if (endDate <= startDate) {
    return { error: 'Waktu selesai harus lebih lambat dari waktu mulai.' };
  }

  const existingSchedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      organizationId: true,
      approvalStatus: true,
      requestedByUserId: true,
      startTime: true,
    },
  });

  if (!existingSchedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  const roleCodes = (userProfile?.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));

  // Validasi pembatasan akses Pengajar / Wali Kelas:
  // Hanya PJ yang boleh mengedit jadwal resmi. Pengajar hanya boleh mengedit pengajuan miliknya yang masih PENDING.
  if (!isManager) {
    const isOwner = existingSchedule.requestedByUserId === user.id;
    const isPending = existingSchedule.approvalStatus === ApprovalStatus.PENDING;
    if (!isOwner || !isPending) {
      return {
        error:
          'Anda tidak memiliki izin untuk mengedit jadwal resmi wilayah. Pengajar hanya dapat memperbarui pengajuan jadwal miliknya yang masih berstatus menunggu persetujuan.',
      };
    }
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile?.organizationId || null);

  let targetOrganizationId = (formData.get('organizationId') as string)?.trim();
  if (targetOrganizationId && scopedOrgIds !== null && !scopedOrgIds.includes(targetOrganizationId)) {
    return { error: 'Anda tidak memiliki hak akses untuk memindahkan jadwal ke unit wilayah tersebut.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Cek organisasi & tier level
      let updateOrgData: { organizationId?: string; tierLevel?: TierLevel } = {};
      if (targetOrganizationId) {
        const targetOrg = await tx.organization.findUnique({
          where: { id: targetOrganizationId },
          select: { id: true, type: true },
        });
        if (targetOrg) {
          updateOrgData = {
            organizationId: targetOrg.id,
            tierLevel: targetOrg.type as TierLevel,
          };
        }
      }

      // 2. Update master data schedule
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          title,
          ...updateOrgData,
          targetScope,
          classId: selectedClassIds[0] || null,
          venuePlaceName,
          venueType,
          startTime: startDate,
          endTime: endDate,
          status: isManager ? status : ScheduleStatus.SCHEDULED,
          notes,
        },
      });

      // 3. Sync Target Classes
      await tx.scheduleClass.deleteMany({
        where: { scheduleId },
      });
      if (targetScope === RollingTargetScope.KELAS && selectedClassIds.length > 0) {
        await tx.scheduleClass.createMany({
          data: selectedClassIds.map((cId) => ({
            scheduleId,
            classId: cId,
          })),
          skipDuplicates: true,
        });
      }

      // 4. Sync Target Generations
      await tx.scheduleGeneration.deleteMany({
        where: { scheduleId },
      });
      if (targetScope === RollingTargetScope.GENERASI && selectedGenerationIds.length > 0) {
        await tx.scheduleGeneration.createMany({
          data: selectedGenerationIds.map((gId) => ({
            scheduleId,
            generationId: gId,
          })),
          skipDuplicates: true,
        });
      }

      // 5. Sync Schedule Materials (maks 3)
      await tx.scheduleMaterial.deleteMany({
        where: { scheduleId },
      });
      if (selectedMaterialIds.length > 0) {
        await tx.scheduleMaterial.createMany({
          data: selectedMaterialIds.map((mId, idx) => ({
            scheduleId,
            materialId: mId,
            slotIndex: idx,
          })),
          skipDuplicates: true,
        });
      }

      // 6. Sync Teachers
      await tx.scheduleTeacher.deleteMany({
        where: { scheduleId },
      });

      const teacherCreations: { scheduleId: string; teacherId: string; isPrimary: boolean; isSubstitute: boolean }[] = [];
      for (const tId of selectedTeacherIds) {
        teacherCreations.push({
          scheduleId,
          teacherId: tId,
          isPrimary: tId === primaryTeacherId,
          isSubstitute: false,
        });
      }

      if (substituteTeacherId && !selectedTeacherIds.includes(substituteTeacherId)) {
        teacherCreations.push({
          scheduleId,
          teacherId: substituteTeacherId,
          isPrimary: false,
          isSubstitute: true,
        });
      }

      if (teacherCreations.length > 0) {
        await tx.scheduleTeacher.createMany({
          data: teacherCreations,
          skipDuplicates: true,
        });
      }
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${scheduleId}`);
    revalidatePath('/dashboard');

    // Evaluasi Aturan 5 Jam untuk Notifikasi Perubahan Jadwal:
    // 1. Jadwal lama belum terlewat lebih dari 5 jam (now - oldStartTime <= 5 jam)
    // 2. Perubahan terjadi minimal 5 jam sebelum waktu jadwal baru (newStartTime - now >= 5 jam)
    const eligibility = checkScheduleChangeNotificationEligibility(
      existingSchedule.startTime,
      startDate
    );

    if (eligibility.isEligible) {
      const changeDesc = `Pembaruan jadwal: Waktu ${startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB di ${venuePlaceName}.${notes ? ` Catatan: ${notes}` : ''}`;

      const notificationData = await getScheduleChangeNotificationPreview({
        scheduleId,
        changeDescription: changeDesc,
        isUrgentShortNotice: eligibility.isUrgentShortNotice,
        warningMessage: eligibility.warningMessage,
      });

      if (notificationData) {
        return {
          success: true,
          needsConfirmation: true,
          notificationData,
          message: 'Jadwal pengajian berhasil diperbarui.',
        };
      }
    }

    return {
      success: true,
      needsConfirmation: false,
      message: 'Jadwal pengajian berhasil diperbarui.',
    };
  } catch (err: any) {
    console.error('Error in updateSchedule:', err);
    return { error: err.message || 'Gagal memperbarui jadwal pengajian.' };
  }
}

export async function deleteSchedule(scheduleId: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk menghapus jadwal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;

  const existingSchedule = await prisma.schedule.findUnique({
    where: { id: validatedScheduleId },
    select: {
      id: true,
      organizationId: true,
      approvalStatus: true,
      requestedByUserId: true,
    },
  });

  if (!existingSchedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  const roleCodes = (userProfile?.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));

  // Validasi pembatasan akses Pengajar / Wali Kelas:
  // Hanya PJ yang boleh menghapus jadwal wilayah. Pengajar hanya boleh membatalkan pengajuan miliknya yang masih PENDING.
  if (!isManager) {
    const isOwner = existingSchedule.requestedByUserId === user.id;
    const isPending = existingSchedule.approvalStatus === ApprovalStatus.PENDING;
    if (!isOwner || !isPending) {
      return {
        error:
          'Anda tidak memiliki izin untuk menghapus jadwal pengajian resmi wilayah. Pengajar hanya dapat membatalkan pengajuan jadwal miliknya yang masih berstatus menunggu persetujuan.',
      };
    }
  }

  try {
    // Periksa apakah jadwal ini memiliki catatan presensi santri
    const attendanceCount = await prisma.attendanceRecord.count({
      where: {
        session: {
          scheduleId,
        },
      },
    });

    if (attendanceCount > 0) {
      return {
        error:
          'Jadwal ini sudah memiliki riwayat presensi santri. Untuk menjaga integritas data absensi, silakan ubah status sesi menjadi DIBATALKAN alih-alih menghapusnya.',
      };
    }

    await prisma.schedule.delete({
      where: { id: scheduleId },
    });

    revalidatePath('/jadwal');
    revalidatePath('/dashboard');
    return { success: true, message: 'Jadwal pengajian berhasil dihapus.' };
  } catch (err: any) {
    console.error('Error in deleteSchedule:', err);
    return { error: err.message || 'Gagal menghapus jadwal pengajian.' };
  }
}

export async function updateScheduleStatus(scheduleId: string, status: ScheduleStatus) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mengubah status jadwal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const parsedStatus = updateStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { error: 'Status baru wajib ditentukan dan harus valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;
  const validatedStatus = parsedStatus.data;

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));

  // Hanya PJ Wilayah yang boleh mengubah status sesi
  if (!isManager) {
    return { error: 'Hanya PJ Wilayah yang berwenang mengubah status sesi pengajian.' };
  }

  try {
    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, startTime: true, status: true, title: true },
    });

    if (!existing) {
      return { error: 'Jadwal tidak ditemukan.' };
    }

    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status },
    });

    // Jika sesi pengajian ditandai selesai atau dibatalkan, nonaktifkan seluruh sesi presensi terkait
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      await prisma.attendanceSession.updateMany({
        where: { scheduleId, isActive: true },
        data: { isActive: false, closedAt: new Date() },
      });
    }

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${scheduleId}`);
    revalidatePath('/presensi');
    revalidatePath('/dashboard');

    // Evaluasi aturan 5 jam untuk notifikasi perubahan status:
    // 1. Jadwal belum terlewat lebih dari 5 jam
    // 2. Perubahan terjadi minimal 5 jam sebelum waktu jadwal baru
    const eligibility = checkScheduleChangeNotificationEligibility(
      existing.startTime,
      existing.startTime
    );

    if (eligibility.isEligible && (status === 'CANCELLED' || status === 'SCHEDULED' || status === 'ACTIVE')) {
      const changeDesc =
        status === 'CANCELLED'
          ? 'PENGUMUMAN: Sesi pengajian pada hari ini DILIBURKAN / DIBATALKAN.'
          : `Pembaruan status sesi pengajian menjadi: ${status === 'ACTIVE' ? 'Sedang Berlangsung' : 'Terjadwal'}.`;

      const notificationData = await getScheduleChangeNotificationPreview({
        scheduleId,
        changeDescription: changeDesc,
        isUrgentShortNotice: eligibility.isUrgentShortNotice,
        warningMessage: eligibility.warningMessage,
      });

      if (notificationData) {
        return {
          success: true,
          status,
          needsConfirmation: true,
          notificationData,
        };
      }
    }

    return { success: true, status, needsConfirmation: false };
  } catch (err: any) {
    console.error('Error in updateScheduleStatus:', err);
    return { error: err.message || 'Gagal mengubah status jadwal.' };
  }
}

/**
 * Server action untuk mengeksekusi pengiriman notifikasi perubahan jadwal
 * setelah dikonfirmasi oleh Admin melalui modal konfirmasi
 */
export async function confirmAndDispatchScheduleChangeNotification(params: {
  scheduleId: string;
  changeDescription: string;
}) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mengirimkan notifikasi.' };
  }

  const validation = confirmNotificationSchema.safeParse(params);
  if (!validation.success) {
    return { error: formatZodError(validation.error) };
  }

  const { scheduleId, changeDescription } = validation.data;

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) =>
    ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r)
  );

  if (!isManager) {
    return {
      error:
        'Hanya Pengurus Wilayah yang berwenang mengirimkan notifikasi siaran pembaruan jadwal.',
    };
  }

  try {
    const result = await dispatchConfirmedScheduleChangeNotification({
      scheduleId,
      changeDescription,
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${scheduleId}`);
    revalidatePath('/dashboard');

    return result;
  } catch (err: any) {
    console.error('Error in confirmAndDispatchScheduleChangeNotification:', err);
    return { error: err.message || 'Gagal mengirim notifikasi perubahan jadwal.' };
  }
}

// Delegasi Badal Pengajar (Substitute Teacher)
// Boleh dilakukan oleh PJ Wilayah ATAU Ustadz Pengampu / Wali Kelas pada sesi terkait
export async function assignSubstituteTeacher(scheduleId: string, substituteTeacherId: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mendelegasikan badal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const parsedSubstituteId = substituteTeacherIdSchema.safeParse(substituteTeacherId);
  if (!parsedSubstituteId.success) {
    return { error: 'ID ustadz badal tidak valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;
  const validatedSubstituteId = parsedSubstituteId.data;

  const schedule = await prisma.schedule.findUnique({
    where: { id: validatedScheduleId },
    include: {
      teachers: true,
      class: true,
      targetClasses: { include: { class: true } },
    },
  });

  if (!schedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));
  const isAssignedTeacher = schedule.teachers.some((t) => t.teacherId === user.id);
  const isHomeroomTeacher =
    schedule.class?.homeroomTeacherId === user.id ||
    schedule.targetClasses.some((tc) => tc.class?.homeroomTeacherId === user.id);

  if (!isManager && !isAssignedTeacher && !isHomeroomTeacher) {
    return {
      error:
        'Anda tidak memiliki wewenang untuk mendelegasikan badal pada sesi ini. Fitur ini hanya untuk pengajar pengampu sesi, wali kelas binaan, atau pengurus wilayah.',
    };
  }

  // Validasi: Pengajar utama tidak boleh ditugaskan sebagai badal untuk jadwalnya sendiri
  if (schedule.teachers.some((t) => t.isPrimary && t.teacherId === substituteTeacherId)) {
    return { error: 'Pengajar utama tidak dapat ditugaskan sebagai guru badal pada sesi jadwalnya sendiri.' };
  }

  try {
    // Hapus badal lain jika ada (selain guru yang baru ditugaskan)
    await prisma.scheduleTeacher.deleteMany({
      where: {
        scheduleId,
        isSubstitute: true,
        teacherId: { not: substituteTeacherId },
      },
    });

    // Gunakan upsert agar tidak melanggar unique constraint jika guru sebelumnya terdaftar sebagai pendamping
    await prisma.scheduleTeacher.upsert({
      where: {
        scheduleId_teacherId: {
          scheduleId,
          teacherId: substituteTeacherId,
        },
      },
      update: {
        isPrimary: false,
        isSubstitute: true,
      },
      create: {
        scheduleId,
        teacherId: substituteTeacherId,
        isPrimary: false,
        isSubstitute: true,
      },
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${scheduleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Ustadz badal berhasil didelegasikan.' };
  } catch (err: any) {
    return { error: err.message || 'Gagal mendelegasikan ustadz badal.' };
  }
}

// Batalkan atau Cabut Badal Pengajar
// Boleh dilakukan oleh PJ Wilayah ATAU Ustadz Pengampu / Wali Kelas pada sesi terkait
export async function removeSubstituteTeacher(scheduleId: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mencabut badal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;

  const schedule = await prisma.schedule.findUnique({
    where: { id: validatedScheduleId },
    include: {
      teachers: true,
      class: true,
      targetClasses: { include: { class: true } },
    },
  });

  if (!schedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));
  const isAssignedTeacher = schedule.teachers.some((t) => t.teacherId === user.id);
  const isHomeroomTeacher =
    schedule.class?.homeroomTeacherId === user.id ||
    schedule.targetClasses.some((tc) => tc.class?.homeroomTeacherId === user.id);

  if (!isManager && !isAssignedTeacher && !isHomeroomTeacher) {
    return {
      error:
        'Anda tidak memiliki wewenang untuk mencabut badal pada sesi ini. Fitur ini hanya untuk pengajar pengampu sesi, wali kelas binaan, atau pengurus wilayah.',
    };
  }

  try {
    await prisma.scheduleTeacher.deleteMany({
      where: {
        scheduleId,
        isSubstitute: true,
      },
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${scheduleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Delegasi badal berhasil dicabut.' };
  } catch (err: any) {
    return { error: err.message || 'Gagal mencabut badal pengajar.' };
  }
}

// Persetujuan Pengajuan Jadwal oleh PJ Wilayah
export async function approveScheduleProposal(scheduleId: string, notes?: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk menyetujui pengajuan jadwal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const parsedNotes = notesSchema.safeParse(notes);
  if (!parsedNotes.success) {
    return { error: 'Catatan persetujuan tidak valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;
  const validatedNotes = parsedNotes.data;

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));

  if (!isManager) {
    return { error: 'Hanya PJ Wilayah yang berwenang menyetujui pengajuan jadwal.' };
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile.organizationId || null);

  const schedule = await prisma.schedule.findUnique({
    where: { id: validatedScheduleId },
    select: { id: true, organizationId: true, approvalStatus: true, notes: true },
  });

  if (!schedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  if (scopedOrgIds !== null && !scopedOrgIds.includes(schedule.organizationId)) {
    return { error: 'Anda tidak memiliki wewenang untuk menyetujui jadwal di unit wilayah ini.' };
  }

  try {
    const updatedNotes = validatedNotes?.trim()
      ? schedule.notes
        ? `${schedule.notes}\n[Catatan Persetujuan PJ]: ${validatedNotes.trim()}`
        : `[Catatan Persetujuan PJ]: ${validatedNotes.trim()}`
      : undefined;

    await prisma.schedule.update({
      where: { id: validatedScheduleId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedByPjId: user.id,
        notes: updatedNotes,
      },
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${validatedScheduleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Pengajuan jadwal pengajian berhasil disetujui dan kini aktif.' };
  } catch (err: any) {
    console.error('Error in approveScheduleProposal:', err);
    return { error: err.message || 'Gagal menyetujui pengajuan jadwal.' };
  }
}

// Penolakan Pengajuan Jadwal oleh PJ Wilayah
export async function rejectScheduleProposal(scheduleId: string, rejectionReason: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk menolak pengajuan jadwal.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const parsedReason = rejectionReasonSchema.safeParse(rejectionReason);
  if (!parsedReason.success) {
    return { error: formatZodError(parsedReason.error) };
  }

  const validatedScheduleId = parsedScheduleId.data;
  const validatedReason = parsedReason.data;

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));

  if (!isManager) {
    return { error: 'Hanya PJ Wilayah yang berwenang menolak pengajuan jadwal.' };
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile.organizationId || null);

  const schedule = await prisma.schedule.findUnique({
    where: { id: validatedScheduleId },
    select: { id: true, organizationId: true, notes: true },
  });

  if (!schedule) {
    return { error: 'Jadwal pengajian tidak ditemukan.' };
  }

  if (scopedOrgIds !== null && !scopedOrgIds.includes(schedule.organizationId)) {
    return { error: 'Anda tidak memiliki wewenang untuk menolak jadwal di unit wilayah ini.' };
  }

  try {
    const trimmedReason = validatedReason.trim();
    const updatedNotes = schedule.notes
      ? `${schedule.notes}\n[Alasan Penolakan PJ]: ${trimmedReason}`
      : `[Alasan Penolakan PJ]: ${trimmedReason}`;

    await prisma.schedule.update({
      where: { id: validatedScheduleId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedByPjId: user.id,
        notes: updatedNotes,
      },
    });

    revalidatePath('/jadwal');
    revalidatePath(`/jadwal/${validatedScheduleId}`);
    revalidatePath('/dashboard');
    return { success: true, message: 'Pengajuan jadwal berhasil ditolak.' };
  } catch (err: any) {
    console.error('Error in rejectScheduleProposal:', err);
    return { error: err.message || 'Gagal menolak pengajuan jadwal.' };
  }
}

/**
 * Server Action: Siaran / Broadcast Pengingat WhatsApp On-Demand oleh PJ / Pengajar
 */
export async function broadcastScheduleReminderAction(scheduleId: string) {
  const { authUser: user, dbUser: userProfile } = await getEffectiveAuthUser();

  if (!user || !userProfile) {
    return { error: 'Anda harus masuk untuk mengirimkan siaran pengingat.' };
  }

  const parsedScheduleId = scheduleIdSchema.safeParse(scheduleId);
  if (!parsedScheduleId.success) {
    return { error: 'ID jadwal tidak valid.' };
  }

  const validatedScheduleId = parsedScheduleId.data;

  const roleCodes = (userProfile.roles.map((r) => r.role) || []) as UserRole[];
  const isManager = roleCodes.some((r) => ['PJ_DAERAH', 'ADMIN_MASTER', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r));
  const isTeacher = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');

  if (!isManager && !isTeacher) {
    return { error: 'Hanya Pengurus Wilayah atau Pengajar yang berwenang mengirim siaran pengingat WhatsApp.' };
  }

  try {
    const result = await broadcastScheduleReminder(validatedScheduleId);
    return result;
  } catch (err: any) {
    console.error('Error in broadcastScheduleReminderAction:', err);
    return { error: err.message || 'Gagal mengirimkan siaran pengingat WhatsApp.' };
  }
}

