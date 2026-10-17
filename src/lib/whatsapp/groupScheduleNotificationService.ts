import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import {
  sendGroupScheduleReminderH1,
  sendGroupWeeklyScheduleDigest,
} from './triggers';
import { formatIndonesianDate, formatTime } from './scheduleNotificationService';
import { ScheduleStatus, ApprovalStatus } from '@prisma/client';

/**
 * Menghitung rentang hari Senin s/d Ahad dalam Waktu Indonesia Barat (WIB / UTC+7)
 * Jika hari ini adalah Ahad (Sunday), secara otomatis menghitung pekan depan (Senin esok s/d Ahad depan).
 * Jika hari Senin - Sabtu, menghitung pekan berjalan (Senin pekan ini s/d Ahad pekan ini).
 */
export function getUpcomingWeekRangeWIB(referenceDate = new Date()): {
  weekStart: Date;
  weekEnd: Date;
  periodLabel: string;
  weekKey: string;
} {
  // Hitung tanggal dalam zona waktu Asia/Jakarta
  const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [yearStr, monthStr, dayStr] = jakartaFormatter.format(referenceDate).split('-');
  const nowJakarta = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  const dayOfWeek = nowJakarta.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  let daysUntilMonday = 0;
  if (dayOfWeek === 0) {
    // Hari ini Ahad -> Target pekan depan (mulai besok Senin)
    daysUntilMonday = 1;
  } else {
    // Hari Senin s/d Sabtu -> Target pekan ini (mulai Senin kemarin/hari ini)
    daysUntilMonday = 1 - dayOfWeek;
  }

  const startUtcMs = nowJakarta.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000;
  // Waktu Senin 00:00:00 WIB adalah UTC Minggu 17:00:00
  const weekStart = new Date(startUtcMs - 7 * 60 * 60 * 1000);
  // Waktu Ahad 23:59:59.999 WIB adalah weekStart + 7 hari - 1ms
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  // Label Periode: Contoh "19 Oktober - 25 Oktober 2026"
  const startDay = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(weekStart);

  const endDay = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(weekEnd);

  const periodLabel = `${startDay} - ${endDay}`;

  // Key unik identifikasi pekan untuk Redis idempotency (contoh: 2026-10-19)
  const mondayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date(weekStart.getTime() + 8 * 60 * 60 * 1000));
  const weekKey = `w_${mondayIso}`;

  return { weekStart, weekEnd, periodLabel, weekKey };
}

/**
 * Mengirimkan pesan pengingat sesi pengajian H-1 ke Grup WhatsApp Jenjang terkait
 */
