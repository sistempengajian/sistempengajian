import prisma from '@/lib/prisma';
import { whatsAppClient } from './WhatsAppClient';
import { getUpcomingWeekRangeWIB } from './groupScheduleNotificationService';
import { isWhatsAppGroupJid } from './utils';

export interface GroupInboundPayload {
  groupId: string;
  senderParticipant?: string;
  text: string;
  mentionedJids?: string[];
  messageId?: string;
  fromMe?: boolean;
}

export interface GroupInboundResult {
  handled: boolean;
  action?:
    | 'JADWAL_HARI_INI'
    | 'JADWAL_MINGGUAN'
    | 'JADWAL_BESOK'
    | 'MATERI_BULANAN'
    | 'PENGAJAR_HARI_INI'
    | 'LOKASI_PENGAJIAN'
    | 'KONTAK_PENGURUS'
    | 'IZIN_INFO'
    | 'MENU_BANTUAN'
    | 'IGNORED_NOT_MENTIONED'
    | 'IGNORED_UNREGISTERED'
    | 'RATE_LIMITED';
  replySent?: boolean;
  replyMessage?: string;
  groupId?: string;
}

// In-memory rate limiter per grup (maksimal 1 balasan bot per 5 detik di grup yang sama)
const recentGroupReplies = new Map<string, number>();

function isGroupRateLimited(groupId: string): boolean {
  const now = Date.now();
  const lastTime = recentGroupReplies.get(groupId);
  if (lastTime && now - lastTime < 5000) {
    return true;
  }
  recentGroupReplies.set(groupId, now);

  // Bersihkan cache jika terlalu besar (> 200 entri)
  if (recentGroupReplies.size > 200) {
    for (const [k, v] of recentGroupReplies.entries()) {
      if (now - v > 60000) recentGroupReplies.delete(k);
    }
  }

  return false;
}

/**
 * Format tanggal dalam Bahasa Indonesia (Asia/Jakarta)
 */
function formatIndonesianDateWIB(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/**
 * Format jam dalam Bahasa Indonesia (Asia/Jakarta)
 */
function formatIndonesianTimeWIB(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/**
 * Menghitung rentang waktu 1 hari penuh (00:00:00 - 23:59:59.999 WIB)
 */
function getDayRangeWIB(targetDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = formatter.format(targetDate).split('-');
  const startOfDay = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
  const endOfDay = new Date(`${y}-${m}-${d}T23:59:59.999+07:00`);
  return { startOfDay, endOfDay, dateIso: `${y}-${m}-${d}` };
}

/**
 * Mengekstrak seluruh daftar JID yang di-mention dari berbagai struktur payload webhook WhatsApp / WAHA
 */
export function extractMentionedJids(payload: any): string[] {
  const result = new Set<string>();
  const add = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'string' && item.trim()) {
          result.add(item.trim());
        }
      }
    }
  };

  add(payload?.payload?.mentionedJidList);
  add(payload?.payload?._data?.mentionedJidList);
  add(payload?.payload?._data?.message?.extendedTextMessage?.contextInfo?.mentionedJid);
  add(payload?.payload?.contextInfo?.mentionedJid);
  add(payload?.mentionedJidList);
  add(payload?.contextInfo?.mentionedJid);

  return Array.from(result);
}

/**
 * Memeriksa apakah bot di-tag/mention secara valid di pesan grup WhatsApp.
 * Aturan Anti-Spam: Bot HANYA akan merespon jika ditag secara eksplisit:
 * 1. Melalui fitur tag WhatsApp native (mentionedJidList berisi nomor / LID bot)
 * 2. Menyertakan tag nomor bot (@6285165868482 / @085165868482)
 * 3. Menyertakan tag keyword resmi (@no_bot / @bot / @asisten / @pengajian)
 * 4. Awalan slash command grup (/bot, /jadwal, /menu)
 */
