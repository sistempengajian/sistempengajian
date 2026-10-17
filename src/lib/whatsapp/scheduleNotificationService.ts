import prisma from '@/lib/prisma';
import {
  sendScheduleReminderH1ToStudent,
  sendScheduleReminderH1ToTeacher,
  sendScheduleReminderCountdown,
  sendScheduleChangeEmergencyAlert,
  sendFamilyScheduleReminderH1,
  sendFamilyScheduleReminderCountdown,
  sendUnifiedTeacherParentReminder,
} from './triggers';
import {
  generateStudentAbsenceRequestToken,
  generateFamilyActionHubToken,
} from '@/lib/studentAbsenceToken';
import { RollingTargetScope, ScheduleStatus, ApprovalStatus } from '@prisma/client';
import { whatsAppClient } from './WhatsAppClient';
import { normalizePhoneNumber } from './utils';

export function isScheduleToday(date: Date): boolean {
  const scheduleDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
  const todayDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  return scheduleDateStr === todayDateStr;
}

export function formatIndonesianDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);
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
 * 1. Pemicu Notifikasi Perubahan Jadwal (SCHEDULE_CHANGE_EMERGENCY) dengan Penarikan Pesan Lama (Revoke / Delete)
 *
 * Aturan Pengiriman:
 * - Jika notifikasi jadwal H-1 atau H-2 jam BELUM PERNAH DIKIRIMKAN ke penerima, maka pesan Emergency Alert
 *   TIDAK PERLU DIKIRIMKAN (dilewati). Informasi terbaru akan otomatis tersampaikan saat cron pengingat reguler berjalan.
 * - Jika notifikasi jadwal H-1 atau H-2 jam SUDAH PERNAH DIKIRIMKAN:
 *   1. Sistem menarik / menghapus (revoke/delete) pesan pengingat lama tersebut dari WhatsApp penerima via WAHA
 *      berdasarkan gatewayMessageId pesan sebelumnya.
 *   2. Setelah pesan lama ditarik/dihapus, barulah pesan Emergency Alert (SCHEDULE_CHANGE_EMERGENCY) dikirimkan.
 *
 * Tujuannya: Mencegah spam pesan dan mencegah kebingungan akibat pesan lama yang infonya sudah tidak berlaku.
 */