export async function dispatchGroupScheduleReminderH1(scheduleId: string): Promise<{
  success: boolean;
  sentCount: number;
  skippedCount: number;
  details: Array<{ generationName: string; groupId: string; status: string; error?: string }>;
}> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      organization: true,
      class: {
        include: {
          generation: true,
        },
      },
      targetGenerations: {
        include: {
          generation: true,
        },
      },
      targetClasses: {
        include: {
          class: {
            include: {
              generation: true,
            },
          },
        },
      },
      teachers: {
        where: {
          teacher: { status: 'ACTIVE' },
        },
        include: {
          teacher: true,
        },
        orderBy: [{ isPrimary: 'desc' }, { isSubstitute: 'asc' }],
      },
      scheduleMaterials: {
        include: {
          material: true,
        },
        orderBy: {
          slotIndex: 'asc',
        },
      },
    },
  });

  if (!schedule) {
    return { success: false, sentCount: 0, skippedCount: 0, details: [] };
  }

  // 1. Kumpulkan semua jenjang unik yang menjadi sasaran pengajian ini
  const generationMap = new Map<
    string,
    {
      id: string;
      name: string;
      whatsappGroupId: string | null;
      whatsappGroupName: string | null;
      waGroupH1Enabled: boolean;
    }
  >();

  if (schedule.targetGenerations && schedule.targetGenerations.length > 0) {
    for (const tg of schedule.targetGenerations) {
      if (tg.generation) {
        generationMap.set(tg.generation.id, tg.generation);
      }
    }
  }

  if (schedule.class?.generation) {
    generationMap.set(schedule.class.generation.id, schedule.class.generation);
  }

  if (schedule.targetClasses && schedule.targetClasses.length > 0) {
    for (const tc of schedule.targetClasses) {
      if (tc.class?.generation) {
        generationMap.set(tc.class.generation.id, tc.class.generation);
      }
    }
  }

  // Jika tidak ada jenjang spesifik (misal pengajian umum wilayah), ambil semua jenjang yang punya grup WA
  if (generationMap.size === 0 && schedule.targetScope === 'WILAYAH_UMUM') {
    const allGenerations = await prisma.generation.findMany({
      where: {
        whatsappGroupId: { not: null },
        waGroupH1Enabled: true,
      },
    });
    for (const g of allGenerations) {
      generationMap.set(g.id, g);
    }
  }

  const results: Array<{ generationName: string; groupId: string; status: string; error?: string }> = [];
  let sentCount = 0;
  let skippedCount = 0;

  // Format Nama Pengajar Terjadwal
  const teacherNames = schedule.teachers.map((st) => st.teacher.fullName);
  const teachersNameText = teacherNames.length > 0 ? teacherNames.join(' & ') : 'Dewan Pengajar';

  // Format Rincian Materi Terjadwal
  let materialsBlock = '';
  if (schedule.scheduleMaterials.length > 0) {
    materialsBlock =
      '\n*• Materi:*' +
      schedule.scheduleMaterials
        .map((sm, idx) => `\n  ${idx + 1}. _${sm.material.title}_`)
        .join('');
  }

  const scheduleDateText = formatIndonesianDate(schedule.startTime);
  const startTimeText = formatTime(schedule.startTime);
  const endTimeText = formatTime(schedule.endTime);

  for (const generation of Array.from(generationMap.values())) {
    if (!generation.whatsappGroupId || !generation.waGroupH1Enabled) {
      skippedCount++;
      continue;
    }

    const groupId = generation.whatsappGroupId.trim();
    const redisLockKey = `cron:wa_group_h1:${schedule.id}:${generation.id}`;

    // Cek Idempotency Redis agar tidak terkirim ganda
    if (redis) {
      try {
        const alreadySent = await redis.get(redisLockKey);
        if (alreadySent) {
          skippedCount++;
          results.push({
            generationName: generation.name,
            groupId,
            status: 'ALREADY_SENT_IDEMPOTENT',
          });
          continue;
        }
      } catch (redisErr) {
        console.warn('[groupScheduleNotificationService] Gagal membaca Redis lock:', redisErr);
      }
    }

    // Eksekusi pengiriman notifikasi H-1 ke Grup
    const sendResult = await sendGroupScheduleReminderH1({
      groupId,
      groupName: generation.whatsappGroupName || `Grup WA ${generation.name}`,
      generationName: generation.name,
      scheduleTitle: schedule.title,
      scheduleDate: scheduleDateText,
      startTime: startTimeText,
      endTime: endTimeText,
      venueName: schedule.venuePlaceName,
      organizationName: schedule.organization?.name || 'Kelompok Pengajian',
      teachersName: teachersNameText,
      materialsBlock,
      teacherNote: schedule.teacherBroadcastNote || schedule.notes,
      scheduleId: schedule.id,
    });

    if (sendResult.success) {
      sentCount++;
      results.push({
        generationName: generation.name,
        groupId,
        status: 'SENT',
      });

      // Simpan kunci idempotensi ke Redis (TTL 36 jam)
      if (redis) {
        try {
          await redis.set(redisLockKey, 'SENT', { ex: 36 * 3600 });
        } catch (setErr) {
          console.warn('[groupScheduleNotificationService] Gagal menyimpan Redis lock:', setErr);
        }
      }
    } else {
      results.push({
        generationName: generation.name,
        groupId,
        status: 'FAILED',
        error: sendResult.error,
      });
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    skippedCount,
    details: results,
  };
}

/**
 * Mengirimkan Rangkuman Kalender Jadwal Pengajian 1 Pekan ke Depan ke Grup WhatsApp Jenjang
 */
