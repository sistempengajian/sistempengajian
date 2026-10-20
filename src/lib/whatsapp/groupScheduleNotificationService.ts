import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import {
  sendGroupScheduleReminderH1,
  sendGroupWeeklyScheduleDigest,
} from './triggers';
import { formatIndonesianDate, formatTime } from './scheduleNotificationService';
import { ScheduleStatus } from '@prisma/client';

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
    daysUntilMonday = 1;
  } else {
    daysUntilMonday = 1 - dayOfWeek;
  }

  const startUtcMs = nowJakarta.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000;
  const weekStart = new Date(startUtcMs - 7 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

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

  const mondayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date(weekStart.getTime() + 8 * 60 * 60 * 1000));
  const weekKey = `w_${mondayIso}`;

  return { weekStart, weekEnd, periodLabel, weekKey };
}

/**
 * Mengecek apakah sebuah sesi pengajian merupakan sesi gabungan:
 * - Menargetkan lebih dari 1 jenjang
 * - Atau menargetkan kelas dari jenjang berbeda
 * - Atau memiliki targetScope WILAYAH_UMUM
 */
export function isScheduleCombined(schedule: {
  targetGenerations?: Array<any>;
  targetClasses?: Array<any>;
  targetScope?: string;
  class?: any;
}): boolean {
  if (schedule.targetScope === 'WILAYAH_UMUM') return true;
  const genIds = new Set<string>();
  if (schedule.class?.generationId) genIds.add(schedule.class.generationId);
  schedule.targetGenerations?.forEach((tg) => {
    if (tg.generationId) genIds.add(tg.generationId);
    if (tg.generation?.id) genIds.add(tg.generation.id);
  });
  schedule.targetClasses?.forEach((tc) => {
    if (tc.class?.generationId) genIds.add(tc.class.generationId);
  });
  return genIds.size > 1;
}

/**
 * Format Baris Jenjang:
 * - 1 Jenjang:  *• Jenjang :* _Pra-Remaja 1_
 * - >1 Jenjang: *• Jenjang :*\n   _Pra-Remaja 1_ *-* _Pra-Remaja 2_ *-* _Remaja 1_
 */
export function formatJenjangBlock(jenjangNames: string[]): string {
  if (jenjangNames.length === 0) {
    return ' *• Jenjang :* _Umum_';
  }
  if (jenjangNames.length === 1) {
    return ` *• Jenjang :* _${jenjangNames[0]}_`;
  }
  const formattedList = jenjangNames.map((j) => `_${j}_`).join(' *-* ');
  return ` *• Jenjang :*\n   ${formattedList}`;
}

/**
 * Format Baris Pengajar:
 * - 0 Pengajar: *• Pengajar :* _Dewan Pengajar_
 * - 1 Pengajar: *• Pengajar :* _Ust. Zaidan_
 * - >1 Pengajar: *• Pengajar :*\n   _Ust. Zaidan_ *-* _Ust. Ahmad_
 */
export function formatTeacherBlock(teacherNames: string[]): string {
  if (teacherNames.length === 0) {
    return ' *• Pengajar :* _Dewan Pengajar_';
  }
  if (teacherNames.length === 1) {
    return ` *• Pengajar :* _${teacherNames[0]}_`;
  }
  const formattedList = teacherNames.map((t) => `_${t}_`).join(' *-* ');
  return ` *• Pengajar :*\n   ${formattedList}`;
}

/**
 * Format Baris Materi:
 * - 0 Materi: *• Materi :* _Materi Rutin_
 * - 1 Materi: *• Materi :* _Bab Thaharah & Wudhu Sempurna_
 * - >1 Materi: *• Materi :*\n    1. _Materi 1_\n    2. _Materi 2_
 */
export function formatMaterialBlock(materials: string[]): string {
  if (materials.length === 0) {
    return ' *• Materi :* _Materi Rutin_';
  }
  if (materials.length === 1) {
    return ` *• Materi :* _${materials[0]}_`;
  }
  const numbered = materials.map((m, idx) => `    ${idx + 1}. _${m}_`).join('\n');
  return ` *• Materi :*\n${numbered}`;
}

