import prisma from '@/lib/prisma';
import {
  sendScheduleReminderH1ToStudent,
  sendScheduleReminderH1ToTeacher,
  sendScheduleReminderCountdown,
  sendScheduleChangeEmergencyAlert,
} from './triggers';
import { RollingTargetScope, ScheduleStatus, ApprovalStatus } from '@prisma/client';

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
        include: {
          parent: true,
        },
      },
    },
    take: 200, // Batas aman per sesi pengajian
  });
}

/**
 * 1. Pemicu Notifikasi Perubahan Jadwal Darurat (HANYA DIKIRIM JIKA TERJADI PADA HARI-H)
 * Aturan: Jika perubahan dibuat sebelum Hari-H (misal H-2, H-3), notifikasi WhatsApp tidak dikirim.
 */
export async function notifyScheduleChangeIfHariH(params: {
  scheduleId: string;
  changeDescription: string;
}) {
  const schedule = await getScheduleDetailForNotification(params.scheduleId);
  if (!schedule) {
    return { success: false, message: 'Jadwal tidak ditemukan' };
  }

  // Cek Aturan Hari-H
  const isToday = isScheduleToday(schedule.startTime);
  if (!isToday) {
    console.log(
      `[EmergencyScheduleChange] Dilewati: Perubahan jadwal ${schedule.title} (${params.scheduleId}) bukan pada Hari-H. Tanggal sesi: ${schedule.startTime.toISOString()}`
    );
    return {
      success: true,
      skipped: true,
      reason: 'NOT_HARI_H',
      message: 'Perubahan jadwal disimpan. Notifikasi instan tidak dikirim karena jadwal bukan untuk hari ini (akan terkirim di pengingat H-1 otomatis).',
    };
  }

  console.log(`[EmergencyScheduleChange] Mengirim pemberitahuan darurat Hari-H untuk jadwal: ${schedule.title}`);

  const dayDateStr = formatIndonesianDate(schedule.startTime);
  const startTimeStr = formatTime(schedule.startTime);
  const endTimeStr = formatTime(schedule.endTime);
  const orgName = schedule.organization.name;
  const venueName = schedule.venuePlaceName || 'Masjid Kelompok';
  const teacherNames = schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';

  let sentCount = 0;
  const contactedPhones = new Set<string>();

  // A. Kirim ke Dewan Pengajar / Ustadz
  for (const st of schedule.teachers) {
    const teacher = st.teacher;
    if (!teacher.phoneNumber || contactedPhones.has(teacher.phoneNumber)) continue;
    contactedPhones.add(teacher.phoneNumber);

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

  // B. Kirim ke Orang Tua dan Santri Target
  const targetStudents = await getTargetStudentsForSchedule(schedule);

  for (const student of targetStudents) {
    // 1. Orang Tua
    for (const rel of student.parents) {
      const parent = rel.parent;
      if (!parent || !parent.phoneNumber || contactedPhones.has(parent.phoneNumber)) continue;
      contactedPhones.add(parent.phoneNumber);

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
    if (student.phoneNumber && !contactedPhones.has(student.phoneNumber)) {
      contactedPhones.add(student.phoneNumber);

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

  return {
    success: true,
    sentCount,
    message: `Pemberitahuan darurat berhasil dikirim ke ${sentCount} nomor WhatsApp (Pengajar, Orang Tua, dan Santri).`,
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

  let sentCount = 0;
  const contactedPhones = new Set<string>();

  // A. Kirim ke Pengajar Terjadwal (termasuk Guru Badal)
  for (const st of schedule.teachers) {
    const teacher = st.teacher;
    if (!teacher.phoneNumber || contactedPhones.has(teacher.phoneNumber)) continue;
    contactedPhones.add(teacher.phoneNumber);

    const res = await sendScheduleReminderH1ToTeacher({
      teacherPhone: teacher.phoneNumber,
      teacherName: teacher.fullName,
      dayDate: dayDateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      venueName,
      organizationName: orgName,
      generationName: uniqueGenNames,
      className: schedule.class?.name,
      materialTitle: materialTitles,
      isBadal: st.isSubstitute,
      scheduleId: schedule.id,
      teacherUserId: teacher.id,
    });

    if (res.success) sentCount++;
  }

  // B. Kirim ke Orang Tua dan Santri
  const targetStudents = await getTargetStudentsForSchedule(schedule);

  for (const student of targetStudents) {
    const genName = student.generation?.name || 'Santri';

    // 1. Orang Tua
    for (const rel of student.parents) {
      const parent = rel.parent;
      if (!parent || !parent.phoneNumber || contactedPhones.has(parent.phoneNumber)) continue;
      contactedPhones.add(parent.phoneNumber);

      // Jika sesi < 4 jam lagi gunakan format countdown, jika lebih gunakan format H-1
      if (diffHours <= 4 && diffHours > 0) {
        const res = await sendScheduleReminderCountdown({
          recipientPhone: parent.phoneNumber,
          recipientName: `Bpk/Ibu ${parent.fullName}`,
          studentName: student.fullName,
          scheduleTitle: schedule.title,
          startTime: startTimeStr,
          venueName,
          materialTitle: materialTitles,
          teacherName: teacherNames,
          scheduleId: schedule.id,
          recipientUserId: parent.id,
        });
        if (res.success) sentCount++;
      } else {
        const magicToken = `SCHED_BROADCAST_${schedule.id}_P_${parent.id}_${Date.now()}`;
        const res = await sendScheduleReminderH1ToStudent({
          recipientPhone: parent.phoneNumber,
          recipientName: `Bpk/Ibu ${parent.fullName}`,
          studentName: student.fullName,
          generationName: genName,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: materialTitles,
          teacherName: teacherNames,
          scheduleId: schedule.id,
          magicToken,
          recipientUserId: parent.id,
        });
        if (res.success) sentCount++;
      }
    }

    // 2. Santri jika punya WA
    if (student.phoneNumber && !contactedPhones.has(student.phoneNumber)) {
      contactedPhones.add(student.phoneNumber);

      if (diffHours <= 4 && diffHours > 0) {
        const res = await sendScheduleReminderCountdown({
          recipientPhone: student.phoneNumber,
          recipientName: student.fullName,
          studentName: student.fullName,
          scheduleTitle: schedule.title,
          startTime: startTimeStr,
          venueName,
          materialTitle: materialTitles,
          teacherName: teacherNames,
          scheduleId: schedule.id,
          recipientUserId: student.id,
        });
        if (res.success) sentCount++;
      } else {
        const magicToken = `SCHED_BROADCAST_${schedule.id}_S_${student.id}_${Date.now()}`;
        const res = await sendScheduleReminderH1ToStudent({
          recipientPhone: student.phoneNumber,
          recipientName: student.fullName,
          studentName: student.fullName,
          generationName: genName,
          scheduleTitle: schedule.title,
          dayDate: dayDateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          venueName,
          organizationName: orgName,
          materialTitle: materialTitles,
          teacherName: teacherNames,
          scheduleId: schedule.id,
          magicToken,
          recipientUserId: student.id,
        });
        if (res.success) sentCount++;
      }
    }
  }

  return {
    success: true,
    sentCount,
    message: `Siaran pengingat WhatsApp berhasil dikirimkan ke ${sentCount} penerima (Dewan Pengajar, Orang Tua, & Santri).`,
  };
}
