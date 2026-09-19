'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ScheduleType, TierLevel, ScheduleStatus, ApprovalStatus } from '@prisma/client';

export async function requestPrivateRemedial(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus masuk untuk mengajukan pengajian private.' };
  }

  const title = formData.get('title') as string;
  const venuePlaceName = formData.get('venuePlaceName') as string;
  const startTimeStr = formData.get('startTime') as string;
  const endTimeStr = formData.get('endTime') as string;
  const teacherId = formData.get('teacherId') as string;
  const studentIds = formData.getAll('studentIds') as string[];

  if (!title || !venuePlaceName || !startTimeStr || !endTimeStr || !teacherId) {
    return { error: 'Semua informasi jadwal wajib diisi.' };
  }

  // Enforce Kuota 1-5 Santri (Blueprint Section 5.3)
  if (studentIds.length < 1 || studentIds.length > 5) {
    return {
      error: `Kuota pengajian private dibatasi 1–5 santri per sesi untuk menjamin efektivitas (Terpilih: ${studentIds.length} santri).`,
    };
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
  });

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
        startTime: new Date(startTimeStr),
        endTime: new Date(endTimeStr),
        maxStudentsQuota: 5,
        status: ScheduleStatus.SCHEDULED,
        requestedByUserId: user.id,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus masuk untuk menyetujui pengajuan.' };
  }

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        approvedByPjId: user.id,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus masuk untuk menolak pengajuan.' };
  }

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        approvedByPjId: user.id,
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