/**
 * Format 1 Sesi Pengajian untuk Pesan Mingguan sesuai format referensi user:
 * *1. Ahad, 25 Oktober 2026*
 * *--- [GABUNGAN] Pendalaman Fiqih & Akhlak*
 *  *• Waktu :* ```08:00 - 10:30 WIB```
 *  *• Tempat :* _Masjid Baitul Haq (Kelompok Ujungrusi)_
 *  *• Jenjang :* _Pra-Remaja 1_
 *  *• Pengajar :* _Ust. Zaidan_
 *  *• Materi :* _Bab Thaharah & Wudhu Sempurna_
 */
export function formatWeeklySessionItem(
  schedule: any,
  index: number,
  targetJenjangNames: string[]
): string {
  const dayDate = formatIndonesianDate(schedule.startTime);
  const startTime = formatTime(schedule.startTime);
  const endTime = formatTime(schedule.endTime);
  const isCombined = isScheduleCombined(schedule);
  const cleanTitle = schedule.title.replace(/^\[GABUNGAN\]\s*/i, '').trim();
  const titleFormatted = isCombined ? `[GABUNGAN] ${cleanTitle}` : cleanTitle;

  const teacherNames = schedule.teachers?.map((st: any) => st.teacher.fullName) || [];
  const materials = schedule.scheduleMaterials?.map((sm: any) => sm.material.title) || [];

  return (
    `*${index}. ${dayDate}*\n` +
    `*--- ${titleFormatted}*\n` +
    ` *• Waktu :* \`\`\`${startTime} - ${endTime} WIB\`\`\`\n` +
    ` *• Tempat :* _${schedule.venuePlaceName}_\n` +
    `${formatJenjangBlock(targetJenjangNames)}\n` +
    `${formatTeacherBlock(teacherNames)}\n` +
    `${formatMaterialBlock(materials)}`
  );
}

/**
 * Format Rincian Sesi untuk Pesan Pengingat H-1:
 */
export function formatH1SessionDetails(
  schedule: any,
  targetJenjangNames: string[]
): {
  titleFormatted: string;
  detailBlock: string;
} {
  const isCombined = isScheduleCombined(schedule);
  const cleanTitle = schedule.title.replace(/^\[GABUNGAN\]\s*/i, '').trim();
  const titleFormatted = isCombined ? `[GABUNGAN] ${cleanTitle}` : cleanTitle;

  const teacherNames = schedule.teachers?.map((st: any) => st.teacher.fullName) || [];
  const materials = schedule.scheduleMaterials?.map((sm: any) => sm.material.title) || [];

  const detailBlock =
    `${formatJenjangBlock(targetJenjangNames)}\n` +
    `${formatTeacherBlock(teacherNames)}\n` +
    `${formatMaterialBlock(materials)}`;

  return { titleFormatted, detailBlock };
}

/**
 * Mengidentifikasi cakupan wilayah (organizationId) yang valid untuk sebuah grup WhatsApp
 * berdasarkan santri aktif dan kelas yang terdaftar pada jenjang-jenjang di grup tersebut.
 * Juga menyertakan hierarki organisasi induk (Desa & Daerah).
 * Mencegah jadwal kelompok lain masuk ke grup kelompok berbeda (Isolasi Wilayah Ketat).
 */
