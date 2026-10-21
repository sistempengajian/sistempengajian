import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { whatsAppClient } from './WhatsAppClient';
import { SendMessageOptions } from './types';
import { isDuplicateInboundMessage } from './inboundDeduplication';
import {
  normalizePhoneNumber,
  extractCleanPhoneFromJid,
  getCanonicalPhoneVariants,
  formatParentSalutation,
  formatStudentSalutation,
  getBaseAppUrl,
  isWhatsAppLidJid,
} from './utils';
import { generateStudentAbsenceRequestToken } from '@/lib/studentAbsenceToken';

/**
 * Mengirim balasan WhatsApp dengan simulasi status "sedang mengetik..." (typing indicator)
 * dan jeda waktu yang realistis (2.0s - 3.5s) agar interaksi terasa alami dan tidak kaku/robotik.
 */
async function sendReplyWithTyping(
  replyDestination: string,
  options: Omit<SendMessageOptions, 'to'>,
  minDelayMs = 2000,
  maxDelayMs = 3500
) {
  // 1. Tampilkan indikator status "mengetik..." di WhatsApp penerima
  await whatsAppClient.startTyping(replyDestination).catch(() => {});

  // 2. Berikan jeda waktu simulasi mengetik yang alami
  const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // 3. Eksekusi pengiriman pesan balasan
  const sendResult = await whatsAppClient.sendMessage({
    ...options,
    to: replyDestination,
  });

  // 4. Hentikan status mengetik
  await whatsAppClient.stopTyping(replyDestination).catch(() => {});

  return sendResult;
}

// Regex Intent Classifiers
export const INTENT_REGEX = {
  ABSENCE: /\b(izin|ijin|sakit|demam|panas|meriang|pusing|batuk|pilek|flu|berhalangan|halangan|keperluan|acara|kondangan|hajat|hajatan|dinas|tugas|tidak bisa hadir|tidak hadir|tidak masuk|tidak bisa ikut|ga bisa hadir|ga bisa masuk|ga bisa ikut|gak bisa hadir|gak bisa masuk|gak bisa ikut|gk bisa hadir|gk bisa masuk|gk bisa ikut|nggak bisa hadir|nggak bisa masuk|nggak bisa ikut|absen|rawat|dirawat|opname|bedrest|keluar kota|ke luar kota|pulang kampung|mudik)\b/i,
  CLOSING_PRAYER: /^\s*(aamiin|amiin|amin|aamin)\b/i,
  AFFIRMATION: /\b(siap|oke|ok|baik|noted|insyaallah|insya allah|bismillah|inggih|siap hadir|bisa hadir|hadir ustadz|siap ustadz|siap ustadzah|siap kak|siap laksanakan)\b/i,
  GREETING: /\b(assalamu|assalamualaikum|assalamu'alaikum|waalaikumsalam|wa'alaikumsalam|samlikum|halo|hai|selamat pagi|selamat siang|selamat sore|selamat malam)\b/i,
  THANKS: /\b(alhamdulillah|syukron|syukran|terima kasih|terimakasih|makasih|jazakallah|jazakillah|jazakumullah)\b/i,
};

/**
 * Mencari jadwal pengajian yang secara presisi ditargetkan untuk santri tertentu
 * berdasarkan organisasi, jenjang (generationId), atau kelas terdaftar.
 */
export async function findMatchingScheduleForStudent(
  student: {
    id: string;
    organizationId?: string | null;
    generationId?: string | null;
  },
  windowStart: Date,
  windowEnd: Date
) {
  if (!student.organizationId) return null;

  const schedules = await prisma.schedule.findMany({
    where: {
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      startTime: { gte: windowStart, lte: windowEnd },
      organizationId: student.organizationId,
    },
    include: {
      class: true,
      targetClasses: {
        include: {
          class: true,
        },
      },
      targetGenerations: true,
      organization: true,
    },
    orderBy: { startTime: 'asc' },
  });

  const matched = schedules.find((sch) => {
    // 1. Cek kecocokan target jenjang langsung
    if (
      student.generationId &&
      sch.targetGenerations.length > 0 &&
      sch.targetGenerations.some((tg) => tg.generationId === student.generationId)
    ) {
      return true;
    }

    // 2. Cek kecocokan target kelas majemuk (targetClasses)
    if (
      student.generationId &&
      sch.targetClasses.length > 0 &&
      sch.targetClasses.some((tc) => tc.class?.generationId === student.generationId)
    ) {
      return true;
    }

    // 3. Cek kelas tunggal jadwal (class)
    if (
      student.generationId &&
      sch.class &&
      sch.class.generationId === student.generationId
    ) {
      return true;
    }

    // 4. Jadwal umum terbuka tanpa batasan kelas/jenjang (Wilayah Umum)
    if (
      sch.targetClasses.length === 0 &&
      sch.targetGenerations.length === 0 &&
      !sch.classId
    ) {
      return true;
    }

    return false;
  });

  return matched || null;
}