export function isBotMentionedInGroup(
  text: string,
  mentionedJids: string[] = [],
  customBotIdentifiers: string[] = []
): boolean {
  const envBotNumber = process.env.WHATSAPP_BOT_NUMBER || '';
  const botIdentifiers = [
    '6285165868482',
    '214006056919268',
    envBotNumber,
    ...customBotIdentifiers,
  ].filter(Boolean);

  // 1. Cek dari daftar JID yang di-tag resmi oleh WhatsApp (mentionedJidList)
  if (Array.isArray(mentionedJids) && mentionedJids.length > 0) {
    const isTag = mentionedJids.some((jid) =>
      botIdentifiers.some((botId) => {
        const cleanId = botId.replace(/\D/g, '');
        return jid.includes(botId) || (cleanId && jid.includes(cleanId));
      })
    );
    if (isTag) return true;
  }

  const clean = text.toLowerCase();

  // 2. Cek mention nomor telepon bot dalam teks (misal: @6285165868482, @085165868482, @85165868482)
  const mentionsBotNumber = botIdentifiers.some((botId) => {
    const digits = botId.replace(/\D/g, '');
    if (digits.length < 8) return false;
    const localFormat = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
    const shortFormat = digits.startsWith('62') ? digits.slice(2) : digits;
    return (
      clean.includes(`@${digits}`) ||
      clean.includes(`@${localFormat}`) ||
      clean.includes(`@${shortFormat}`) ||
      clean.includes(`@+${digits}`)
    );
  });
  if (mentionsBotNumber) return true;

  // 3. Cek mention keyword bot resmi: @no_bot, @bot, @nobot, @asisten, @pengajian, @sistem, @admin
  const botKeywordRegex = /@\b(bot|no_bot|nobot|asisten|pengajian|sistem|admin)\b/i;
  if (botKeywordRegex.test(clean)) {
    return true;
  }

  // 4. Perintah awalan slash / bang di grup: /bot, /jadwal, /menu, !bot, !jadwal
  const commandPrefixRegex = /^[/!](bot|jadwal|menu|bantuan)\b/i;
  if (commandPrefixRegex.test(clean.trim())) {
    return true;
  }

  return false;
}

/**
 * Membersihkan awalan tag / mention dari isi pesan
 */