export async function getGroupOrganizationScope(generationIds: string[]): Promise<{
  validOrgIds: Set<string>;
  organizationName: string;
}> {
  const [santriOrgs, classOrgs] = await Promise.all([
    prisma.user.findMany({
      where: {
        generationId: { in: generationIds },
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
        organizationId: { not: null },
      },
      select: { organizationId: true },
    }),
    prisma.class.findMany({
      where: {
        generationId: { in: generationIds },
      },
      select: { organizationId: true },
    }),
  ]);

  const directOrgIds = new Set<string>();
  for (const s of santriOrgs) {
    if (s.organizationId) directOrgIds.add(s.organizationId);
  }
  for (const c of classOrgs) {
    if (c.organizationId) directOrgIds.add(c.organizationId);
  }

  if (directOrgIds.size === 0) {
    const defaultOrg = await prisma.organization.findFirst({ select: { id: true, name: true } });
    const set = new Set<string>();
    if (defaultOrg) set.add(defaultOrg.id);
    return { validOrgIds: set, organizationName: defaultOrg?.name || 'Sistem Pengajian' };
  }

  const validOrgIds = new Set<string>(directOrgIds);

  const orgs = await prisma.organization.findMany({
    where: { id: { in: Array.from(directOrgIds) } },
    include: {
      parent: {
        include: {
          parent: true,
        },
      },
    },
  });

  let primaryOrgName = '';
  for (const org of orgs) {
    if (!primaryOrgName) {
      primaryOrgName = org.name;
    }
    if (org.parent) {
      validOrgIds.add(org.parent.id);
      if (org.parent.parent) {
        validOrgIds.add(org.parent.parent.id);
      }
    }
  }

  return {
    validOrgIds,
    organizationName: primaryOrgName || 'Kelompok Pengajian',
  };
}

/**
 * Menghitung santri aktif pada jenjang tertentu
 */
export async function countActiveSantriForGeneration(generationId: string): Promise<number> {
  return prisma.user.count({
    where: {
      generationId,
      roles: { some: { role: 'SANTRI' } },
      status: 'ACTIVE',
    },
  });
}

