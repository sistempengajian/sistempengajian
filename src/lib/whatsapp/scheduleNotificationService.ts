import prisma from '@/lib/prisma';

import {
  sendScheduleReminderH1ToStudent,
  sendStudentActionLinkH1,
  sendScheduleReminderH1ToTeacher,
  sendScheduleReminderCountdownTeacher,
  sendTeacherActionLinksH1,
  sendTeacherPresensiLink2h,
  sendTeacherMultiScheduleDigestH1,
  sendTeacherMultiScheduleActionsH1,
  TeacherMultiScheduleItem,
  sendScheduleReminderCountdown,
  sendStudentActionLinks2h,
  sendScheduleChangeEmergencyAlert,
  sendFamilyScheduleReminderH1,
  sendFamilyActionLinkH1,
  sendFamilyScheduleReminderCountdown,
  sendFamilyActionLinks2h,
  sendUnifiedTeacherParentReminder,
} from './triggers';
import { isScheduleCombined } from './groupScheduleNotificationService';
import {
  generateStudentAbsenceRequestToken,
  generateFamilyActionHubToken,
} from '@/lib/studentAbsenceToken';
import { ScheduleStatus } from '@prisma/client';
import { whatsAppClient } from './WhatsAppClient';
import { normalizePhoneNumber, getBaseAppUrl } from './utils';
import { DEFAULT_TEMPLATES, renderTemplate } from './templateEngine';
import {
  sleepWithJitter,
  microDelayBetweenPairedMessages,
  isApproachingTimeout,
} from './pacingUtils';

export function isScheduleToday(date: Date): boolean {
  const scheduleDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
  const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  return scheduleDateStr === todayDateStr;
}

export function formatIndonesianDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
  return formatted.replace(/^Minggu,/i, 'Ahad,');
}

export function formatTime(date: Date): string {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);
  return formatted.replace('.', ':');
}

/**
 * Mengambil data rincian jadwal lengkap beserta pengajar, materi, dan target kelas/generasi
 */
