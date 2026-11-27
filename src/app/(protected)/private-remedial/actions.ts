'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ScheduleType, TierLevel, ScheduleStatus, ApprovalStatus } from '@prisma/client';
import { getEffectiveAuthUser } from '@/lib/auth';
import { CACHE_TAGS } from '@/lib/cache';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { formatZodError } from '@/lib/security-utils';

const requestRemedialSchema = z.object({
  title: z
    .string({ required_error: 'Topik pengajian / materi remedial wajib diisi.' })
    .min(3, 'Topik pengajian minimal 3 karakter.')
    .max(200, 'Topik pengajian maksimal 200 karakter.')
    .trim(),
  venuePlaceName: z
    .string({ required_error: 'Tempat / ruang pengajian wajib diisi.' })
    .min(2, 'Nama tempat pengajian minimal 2 karakter.')
    .max(200, 'Nama tempat pengajian maksimal 200 karakter.')
    .trim(),
  startTime: z
    .string({ required_error: 'Waktu mulai wajib diisi.' })
    .min(1, 'Waktu mulai wajib diisi.'),
  endTime: z
    .string({ required_error: 'Waktu selesai wajib diisi.' })
    .min(1, 'Waktu selesai wajib diisi.'),
  teacherId: z.string().uuid('Ustadz pembimbing tidak valid.'),
  studentIds: z
    .array(z.string().uuid('ID santri tidak valid.'))
    .min(1, 'Pilih minimal 1 santri untuk bimbingan private.')
    .max(5, 'Kuota pengajian private dibatasi 1–5 santri per sesi.'),
});

const scheduleIdSchema = z.string().uuid('ID jadwal pengajian tidak valid.');

export async function requestPrivateRemedial(formData: FormData) {
  const { authUser: user, dbUser: userProfile, effectiveUserId } = await getEffectiveAuthUser();

  if (!user || !userProfile || !effectiveUserId) {
    return { error: 'Anda harus masuk untuk mengajukan pengajian private.' };
  }

  const roles = userProfile.roles.map((r) => r.role);
  const canPropose = roles.some((r) =>
    ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
  );
  if (!canPropose) {
    return {
      error:
        'Akses ditolak: Hanya Pengajar, Wali Kelas, atau Pengurus Wilayah yang berhak mengajukan jadwal private remedial.',
    };
  }

  const rawData = {
    title: formData.get('title') as string,
    venuePlaceName: formData.get('venuePlaceName') as string,
    startTime: formData.get('startTime') as string,
    endTime: formData.get('endTime') as string,
    teacherId: formData.get('teacherId') as string,
    studentIds: formData.getAll('studentIds') as string[],
  };

  const validation = requestRemedialSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: formatZodError(validation.error) };
  }

  const { title, venuePlaceName, startTime, endTime, teacherId, studentIds } = validation.data;

  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return { error: 'Format waktu mulai atau selesai tidak valid.' };
  }
  if (parsedEnd <= parsedStart) {
    return { error: 'Waktu selesai harus lebih akhir daripada waktu mulai.' };
  }

  if (!userProfile.organizationId) {
    return { error: 'Organisasi wilayah tidak ditemukan.' };
  }

  const baseScopedOrgIds = await getScopedOrganizationIds(roles, userProfile.organizationId);
  const scopedOrgIds =
    baseScopedOrgIds === null
      ? null
      : Array.from(
          new Set([
            ...baseScopedOrgIds,
            ...userProfile.homeroomClasses.map((c) => c.organizationId),
          ])
        );

  const uniqueStudentIds = Array.from(new Set(studentIds));

  // Validasi pengajar dan seluruh santri yang dipilih berada dalam lingkup wilayah binaan
  const [validTeacher, validStudentsCount] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: teacherId,
        status: 'ACTIVE',
        ...(scopedOrgIds !== null ? { organizationId: { in: scopedOrgIds } } : {}),
        roles: {
          some: {
            role: {
              in: ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'],
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.user.count({
      where: {
        id: { in: uniqueStudentIds },
        status: 'ACTIVE',
        ...(scopedOrgIds !== null ? { organizationId: { in: scopedOrgIds } } : {}),
        roles: { some: { role: 'SANTRI' } },
      },
    }),
  ]);

  if (!validTeacher) {
    return { error: 'Ustadz pembimbing tidak valid atau berada di luar wilayah binaan Anda.' };
  }

  if (validStudentsCount !== uniqueStudentIds.length) {
    return { error: 'Sebagian santri yang dipilih tidak valid atau berada di luar wilayah binaan Anda.' };
  }

  try {
    const schedule = await prisma.schedule.create({
      data: {
        title,
        scheduleType: ScheduleType.PRIVATE_REMEDIAL,
        tierLevel: TierLevel.KELOMPOK,
        organizationId: userProfile.organizationId,
        venuePlaceName,
        startTime: parsedStart,
        endTime: parsedEnd,
        maxStudentsQuota: 5,
        status: ScheduleStatus.SCHEDULED,
        requestedByUserId: effectiveUserId,
        requesterType: 'PENGAJAR',
        approvalStatus: ApprovalStatus.PENDING,
        teachers: {
          create: [
            {
              teacherId,
              isPrimary: true,
              isSubstitute: false,
            },
          ],
        },
      },
    });

    revalidateTag(CACHE_TAGS.UPCOMING_SCHEDULE);
    revalidatePath('/private-remedial');
    revalidatePath('/dashboard');
    return { success: true, scheduleId: schedule.id };
  } catch (err: any) {
    return { error: err.message || 'Gagal mengajukan jadwal private remedial.' };
  }
}