/**
 * Mengirimkan pesan pengingat sesi pengajian H-1 ke Grup WhatsApp Jenjang terkait
 * - Cek grup gabungan vs grup tunggal
 * - Cek jenjang memiliki santri aktif (> 0)
 * - Isolasi wilayah (jadwal kelompok lain tidak akan dikirim)
 * - Deduplikasi pesan per grup
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
  const candidateGenerations = new Map<
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
        candidateGenerations.set(tg.generation.id, tg.generation);
      }
    }
  }

  if (schedule.class?.generation) {
    candidateGenerations.set(schedule.class.generation.id, schedule.class.generation);
  }

  if (schedule.targetClasses && schedule.targetClasses.length > 0) {
    for (const tc of schedule.targetClasses) {
      if (tc.class?.generation) {
        candidateGenerations.set(tc.class.generation.id, tc.class.generation);
      }
    }
  }

  // 2. Filter Jenjang: Hanya yang MEMILIKI SANTRI AKTIF (> 0)
  const validTargetGenerations: Array<{
    id: string;
    name: string;
    whatsappGroupId: string | null;
    whatsappGroupName: string | null;
    waGroupH1Enabled: boolean;
  }> = [];

  for (const gen of Array.from(candidateGenerations.values())) {
    const santriCount = await countActiveSantriForGeneration(gen.id);
    if (santriCount > 0) {
      validTargetGenerations.push(gen);
    }
  }

  // Fallback untuk WILAYAH_UMUM jika belum ada target jenjang spesifik
  if (validTargetGenerations.length === 0 && schedule.targetScope === 'WILAYAH_UMUM') {
    const allGens = await prisma.generation.findMany({
      where: {
        whatsappGroupId: { not: null },
        waGroupH1Enabled: true,
      },
    });
    for (const g of allGens) {
      const santriCount = await countActiveSantriForGeneration(g.id);
      if (santriCount > 0) {
        validTargetGenerations.push(g);
      }
    }
  }

  if (validTargetGenerations.length === 0) {
    return { success: false, sentCount: 0, skippedCount: 0, details: [] };
  }

  // 3. Kelompokkan jenjang berdasarkan unik whatsappGroupId
  const groupByMap = new Map<string, typeof validTargetGenerations>();
  for (const gen of validTargetGenerations) {
    if (!gen.whatsappGroupId || !gen.waGroupH1Enabled) continue;
    const gid = gen.whatsappGroupId.trim();
    if (!groupByMap.has(gid)) {
      groupByMap.set(gid, []);
    }
    groupByMap.get(gid)!.push(gen);
  }

  const results: Array<{ generationName: string; groupId: string; status: string; error?: string }> = [];
  let sentCount = 0;
  let skippedCount = 0;

  const scheduleDateText = formatIndonesianDate(schedule.startTime);
  const startTimeText = formatTime(schedule.startTime);
  const endTimeText = formatTime(schedule.endTime);

  for (const [groupId, gensInGroupForSchedule] of groupByMap.entries()) {
    // 4. Periksa seluruh jenjang yang terdaftar di grup ini pada sistem (untuk deteksi grup gabungan)
    const allGenerationsInGroup = await prisma.generation.findMany({
      where: {
        whatsappGroupId: {
          in: [groupId, groupId.replace(/@g\.us$/, ''), `${groupId.replace(/@g\.us$/, '')}@g.us`],
        },
      },
      select: { id: true, name: true },
    });

    const isCombinedGroup = allGenerationsInGroup.length > 1;

    // 5. Isolasi Wilayah: Cek apakah jadwal ini sesuai dengan wilayah grup
    const allGenIdsInGroup = allGenerationsInGroup.map((g) => g.id);
    const { validOrgIds, organizationName } = await getGroupOrganizationScope(allGenIdsInGroup);

    if (schedule.organizationId && !validOrgIds.has(schedule.organizationId)) {
      skippedCount++;
      results.push({
        generationName: gensInGroupForSchedule.map((g) => g.name).join(', '),
        groupId,
        status: 'SKIPPED_DIFFERENT_WILAYAH',
      });
      continue;
    }

    // 6. Deduplikasi Database & Redis Idempotency Lock per Grup + Jadwal (Mencegah pesan ganda ke grup yang sama)
    const cleanGroupId = groupId.replace(/[^a-zA-Z0-9]/g, '_');
    const groupMagicToken = `GROUP_H1_${schedule.id}_${cleanGroupId}`;
    const redisLockKey = `cron:wa_group_h1:${schedule.id}:${cleanGroupId}`;

    // A. Cek Ground-Truth Database Log 36 Jam Terakhir
    const existingGroupLog = await prisma.whatsAppMessageLog.findFirst({
      where: {
        recipientPhone: groupId,
        referenceId: schedule.id,
        templateCode: 'GROUP_SCHEDULE_REMINDER_H1',
        status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
        createdAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
      },
    });

    if (existingGroupLog) {
      skippedCount++;
      results.push({
        generationName: gensInGroupForSchedule.map((g) => g.name).join(', '),
        groupId,
        status: 'ALREADY_SENT_DATABASE',
      });
      continue;
    }

    // B. Cek Redis Lock (Jika Redis aktif)
    if (redis) {
      try {
        const alreadySent = await redis.get(redisLockKey);
        if (alreadySent) {
          skippedCount++;
          results.push({
            generationName: gensInGroupForSchedule.map((g) => g.name).join(', '),
            groupId,
            status: 'ALREADY_SENT_IDEMPOTENT',
          });
          continue;
        }
      } catch (redisErr) {
        console.warn('[groupScheduleNotificationService] Gagal membaca Redis lock:', redisErr);
      }
    }

    // 7. Format Rincian Sesi sesuai Versi 1 atau Versi 2
    const targetJenjangNames = gensInGroupForSchedule.map((g) => g.name);
    const { titleFormatted, detailBlock } = formatH1SessionDetails(schedule, targetJenjangNames);

    // Sapaan penerima
    let recipientGreeting = '';
    if (isCombinedGroup) {
      recipientGreeting = `(${allGenerationsInGroup.map((g) => g.name).join(', ')})`;
    } else {
      recipientGreeting = `Jenjang *${gensInGroupForSchedule[0]?.name || 'Santri'}*`;
    }

    const groupLabelName =
      gensInGroupForSchedule[0]?.whatsappGroupName ||
      (isCombinedGroup ? `Grup Gabungan ${allGenerationsInGroup.map((g) => g.name).join(', ')}` : `Grup ${gensInGroupForSchedule[0]?.name}`);

    // Eksekusi pengiriman pengingat H-1
    const sendResult = await sendGroupScheduleReminderH1({
      groupId,
      groupName: groupLabelName,
      recipientGreeting,
      generationName: gensInGroupForSchedule[0]?.name,
      scheduleTitle: titleFormatted,
      scheduleDate: scheduleDateText,
      startTime: startTimeText,
      endTime: endTimeText,
      venueName: schedule.venuePlaceName,
      organizationName: schedule.organization?.name || organizationName,
      detailBlock,
      teacherNote: schedule.teacherBroadcastNote || schedule.notes,
      scheduleId: schedule.id,
      magicToken: groupMagicToken,
    });

    if (sendResult.success) {
      sentCount++;
      results.push({
        generationName: gensInGroupForSchedule.map((g) => g.name).join(', '),
        groupId,
        status: 'SENT',
      });

      if (redis) {
        try {
          await redis.set(redisLockKey, 'SENT', { ex: 36 * 3600 });
        } catch (setErr) {
          console.warn('[groupScheduleNotificationService] Gagal menyimpan Redis lock:', setErr);
        }
      }
    } else {
      results.push({
        generationName: gensInGroupForSchedule.map((g) => g.name).join(', '),
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
 * Mengirimkan Rangkuman Kalender Jadwal Pengajian 1 Pekan ke Depan untuk grup jenjang
 * - Cek jenjang memiliki santri aktif (> 0)
 * - Grup gabungan mengonsolidasikan jadwal seluruh jenjang yang tergabung
 * - Sesi gabungan HANYA MUNCUL 1 KALI (Deduplikasi id jadwal)
 * - Isolasi Wilayah ketat (jadwal kelompok lain tidak masuk)
 * - Menggunakan format Versi 1 / Versi 2
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
  const targetGeneration = await prisma.generation.findUnique({
    where: { id: generationId },
  });

  if (!targetGeneration) {
    return { success: false, status: 'GENERATION_NOT_FOUND', schedulesCount: 0, error: 'Jenjang tidak ditemukan' };
  }

  if (!targetGeneration.whatsappGroupId) {
    return { success: false, status: 'NO_WHATSAPP_GROUP', schedulesCount: 0, error: 'Grup WhatsApp belum dikonfigurasi' };
  }

  const groupId = targetGeneration.whatsappGroupId.trim();

  // Cari seluruh jenjang yang berbagi grup WA yang sama
  const allGenerationsInGroup = await prisma.generation.findMany({
    where: {
      whatsappGroupId: {
        in: [groupId, groupId.replace(/@g\.us$/, ''), `${groupId.replace(/@g\.us$/, '')}@g.us`],
      },
    },
    include: {
      _count: {
        select: {
          users: {
            where: {
              roles: { some: { role: 'SANTRI' } },
              status: 'ACTIVE',
            },
          },
        },
      },
    },
    orderBy: { minAge: 'asc' },
  });

  // Filter jenjang yang memiliki santri aktif (> 0)
  const activeGenerationsInGroup = allGenerationsInGroup.filter((g) => g._count.users > 0);

  if (activeGenerationsInGroup.length === 0) {
    return { success: false, status: 'ZERO_SANTRI', schedulesCount: 0, error: 'Seluruh jenjang di grup ini tidak memiliki santri aktif' };
  }

  const anyEnabled = activeGenerationsInGroup.some((g) => g.waGroupWeeklyEnabled);
  if (!anyEnabled && !options?.force) {
    return { success: false, status: 'WEEKLY_DISABLED', schedulesCount: 0, error: 'Rangkuman mingguan dimatikan' };
  }

  const { weekStart, weekEnd, periodLabel, weekKey } = getUpcomingWeekRangeWIB(options?.referenceDate);
  const cleanGroupId = groupId.replace(/[^a-zA-Z0-9]/g, '_');
  const weeklyMagicToken = `WEEKLY_DIGEST_${cleanGroupId}_${weekKey}`;
  const redisLockKey = `cron:wa_group_weekly:${cleanGroupId}:${weekKey}`;

  if (!options?.force) {
    // A. Cek Ground-Truth Database Log 6 Hari Terakhir
    const existingWeeklyLog = await prisma.whatsAppMessageLog.findFirst({
      where: {
        recipientPhone: groupId,
        templateCode: 'GROUP_WEEKLY_SCHEDULE_DIGEST',
        status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
        createdAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
        OR: [
          { magicToken: weeklyMagicToken },
          { referenceId: `weekly_${cleanGroupId}_${weekKey}` },
        ],
      },
    });

    if (existingWeeklyLog) {
      return {
        success: true,
        status: 'ALREADY_SENT_THIS_WEEK',
        schedulesCount: 0,
      };
    }

    // B. Cek Redis Lock (Jika Redis aktif)
    if (redis) {
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
  }

  // Ambil cakupan wilayah (organizationId) yang valid untuk grup ini
  const activeGenIds = activeGenerationsInGroup.map((g) => g.id);
  const { validOrgIds, organizationName } = await getGroupOrganizationScope(activeGenIds);

  // Query jadwal pekan ini:
  // 1. Status aktif/terjadwal
  // 2. Dalam rentang pekan
  // 3. DI DALAM WILAYAH GRUP (validOrgIds) -> Mencegah jadwal kelompok lain bocor!
  // 4. Menargetkan salah satu jenjang yang ada di grup ini
  const rawSchedules = await prisma.schedule.findMany({
    where: {
      status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE] },
      startTime: { gte: weekStart, lte: weekEnd },
      organizationId: { in: Array.from(validOrgIds) },
      AND: [
        {
          OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
        },
        {
          OR: [
            { targetGenerations: { some: { generationId: { in: activeGenIds } } } },
            { class: { generationId: { in: activeGenIds } } },
            { targetClasses: { some: { class: { generationId: { in: activeGenIds } } } } },
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
      targetGenerations: {
        include: { generation: true },
      },
      class: {
        include: { generation: true },
      },
      targetClasses: {
        include: { class: { include: { generation: true } } },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  // 5. DEDUPLIKASI JADWAL: Pastikan sesi gabungan hanya muncul 1 kali
  const scheduleDeduplicationMap = new Map<string, (typeof rawSchedules)[0]>();
  for (const s of rawSchedules) {
    if (!scheduleDeduplicationMap.has(s.id)) {
      scheduleDeduplicationMap.set(s.id, s);
    }
  }
  const uniqueSchedules = Array.from(scheduleDeduplicationMap.values());

  // 6. Susun Teks Sesi Pekanan
  let weeklySessionsListText = '';
  if (uniqueSchedules.length === 0) {
    weeklySessionsListText = '_Tidak ada jadwal pengajian terjadwal untuk pekan ini._';
  } else {
    weeklySessionsListText = uniqueSchedules
      .map((s, idx) => {
        // Kumpulkan jenjang aktif yang menjadi target sesi ini
        const sessionGenNames = new Set<string>();
        if (s.targetGenerations && s.targetGenerations.length > 0) {
          s.targetGenerations.forEach((tg) => {
            if (tg.generation?.name) sessionGenNames.add(tg.generation.name);
          });
        }
        if (s.class?.generation?.name) {
          sessionGenNames.add(s.class.generation.name);
        }
        if (s.targetClasses && s.targetClasses.length > 0) {
          s.targetClasses.forEach((tc) => {
            if (tc.class?.generation?.name) sessionGenNames.add(tc.class.generation.name);
          });
        }

        // Jika tidak ada spesifik tapi WILAYAH_UMUM
        if (sessionGenNames.size === 0 && s.targetScope === 'WILAYAH_UMUM') {
          activeGenerationsInGroup.forEach((g) => sessionGenNames.add(g.name));
        }

        const jenjangList = Array.from(sessionGenNames);
        return formatWeeklySessionItem(s, idx + 1, jenjangList);
      })
      .join('\n\n');
  }

  // Format Sapaan Penerima
  const isCombinedGroup = activeGenerationsInGroup.length > 1;
  let recipientGreeting = '';
  if (isCombinedGroup) {
    recipientGreeting = `(${activeGenerationsInGroup.map((g) => g.name).join(', ')})`;
  } else {
    recipientGreeting = `Jenjang *${activeGenerationsInGroup[0]?.name}*`;
  }

  const groupLabelName =
    activeGenerationsInGroup[0]?.whatsappGroupName ||
    (isCombinedGroup ? `Grup Gabungan ${activeGenerationsInGroup.map((g) => g.name).join(', ')}` : `Grup ${activeGenerationsInGroup[0]?.name}`);

  const orgSignatureName = uniqueSchedules[0]?.organization?.name || organizationName;

  const sendResult = await sendGroupWeeklyScheduleDigest({
    groupId,
    groupName: groupLabelName,
    recipientGreeting,
    generationName: activeGenerationsInGroup[0]?.name,
    weekPeriodText: periodLabel,
    organizationName: orgSignatureName,
    weeklySessionsListText,
    referenceId: `weekly_${cleanGroupId}_${weekKey}`,
    magicToken: weeklyMagicToken,
  });

  if (sendResult.success) {
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
      schedulesCount: uniqueSchedules.length,
    };
  }

  return {
    success: false,
    status: 'FAILED',
    schedulesCount: uniqueSchedules.length,
    error: sendResult.error,
  };
}

/**
 * Menjalankan pengiriman Rangkuman Jadwal Mingguan ke seluruh grup WhatsApp jenjang unik
 * - Mengelompokkan berdasarkan whatsappGroupId (1 pesan per grup, tidak ganda)
 * - Menyaring jenjang tanpa santri
 * - Mencegah pesan bocor ke wilayah berbeda
 */