// In-memory + Redis distributed rate limiter: mencegah bot membalas lebih dari 1x per 15 detik ke nomor yang sama
const recentAutoReplies = new Map<string, number>();

async function isRateLimited(phone: string): Promise<boolean> {
  const cleanPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
  const now = Date.now();

  // 1. Cek Lapis 1 (In-Memory Map)
  const lastTime = recentAutoReplies.get(phone);
  if (lastTime && now - lastTime < 15000) {
    return true;
  }

  // 2. Cek Lapis 2 (Upstash Redis Distributed Lock dengan TTL 15 detik)
  if (redis && cleanPhone) {
    try {
      const setResult = await redis.set(`wa:ratelimit:direct:${cleanPhone}`, '1', {
        ex: 15,
        nx: true,
      });

      if (setResult === null) {
        recentAutoReplies.set(phone, now);
        return true;
      }
    } catch (redisErr) {
      console.warn('[WhatsApp RateLimit] Peringatan saat akses Redis rate limit:', redisErr);
      // Fallback tenang ke Lapis 1
    }
  }

  recentAutoReplies.set(phone, now);

  // Bersihkan cache lama berkala (> 5 menit)
  if (recentAutoReplies.size > 500) {
    for (const [k, v] of recentAutoReplies.entries()) {
      if (now - v > 300000) recentAutoReplies.delete(k);
    }
  }

  return false;
}

function formatIndonesianDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

function formatIndonesianTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
}

const INBOUND_USER_INCLUDE = {
  roles: true,
  children: {
    include: {
      student: {
        include: {
          generation: true,
          organization: true,
        },
      },
    },
  },
  generation: true,
  organization: true,
};

/**
 * Resolusi data pengguna pengirim melalui 4 lapisan identifikasi:
 * Lapisan 1: JID / Nomor HP kanonikal pengirim (membersihkan multi-device suffix seperti :1@c.us, :2@s.whatsapp.net, dll)
 * Lapisan 2: ID WhatsApp LID (@lid) yang sudah tersimpan pada profil user
 * Lapisan 3: Riwayat pesan keluar (whatsAppMessageLog) via quotedMessageId (stanzaId pengingat sebelumnya)
 * Lapisan 4: Nomor HP yang diketikkan di dalam teks pesan (fallback registrasi/penautan mandiri)
 *
 * Serta otomatis menautkan whatsappLid jika berhasil diidentifikasi dari kanal @lid.
 */