export async function getScheduleDetailForNotification(scheduleId: string) {
  return prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      organization: true,
      class: {
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
      targetGenerations: {
        include: {
          generation: true,
        },
      },
      teachers: {
        where: {
          teacher: {
            status: 'ACTIVE',
          },
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
}

/**
 * Mengambil daftar santri dan orang tua yang menjadi target audiens sesi pengajian
 */
export async function getTargetStudentsForSchedule(schedule: NonNullable<Awaited<ReturnType<typeof getScheduleDetailForNotification>>>) {
  const rawTargetClasses: Array<{
    organizationId: string;
    generationId: string;
  }> = [];

  if (schedule.targetClasses && schedule.targetClasses.length > 0) {
    schedule.targetClasses.forEach((tc) => {
      if (tc.class) {
        rawTargetClasses.push({
          organizationId: tc.class.organizationId,
          generationId: tc.class.generationId,
        });
      }
    });
  } else if (schedule.class) {
    rawTargetClasses.push({
      organizationId: schedule.class.organizationId,
      generationId: schedule.class.generationId,
    });
  }

  const targetGenerationIds = schedule.targetGenerations?.map((tg) => tg.generationId) || [];

  const studentWhere: any = {
    status: 'ACTIVE',
    roles: {
      some: { role: 'SANTRI' },
    },
  };

  if (rawTargetClasses.length > 0) {
    studentWhere.OR = rawTargetClasses.map((cls) => ({
      organizationId: cls.organizationId,
      generationId: cls.generationId,
    }));
  } else if (targetGenerationIds.length > 0) {
    studentWhere.generationId = { in: targetGenerationIds };
    studentWhere.organizationId = schedule.organizationId;
  } else {
    // WILAYAH_UMUM / fallback
    const orgId = schedule.organizationId;
    if (orgId) {
      if (schedule.organization?.type === 'DESA') {
        const childOrgs = await prisma.organization.findMany({
          where: { parentId: orgId },
          select: { id: true },
        });
        studentWhere.organizationId = { in: [orgId, ...childOrgs.map((c) => c.id)] };
      } else {
        studentWhere.organizationId = orgId;
      }
    }
  }

  return prisma.user.findMany({
    where: studentWhere,
    include: {
      generation: true,
      parents: {
        where: {
          parent: {
            status: 'ACTIVE',
          },
        },
        include: {
          parent: true,
        },
      },
    },
    take: 200, // Batas aman per sesi pengajian
  });
}

/**
 * 1. Evaluasi Kelayakan Pengiriman Notifikasi Perubahan Jadwal (Opsi C: Soft-Warning):
 * - Syarat Mutlak: Jadwal lama belum terlewat lebih dari 5 jam (now - oldStartTime <= 5 jam).
 *   Jika jadwal lama sudah lewat > 5 jam, perubahan dianggap arsip masa lalu sehingga modal tidak muncul.
 * - Deteksi Peringatan Mendadak (< 5 jam):
 *   Jika perubahan dilakukan kurang dari 5 jam sebelum waktu jadwal baru (newStartTime - now < 5 jam),
 *   modal konfirmasi TETAP MUNCUL namun ditandai sebagai `isUrgentShortNotice: true` dengan pesan peringatan
 *   agar Admin hanya mengirimkan jika bersifat mendesak/darurat (seperti pembatalan sesi / ustadz sakit).
 */
export function checkScheduleChangeNotificationEligibility(
  oldStartTime: Date,
  newStartTime: Date,
  now = new Date()
): {
  isEligible: boolean;
  reason?: string;
  isUrgentShortNotice?: boolean;
  warningMessage?: string;
} {
  const fiveHoursMs = 5 * 60 * 60 * 1000;
  const oldStartMs = new Date(oldStartTime).getTime();
  const newStartMs = new Date(newStartTime).getTime();
  const nowMs = now.getTime();

  // Syarat Mutlak: Jadwal lama belum terlewat lebih dari 5 jam
  if (nowMs - oldStartMs > fiveHoursMs) {
    return {
      isEligible: false,
      reason: 'Waktu jadwal lama telah terlewat lebih dari 5 jam.',
    };
  }

  // Deteksi perubahan mendadak (< 5 jam sebelum jadwal baru)
  const isUrgentShortNotice = newStartMs - nowMs < fiveHoursMs;
  const warningMessage = isUrgentShortNotice
    ? 'Perubahan jadwal dilakukan kurang dari 5 jam sebelum sesi dimulai. Kirimkan pesan hanya jika bersifat mendesak/darurat bagi peserta, atau pilih Bisukan jika tidak ingin mengirim pesan WA.'
    : undefined;

  return {
    isEligible: true,
    isUrgentShortNotice,
    warningMessage,
  };
}

export interface ScheduleNotificationPreviewData {
  scheduleId: string;
  scheduleTitle: string;
  organizationName: string;
  changeDescription: string;
  previewMessage: string;
  dayDateStr: string;
  timeRangeStr: string;
  venueName: string;
  teacherNames: string;
  estimatedRecipientsCount: number;
  isUrgentShortNotice?: boolean;
  warningMessage?: string;
}

/**
 * Mengambil preview pesan WhatsApp dan perkiraan audiens untuk modal konfirmasi admin
 */
export async function getScheduleChangeNotificationPreview(params: {
  scheduleId: string;
  changeDescription: string;
  isUrgentShortNotice?: boolean;
  warningMessage?: string;
}): Promise<ScheduleNotificationPreviewData | null> {
  const schedule = await getScheduleDetailForNotification(params.scheduleId);
  if (!schedule) return null;

  const dayDateStr = formatIndonesianDate(schedule.startTime);
  const startTimeStr = formatTime(schedule.startTime);
  const endTimeStr = formatTime(schedule.endTime);
  const orgName = schedule.organization.name;
  const venueName = schedule.venuePlaceName || 'Masjid Kelompok';
  const teacherNames =
    schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

  const baseUrl = getBaseAppUrl();
  const scheduleDetailUrl = `${baseUrl}/jadwal/${schedule.id}`;
  const notesBlock = schedule.notes ? `\n*• Catatan Tambahan* _${schedule.notes}_` : '';

  const previewMessage = renderTemplate(
    DEFAULT_TEMPLATES.SCHEDULE_CHANGE_EMERGENCY.templateBody,
    {
      sapaan_penerima: '*Bapak/Ibu Wali Santri / Santri / Dewan Pengajar*',
      nama_kelompok: orgName,
      judul_sesi: schedule.title,
      status_perubahan_keterangan: params.changeDescription,
      hari_tanggal: dayDateStr,
      waktu_mulai: startTimeStr,
      waktu_selesai: endTimeStr,
      nama_tempat: venueName,
      nama_ustadz: teacherNames,
      catatan_tambahan: notesBlock,
      url_jadwal: scheduleDetailUrl,
    }
  );

  // Hitung jumlah estimasi penerima unik
  const targetStudents = await getTargetStudentsForSchedule(schedule);
  const recipientPhones = new Set<string>();

  schedule.teachers.forEach((t) => {
    if (t.teacher.phoneNumber) {
      recipientPhones.add(normalizePhoneNumber(t.teacher.phoneNumber) || t.teacher.phoneNumber);
    }
  });

  targetStudents.forEach((s) => {
    s.parents.forEach((p) => {
      if (p.parent?.phoneNumber) {
        recipientPhones.add(normalizePhoneNumber(p.parent.phoneNumber) || p.parent.phoneNumber);
      }
    });
    if (s.phoneNumber) {
      recipientPhones.add(normalizePhoneNumber(s.phoneNumber) || s.phoneNumber);
    }
  });

  return {
    scheduleId: schedule.id,
    scheduleTitle: schedule.title,
    organizationName: orgName,
    changeDescription: params.changeDescription,
    previewMessage,
    dayDateStr,
    timeRangeStr: `${startTimeStr} - ${endTimeStr} WIB`,
    venueName,
    teacherNames,
    estimatedRecipientsCount: recipientPhones.size,
    isUrgentShortNotice: params.isUrgentShortNotice,
    warningMessage: params.warningMessage,
  };
}

/**
 * Mengeksekusi pengiriman notifikasi perubahan jadwal setelah dikonfirmasi oleh Admin
 * Otomatis menarik (revoke) pesan pengingat lama jika pernah terkirim ke penerima terkait.
 */
export async function dispatchConfirmedScheduleChangeNotification(params: {
  scheduleId: string;
  changeDescription: string;
}) {
  const schedule = await getScheduleDetailForNotification(params.scheduleId);
  if (!schedule) {
    return { success: false, message: 'Jadwal tidak ditemukan' };
  }

  const startTimeMs = Date.now();

  // 1. Ambil seluruh log pesan pengingat jadwal terdahulu untuk ditarik jika ada
  const allPreviousReminders = await prisma.whatsAppMessageLog.findMany({
    where: {
      referenceId: params.scheduleId,
      status: 'SENT',
      gatewayMessageId: { not: null },
      AND: [
        {
          OR: [
            {
              templateCode: {
                in: [
                  'SCHEDULE_REMINDER_H1_STUDENT',
                  'STUDENT_ACTION_LINK_H1',
                  'SCHEDULE_REMINDER_H1_TEACHER',
                  'TEACHER_ACTION_LINKS_H1',
                  'SCHEDULE_REMINDER_COUNTDOWN_TEACHER',
                  'TEACHER_PRESENSI_LINK_2H',
                  'TEACHER_MULTI_SCHEDULE_DIGEST_H1',
                  'TEACHER_MULTI_SCHEDULE_ACTIONS_H1',
                  'SCHEDULE_REMINDER_COUNTDOWN',
                  'STUDENT_ACTION_LINKS_2H',
                  'SCHEDULE_REMINDER_FAMILY_DIGEST',
                  'FAMILY_ACTION_LINK_H1',
                  'SCHEDULE_REMINDER_FAMILY_COUNTDOWN',
                  'FAMILY_ACTION_LINKS_2H',
                  'SCHEDULE_REMINDER_UNIFIED_TEACHER_PARENT',
                  'SCHEDULE_REMINDER_TEACHER_WITH_DISPENSATION',
                  'SCHEDULE_REMINDER',
                  'GROUP_SCHEDULE_REMINDER_H1',
                ],
              },
            },
            {
              AND: [
                { templateCode: null },
                { messageType: 'SCHEDULE_REMINDER' },
                {
                  NOT: {
                    messageBody: {
                      contains: 'PEMBARUAN JADWAL DARURAT',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // Petakan pesan pengingat lama berdasarkan nomor HP yang telah dinormalisasi
  const oldRemindersByPhone = new Map<string, typeof allPreviousReminders>();
  for (const oldLog of allPreviousReminders) {
    const norm = normalizePhoneNumber(oldLog.recipientPhone) || oldLog.recipientPhone;
    const list = oldRemindersByPhone.get(norm) || [];
    list.push(oldLog);
    oldRemindersByPhone.set(norm, list);
  }

  const updateTimestamp = schedule.updatedAt instanceof Date
    ? schedule.updatedAt.getTime()
    : new Date(schedule.updatedAt || Date.now()).getTime();

  // 1.5 Preload log pesan perubahan darurat yang sudah dikirim untuk jadwal & revisi ini guna mencegah duplikasi (Idempotency Guard)
  const existingEmergencyLogs = await prisma.whatsAppMessageLog.findMany({
    where: {
      referenceId: schedule.id,
      magicToken: { startsWith: `SCHED_CHANGE_${schedule.id}_` },
      status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
    },
    select: { magicToken: true },
  });
  const sentEmergencyTokens = new Set(existingEmergencyLogs.map((l) => l.magicToken).filter(Boolean));

  const dayDateStr = formatIndonesianDate(schedule.startTime);
  const startTimeStr = formatTime(schedule.startTime);
  const endTimeStr = formatTime(schedule.endTime);
  const orgName = schedule.organization.name;
  const venueName = schedule.venuePlaceName || 'Masjid Kelompok';
  const teacherNames =
    schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

  let sentCount = 0;
  let revokedCount = 0;
  const contactedPhones = new Set<string>();

  // Helper untuk menarik pesan lama sebelum kirim pesan baru
  const revokeOldMessagesForPhone = async (phone: string) => {
    const norm = normalizePhoneNumber(phone) || phone;
    const oldMsgs = oldRemindersByPhone.get(norm);
    if (!oldMsgs || oldMsgs.length === 0) return 0;

    let count = 0;
    for (const msg of oldMsgs) {
      if (msg.gatewayMessageId) {
        try {
          console.log(`[ScheduleChangeConfirm] 🗑️ Menarik pesan WA lama (${msg.gatewayMessageId}) dari ${norm}...`);
          const delRes = await whatsAppClient.deleteMessage(norm, msg.gatewayMessageId);
          if (delRes.success) count++;
        } catch (err) {
          console.error(`[ScheduleChangeConfirm] Gagal menarik pesan ${msg.gatewayMessageId}:`, err);
        }
      }
    }
    return count;
  };

  // A. Kirim ke Dewan Pengajar / Ustadz
  for (const st of schedule.teachers) {
    const teacher = st.teacher;
    if (!teacher.phoneNumber) continue;
    const normPhone = normalizePhoneNumber(teacher.phoneNumber) || teacher.phoneNumber;
    if (contactedPhones.has(normPhone)) continue;

    contactedPhones.add(normPhone);

    const magicToken = `SCHED_CHANGE_${schedule.id}_${normPhone}_${updateTimestamp}`;
    if (sentEmergencyTokens.has(magicToken)) {
      console.log(`[ScheduleChangeConfirm] 🛑 Pesan darurat untuk ${normPhone} sudah pernah dikirim (${magicToken}). Dilewati.`);
      continue;
    }

    // Langkah 1: Tarik pesan lama jika ada
    const revoked = await revokeOldMessagesForPhone(normPhone);
    revokedCount += revoked;

    // Langkah 2: Kirim Emergency Alert yang baru
    const res = await sendScheduleChangeEmergencyAlert({
      recipientPhone: teacher.phoneNumber,
      recipientName: teacher.fullName,
      organizationName: orgName,
      scheduleTitle: schedule.title,
      changeDescription: params.changeDescription,
      dayDate: dayDateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      venueName,
      teacherName: teacherNames,
      notes: schedule.notes,
      scheduleId: schedule.id,
      recipientUserId: teacher.id,
      magicToken,
    });

    if (res.success) {
      sentEmergencyTokens.add(magicToken);
      sentCount++;
      if (isApproachingTimeout(startTimeMs, 12000, 2500)) {
        console.warn(`[ScheduleChangeConfirm] ⏱️ Batas waktu aman Server Action (12s) tercapai saat mengirim ke pengajar.`);
        break;
      }
      await sleepWithJitter(1500, 2500);
    }
  }

  // B. Kirim ke Orang Tua dan Santri Target
  const targetStudents = await getTargetStudentsForSchedule(schedule);

  for (const student of targetStudents) {
    // 1. Orang Tua
    for (const rel of student.parents) {
      const parent = rel.parent;
      if (!parent || !parent.phoneNumber) continue;
      const normPhone = normalizePhoneNumber(parent.phoneNumber) || parent.phoneNumber;
      if (contactedPhones.has(normPhone)) continue;

      contactedPhones.add(normPhone);

      const magicToken = `SCHED_CHANGE_${schedule.id}_${normPhone}_${updateTimestamp}`;
      if (sentEmergencyTokens.has(magicToken)) {
        console.log(`[ScheduleChangeConfirm] 🛑 Pesan darurat untuk ${normPhone} sudah pernah dikirim (${magicToken}). Dilewati.`);
        continue;
      }

      // Langkah 1: Tarik pesan lama jika ada
      const revoked = await revokeOldMessagesForPhone(normPhone);
      revokedCount += revoked;

      // Langkah 2: Kirim pesan baru
      const res = await sendScheduleChangeEmergencyAlert({
        recipientPhone: parent.phoneNumber,
        recipientName: parent.fullName,
        recipientGender: parent.gender,
        relationshipType: rel.relationshipType,
        isParent: true,
        organizationName: orgName,
        scheduleTitle: schedule.title,
        changeDescription: params.changeDescription,
        dayDate: dayDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venueName,
        teacherName: teacherNames,
        notes: schedule.notes,
        scheduleId: schedule.id,
        recipientUserId: parent.id,
        magicToken,
      });

      if (res.success) {
        sentEmergencyTokens.add(magicToken);
        sentCount++;
        if (isApproachingTimeout(startTimeMs, 12000, 2500)) {
          console.warn(`[ScheduleChangeConfirm] ⏱️ Batas waktu aman Server Action (12s) tercapai.`);
          break;
        }
        await sleepWithJitter(1500, 2500);
      }
    }

    // 2. Santri langsung jika memiliki nomor WA sendiri
    if (student.phoneNumber) {
      const normPhone = normalizePhoneNumber(student.phoneNumber) || student.phoneNumber;
      if (!contactedPhones.has(normPhone)) {
        contactedPhones.add(normPhone);

        const magicToken = `SCHED_CHANGE_${schedule.id}_${normPhone}_${updateTimestamp}`;
        if (sentEmergencyTokens.has(magicToken)) {
          console.log(`[ScheduleChangeConfirm] 🛑 Pesan darurat untuk ${normPhone} sudah pernah dikirim (${magicToken}). Dilewati.`);
          continue;
        }

        // Langkah 1: Tarik pesan lama jika ada
        const revoked = await revokeOldMessagesForPhone(normPhone);
        revokedCount += revoked;

        // Langkah 2: Kirim pesan baru
        const res = await sendScheduleChangeEmergencyAlert({
          recipientPhone: student.phoneNumber,
          recipientName: student.fullName,
          recipientGender: student.gender,
          isStudent: true,
          organizationName: orgName,
          scheduleTitle: schedule.title,
          changeDescription: params.changeDescription,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          teacherName: teacherNames,
          notes: schedule.notes,
          scheduleId: schedule.id,
          recipientUserId: student.id,
          magicToken,
        });

        if (res.success) {
          sentEmergencyTokens.add(magicToken);
          sentCount++;
          if (isApproachingTimeout(startTimeMs, 12000, 2500)) {
            console.warn(`[ScheduleChangeConfirm] ⏱️ Batas waktu aman Server Action (12s) tercapai.`);
            break;
          }
          await sleepWithJitter(1500, 2500);
        }
      }
    }
  }

  return {
    success: true,
    sentCount,
    revokedCount,
    message: `Notifikasi perubahan jadwal berhasil dikirimkan ke ${sentCount} penerima${
      revokedCount > 0 ? ` (dan berhasil menarik ${revokedCount} pesan lama)` : ''
    }.`,
  };
}

/**
 * Kompatibilitas mundur
 */
export const notifyScheduleChangeIfHariH = dispatchConfirmedScheduleChangeNotification;

/**
 * Menghasilkan informasi kelas, jenjang, dan materi yang terpersonalisasi untuk masing-masing santri.
 * Khusus pada sesi gabungan, santri hanya akan menerima nama kelas spesifik tempat ia bernaung dan
 * materi target bulanan miliknya alih-alih gabungan seluruh kelas.
 */
export function getPersonalizedSessionInfoForStudent(params: {
  schedule: {
    id: string;
    title: string;
    class?: { id: string; name: string; generationId?: string | null; organizationId?: string | null } | null;
    targetClasses?: Array<{ class: { id: string; name: string; generationId?: string | null; organizationId?: string | null } | null }>;
    scheduleMaterials?: Array<{ material: { id: string; title: string; targetGenerationId?: string | null } }>;
  };
  student: {
    id: string;
    organizationId?: string | null;
    generationId?: string | null;
    generation?: { id: string; name: string } | null;
  };
  monthlyTargets?: Array<{
    generationId: string;
    material: { id: string; title: string };
  }>;
}) {
  const { schedule, student, monthlyTargets = [] } = params;

  // 1. Ekstrak seluruh kelas target yang terlibat
  const allTargetClasses = [
    ...(schedule.targetClasses?.map((tc) => tc.class) || []),
    ...(schedule.class ? [schedule.class] : []),
  ].filter(Boolean) as Array<{ id: string; name: string; generationId?: string | null; organizationId?: string | null }>;

  const uniqueTargetClasses = Array.from(
    new Map(allTargetClasses.map((c) => [c.id, c])).values()
  );

  // 2. Cocokkan kelas spesifik santri pada sesi ini
  const studentClass =
    uniqueTargetClasses.find(
      (c) =>
        c.organizationId === student.organizationId &&
        c.generationId === student.generationId
    ) ||
    uniqueTargetClasses.find(
      (c) => c.generationId === student.generationId
    ) ||
    (schedule.class &&
      (schedule.class.generationId === student.generationId ||
        schedule.class.organizationId === student.organizationId)
      ? schedule.class
      : null) ||
    schedule.class ||
    null;

  const className = studentClass?.name || student.generation?.name || 'Santri';
  const generationName = student.generation?.name || 'Santri';

  // 3. Resolusi materi terpersonalisasi:
  // - Target bulanan kalender sesuai jenjang santri
  // - Ditambah materi umum dari jadwal yang tidak dibatasi jenjang lain
  const studentGenId = student.generationId;
  const studentMonthlyTitles = studentGenId
    ? monthlyTargets
        .filter((mt) => mt.generationId === studentGenId)
        .map((mt) => mt.material.title)
    : [];

  const studentGeneralTitles = (schedule.scheduleMaterials || [])
    .filter(
      (sm) =>
        !sm.material.targetGenerationId ||
        sm.material.targetGenerationId === studentGenId
    )
    .map((sm) => sm.material.title);

  const combinedTitles = Array.from(
    new Set([...studentMonthlyTitles, ...studentGeneralTitles])
  );

  const materialTitles =
    combinedTitles.length > 0
      ? combinedTitles.join(', ')
      : ((schedule.scheduleMaterials && schedule.scheduleMaterials.length > 0)
          ? schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ')
          : schedule.title || 'Materi Pengajian Rutin');

  return {
    studentClass,
    className,
    generationName,
    materialTitles,
  };
}

/**
 * 2. Pemicu Siaran / Broadcast Pengingat Jadwal Manual On-Demand oleh Pengurus Wilayah
 */
export async function broadcastScheduleReminder(scheduleId: string) {
  const schedule = await getScheduleDetailForNotification(scheduleId);
  if (!schedule) {
    return { success: false, message: 'Jadwal pengajian tidak ditemukan.' };
  }

  if (schedule.status === ScheduleStatus.CANCELLED) {
    return { success: false, message: 'Tidak dapat mengirim pengingat untuk jadwal yang telah diliburkan / dibatalkan.' };
  }

  const now = new Date();
  const diffHours = (schedule.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  const dayDateStr = formatIndonesianDate(schedule.startTime);
  const startTimeStr = formatTime(schedule.startTime);
  const endTimeStr = formatTime(schedule.endTime);
  const orgName = schedule.organization.name;
  const venueName = schedule.venuePlaceName || 'Masjid Kelompok';

  const teacherNames = schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';
  const materialTitles =
    schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ') ||
    schedule.title ||
    'Materi Pengajian Rutin';

  // Tentukan Jenjang / Kelas Target dengan Penyaringan Jenjang Tanpa Santri
  const candidateGenMap = new Map<string, { id: string; name: string }>();
  if (schedule.class?.generation) {
    candidateGenMap.set(schedule.class.generation.id, {
      id: schedule.class.generation.id,
      name: schedule.class.generation.name,
    });
  }
  schedule.targetGenerations?.forEach((tg) => {
    if (tg.generation) {
      candidateGenMap.set(tg.generation.id, {
        id: tg.generation.id,
        name: tg.generation.name,
      });
    }
  });
  schedule.targetClasses?.forEach((tc) => {
    if (tc.class?.generation) {
      candidateGenMap.set(tc.class.generation.id, {
        id: tc.class.generation.id,
        name: tc.class.generation.name,
      });
    }
  });

  const validGenerations: Array<{ id: string; name: string }> = [];
  const validGenIdSet = new Set<string>();
  for (const gen of candidateGenMap.values()) {
    const santriCount = await prisma.user.count({
      where: {
        generationId: gen.id,
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
        ...(schedule.organizationId ? { organizationId: schedule.organizationId } : {}),
      },
    });
    if (santriCount > 0) {
      validGenerations.push(gen);
      validGenIdSet.add(gen.id);
    }
  }

  if (validGenerations.length === 0 && candidateGenMap.size > 0) {
    for (const gen of candidateGenMap.values()) {
      validGenerations.push(gen);
      validGenIdSet.add(gen.id);
    }
  }

  const validGenNames = validGenerations.map((g) => g.name);

  const candidateClassNames: string[] = [];
  if (schedule.class?.name) {
    if (!schedule.class.generationId || validGenIdSet.has(schedule.class.generationId)) {
      candidateClassNames.push(schedule.class.name);
    }
  }
  schedule.targetClasses?.forEach((tc) => {
    if (tc.class?.name) {
      if (!tc.class.generationId || validGenIdSet.has(tc.class.generationId)) {
        candidateClassNames.push(tc.class.name);
      }
    }
  });
  const validClassNames = Array.from(new Set(candidateClassNames));

  let displayClassOrGenList: string[] = [];
  if (validGenNames.length > 1) {
    displayClassOrGenList = validGenNames;
  } else if (validClassNames.length > 1) {
    displayClassOrGenList = validClassNames;
  } else if (validGenNames.length === 1) {
    displayClassOrGenList = validGenNames;
  } else if (validClassNames.length === 1) {
    displayClassOrGenList = validClassNames;
  } else {
    displayClassOrGenList = ['Umum'];
  }

  const uniqueGenNames = validGenNames.join(', ') || 'Seluruh Santri';

  const isCombined =
    isScheduleCombined(schedule) ||
    validGenerations.length > 1 ||
    validClassNames.length > 1;

  const cleanTitle = schedule.title.replace(/^\[GABUNGAN\]\s*/i, '').trim();
  const displayScheduleTitle = isCombined ? `[GABUNGAN] ${cleanTitle}` : cleanTitle;

  const scheduledTeacherIds = new Set(schedule.teachers.map((st) => st.teacher.id));
  const rawTargetStudents = await getTargetStudentsForSchedule(schedule);

  // KASUS 1: Peer-Teaching (Santri bertugas mengajar di sesi sendiri) -> exclude dari audiens santri
  const targetStudents = rawTargetStudents.filter((s) => !scheduledTeacherIds.has(s.id));

  // Ambil target materi bulanan untuk bulan dan tahun pelaksanaan jadwal (zona waktu WIB)
  const sessionWibDate = new Date(schedule.startTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const sessionYear = sessionWibDate.getFullYear();
  const sessionMonth = sessionWibDate.getMonth() + 1;

  const relevantGenIds = new Set<string>();
  if (schedule.class?.generationId) relevantGenIds.add(schedule.class.generationId);
  schedule.targetGenerations.forEach((tg) => relevantGenIds.add(tg.generationId));
  schedule.targetClasses.forEach((tc) => {
    if (tc.class?.generationId) relevantGenIds.add(tc.class.generationId);
  });

  const monthlyTargets = await prisma.materialMonthlyTarget.findMany({
    where: {
      year: sessionYear,
      month: sessionMonth,
      isActive: true,
      ...(relevantGenIds.size > 0 ? { generationId: { in: Array.from(relevantGenIds) } } : {}),
    },
    include: {
      material: true,
    },
    orderBy: {
      orderIndex: 'asc',
    },
  });

  // Wadah Agregasi Berbasis Nomor Telepon (Phone-Centric Bucket)
  interface BroadcastPhoneBucket {
    phone: string;
    name: string;
    gender?: string | null;
    relationshipType?: string | null;
    userId?: string;
    isTeacher: boolean;
    teacherSt?: any;
    studentsAsParent: Array<{
      studentId: string;
      studentName: string;
      generationName: string;
      className?: string | null;
      scheduleTitle: string;
      startTime: string;
      endTime: string;
      venueName: string;
      materialTitle: string;
      teacherName: string;
      notes?: string | null;
      absenceUrl?: string;
      scheduleUrl?: string;
    }>;
    isDirectStudent: boolean;
    directStudentInfo?: {
      studentId: string;
      studentName: string;
      generationName: string;
      className?: string | null;
      materialTitle: string;
    };
  }

  const recipientMap = new Map<string, BroadcastPhoneBucket>();

  const getOrCreateBucket = (rawPhone: string, defaultName: string, userId?: string): BroadcastPhoneBucket | null => {
    const norm = normalizePhoneNumber(rawPhone);
    if (!norm) return null;
    let b = recipientMap.get(norm);
    if (!b) {
      b = {
        phone: rawPhone,
        name: defaultName,
        userId,
        isTeacher: false,
        studentsAsParent: [],
        isDirectStudent: false,
      };
      recipientMap.set(norm, b);
    }
    return b;
  };

  // A. Masukkan Dewan Pengajar
  for (const st of schedule.teachers) {
    const teacher = st.teacher;
    if (!teacher.phoneNumber) continue;
    const bucket = getOrCreateBucket(teacher.phoneNumber, teacher.fullName, teacher.id);
    if (bucket) {
      bucket.isTeacher = true;
      bucket.teacherSt = st;
      bucket.gender = teacher.gender;
    }
  }

  const isCountdown = diffHours <= 4 && diffHours > 0;

  // B. Masukkan Santri dan Orang Tua
  for (const student of targetStudents) {
    const { className, generationName: genName, materialTitles: studentMaterialTitles } =
      getPersonalizedSessionInfoForStudent({
        schedule,
        student,
        monthlyTargets,
      });

    // 1. Orang Tua
    let parentsToNotify = student.parents;
    if (student.waPreferredParent === 'AYAH') {
      const ayahParents = parentsToNotify.filter(
        (rel) =>
          rel.relationshipType?.toUpperCase().includes('AYAH') ||
          rel.parent?.gender === 'MALE'
      );
      if (ayahParents.length > 0) parentsToNotify = ayahParents;
    } else if (student.waPreferredParent === 'IBU') {
      const ibuParents = parentsToNotify.filter(
        (rel) =>
          rel.relationshipType?.toUpperCase().includes('IBU') ||
          rel.parent?.gender === 'FEMALE'
      );
      if (ibuParents.length > 0) parentsToNotify = ibuParents;
    }

    for (const rel of parentsToNotify) {
      const parent = rel.parent;
      if (!parent || !parent.phoneNumber) continue;

      if (isCountdown && parent.waNotifyCountdown === false) continue;
      if (!isCountdown && parent.waNotifyH1 === false) continue;

      if (parent.waPreferredParent === 'AYAH') {
        const isAyah =
          rel.relationshipType?.toUpperCase().includes('AYAH') ||
          parent.gender === 'MALE';
        if (!isAyah) continue;
      } else if (parent.waPreferredParent === 'IBU') {
        const isIbu =
          rel.relationshipType?.toUpperCase().includes('IBU') ||
          parent.gender === 'FEMALE';
        if (!isIbu) continue;
      }

      const bucket = getOrCreateBucket(parent.phoneNumber, parent.fullName, parent.id);
      if (!bucket) continue;

      bucket.relationshipType = rel.relationshipType;
      bucket.gender = parent.gender;

      const absenceToken = generateStudentAbsenceRequestToken(
        schedule.id,
        student.id,
        parent.id,
        'PARENT'
      );
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
        : 'http://localhost:3000';
      const absenceUrl = `${baseUrl}/izin/ajukan/${absenceToken}`;
      const scheduleUrl = `${baseUrl}/jadwal/${schedule.id}`;

      bucket.studentsAsParent.push({
        studentId: student.id,
        studentName: student.fullName,
        generationName: genName,
        className,
        scheduleTitle: schedule.title,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venueName,
        materialTitle: studentMaterialTitles,
        teacherName: teacherNames,
        notes: schedule.notes,
        absenceUrl,
        scheduleUrl,
      });
    }

    // 2. Santri Sendiri
    const isStudentNotifyAllowed = isCountdown
      ? (student.waNotifyCountdown ?? true)
      : (student.waNotifyH1 ?? true);

    if (isStudentNotifyAllowed && student.phoneNumber) {
      const normStudentPhone = normalizePhoneNumber(student.phoneNumber);
      if (normStudentPhone && !recipientMap.has(normStudentPhone)) {
        const bucket = getOrCreateBucket(student.phoneNumber, student.fullName, student.id);
        if (bucket) {
          bucket.isDirectStudent = true;
          bucket.gender = student.gender;
          bucket.directStudentInfo = {
            studentId: student.id,
            studentName: student.fullName,
            generationName: genName,
            className,
            materialTitle: studentMaterialTitles,
          };
        }
      }
    }
  }

  const startTimeMs = Date.now();
  let sentCount = 0;
  const totalRecipients = recipientMap.size;
  let processedRecipients = 0;

  if (totalRecipients === 0) {
    return {
      success: true,
      sentCount: 0,
      totalEligible: 0,
      message: 'Tidak ada nomor telepon dewan pengajar atau santri yang terdaftar untuk sesi ini.',
    };
  }

  const waitBeforeNextRecipient = async (): Promise<boolean> => {
    processedRecipients++;
    if (processedRecipients < totalRecipients) {
      if (isApproachingTimeout(startTimeMs, 12000, 2500)) {
        console.warn(
          `[broadcastScheduleReminder] ⏱️ Batas waktu aman Server Action (12s) tercapai. Selesai memproses ${sentCount} dari ${totalRecipients} penerima.`
        );
        return false;
      }
      await sleepWithJitter(1500, 2500);
    }
    return true;
  };

  for (const [normPhone, bucket] of recipientMap.entries()) {
    const batchWindow = Math.floor(Date.now() / (10 * 60 * 1000));
    const magicToken = `SCHED_BROADCAST_${schedule.id}_${normPhone}_${batchWindow}`;

    // Skenario 1: Ustadz merangkap Orang Tua
    if (bucket.isTeacher && bucket.studentsAsParent.length > 0) {
      const st = bucket.teacherSt;
      const res = await sendUnifiedTeacherParentReminder({
        teacherPhone: bucket.phone,
        teacherName: bucket.name,
        teacherGender: bucket.gender,
        dayDate: dayDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venueName,
        organizationName: orgName,
        generationName: validGenNames,
        className: displayClassOrGenList,
        materialTitle: materialTitles,
        isBadal: st?.isSubstitute,
        notes: schedule.notes,
        teacherBroadcastNote: schedule.teacherBroadcastNote,
        scheduleId: schedule.id,
        scheduleTitle: displayScheduleTitle,
        magicToken: `${magicToken}_MAIN`,
        teacherUserId: bucket.userId,
        students: bucket.studentsAsParent,
      });

      if (res.success) {
        sentCount++;
        await microDelayBetweenPairedMessages();
        if (isCountdown) {
          await sendTeacherPresensiLink2h({
            teacherPhone: bucket.phone,
            teacherName: bucket.name,
            teacherGender: bucket.gender,
            scheduleTitle: displayScheduleTitle,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            teacherUserId: bucket.userId,
            magicToken: `${magicToken}_PRESENSI`,
          });
        } else {
          await sendTeacherActionLinksH1({
            teacherPhone: bucket.phone,
            teacherName: bucket.name,
            teacherGender: bucket.gender,
            scheduleTitle: displayScheduleTitle,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            teacherUserId: bucket.userId,
            magicToken: `${magicToken}_ACTION`,
          });
        }
      }

      if (!(await waitBeforeNextRecipient())) break;
      continue;
    }

    // Skenario 2: Ustadz Reguler
    if (bucket.isTeacher) {
      const st = bucket.teacherSt;
      let res;
      if (isCountdown) {
        res = await sendScheduleReminderCountdownTeacher({
          teacherPhone: bucket.phone,
          teacherName: bucket.name,
          teacherGender: bucket.gender,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          generationName: validGenNames,
          className: displayClassOrGenList,
          materialTitle: materialTitles,
          isBadal: st?.isSubstitute,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          scheduleId: schedule.id,
          scheduleTitle: displayScheduleTitle,
          teacherUserId: bucket.userId,
          magicToken: `${magicToken}_MAIN`,
        });

        await sendTeacherPresensiLink2h({
          teacherPhone: bucket.phone,
          teacherName: bucket.name,
          teacherGender: bucket.gender,
          scheduleTitle: displayScheduleTitle,
          dayDate: dayDateStr,
          scheduleId: schedule.id,
          teacherUserId: bucket.userId,
          magicToken: `${magicToken}_PRESENSI`,
        });
      } else {
        // Cek apakah guru mengajar >= 2 sesi esok hari
        let isMultiSession = false;
        let multiSessionItems: TeacherMultiScheduleItem[] = [];
        let teacherTomorrowSchedules: any[] = [];

        if (bucket.userId) {
          const scheduleDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(schedule.startTime);
          const dayStart = new Date(`${scheduleDateStr}T00:00:00+07:00`);
          const dayEnd = new Date(`${scheduleDateStr}T23:59:59.999+07:00`);

          teacherTomorrowSchedules = await prisma.schedule.findMany({
            where: {
              status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE] },
              startTime: { gte: dayStart, lte: dayEnd },
              teachers: {
                some: {
                  teacherId: bucket.userId,
                },
              },
              AND: [
                {
                  OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
                },
              ],
            },
            include: {
              organization: true,
              class: { include: { generation: true } },
              targetClasses: { include: { class: { include: { generation: true } } } },
              targetGenerations: { include: { generation: true } },
              teachers: {
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

          if (teacherTomorrowSchedules.length > 1) {
            isMultiSession = true;
            multiSessionItems = teacherTomorrowSchedules.map((s) => {
              const sIsCombined =
                isScheduleCombined(s) ||
                (s.targetGenerations?.length || 0) > 1 ||
                (s.targetClasses?.length || 0) > 1;
              const sCleanTitle = s.title.replace(/^\[GABUNGAN\]\s*/i, '').trim();
              const sDisplayTitle = sIsCombined ? `[GABUNGAN] ${sCleanTitle}` : sCleanTitle;

              const sGenNames: string[] = [];
              if (s.class?.generation?.name) sGenNames.push(s.class.generation.name);
              s.targetGenerations?.forEach((tg: any) => {
                if (tg.generation?.name) sGenNames.push(tg.generation.name);
              });
              s.targetClasses?.forEach((tc: any) => {
                if (tc.class?.generation?.name) sGenNames.push(tc.class.generation.name);
              });
              const sUniqueGenNames = Array.from(new Set(sGenNames));

              const sClassNames: string[] = [];
              if (s.class?.name) sClassNames.push(s.class.name);
              s.targetClasses?.forEach((tc: any) => {
                if (tc.class?.name) sClassNames.push(tc.class.name);
              });
              const sUniqueClassNames = Array.from(new Set(sClassNames));

              let sDisplayClassOrGenList: string[] = [];
              if (sUniqueGenNames.length > 1) {
                sDisplayClassOrGenList = sUniqueGenNames;
              } else if (sUniqueClassNames.length > 1) {
                sDisplayClassOrGenList = sUniqueClassNames;
              } else if (sUniqueGenNames.length === 1) {
                sDisplayClassOrGenList = sUniqueGenNames;
              } else if (sUniqueClassNames.length === 1) {
                sDisplayClassOrGenList = sUniqueClassNames;
              } else {
                sDisplayClassOrGenList = ['Umum'];
              }

              const sMaterialTitles =
                s.scheduleMaterials
                  ?.map((sm: any) => sm.material?.title)
                  .filter(Boolean)
                  .join(', ') ||
                s.title ||
                'Materi Pengajian Rutin';
              const sTeacherSt = s.teachers?.find((t: any) => t.teacherId === bucket.userId);

              return {
                scheduleId: s.id,
                scheduleTitle: sDisplayTitle,
                startTime: formatTime(s.startTime),
                endTime: formatTime(s.endTime),
                venueName: s.venuePlaceName || 'Masjid Kelompok',
                organizationName: s.organization?.name,
                generationClassName: sDisplayClassOrGenList,
                materialTitle: sMaterialTitles,
                isBadal: sTeacherSt?.isSubstitute || false,
              };
            });
          }
        }

        if (isMultiSession && multiSessionItems.length > 1) {
          res = await sendTeacherMultiScheduleDigestH1({
            teacherPhone: bucket.phone,
            teacherName: bucket.name,
            teacherGender: bucket.gender,
            dayDate: dayDateStr,
            organizationName: orgName,
            items: multiSessionItems,
            magicToken: `${magicToken}_MAIN`,
            teacherUserId: bucket.userId,
          });

          if (res.success) {
            sentCount++;
            await microDelayBetweenPairedMessages();
            await sendTeacherMultiScheduleActionsH1({
              teacherPhone: bucket.phone,
              teacherName: bucket.name,
              teacherGender: bucket.gender,
              dayDate: dayDateStr,
              items: multiSessionItems,
              magicToken: `${magicToken}_ACTION`,
              teacherUserId: bucket.userId,
            });
          }
        } else {
          res = await sendScheduleReminderH1ToTeacher({
            teacherPhone: bucket.phone,
            teacherName: bucket.name,
            teacherGender: bucket.gender,
            dayDate: dayDateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            venueName,
            organizationName: orgName,
            generationName: validGenNames,
            className: displayClassOrGenList,
            materialTitle: materialTitles,
            isBadal: st?.isSubstitute,
            notes: schedule.notes,
            teacherBroadcastNote: schedule.teacherBroadcastNote,
            scheduleId: schedule.id,
            scheduleTitle: displayScheduleTitle,
            teacherUserId: bucket.userId,
            magicToken: `${magicToken}_MAIN`,
          });

          if (res.success) {
            sentCount++;
            await microDelayBetweenPairedMessages();
            await sendTeacherActionLinksH1({
              teacherPhone: bucket.phone,
              teacherName: bucket.name,
              teacherGender: bucket.gender,
              scheduleTitle: displayScheduleTitle,
              dayDate: dayDateStr,
              scheduleId: schedule.id,
              teacherUserId: bucket.userId,
              magicToken: `${magicToken}_ACTION`,
            });
          }
        }
      }

      if (!(await waitBeforeNextRecipient())) break;
      continue;
    }

    // Skenario 3: Orang Tua Multi-Santri
    if (bucket.studentsAsParent.length > 1) {
      const familyToken = bucket.userId
        ? generateFamilyActionHubToken(schedule.id, bucket.userId)
        : '';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
        : 'http://localhost:3000';
      const familyActionUrl = familyToken
        ? `${baseUrl}/keluarga/sesi/${familyToken}`
        : `${baseUrl}/jadwal/${schedule.id}`;

      if (isCountdown) {
        const res = await sendFamilyScheduleReminderCountdown({
          parentPhone: bucket.phone,
          parentName: bucket.name,
          parentGender: bucket.gender,
          relationshipType: bucket.relationshipType,
          dayDate: dayDateStr,
          organizationName: orgName,
          students: bucket.studentsAsParent,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          primaryScheduleId: schedule.id,
          familyActionUrl,
          magicToken: `${magicToken}_MAIN`,
          parentUserId: bucket.userId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (-2 Jam Terpisah): Tautan Presensi & Izin Keluarga
          await sendFamilyActionLinks2h({
            parentPhone: bucket.phone,
            parentName: bucket.name,
            dayDate: dayDateStr,
            primaryScheduleId: schedule.id,
            familyActionUrl,
            magicToken: `${magicToken}_ACTION`,
            parentUserId: bucket.userId,
          });
        }
      } else {
        // Pesan 1 (H-1): Ringkasan Jadwal Pengajian Keluarga
        const res = await sendFamilyScheduleReminderH1({
          parentPhone: bucket.phone,
          parentName: bucket.name,
          parentGender: bucket.gender,
          relationshipType: bucket.relationshipType,
          dayDate: dayDateStr,
          organizationName: orgName,
          students: bucket.studentsAsParent,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          primaryScheduleId: schedule.id,
          familyActionUrl,
          magicToken: `${magicToken}_MAIN`,
          parentUserId: bucket.userId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (H-1 Terpisah): Tautan Konfirmasi Izin Keluarga
          await sendFamilyActionLinkH1({
            parentPhone: bucket.phone,
            parentName: bucket.name,
            dayDate: dayDateStr,
            primaryScheduleId: schedule.id,
            familyActionUrl,
            magicToken: `${magicToken}_ACTION`,
            parentUserId: bucket.userId,
          });
        }
      }

      if (!(await waitBeforeNextRecipient())) break;
      continue;
    }

    // Skenario 4: Orang Tua 1 Santri
    if (bucket.studentsAsParent.length === 1) {
      const single = bucket.studentsAsParent[0];
      if (isCountdown) {
        // Pesan 1 (-2 Jam): Countdown Keberangkatan Santri
        const res = await sendScheduleReminderCountdown({
          recipientPhone: bucket.phone,
          recipientName: `Bpk/Ibu ${bucket.name}`,
          recipientGender: bucket.gender,
          relationshipType: bucket.relationshipType,
          isParent: true,
          studentName: single.studentName,
          generationName: single.generationName,
          className: single.className,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: single.materialTitle,
          teacherName: teacherNames,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          scheduleId: schedule.id,
          magicToken: `${magicToken}_MAIN`,
          recipientUserId: bucket.userId,
          studentUserId: single.studentId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (-2 Jam Terpisah): Tautan Presensi & Izin/Sakit
          await sendStudentActionLinks2h({
            recipientPhone: bucket.phone,
            recipientName: `Bpk/Ibu ${bucket.name}`,
            recipientUserId: bucket.userId,
            scheduleTitle: schedule.title,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            studentUserId: single.studentId,
            isParent: true,
            magicToken: `${magicToken}_ACTION`,
          });
        }
      } else {
        // Pesan 1 (H-1): Detail Jadwal Santri
        const res = await sendScheduleReminderH1ToStudent({
          recipientPhone: bucket.phone,
          recipientName: `Bpk/Ibu ${bucket.name}`,
          recipientGender: bucket.gender,
          relationshipType: bucket.relationshipType,
          isParent: true,
          studentName: single.studentName,
          generationName: single.generationName,
          className: single.className,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: single.materialTitle,
          teacherName: teacherNames,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          scheduleId: schedule.id,
          magicToken: `${magicToken}_MAIN`,
          recipientUserId: bucket.userId,
          studentUserId: single.studentId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (H-1 Terpisah): Tautan Pengajuan Izin / Sakit
          await sendStudentActionLinkH1({
            recipientPhone: bucket.phone,
            recipientName: `Bpk/Ibu ${bucket.name}`,
            recipientUserId: bucket.userId,
            scheduleTitle: schedule.title,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            studentUserId: single.studentId,
            isParent: true,
            magicToken: `${magicToken}_ACTION`,
          });
        }
      }

      if (!(await waitBeforeNextRecipient())) break;
      continue;
    }

    // Skenario 5: Santri Mandiri Langsung
    if (bucket.isDirectStudent && bucket.directStudentInfo) {
      const direct = bucket.directStudentInfo;
      if (isCountdown) {
        // Pesan 1 (-2 Jam): Countdown Keberangkatan Santri
        const res = await sendScheduleReminderCountdown({
          recipientPhone: bucket.phone,
          recipientName: direct.studentName,
          recipientGender: bucket.gender,
          isParent: false,
          studentName: direct.studentName,
          generationName: direct.generationName,
          className: direct.className,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: direct.materialTitle,
          teacherName: teacherNames,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          scheduleId: schedule.id,
          magicToken: `${magicToken}_MAIN`,
          recipientUserId: bucket.userId,
          studentUserId: direct.studentId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (-2 Jam Terpisah): Tautan Presensi & Izin/Sakit
          await sendStudentActionLinks2h({
            recipientPhone: bucket.phone,
            recipientName: direct.studentName,
            recipientUserId: bucket.userId,
            scheduleTitle: schedule.title,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            studentUserId: direct.studentId,
            isParent: false,
            magicToken: `${magicToken}_ACTION`,
          });
        }
      } else {
        // Pesan 1 (H-1): Detail Jadwal Santri
        const res = await sendScheduleReminderH1ToStudent({
          recipientPhone: bucket.phone,
          recipientName: direct.studentName,
          recipientGender: bucket.gender,
          isParent: false,
          studentName: direct.studentName,
          generationName: direct.generationName,
          className: direct.className,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: direct.materialTitle,
          teacherName: teacherNames,
          notes: schedule.notes,
          teacherBroadcastNote: schedule.teacherBroadcastNote,
          scheduleId: schedule.id,
          magicToken: `${magicToken}_MAIN`,
          recipientUserId: bucket.userId,
          studentUserId: direct.studentId,
        });

        if (res.success) {
          sentCount++;
          await microDelayBetweenPairedMessages();
          // Pesan 2 (H-1 Terpisah): Tautan Pengajuan Izin / Sakit
          await sendStudentActionLinkH1({
            recipientPhone: bucket.phone,
            recipientName: direct.studentName,
            recipientUserId: bucket.userId,
            scheduleTitle: schedule.title,
            dayDate: dayDateStr,
            scheduleId: schedule.id,
            studentUserId: direct.studentId,
            isParent: false,
            magicToken: `${magicToken}_ACTION`,
          });
        }
      }

      if (!(await waitBeforeNextRecipient())) break;
    }
  }

  const isPartial = sentCount < totalRecipients;
  return {
    success: sentCount > 0,
    sentCount,
    totalEligible: totalRecipients,
    message: isPartial
      ? `Gelombang pertama (${sentCount} dari ${totalRecipients} penerima) berhasil dikirimkan dengan jeda aman anti-spam. Sisa penerima dilanjutkan oleh cron otomatis atau klik kirim kembali.`
      : `Siaran pengingat WhatsApp berhasil dikirimkan ke seluruh ${sentCount} penerima unik (Dewan Pengajar, Orang Tua, & Santri) dengan jeda aman anti-spam.`,
  };
}