export async function dispatchAllWeeklyScheduleDigests(options?: { force?: boolean }): Promise<{
  totalProcessed: number;
  totalSent: number;
  totalSkipped: number;
  details: Array<{ generationName: string; status: string; schedulesCount: number; error?: string }>;
}> {
  // 1. Ambil seluruh generasi yang memiliki whatsappGroupId
  const allGenerations = await prisma.generation.findMany({
    where: {
      whatsappGroupId: { not: null },
      ...(options?.force ? {} : { waGroupWeeklyEnabled: true }),
    },
    include: {
      _count: {
        select: {
          users: {
            where: {
              roles: { some: { role: 'SANTRI' } },
              status: 'ACTIVE',
            },
          },
        },
      },
    },
    orderBy: {
      minAge: 'asc',
    },
  });

  // 2. Filter hanya jenjang yang memiliki santri aktif (> 0)
  const activeGenerations = allGenerations.filter((g) => g._count.users > 0);

  // 3. Kelompokkan berdasarkan unik whatsappGroupId
  const groupMap = new Map<string, typeof activeGenerations>();
  for (const gen of activeGenerations) {
    const gid = gen.whatsappGroupId!.trim();
    if (!groupMap.has(gid)) {
      groupMap.set(gid, []);
    }
    groupMap.get(gid)!.push(gen);
  }

  const details: Array<{ generationName: string; status: string; schedulesCount: number; error?: string }> = [];
  let totalSent = 0;
  let totalSkipped = 0;

  for (const [groupId, gensInGroup] of groupMap.entries()) {
    // Jalankan pengiriman untuk 1 grup (mewakili seluruh jenjang aktif di grup tersebut)
    const primaryGen = gensInGroup[0];
    const groupNameLabel = gensInGroup.map((g) => g.name).join(', ');

    const result = await dispatchWeeklyScheduleDigestForGeneration(primaryGen.id, options);

    if (result.success && result.status === 'SENT') {
      totalSent++;
    } else if (result.status === 'ALREADY_SENT_THIS_WEEK' || result.status === 'WEEKLY_DISABLED') {
      totalSkipped++;
    }

    details.push({
      generationName: groupNameLabel,
      status: result.status,
      schedulesCount: result.schedulesCount,
      error: result.error,
    });

    // Jeda sejenak antar pengiriman grup (anti-spam WAHA rate limiting)
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    totalProcessed: groupMap.size,
    totalSent,
    totalSkipped,
    details,
  };
}