export async function dispatchWeeklyScheduleDigestForGeneration(
  generationId: string,
  options?: { force?: boolean; referenceDate?: Date }
): Promise<{
  success: boolean;
  status: string;
  schedulesCount: number;
  error?: string;
}> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
  });

  if (!generation) {
    return { success: false, status: 'GENERATION_NOT_FOUND', schedulesCount: 0, error: 'Jenjang tidak ditemukan' };
  }

  if (!generation.whatsappGroupId) {
    return { success: false, status: 'NO_WHATSAPP_GROUP', schedulesCount: 0, error: 'Grup WhatsApp belum dikonfigurasi' };
  }

  if (!generation.waGroupWeeklyEnabled && !options?.force) {
    return { success: false, status: 'WEEKLY_DISABLED', schedulesCount: 0, error: 'Rangkuman mingguan dimatikan' };
  }

  const { weekStart, weekEnd, periodLabel, weekKey } = getUpcomingWeekRangeWIB(options?.referenceDate);
  const redisLockKey = `cron:wa_group_weekly:${generation.id}:${weekKey}`;

  // Cek Idempotency Redis
  if (redis && !options?.force) {
    try {
      const alreadySent = await redis.get(redisLockKey);
      if (alreadySent) {
        return {
          success: true,
          status: 'ALREADY_SENT_THIS_WEEK',
          schedulesCount: 0,
        };
      }
    } catch (redisErr) {
      console.warn('[groupScheduleNotificationService] Gagal membaca Redis lock mingguan:', redisErr);
    }
  }

  // Query jadwal pekan ini yang menyasar jenjang ini
  const schedules = await prisma.schedule.findMany({
    where: {
      status: {
        in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE],
      },
      startTime: {
        gte: weekStart,
        lte: weekEnd,
      },
      AND: [
        {
          OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
        },
        {
          OR: [
            { targetGenerations: { some: { generationId: generation.id } } },
            { class: { generationId: generation.id } },
            { targetClasses: { some: { class: { generationId: generation.id } } } },
            { targetScope: 'WILAYAH_UMUM' },
          ],
        },
      ],
    },
    include: {
      organization: true,
      teachers: {
        where: { teacher: { status: 'ACTIVE' } },
        include: { teacher: true },
        orderBy: [{ isPrimary: 'desc' }, { isSubstitute: 'asc' }],
      },
      scheduleMaterials: {
        include: { material: true },
        orderBy: { slotIndex: 'asc' },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  // Susun Teks Sesi Pekanan
  let weeklySessionsListText = '';
  if (schedules.length === 0) {
    weeklySessionsListText = '_Tidak ada jadwal pengajian terjadwal untuk pekan ini._';
  } else {
    weeklySessionsListText = schedules
      .map((s, idx) => {
        const dayDate = formatIndonesianDate(s.startTime);
        const startTime = formatTime(s.startTime);
        const endTime = formatTime(s.endTime);
        const teachers = s.teachers.map((t) => t.teacher.fullName).join(' & ') || 'Dewan Pengajar';
        const materials =
          s.scheduleMaterials.length > 0
            ? s.scheduleMaterials.map((m) => m.material.title).join(', ')
            : 'Materi Rutin';

        return (
          `*${idx + 1}. ${dayDate}*\n` +
          `   • Sesi: *${s.title}*\n` +
          `   • Waktu: \`\`\`${startTime} - ${endTime} WIB\`\`\`\n` +
          `   • Tempat: _${s.venuePlaceName}_\n` +
          `   • Pengajar: _${teachers}_\n` +
          `   • Materi: _${materials}_`
        );
      })
      .join('\n\n');
  }

  const organizationName = schedules[0]?.organization?.name || 'Kelompok Pengajian';

  const sendResult = await sendGroupWeeklyScheduleDigest({
    groupId: generation.whatsappGroupId.trim(),
    groupName: generation.whatsappGroupName || `Grup WA ${generation.name}`,
    generationName: generation.name,
    weekPeriodText: periodLabel,
    organizationName,
    weeklySessionsListText,
    referenceId: `weekly_${generation.id}_${weekKey}`,
  });

  if (sendResult.success) {
    // Kunci selama 8 hari di Redis
    if (redis) {
      try {
        await redis.set(redisLockKey, 'SENT', { ex: 8 * 24 * 3600 });
      } catch (redisSetErr) {
        console.warn('[groupScheduleNotificationService] Gagal set Redis lock mingguan:', redisSetErr);
      }
    }

    return {
      success: true,
      status: 'SENT',
      schedulesCount: schedules.length,
    };
  }

  return {
    success: false,
    status: 'FAILED',
    schedulesCount: schedules.length,
    error: sendResult.error,
  };
}

/**
 * Menjalankan pengiriman Rangkuman Jadwal Mingguan ke seluruh grup WhatsApp jenjang
 */
export async function dispatchAllWeeklyScheduleDigests(options?: { force?: boolean }): Promise<{
  totalProcessed: number;
  totalSent: number;
  totalSkipped: number;
  details: Array<{ generationName: string; status: string; schedulesCount: number; error?: string }>;
}> {
  const generations = await prisma.generation.findMany({
    where: {
      whatsappGroupId: { not: null },
      ...(options?.force ? {} : { waGroupWeeklyEnabled: true }),
    },
    orderBy: {
      minAge: 'asc',
    },
  });

  const details: Array<{ generationName: string; status: string; schedulesCount: number; error?: string }> = [];
  let totalSent = 0;
  let totalSkipped = 0;

  for (const gen of generations) {
    const result = await dispatchWeeklyScheduleDigestForGeneration(gen.id, options);
    if (result.success && result.status === 'SENT') {
      totalSent++;
    } else if (result.status === 'ALREADY_SENT_THIS_WEEK') {
      totalSkipped++;
    }

    details.push({
      generationName: gen.name,
      status: result.status,
      schedulesCount: result.schedulesCount,
      error: result.error,
    });

    // Jeda sejenak antar pengiriman grup (anti-spam WAHA rate limiting)
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    totalProcessed: generations.length,
    totalSent,
    totalSkipped,
    details,
  };
}