export function cleanGroupQuery(text: string): string {
  return text
    .replace(/@\S+/g, ' ')
    .replace(/^[/!]\S+/g, ' ')
    .replace(/\b(asisten|bot|no_bot|nobot|pengajian|sistem|admin)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Memproses pesan masuk dari Grup WhatsApp
 */
export async function processGroupInboundWhatsAppMessage(
  payload: GroupInboundPayload
): Promise<GroupInboundResult> {
  // 0. Proteksi Anti-Loop: Abaikan pesan dari akun bot sendiri
  if (payload.fromMe === true) {
    return { handled: false, action: 'IGNORED_NOT_MENTIONED' };
  }

  const groupId = (payload.groupId || '').trim();
  if (!isWhatsAppGroupJid(groupId)) {
    return { handled: false, action: 'IGNORED_UNREGISTERED' };
  }

  // 1. Validasi apakah Grup terdaftar pada sistem (Jenjang Generasi atau Kelas)
  const groupVariants = [
    groupId,
    groupId.replace(/@g\.us$/, ''),
    groupId.endsWith('@g.us') ? groupId : `${groupId}@g.us`,
  ];

  const generation = await prisma.generation.findFirst({
    where: { whatsappGroupId: { in: groupVariants } },
  });

  const registeredClass = !generation
    ? await prisma.class.findFirst({
        where: { whatsappGroupId: { in: groupVariants } },
        include: { generation: true, organization: true },
      })
    : null;

  if (!generation && !registeredClass) {
    // Abaikan grup yang tidak terdaftar di sistem pengajian (Anti-Spam)
    return { handled: false, action: 'IGNORED_UNREGISTERED' };
  }

  const groupTargetName = generation?.name || registeredClass?.name || 'Pengajian';
  const generationId = generation?.id || registeredClass?.generationId || null;
  const classId = registeredClass?.id || null;

  let orgName = registeredClass?.organization?.name || '';
  if (!orgName) {
    const defaultOrg = await prisma.organization.findFirst({
      select: { name: true },
    });
    orgName = defaultOrg?.name || 'Sistem Pengajian';
  }
  const orgSignature = `— *Sistem Pengajian ${orgName}*`;

  // 2. Proteksi Anti-Spam: Bot HANYA merespon jika ditag / dimention (@no_bot, @bot, dll)
  const rawText = (payload.text || '').trim();
  const mentionedJids = payload.mentionedJids || [];

  if (!isBotMentionedInGroup(rawText, mentionedJids)) {
    return { handled: false, action: 'IGNORED_NOT_MENTIONED' };
  }

  // 3. Proteksi Rate Limit per Grup (Maksimal 1 respons per 5 detik per grup)
  if (isGroupRateLimited(groupId)) {
    return { handled: true, action: 'RATE_LIMITED', replySent: false, groupId };
  }

  // 4. Bersihkan query teks perintah
  const cleanQuery = cleanGroupQuery(rawText);

  // 5. Klasifikasi Aksi / Perintah
  const isToday =
    cleanQuery.includes('hari ini') ||
    cleanQuery.includes('sekarang') ||
    cleanQuery.includes('ada ngaji') ||
    cleanQuery === 'jadwal';

  const isWeekly =
    cleanQuery.includes('mingguan') ||
    cleanQuery.includes('pekan ini') ||
    cleanQuery.includes('minggu ini') ||
    cleanQuery.includes('seminggu') ||
    cleanQuery.includes('sepekan') ||
    cleanQuery.includes('1 minggu') ||
    cleanQuery.includes('seminggu ke depan') ||
    cleanQuery.includes('1 pekan');

  const isTomorrow =
    cleanQuery.includes('besok') ||
    cleanQuery.includes('esok') ||
    cleanQuery.includes('h+1') ||
    cleanQuery.includes('malam besok');

  const isMaterial =
    cleanQuery.includes('materi') ||
    cleanQuery.includes('kurikulum') ||
    cleanQuery.includes('target') ||
    cleanQuery.includes('pelajaran') ||
    cleanQuery.includes('hafalan');

  const isTeacher =
    cleanQuery.includes('pengajar') ||
    cleanQuery.includes('ustadz') ||
    cleanQuery.includes('ustadzah') ||
    cleanQuery.includes('guru') ||
    cleanQuery.includes('ngajar') ||
    cleanQuery.includes('pemateri');

  const isLocation =
    cleanQuery.includes('lokasi') ||
    cleanQuery.includes('tempat') ||
    cleanQuery.includes('di mana') ||
    cleanQuery.includes('dimana') ||
    cleanQuery.includes('masjid');

  const isContact =
    cleanQuery.includes('kontak') ||
    cleanQuery.includes('admin') ||
    cleanQuery.includes('pengurus') ||
    cleanQuery.includes('musyrif') ||
    cleanQuery.includes('pj');

  const isAbsence =
    cleanQuery.includes('izin') ||
    cleanQuery.includes('ijin') ||
    cleanQuery.includes('sakit') ||
    cleanQuery.includes('tidak hadir') ||
    cleanQuery.includes('berhalangan') ||
    cleanQuery.includes('absen');

  const isHelp =
    cleanQuery.includes('menu') ||
    cleanQuery.includes('bantuan') ||
    cleanQuery.includes('help') ||
    cleanQuery.includes('perintah') ||
    cleanQuery.includes('panduan') ||
    cleanQuery === '';

  // Helper pengiriman balasan dengan typing presence (delay 2.0 - 3.2 detik)
  const sendGroupReply = async (message: string) => {
    await whatsAppClient.startTyping(groupId).catch(() => {});
    const delay = Math.floor(Math.random() * 1200) + 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const result = await whatsAppClient.sendMessage({
      to: groupId,
      messageType: 'CUSTOM_DIRECT',
      message,
    });

    await whatsAppClient.stopTyping(groupId).catch(() => {});
    return result;
  };

  // Helper pencarian jadwal
  const findSchedulesInRange = async (start: Date, end: Date) => {
    return prisma.schedule.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        startTime: { gte: start, lte: end },
        OR: [
          ...(generationId
            ? [
                { targetGenerations: { some: { generationId } } },
                { class: { generationId } },
                { targetClasses: { some: { class: { generationId } } } },
              ]
            : []),
          ...(classId
            ? [{ classId }, { targetClasses: { some: { classId } } }]
            : []),
          // Pengajian Wilayah Terbuka Umum
          {
            targetClasses: { none: {} },
            targetGenerations: { none: {} },
            classId: null,
          },
        ],
      },
      include: {
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
      orderBy: { startTime: 'asc' },
    });
  };

  // =========================================================================
  // AKSI 1: JADWAL HARI INI
  // =========================================================================
  if (isToday) {
    const { startOfDay, endOfDay } = getDayRangeWIB(new Date());
    const schedules = await findSchedulesInRange(startOfDay, endOfDay);
    const dateLabel = formatIndonesianDateWIB(new Date());

    let replyMessage = '';
    if (schedules.length > 0) {
      const itemsText = schedules
        .map((s, idx) => {
          const time = `${formatIndonesianTimeWIB(s.startTime)} - ${formatIndonesianTimeWIB(s.endTime)} WIB`;
          const venue = s.venuePlaceName || 'Masjid';
          const teachers =
            s.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';
          const materials =
            s.scheduleMaterials.map((m) => m.material.title).join(', ') || 'Materi Reguler';

          return (
            `*${idx + 1}. ${s.title}*\n` +
            `• *Waktu:* \`\`\`${time}\`\`\`\n` +
            `• *Tempat:* _${venue}_\n` +
            `• *Pengajar:* ${teachers}\n` +
            `• *Materi:* _${materials}_`
          );
        })
        .join('\n\n');

      replyMessage =
        `📅 *JADWAL PENGAJIAN HARI INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `${itemsText}\n\n` +
        `Semoga Allah SWT memberikan kemudahan dan kelancaran untuk hadir tepat waktu. 🌟\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `📅 *JADWAL PENGAJIAN HARI INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `Alhamdulillah, tidak ada jadwal pengajian terjadwal untuk hari ini. Selamat beristirahat atau muraja'ah mandiri di rumah! 🌿\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'JADWAL_HARI_INI',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 2: JADWAL MINGGUAN / PEKAN INI
  // =========================================================================
  if (isWeekly) {
    const { weekStart, weekEnd, periodLabel } = getUpcomingWeekRangeWIB(new Date());
    const schedules = await findSchedulesInRange(weekStart, weekEnd);

    let replyMessage = '';
    if (schedules.length > 0) {
      const itemsText = schedules
        .map((s, idx) => {
          const dayName = formatIndonesianDateWIB(s.startTime);
          const time = `${formatIndonesianTimeWIB(s.startTime)} - ${formatIndonesianTimeWIB(s.endTime)} WIB`;
          const venue = s.venuePlaceName || 'Masjid';
          const teachers =
            s.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

          return (
            `*${idx + 1}. ${dayName}*\n` +
            `• *Sesi:* *${s.title}*\n` +
            `• *Waktu:* \`\`\`${time}\`\`\`\n` +
            `• *Tempat:* _${venue}_\n` +
            `• *Pengajar:* ${teachers}`
          );
        })
        .join('\n\n');

      replyMessage =
        `📋 *AGENDA PENGAJIAN PEKAN INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *Periode:* ${periodLabel}\n\n` +
        `${itemsText}\n\n` +
        `Total ada *${schedules.length} sesi pengajian* terjadwal untuk sepekan ini.\n` +
        `Alhamdulillah Jazakumullahu Khairan.\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `📋 *AGENDA PENGAJIAN PEKAN INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *Periode:* ${periodLabel}\n\n` +
        `Belum ada sesi pengajian yang diagendakan pada rentang pekan ini.\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'JADWAL_MINGGUAN',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 3: JADWAL BESOK (H-1)
  // =========================================================================
  if (isTomorrow) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { startOfDay, endOfDay } = getDayRangeWIB(tomorrow);
    const schedules = await findSchedulesInRange(startOfDay, endOfDay);
    const dateLabel = formatIndonesianDateWIB(tomorrow);

    let replyMessage = '';
    if (schedules.length > 0) {
      const itemsText = schedules
        .map((s, idx) => {
          const time = `${formatIndonesianTimeWIB(s.startTime)} - ${formatIndonesianTimeWIB(s.endTime)} WIB`;
          const venue = s.venuePlaceName || 'Masjid';
          const teachers =
            s.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

          return (
            `*${idx + 1}. ${s.title}*\n` +
            `• *Waktu:* \`\`\`${time}\`\`\`\n` +
            `• *Tempat:* _${venue}_\n` +
            `• *Pengajar:* ${teachers}`
          );
        })
        .join('\n\n');

      replyMessage =
        `🔔 *JADWAL PENGAJIAN BESOK*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `${itemsText}\n\n` +
        `Persiapkan diri dan perlengkapan mengaji dari sekarang ya! 🌟\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `🔔 *JADWAL PENGAJIAN BESOK*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `Alhamdulillah, tidak ada jadwal pengajian untuk esok hari.\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'JADWAL_BESOK',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 4: TARGET MATERI / KURIKULUM BULAN INI
  // =========================================================================
  if (isMaterial && generationId) {
    const now = new Date();
    const currentMonth = Number(
      new Intl.DateTimeFormat('id-ID', { month: 'numeric', timeZone: 'Asia/Jakarta' }).format(now)
    );
    const currentYear = Number(
      new Intl.DateTimeFormat('id-ID', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now)
    );
    const monthName = new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      timeZone: 'Asia/Jakarta',
    }).format(now);

    const targets = await prisma.materialMonthlyTarget.findMany({
      where: {
        generationId,
        year: currentYear,
        month: currentMonth,
        isActive: true,
      },
      include: {
        material: true,
      },
      orderBy: { orderIndex: 'asc' },
    });

    let replyMessage = '';
    if (targets.length > 0) {
      const itemsText = targets
        .map((t, idx) => {
          return `*${idx + 1}. ${t.material.title}*\n   _${t.material.description || 'Target kurikulum aktif'}_`;
        })
        .join('\n\n');

      replyMessage =
        `📚 *TARGET KURIKULUM BULAN INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `🗓️ *Bulan:* ${monthName} ${currentYear}\n\n` +
        `${itemsText}\n\n` +
        `Mari bersama-sama kita capai target materi kurikulum ini dengan tekun dan istiqomah! 💪\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `📚 *TARGET KURIKULUM BULAN INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `🗓️ *Bulan:* ${monthName} ${currentYear}\n\n` +
        `Target kurikulum bulanan khusus belum diset oleh PJ Kurikulum. Kegiatan pengajian berjalan mengacu pada silabus materi rutin aktif.\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'MATERI_BULANAN',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 5: INFORMASI PENGAJAR BERTUGAS
  // =========================================================================
  if (isTeacher) {
    const { startOfDay, endOfDay } = getDayRangeWIB(new Date());
    const schedules = await findSchedulesInRange(startOfDay, endOfDay);
    const dateLabel = formatIndonesianDateWIB(new Date());

    let replyMessage = '';
    if (schedules.length > 0) {
      const itemsText = schedules
        .map((s) => {
          const teachers =
            s.teachers.map((t) => `*${t.teacher.fullName}* (${t.isPrimary ? 'Utama' : 'Pendamping'})`).join('\n• ') ||
            'Dewan Pengajar';
          return `*${s.title}*\n• ${teachers}`;
        })
        .join('\n\n');

      replyMessage =
        `👨‍🏫 *PENGAJAR BERTUGAS HARI INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `${itemsText}\n\n` +
        `Mari kita doakan para Ustadz/Ustadzah senantiasa diberikan kelancaran dan kesehatan dalam membimbing kita. 🤲\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `👨‍🏫 *INFORMASI PENGAJAR*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n` +
        `📆 *${dateLabel}*\n\n` +
        `Tidak ada sesi pengajian terjadwal untuk hari ini.\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'PENGAJAR_HARI_INI',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 6: INFORMASI LOKASI / TEMPAT PENGAJIAN
  // =========================================================================
  if (isLocation) {
    const { startOfDay, endOfDay } = getDayRangeWIB(new Date());
    const todaySchedules = await findSchedulesInRange(startOfDay, endOfDay);

    let replyMessage = '';
    if (todaySchedules.length > 0) {
      const itemsText = todaySchedules
        .map((s, idx) => {
          const time = `${formatIndonesianTimeWIB(s.startTime)} - ${formatIndonesianTimeWIB(s.endTime)} WIB`;
          return (
            `*${idx + 1}. ${s.title}*\n` +
            `• *Tempat:* _${s.venuePlaceName || 'Masjid'}_ (${s.venueType || 'MASJID'})\n` +
            `• *Waktu:* \`\`\`${time}\`\`\`\n` +
            (s.notes ? `• *Keterangan:* _${s.notes}_\n` : '')
          );
        })
        .join('\n\n');

      replyMessage =
        `📍 *LOKASI PENGAJIAN HARI INI*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n\n` +
        `${itemsText}\n` +
        `Mari hadir tepat waktu dengan pakaian rapi dan sopan. 🕌\n` +
        `— *Sistem Pengajian ${orgName}*`;
    } else {
      replyMessage =
        `📍 *INFORMASI LOKASI PENGAJIAN*\n` +
        `🏷️ *Jenjang:* ${groupTargetName}\n\n` +
        `Hari ini tidak ada sesi pengajian terjadwal. Lokasi pengajian reguler jenjang ini bertempat di Masjid / Aula binaan *${orgName}*.\n\n` +
        `Ketik *@no_bot jadwal besok* atau *@no_bot jadwal mingguan* untuk melihat tempat sesi berikutnya! 🌿\n\n` +
        `— *Sistem Pengajian ${orgName}*`;
    }

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'LOKASI_PENGAJIAN',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 7: INFORMASI KONTAK PENGURUS & ADMINISTRASI
  // =========================================================================
  if (isContact) {
    const replyMessage =
      `📞 *INFORMASI PENGURUS & ADMINISTRASI*\n` +
      `🏷️ *Jenjang:* ${groupTargetName}\n` +
      `🏛️ *Organisasi:* ${orgName}\n\n` +
      `Bagi Bapak/Ibu atau Santri yang memiliki pertanyaan seputar administrasi, pendaftaran, kurikulum, atau konfirmasi khusus, silakan menghubungi:\n` +
      `• *Musyrif / PJ Jenjang:* Hubungi kontak pengurus grup ini\n` +
      `• *Hotline Chatbot WhatsApp:* wa.me/6285165868482\n\n` +
      `Semoga senantiasa dimudahkan dalam segala urusan kebaikan. 🌟\n` +
      `— *Pengurus Pengajian ${orgName}*`;

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'KONTAK_PENGURUS',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 8: INFORMASI PERMOHONAN IZIN (PRIVASI JAPRI)
  // =========================================================================
  if (isAbsence) {
    const replyMessage =
      `ℹ️ *PANDUAN PENGAJUAN IZIN SANTRI*\n` +
      `🏷️ *Grup:* ${groupTargetName}\n\n` +
      `Untuk menjaga ketertiban administrasi dan privasi keluarga, permohonan izin santri dimohon untuk diajukan melalui *chat pribadi (japri)* ke nomor bot ini:\n` +
      `👉 wa.me/6285165868482\n\n` +
      `Cukup ketik *'izin'* atau *'sakit'* di chat pribadi bot untuk mendapatkan formulir konfirmasi digital instan tanpa login.\n\n` +
      `Alhamdulillah Jazakumullahu Khairan.\n` +
      `— *Sistem Pengajian ${orgName}*`;

    await sendGroupReply(replyMessage);
    return {
      handled: true,
      action: 'IZIN_INFO',
      replySent: true,
      replyMessage,
      groupId,
    };
  }

  // =========================================================================
  // AKSI 9: MENU BANTUAN & PERINTAH GRUP
  // =========================================================================
  const helpMessage =
    `🤖 *LAYANAN ASISTEN PENGAJIAN GRUP*\n` +
    `🏷️ *Grup:* ${groupTargetName}\n\n` +
    `Halo Bapak/Ibu & Rekan-Rekan sekalian! Saya adalah asisten bot sistem pengajian.\n` +
    `Agar bot merespon di grup, awali pesan dengan tag *@no_bot* atau *@bot* diikuti perintah berikut:\n\n` +
    `• *@no_bot jadwal hari ini* — Cek jadwal pengajian hari ini\n` +
    `• *@no_bot jadwal mingguan* — Cek agenda pengajian sepekan\n` +
    `• *@no_bot jadwal besok* — Cek jadwal pengajian esok hari (H-1)\n` +
    `• *@no_bot materi bulan ini* — Cek target kurikulum aktif\n` +
    `• *@no_bot pengajar* — Cek ustadz bertugas hari ini\n` +
    `• *@no_bot lokasi* — Cek tempat / masjid pengajian\n` +
    `• *@no_bot kontak* — Informasi kontak pengurus\n` +
    `• *@no_bot izin* — Info pengajuan izin santri via japri\n\n` +
    `Semoga senantiasa lancar dan barokah! 🌟\n` +
    `— *Pengurus Pengajian ${orgName}*`;

  await sendGroupReply(helpMessage);
  return {
    handled: true,
    action: 'MENU_BANTUAN',
    replySent: true,
    replyMessage: helpMessage,
    groupId,
  };
}