// PJ Approval Action: Setujui Jadwal Private
export async function approvePrivateRemedial(scheduleId: string) {
  const idValidation = scheduleIdSchema.safeParse(scheduleId);
  if (!idValidation.success) {
    return { error: formatZodError(idValidation.error) };
  }

  const { authUser: user, dbUser, effectiveUserId } = await getEffectiveAuthUser();

  if (!user || !dbUser || !effectiveUserId) {
    return { error: 'Anda harus masuk untuk menyetujui pengajuan.' };
  }

  const roles = dbUser.roles.map((r) => r.role);
  const isManager =
    roles.includes('ADMIN_MASTER') ||
    roles.includes('PJ_DAERAH') ||
    roles.includes('PJ_DESA') ||
    roles.includes('PJ_KELOMPOK');

  if (!isManager) {
    return { error: 'Akses ditolak: Hanya Pengelola / PJ yang berhak menyetujui pengajuan private remedial.' };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: idValidation.data },
    select: { id: true, scheduleType: true, organizationId: true },
  });

  if (!schedule || schedule.scheduleType !== ScheduleType.PRIVATE_REMEDIAL) {
    return { error: 'Pengajuan jadwal private remedial tidak ditemukan.' };
  }

  const scopedOrgIds = await getScopedOrganizationIds(roles, dbUser.organizationId || null);
  if (scopedOrgIds !== null && !scopedOrgIds.includes(schedule.organizationId)) {
    return { error: 'Akses ditolak: Pengajuan berada di luar wilayah binaan Anda.' };
  }

  try {
    await prisma.schedule.update({
      where: { id: idValidation.data },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedByPjId: effectiveUserId,
        status: ScheduleStatus.SCHEDULED,
      },
    });

    revalidateTag(CACHE_TAGS.UPCOMING_SCHEDULE);
    revalidatePath('/private-remedial');
    revalidatePath('/jadwal');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Gagal menyetujui pengajuan.' };
  }
}

// PJ Rejection Action: Tolak Jadwal Private
export async function rejectPrivateRemedial(scheduleId: string) {
  const idValidation = scheduleIdSchema.safeParse(scheduleId);
  if (!idValidation.success) {
    return { error: formatZodError(idValidation.error) };
  }

  const { authUser: user, dbUser, effectiveUserId } = await getEffectiveAuthUser();

  if (!user || !dbUser || !effectiveUserId) {
    return { error: 'Anda harus masuk untuk menolak pengajuan.' };
  }

  const roles = dbUser.roles.map((r) => r.role);
  const isManager =
    roles.includes('ADMIN_MASTER') ||
    roles.includes('PJ_DAERAH') ||
    roles.includes('PJ_DESA') ||
    roles.includes('PJ_KELOMPOK');

  if (!isManager) {
    return { error: 'Akses ditolak: Hanya Pengelola / PJ yang berhak menolak pengajuan private remedial.' };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: idValidation.data },
    select: { id: true, scheduleType: true, organizationId: true },
  });

  if (!schedule || schedule.scheduleType !== ScheduleType.PRIVATE_REMEDIAL) {
    return { error: 'Pengajuan jadwal private remedial tidak ditemukan.' };
  }

  const scopedOrgIds = await getScopedOrganizationIds(roles, dbUser.organizationId || null);
  if (scopedOrgIds !== null && !scopedOrgIds.includes(schedule.organizationId)) {
    return { error: 'Akses ditolak: Pengajuan berada di luar wilayah binaan Anda.' };
  }

  try {
    await prisma.schedule.update({
      where: { id: idValidation.data },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedByPjId: effectiveUserId,
        status: ScheduleStatus.CANCELLED,
      },
    });

    revalidateTag(CACHE_TAGS.UPCOMING_SCHEDULE);
    revalidatePath('/private-remedial');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Gagal menolak pengajuan.' };
  }
}
