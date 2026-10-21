'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ScheduleType, TierLevel, ScheduleStatus, ApprovalStatus } from '@prisma/client';
import { getEffectiveAuthUser } from '@/lib/auth';
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

  if (!user || !effectiveUserId) {
    return { error: 'Anda harus masuk untuk mengajukan pengajian private.' };
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

  if (!userProfile?.organizationId) {
    return { error: 'Organisasi wilayah tidak ditemukan.' };
  }

  try {
    const schedule = await prisma.schedule.create({
      data: {
        title,
        scheduleType: ScheduleType.PRIVATE_REMEDIAL,
        tierLevel: TierLevel.KELOMPOK,
        organizationId: userProfile.organizationId,
        venuePlaceName,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
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

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedByPjId: effectiveUserId,
        status: ScheduleStatus.SCHEDULED,
      },
    });

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

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedByPjId: effectiveUserId,
        status: ScheduleStatus.CANCELLED,
      },
    });

    revalidatePath('/private-remedial');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Gagal menolak pengajuan.' };
  }
}