export async function notifyScheduleChangeIfHariH(params: {
  scheduleId: string;
  changeDescription: string;
}) {
  const schedule = await getScheduleDetailForNotification(params.scheduleId);
  if (!schedule) {
    return { success: false, message: 'Jadwal tidak ditemukan' };
  }

  // 1. Ambil seluruh log pesan pengingat jadwal (H-1 atau H-2 jam) yang sebelumnya SUDAH TERKIRIM ('SENT') untuk sesi ini
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
                  'SCHEDULE_REMINDER_H1_TEACHER',
                  'SCHEDULE_REMINDER_COUNTDOWN',
                  'SCHEDULE_REMINDER',
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

  // Jika BELUM PERNAH ada notifikasi jadwal (H-1 maupun H-2 jam) yang terkirim untuk sesi ini:
  // Sesuai aturan: Emergency Alert TIDAK PERLU dikirimkan sama sekali!
  if (allPreviousReminders.length === 0) {
    console.log(
      `[EmergencyScheduleChange] ⏩ Dilewati: Belum ada pengingat H-1 / H-2 jam yang terkirim untuk sesi "${schedule.title}" (${params.scheduleId}). Emergency Alert tidak perlu ditampilkan.`
    );
    return {
      success: true,
      skipped: true,
      reason: 'NO_PREVIOUS_REMINDERS',
      message: 'Perubahan jadwal disimpan. Pesan Emergency Alert tidak dikirim karena belum ada pengingat jadwal sebelumnya.',
    };
  }

  console.log(
    `[EmergencyScheduleChange] 🔄 Ditemukan ${allPreviousReminders.length} pesan pengingat sebelumnya untuk "${schedule.title}". Memproses penarikan pesan lama & pengiriman Emergency Alert...`
  );

  // Petakan pesan pengingat lama berdasarkan nomor HP yang telah dinormalisasi
  const oldRemindersByPhone = new Map<string, typeof allPreviousReminders>();
  for (const oldLog of allPreviousReminders) {
    const norm = normalizePhoneNumber(oldLog.recipientPhone) || oldLog.recipientPhone;
    const list = oldRemindersByPhone.get(norm) || [];
    list.push(oldLog);
    oldRemindersByPhone.set(norm, list);
  }

  const dayDateStr = formatIndonesianDate(schedule.startTime);
  const startTimeStr = formatTime(schedule.startTime);
  const endTimeStr = formatTime(schedule.endTime);
  const orgName = schedule.organization.name;
  const venueName = schedule.venuePlaceName || 'Masjid Kelompok';
  const teacherNames = schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

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
          console.log(`[EmergencyScheduleChange] 🗑️ Menarik pesan WA lama (${msg.gatewayMessageId}) dari ${norm}...`);
          const delRes = await whatsAppClient.deleteMessage(norm, msg.gatewayMessageId);
          if (delRes.success) count++;
        } catch (err) {
          console.error(`[EmergencyScheduleChange] Gagal menarik pesan ${msg.gatewayMessageId}:`, err);
        }
      }
    }
    return count;
  };

  // A. Kirim ke Dewan Pengajar / Ustadz (HANYA JIKA SUDAH PERNAH MENERIMA PESAN JADWAL)
  for (const st of schedule.teachers) {
    const teacher = st.teacher;
    if (!teacher.phoneNumber) continue;
    const normPhone = normalizePhoneNumber(teacher.phoneNumber) || teacher.phoneNumber;
    if (contactedPhones.has(normPhone)) continue;

    // Cek apakah guru ini sudah pernah menerima notifikasi jadwal sebelumnya
    if (!oldRemindersByPhone.has(normPhone)) {
      console.log(`[EmergencyScheduleChange] Guru ${teacher.fullName} (${normPhone}) belum pernah terima jadwal sesi ini. Lewati Emergency Alert.`);
      continue;
    }

    contactedPhones.add(normPhone);

    // Langkah 1: Tarik / hapus pesan lama terlebih dahulu
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
    });

    if (res.success) sentCount++;
  }

  // B. Kirim ke Orang Tua dan Santri Target (HANYA JIKA SUDAH PERNAH MENERIMA PESAN JADWAL)
  const targetStudents = await getTargetStudentsForSchedule(schedule);

  for (const student of targetStudents) {
    // 1. Orang Tua
    for (const rel of student.parents) {
      const parent = rel.parent;
      if (!parent || !parent.phoneNumber) continue;
      const normPhone = normalizePhoneNumber(parent.phoneNumber) || parent.phoneNumber;
      if (contactedPhones.has(normPhone)) continue;

      if (!oldRemindersByPhone.has(normPhone)) {
        continue; // Belum pernah terima jadwal lama -> lewati
      }

      contactedPhones.add(normPhone);

      // Langkah 1: Tarik pesan lama
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
      });

      if (res.success) sentCount++;
    }

    // 2. Santri langsung jika memiliki nomor WA sendiri
    if (student.phoneNumber) {
      const normPhone = normalizePhoneNumber(student.phoneNumber) || student.phoneNumber;
      if (!contactedPhones.has(normPhone)) {
        if (!oldRemindersByPhone.has(normPhone)) {
          continue; // Belum pernah terima jadwal lama -> lewati
        }

        contactedPhones.add(normPhone);

        // Langkah 1: Tarik pesan lama
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
        });

        if (res.success) sentCount++;
      }
    }
  }

  return {
    success: true,
    sentCount,
    revokedCount,
    message: `Pembaruan jadwal selesai: Berhasil menarik ${revokedCount} pesan lama dan mengirimkan ${sentCount} pesan Emergency Alert terbaru.`,
  };
}

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

  const genNames = [
    ...(schedule.class?.generation ? [schedule.class.generation.name] : []),
    ...schedule.targetGenerations.map((tg) => tg.generation.name),
    ...schedule.targetClasses.map((tc) => tc.class.generation?.name).filter(Boolean),
  ];
  const uniqueGenNames = Array.from(new Set(genNames)).join(', ') || 'Seluruh Santri';

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

  let sentCount = 0;

  for (const [normPhone, bucket] of recipientMap.entries()) {
    const magicToken = `SCHED_BROADCAST_${schedule.id}_${normPhone}_${Date.now()}`;

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
        generationName: uniqueGenNames,
        className: schedule.class?.name,
        materialTitle: materialTitles,
        isBadal: st?.isSubstitute,
        notes: schedule.notes,
        teacherBroadcastNote: schedule.teacherBroadcastNote,
        scheduleId: schedule.id,
        scheduleTitle: schedule.title,
        magicToken,
        teacherUserId: bucket.userId,
        students: bucket.studentsAsParent,
      });
      if (res.success) sentCount++;
      continue;
    }

    // Skenario 2: Ustadz Reguler
    if (bucket.isTeacher) {
      const st = bucket.teacherSt;
      const res = await sendScheduleReminderH1ToTeacher({
        teacherPhone: bucket.phone,
        teacherName: bucket.name,
        teacherGender: bucket.gender,
        dayDate: dayDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venueName,
        organizationName: orgName,
        generationName: uniqueGenNames,
        className: schedule.class?.name,
        materialTitle: materialTitles,
        isBadal: st?.isSubstitute,
        notes: schedule.notes,
        teacherBroadcastNote: schedule.teacherBroadcastNote,
        scheduleId: schedule.id,
        scheduleTitle: schedule.title,
        teacherUserId: bucket.userId,
        magicToken,
      });
      if (res.success) sentCount++;
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
          magicToken,
          parentUserId: bucket.userId,
        });
        if (res.success) sentCount++;
      } else {
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
          magicToken,
          parentUserId: bucket.userId,
        });
        if (res.success) sentCount++;
      }
      continue;
    }

    // Skenario 4: Orang Tua 1 Santri
    if (bucket.studentsAsParent.length === 1) {
      const single = bucket.studentsAsParent[0];
      if (isCountdown) {
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
          magicToken,
          recipientUserId: bucket.userId,
          studentUserId: single.studentId,
        });
        if (res.success) sentCount++;
      } else {
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
          magicToken,
          recipientUserId: bucket.userId,
          studentUserId: single.studentId,
        });
        if (res.success) sentCount++;
      }
      continue;
    }

    // Skenario 5: Santri Mandiri Langsung
    if (bucket.isDirectStudent && bucket.directStudentInfo) {
      const direct = bucket.directStudentInfo;
      if (isCountdown) {
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
          magicToken,
          recipientUserId: bucket.userId,
          studentUserId: direct.studentId,
        });
        if (res.success) sentCount++;
      } else {
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
          magicToken,
          recipientUserId: bucket.userId,
          studentUserId: direct.studentId,
        });
        if (res.success) sentCount++;
      }
    }
  }

  return {
    success: true,
    sentCount,
    message: `Siaran pengingat WhatsApp berhasil dikirimkan ke ${sentCount} penerima unik (Dewan Pengajar, Orang Tua, & Santri).`,
  };
}