async function resolveInboundUser(params: {
  replyDestination: string;
  normalizedPhone: string | null;
  quotedMessageId?: string;
  rawText?: string;
}) {
  const { replyDestination, normalizedPhone, quotedMessageId, rawText } = params;

  // 1. Cari berdasarkan whatsappLid atau normalizedPhone
  const userConditions: any[] = [{ whatsappLid: replyDestination }];
  if (normalizedPhone) {
    userConditions.push({ phoneNumber: { in: getCanonicalPhoneVariants(normalizedPhone) } });
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: userConditions,
      status: 'ACTIVE',
    },
    include: INBOUND_USER_INCLUDE,
  });

  // 2. Jika belum ditemukan dan ada quotedMessageId, cari dari riwayat pengiriman pesan keluar (whatsAppMessageLog)
  if (!user && quotedMessageId) {
    const cleanQuotedId = quotedMessageId.trim();
    const quotedLog = await prisma.whatsAppMessageLog.findFirst({
      where: {
        OR: [
          { gatewayMessageId: cleanQuotedId },
          { gatewayMessageId: { endsWith: cleanQuotedId } },
        ],
      },
      select: {
        recipientUserId: true,
        recipientPhone: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (quotedLog) {
      if (quotedLog.recipientUserId) {
        user = await prisma.user.findFirst({
          where: {
            id: quotedLog.recipientUserId,
            status: 'ACTIVE',
          },
          include: INBOUND_USER_INCLUDE,
        });
      }

      if (!user && quotedLog.recipientPhone) {
        const logCleanPhone = extractCleanPhoneFromJid(quotedLog.recipientPhone);
        if (logCleanPhone) {
          user = await prisma.user.findFirst({
            where: {
              phoneNumber: { in: getCanonicalPhoneVariants(logCleanPhone) },
              status: 'ACTIVE',
            },
            include: INBOUND_USER_INCLUDE,
          });
        }
      }
    }
  }

  // 3. Jika belum ditemukan, periksa apakah pengguna menyertakan nomor HP dalam pesan teksnya
  if (!user && rawText) {
    const phoneRegex = /\b(08\d{8,12}|628\d{8,12}|\+628\d{8,12})\b/;
    const match = rawText.match(phoneRegex);
    if (match) {
      const extractedPhone = normalizePhoneNumber(match[1]);
      if (extractedPhone) {
        user = await prisma.user.findFirst({
          where: {
            phoneNumber: { in: getCanonicalPhoneVariants(extractedPhone) },
            status: 'ACTIVE',
          },
          include: INBOUND_USER_INCLUDE,
        });
      }
    }
  }

  // 4. Auto-link whatsappLid jika user berhasil ditemukan dan kanal masuk adalah @lid
  if (user && isWhatsAppLidJid(replyDestination) && user.whatsappLid !== replyDestination) {
    await prisma.user.update({
      where: { id: user.id },
      data: { whatsappLid: replyDestination },
    }).catch((err) => {
      console.error(`[WhatsApp Inbound] Gagal auto-link whatsappLid ${replyDestination} ke user ${user.id}:`, err);
    });
  }

  return user;
}

export interface InboundMessagePayload {
  from: string;
  body: string;
  fromMe?: boolean;
  messageId?: string;
  timestamp?: number;
  authorPhone?: string;
  quotedMessageId?: string;
}

export interface InboundProcessResult {
  handled: boolean;
  intent: 'ABSENCE' | 'CLOSING_PRAYER' | 'AFFIRMATION' | 'GREETING' | 'THANKS' | 'OTHER' | 'IGNORED_SELF' | 'RATE_LIMITED' | 'DUPLICATE_MESSAGE';
  replySent?: boolean;
  replyMessage?: string;
  recipientPhone?: string;
  error?: string;
}

/**
 * Memproses pesan masuk dari WhatsApp Webhook dan memberikan respons otomatis cerdas
 */
export async function processInboundWhatsAppMessage(
  payload: InboundMessagePayload
): Promise<InboundProcessResult> {
  // 0. Proteksi Deduplikasi Pesan Masuk (Anti Double-Reply dari WAHA / Gateway Re-delivery)
  if (payload.messageId && (await isDuplicateInboundMessage(payload.messageId))) {
    console.log(`[WhatsApp Inbound] 🛑 Pesan pribadi diabaikan karena messageId duplikat: ${payload.messageId}`);
    return {
      handled: false,
      intent: 'DUPLICATE_MESSAGE',
      replySent: false,
      recipientPhone: payload.from,
    };
  }

  // 1. Proteksi Anti-Loop: Abaikan pesan dari akun bot sendiri
  if (payload.fromMe === true) {
    return { handled: false, intent: 'IGNORED_SELF' };
  }

  // 1b. Proteksi Grup & Siaran: Hanya tangani percakapan langsung pribadi (1-on-1 direct chat)
  const rawSender = (payload.from || '').toLowerCase();
  if (
    rawSender.endsWith('@g.us') ||
    rawSender.includes('broadcast') ||
    rawSender.endsWith('@newsletter')
  ) {
    return { handled: false, intent: 'OTHER' };
  }

  const rawText = (payload.body || '').trim();
  if (!rawText) {
    return { handled: false, intent: 'OTHER' };
  }

  // Tujuan balasan pesan (chat thread asal: bisa @c.us atau @lid)
  const replyDestination = payload.from.trim();

  // Proteksi Rate Limiting
  if (await isRateLimited(replyDestination)) {
    return {
      handled: true,
      intent: 'RATE_LIMITED',
      replySent: false,
      recipientPhone: replyDestination,
    };
  }

  // 2. Normalisasi nomor telepon pengirim untuk pencarian database profil pengguna
  let cleanPhoneCandidate: string | null = null;
  if (payload.authorPhone) {
    cleanPhoneCandidate = extractCleanPhoneFromJid(payload.authorPhone) || normalizePhoneNumber(payload.authorPhone);
  }
  if (!cleanPhoneCandidate && payload.from) {
    cleanPhoneCandidate = extractCleanPhoneFromJid(payload.from);
  }
  if (!cleanPhoneCandidate && !payload.from.includes('@')) {
    cleanPhoneCandidate = normalizePhoneNumber(payload.from);
  }

  const normalizedPhone = cleanPhoneCandidate;

  const baseUrl = getBaseAppUrl();

  // 3. Deteksi Niat Percakapan (Intent Classification)
  const isAbsence = INTENT_REGEX.ABSENCE.test(rawText);
  const isClosingPrayer = INTENT_REGEX.CLOSING_PRAYER.test(rawText);
  const isAffirmation = INTENT_REGEX.AFFIRMATION.test(rawText);
  const isGreeting = INTENT_REGEX.GREETING.test(rawText);
  const isThanks = INTENT_REGEX.THANKS.test(rawText);

  // =========================================================================
  // FITUR KHUSUS: PENAUTAN AKUN INSTAN VIA NOMOR HP (ACCOUNT LINKING)
  // Jika pengguna mengirimkan nomor teleponnya (misal: "0882007730579")
  // =========================================================================
  const phoneOnlyMatch = rawText.match(/^\s*(?:\+?62|0)8\d{8,12}\s*$/);
  if (phoneOnlyMatch && isWhatsAppLidJid(replyDestination)) {
    const rawNumber = rawText.trim();
    const candidatePhone = normalizePhoneNumber(rawNumber);
    if (candidatePhone) {
      const linkedUser = await prisma.user.findFirst({
        where: {
          phoneNumber: { in: getCanonicalPhoneVariants(candidatePhone) },
          status: 'ACTIVE',
        },
        include: { roles: true },
      });

      if (linkedUser) {
        await prisma.user.update({
          where: { id: linkedUser.id },
          data: { whatsappLid: replyDestination },
        });

        const rolesList = linkedUser.roles.map((r) => r.role).join(', ') || 'Santri/Wali';
        const linkSuccessReply =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
          `Alhamdulillah! Akun pengajian atas nama *${linkedUser.fullName}* (${rolesList}) berhasil ditautkan ke WhatsApp ini. ✨\n\n` +
          `Nomor WhatsApp Anda sekarang telah terdaftar penuh di sistem pengajian.\n\n` +
          `Panduan Layanan:\n` +
          `• *Ketik 'izin' atau 'sakit'* untuk formulir konfirmasi izin instan\n` +
          `• *Ketik 'siap'* untuk konfirmasi kesiapan hadir\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Pengurus Pengajian*`;

        await sendReplyWithTyping(replyDestination, {
          recipientName: linkedUser.fullName,
          recipientUserId: linkedUser.id,
          messageType: 'CUSTOM_DIRECT',
          message: linkSuccessReply,
        });

        return {
          handled: true,
          intent: 'OTHER',
          replySent: true,
          replyMessage: linkSuccessReply,
          recipientPhone: replyDestination,
        };
      }
    }
  }

  // =========================================================================
  // KASUS A: INTENT IZIN / SAKIT (SMART ABSENCE AUTO-RESPONDER)
  // =========================================================================
  if (isAbsence) {
    // Resolusi User melalui strategi 4 lapisan (Phone Kanonikal, WhatsApp LID, Quoted Reminder Log, atau Input Nomor Teks)
    const user = await resolveInboundUser({
      replyDestination,
      normalizedPhone,
      quotedMessageId: payload.quotedMessageId,
      rawText,
    });

    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 jam ke belakang
    const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 jam ke depan

    // Sub-Kasus A.1: Pengirim adalah Orang Tua / Wali Santri (memiliki anak terdaftar)
    if (user && user.children && user.children.length > 0) {
      const sapaanOrtu = `*${formatParentSalutation(user.fullName, user.gender, user.children[0]?.relationshipType)}* *- Wali Santri.*`;

      const childItemsText: string[] = [];

      for (const rel of user.children) {
        const student = rel.student;
        const studentGenName = student.generation?.name || 'Jenjang';

        // Cari jadwal terdekat yang cocok dengan santri ini
        const matchedSchedule = await findMatchingScheduleForStudent(
          student,
          windowStart,
          windowEnd
        );

        if (matchedSchedule) {
          const absenceToken = generateStudentAbsenceRequestToken(
            matchedSchedule.id,
            student.id,
            user.id,
            'PARENT'
          );
          const absenceUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;
          const dayDate = formatIndonesianDate(matchedSchedule.startTime);
          const timeRange = `${formatIndonesianTime(matchedSchedule.startTime)} - ${formatIndonesianTime(matchedSchedule.endTime)} WIB`;

          childItemsText.push(
            `*${matchedSchedule.title}*\n` +
            `*${dayDate}*\n\n` +
            `*• Santri* _${student.fullName} (${studentGenName})_\n` +
            `*• Waktu* \`\`\`${timeRange}\`\`\`\n` +
            `*• Tempat* _${matchedSchedule.venuePlaceName || 'Masjid'}_\n\n` +
            `*Tautan Konfirmasi Izin Santri:*\n${absenceUrl}`
          );
        }
      }

      let replyBody = '';
      if (childItemsText.length > 0) {
        replyBody =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
          `${sapaanOrtu}\n\n` +
          `Terima kasih atas informasinya. Untuk mencatatkan konfirmasi izin resmi ananda pada presensi digital pengajian, silakan klik tautan instan di bawah ini (tanpa perlu login):\n\n` +
          childItemsText.join('\n\n') +
          `\n\nSetelah formulir dikirimkan, surat izin ananda akan otomatis diverifikasi oleh Wali Kelas.\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Sistem Notifikasi Pengajian*`;
      } else {
        replyBody =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
          `${sapaanOrtu}\n\n` +
          `Terima kasih atas konfirmasinya. Saat ini tidak ditemukan agenda pengajian dalam kurun waktu 24 jam ke depan untuk santri Anda.\n\n` +
          `Apabila ingin mengajukan izin untuk sesi pengajian mendatang, mohon berkenan menghubungi langsung Wali Kelas atau Pengurus Wilayah setempat.\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Sistem Notifikasi Pengajian*`;
      }

      await sendReplyWithTyping(replyDestination, {
        recipientName: user.fullName,
        recipientUserId: user.id,
        messageType: 'CUSTOM_DIRECT',
        message: replyBody,
      });

      return {
        handled: true,
        intent: 'ABSENCE',
        replySent: true,
        replyMessage: replyBody,
        recipientPhone: replyDestination,
      };
    }

    // Sub-Kasus A.2: Pengirim adalah Pengajar, Santri, atau Pengajar Multi-Role (Pengajar + Santri)
    if (user) {
      const isTeacherRole = user.roles?.some((r) => r.role === 'PENGAJAR' || r.role === 'WALI_KELAS');
      const isStudentRole = user.roles?.some((r) => r.role === 'SANTRI') || Boolean(user.generationId);

      // Cari apakah ada jadwal mengajar dalam kurun waktu aktif
      const teacherSchedule = isTeacherRole
        ? await prisma.scheduleTeacher.findFirst({
            where: {
              teacherId: user.id,
              schedule: {
                status: { in: ['SCHEDULED', 'ACTIVE'] },
                startTime: { gte: windowStart, lte: windowEnd },
              },
            },
            include: {
              schedule: {
                include: {
                  organization: true,
                },
              },
            },
            orderBy: {
              schedule: { startTime: 'asc' },
            },
          })
        : null;

      // Cari apakah ada jadwal belajar santri yang sesuai jenjang
      const studentSchedule = isStudentRole
        ? await findMatchingScheduleForStudent(
            {
              id: user.id,
              organizationId: user.organizationId,
              generationId: user.generationId,
            },
            windowStart,
            windowEnd
          )
        : null;

      // Kasus A.2.1: Multi-Role Aktif (Terjadwal Mengajar DAN Terdaftar Santri di Window Waktu Ini)
      if (teacherSchedule && studentSchedule) {
        const schT = teacherSchedule.schedule;
        const dayDateT = formatIndonesianDate(schT.startTime);
        const timeRangeT = `${formatIndonesianTime(schT.startTime)} - ${formatIndonesianTime(schT.endTime)} WIB`;
        const scheduleUrlT = `${baseUrl}/jadwal/${schT.id}`;

        const schS = studentSchedule;
        const dayDateS = formatIndonesianDate(schS.startTime);
        const timeRangeS = `${formatIndonesianTime(schS.startTime)} - ${formatIndonesianTime(schS.endTime)} WIB`;
        const absenceTokenS = generateStudentAbsenceRequestToken(
          schS.id,
          user.id,
          user.id,
          'STUDENT'
        );
        const absenceUrlS = `${baseUrl}/izin/ajukan/${absenceTokenS}`;

        const studentGen = user.generation?.name || 'Muda-Mudi';
        const sapaanMulti = `*Ustadz ${user.fullName}* *- Pengajar & Santri ${studentGen}.*`;

        const replyBody =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
          `${sapaanMulti}\n\n` +
          `Terima kasih atas informasinya. Kami mencatat konfirmasi izin Anda untuk 2 agenda pengajian berikut:\n\n` +
          `*1. Amanah Mengajar:*\n` +
          `*${schT.title}*\n` +
          `*${dayDateT}*\n\n` +
          `*• Waktu* \`\`\`${timeRangeT}\`\`\`\n` +
          `*• Tempat* _${schT.venuePlaceName || 'Masjid'}_\n\n` +
          `*Detail Jadwal & Ruang Pengajar:*\n${scheduleUrlT}\n` +
          `_(Mohon koordinasikan permohonan badal mengajar dengan Koordinator Pengajar setempat)_\n\n` +
          `*2. Presensi Belajar Santri:*\n` +
          `*${schS.title}*\n` +
          `*${dayDateS}*\n\n` +
          `*• Waktu* \`\`\`${timeRangeS}\`\`\`\n` +
          `*• Tempat* _${schS.venuePlaceName || 'Masjid'}_\n\n` +
          `*Tautan Pengajuan Izin Santri:*\n${absenceUrlS}\n\n` +
          `Setelah formulir dikirimkan, pengajuan izin santri Anda akan langsung diverifikasi oleh Wali Kelas.\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Sistem Notifikasi Pengajian*`;

        await sendReplyWithTyping(replyDestination, {
          recipientName: user.fullName,
          recipientUserId: user.id,
          messageType: 'CUSTOM_DIRECT',
          message: replyBody,
        });

        return {
          handled: true,
          intent: 'ABSENCE',
          replySent: true,
          replyMessage: replyBody,
          recipientPhone: replyDestination,
        };
      }

      // Kasus A.2.2: Pengajar Biasa (Sedang Terjadwal Mengajar)
      if (teacherSchedule) {
        const sch = teacherSchedule.schedule;
        const dayDate = formatIndonesianDate(sch.startTime);
        const timeRange = `${formatIndonesianTime(sch.startTime)} - ${formatIndonesianTime(sch.endTime)} WIB`;
        const sapaanUstadz = `*Ustadz ${user.fullName}* *- Pengajar.*`;
        const scheduleUrl = `${baseUrl}/jadwal/${sch.id}`;

        const replyBody =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
          `${sapaanUstadz}\n\n` +
          `Terima kasih atas informasinya. Kami mencatat konfirmasi izin berhalangan mengajar Anda untuk sesi:\n\n` +
          `*${sch.title}*\n` +
          `*${dayDate}*\n\n` +
          `*• Waktu* \`\`\`${timeRange}\`\`\`\n` +
          `*• Tempat* _${sch.venuePlaceName || 'Masjid'}_\n\n` +
          `*Detail Jadwal & Ruang Pengajar:*\n${scheduleUrl}\n\n` +
          `Mohon berkenan mengoordinasikan permohonan badal mengajar dengan Koordinator Pengajar atau Pengurus Wilayah setempat.\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Sistem Notifikasi Pengajian ${sch.organization?.name || ''}*`;

        await sendReplyWithTyping(replyDestination, {
          recipientName: user.fullName,
          recipientUserId: user.id,
          messageType: 'CUSTOM_DIRECT',
          message: replyBody,
        });

        return {
          handled: true,
          intent: 'ABSENCE',
          replySent: true,
          replyMessage: replyBody,
          recipientPhone: replyDestination,
        };
      }

      // Kasus A.2.3: Santri Mandiri (Atau Pengajar yang Sesi Ini Berperan Sebagai Santri)
      if (studentSchedule) {
        const matchedSchedule = studentSchedule;
        const absenceToken = generateStudentAbsenceRequestToken(
          matchedSchedule.id,
          user.id,
          user.id,
          'STUDENT'
        );
        const absenceUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;
        const dayDate = formatIndonesianDate(matchedSchedule.startTime);
        const timeRange = `${formatIndonesianTime(matchedSchedule.startTime)} - ${formatIndonesianTime(matchedSchedule.endTime)} WIB`;

        const studentGen = user.generation?.name || 'Santri';
        const sapaanSantri = isTeacherRole
          ? `*Ustadz ${user.fullName}* *- Santri ${studentGen}.*`
          : `*${formatStudentSalutation(user.fullName)}* *- ${studentGen}.*`;

        const replyBody =
          `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
          `${sapaanSantri}\n\n` +
          `Terima kasih atas informasinya. Untuk mengajukan izin resmi pada presensi digital pengajian, silakan klik tautan instan di bawah ini (tanpa perlu login):\n\n` +
          `*${matchedSchedule.title}*\n` +
          `*${dayDate}*\n\n` +
          `*• Waktu* \`\`\`${timeRange}\`\`\`\n` +
          `*• Tempat* _${matchedSchedule.venuePlaceName || 'Masjid'}_\n\n` +
          `*Tautan Pengajuan Izin:*\n${absenceUrl}\n\n` +
          `Setelah formulir dikirimkan, pengajuan izin Anda akan langsung diverifikasi oleh Wali Kelas.\n\n` +
          `Alhamdulillah Jazakumullahu Khairan.\n` +
          `— *Sistem Notifikasi Pengajian ${matchedSchedule.organization?.name || ''}*`;

        await sendReplyWithTyping(replyDestination, {
          recipientName: user.fullName,
          recipientUserId: user.id,
          messageType: 'CUSTOM_DIRECT',
          message: replyBody,
        });

        return {
          handled: true,
          intent: 'ABSENCE',
          replySent: true,
          replyMessage: replyBody,
          recipientPhone: replyDestination,
        };
      }

      // Kasus A.2.4: Pengajar / Santri yang tidak memiliki jadwal dalam rentang 24 jam ke depan
      const sapaanFallback = isTeacherRole
        ? `*Ustadz ${user.fullName}* *- Pengajar.*`
        : `*${formatStudentSalutation(user.fullName)}* *- ${user.generation?.name || 'Santri'}.*`;

      const replyBody =
        `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n` +
        `${sapaanFallback}\n\n` +
        `Terima kasih atas informasinya. Saat ini tidak ditemukan sesi pengajian aktif dalam kurun waktu 24 jam ke depan.\n\n` +
        `Apabila Anda berhalangan hadir pada pengajian mendatang, silakan koordinasi langsung dengan Pengurus Wilayah atau Wali Kelas setempat.\n\n` +
        `Alhamdulillah Jazakumullahu Khairan.\n` +
        `— *Sistem Notifikasi Pengajian*`;

      await sendReplyWithTyping(replyDestination, {
        recipientName: user.fullName,
        recipientUserId: user.id,
        messageType: 'CUSTOM_DIRECT',
        message: replyBody,
      });

      return {
        handled: true,
        intent: 'ABSENCE',
        replySent: true,
        replyMessage: replyBody,
        recipientPhone: replyDestination,
      };
    }

    // Sub-Kasus A.3: Nomor Pengirim Belum Terdaftar di Sistem
    const fallbackUnregistered =
      `Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n` +
      `Terima kasih telah menghubungi Layanan Notifikasi Pengajian.\n\n` +
      `Nomor atau identitas WhatsApp Anda belum tertaut dengan data santri atau pengajar pada sistem kami.\n\n` +
      `💡 *Petunjuk Penautan Akun:*\n` +
      `Silakan kirimkan balasan berisi *nomor HP* Anda yang terdaftar pada sistem (contoh: *0882007730579*).\n` +
      `Sistem akan langsung memverifikasi dan menghubungkan WhatsApp Anda secara otomatis.\n\n` +
      `Alhamdulillah Jazakumullahu Khairan.\n` +
      `— *Layanan Notifikasi Sistem Pengajian*`;

    await sendReplyWithTyping(replyDestination, {
      messageType: 'CUSTOM_DIRECT',
      message: fallbackUnregistered,
    });

    return {
      handled: true,
      intent: 'ABSENCE',
      replySent: true,
      replyMessage: fallbackUnregistered,
      recipientPhone: replyDestination,
    };
  }

  // =========================================================================
  // KASUS B: INTENT DOA PENUTUP / AAMIIN / GESTUR (SILENT CLOSING)
  // Menghindari looping chat ping-pong saat pengguna membalas doa bot dengan Aamiin
  // =========================================================================
  const isCourtesyGesture = /^[\p{Emoji}\s.!-]{1,4}$/u.test(rawText);
  if (isClosingPrayer || isCourtesyGesture) {
    console.log(`[WhatsApp Inbound] Doa penutup/Aamiin/gestur diterima dari ${replyDestination}. Menutup percakapan secara tenang.`);
    return {
      handled: true,
      intent: 'CLOSING_PRAYER',
      replySent: false,
      recipientPhone: replyDestination,
    };
  }

  // =========================================================================
  // KASUS C: INTENT KONFIRMASI KESIAPAN / KEHADIRAN (SIAP / INSYAALLAH)
  // Pengguna membalas pengingat jadwal dengan kesiapan hadir
  // =========================================================================
  if (isAffirmation) {
    const userSender = await resolveInboundUser({
      replyDestination,
      normalizedPhone,
      quotedMessageId: payload.quotedMessageId,
      rawText,
    });

    const isTeacher = userSender?.roles?.some((r) => r.role === 'PENGAJAR' || r.role === 'WALI_KELAS');
    const affirmationReply = isTeacher
      ? `Alhamdulillah, terima kasih atas konfirmasinya Ustadz/Ustadzah.\n\n` +
        `Semoga Allah SWT senantiasa memberikan kemudahan, kelancaran, dan keberkahan dalam mengemban amanah mengajar generasi penerus.\n\n` +
        `— *Pengurus Pengajian*`
      : `Alhamdulillah, terima kasih atas konfirmasinya.\n\n` +
        `Selamat mengikuti sesi pengajian, semoga Allah SWT senantiasa memberikan kemudahan, kelancaran, dan keberkahan.\n\n` +
        `— *Pengurus Pengajian*`;

    await sendReplyWithTyping(replyDestination, {
      messageType: 'CUSTOM_DIRECT',
      message: affirmationReply,
    });

    return {
      handled: true,
      intent: 'AFFIRMATION',
      replySent: true,
      replyMessage: affirmationReply,
      recipientPhone: replyDestination,
    };
  }

  // =========================================================================
  // KASUS D: INTENT SALAM / SAPAAN
  // =========================================================================
  if (isGreeting) {
    const greetingReply =
      `Wa'alaikumussalam Warahmatullahi Wabarakatuh,\n\n` +
      `Terima kasih telah menghubungi Layanan Notifikasi Sistem Pengajian.\n\n` +
      `Pemberitahuan:\n` +
      `*• Saluran Otomatis* _Nomor ini adalah bot pengingat dan notifikasi pengajian otomatis_\n` +
      `*• Pengajuan Izin* _Ketik pesan memuat kata izin atau sakit untuk mendapatkan tautan instan_\n` +
      `*• Administrasi & Info* _Silakan hubungi Wali Kelas atau Pengurus Wilayah setempat_\n\n` +
      `Alhamdulillah Jazakumullahu Khairan.\n` +
      `— *Pengurus Pengajian*`;

    await sendReplyWithTyping(replyDestination, {
      messageType: 'CUSTOM_DIRECT',
      message: greetingReply,
    });

    return {
      handled: true,
      intent: 'GREETING',
      replySent: true,
      replyMessage: greetingReply,
      recipientPhone: replyDestination,
    };
  }

  // =========================================================================
  // KASUS E: INTENT UCAPAN TERIMA KASIH / JAZAKALLAH
  // =========================================================================
  if (isThanks) {
    const thanksReply =
      `Alhamdulillah Jazakumullahu Khairan Katsiran atas perhatian dan kerja sama Bapak/Ibu/Saudara sekalian.\n\n` +
      `Semoga Allah SWT senantiasa memberikan kemudahan, keberkahan, dan kelancaran dalam setiap aktivitas bimbingan generasi penerus.\n\n` +
      `— *Pengurus Pengajian*`;

    await sendReplyWithTyping(replyDestination, {
      messageType: 'CUSTOM_DIRECT',
      message: thanksReply,
    });

    return {
      handled: true,
      intent: 'THANKS',
      replySent: true,
      replyMessage: thanksReply,
      recipientPhone: replyDestination,
    };
  }

  // =========================================================================
  // KASUS F: PESAN TANPA KATA KUNCI (SILENT / TIDAK MERESPON DEMI MENCEGAH SPAM)
  // =========================================================================
  // Jika pesan pengguna tidak mengandung kata kunci yang dikenali (misal: stiker, reaksi,
  // atau percakapan acak), bot tetap diam tanpa mengirimkan balasan otomatis.
  console.log(
    `[Inbound WhatsApp] Pesan dari ${replyDestination} tidak memuat kata kunci ("${rawText}"). Bot tetap diam (silent / no-reply).`
  );

  return {
    handled: false,
    intent: 'OTHER',
    replySent: false,
    recipientPhone: replyDestination,
  };
}
