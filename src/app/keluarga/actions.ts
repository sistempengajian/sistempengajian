'use server';

import prisma from '@/lib/prisma';
import {
  verifyFamilyActionHubToken,
  generateStudentAbsenceApprovalToken,
} from '@/lib/studentAbsenceToken';
import { sendStudentAbsenceRequestInvitationNotification } from '@/lib/whatsapp/triggers';
import { revalidatePath } from 'next/cache';

function formatIndonesianDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function formatIndonesianTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/**
 * 1. Mengambil data komprehensif Family Action Hub (Portal Multi-Santri Keluarga)
 */
export async function getFamilyActionHubData(token: string) {
  const verified = verifyFamilyActionHubToken(token);
  if (!verified.valid || !verified.parentUserId || !verified.scheduleId) {
    return {
      success: false,
      error: verified.error || 'Tautan portal keluarga tidak sah atau telah kedaluwarsa.',
    };
  }

  try {
    const [parentUser, primarySchedule, parentRelations] = await Promise.all([
      prisma.user.findUnique({
        where: { id: verified.parentUserId },
        select: {
          id: true,
          fullName: true,
          gender: true,
          phoneNumber: true,
          organization: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.schedule.findUnique({
        where: { id: verified.scheduleId },
        include: {
          organization: { select: { id: true, name: true } },
          class: { select: { id: true, name: true, generationId: true } },
          targetClasses: {
            include: {
              class: { select: { id: true, name: true, generationId: true } },
            },
          },
          targetGenerations: {
            include: {
              generation: { select: { id: true, name: true } },
            },
          },
          teachers: {
            where: {
              teacher: { status: 'ACTIVE' },
            },
            include: {
              teacher: { select: { id: true, fullName: true, gender: true } },
            },
            orderBy: [{ isPrimary: 'desc' }, { isSubstitute: 'asc' }],
          },
          scheduleMaterials: {
            include: {
              material: { select: { id: true, title: true, description: true } },
            },
            orderBy: { slotIndex: 'asc' },
          },
          attendanceSessions: {
            where: { isActive: true },
            take: 1,
          },
        },
      }),
      prisma.studentParentRelation.findMany({
        where: { parentUserId: verified.parentUserId },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              gender: true,
              organizationId: true,
              generationId: true,
              generation: { select: { id: true, name: true } },
              organization: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    if (!parentUser || !primarySchedule) {
      return {
        success: false,
        error: 'Data jadwal atau akun orang tua tidak ditemukan.',
      };
    }

    const dayDate = formatIndonesianDate(primarySchedule.startTime);
    const startTimeStr = formatIndonesianTime(primarySchedule.startTime);
    const endTimeStr = formatIndonesianTime(primarySchedule.endTime);

    // Ambil data kehadiran dan permohonan izin untuk setiap anak pada jadwal ini
    const studentIds = parentRelations.map((r) => r.student.id);

    const [attendanceRecords, absenceRequests] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: {
          studentId: { in: studentIds },
          session: { scheduleId: primarySchedule.id },
        },
        include: {
          session: true,
        },
      }),
      prisma.studentAbsenceRequest.findMany({
        where: {
          studentId: { in: studentIds },
          scheduleId: primarySchedule.id,
        },
        include: {
          approvals: {
            include: {
              approverUser: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const childrenData = parentRelations.map((rel) => {
      const student = rel.student;
      const attRecord = attendanceRecords.find((a) => a.studentId === student.id) || null;
      const absReq = absenceRequests.find((r) => r.studentId === student.id) || null;

      // Evaluasi status kehadiran riil berbasis verifikasi Pengajar di majelis
      let statusBadge: 'HADIR' | 'TERLAMBAT' | 'ABSENCE_PENDING' | 'ABSENCE_APPROVED' | 'ABSENCE_REJECTED' | 'NOT_CHECKED_IN' = 'NOT_CHECKED_IN';

      if (attRecord?.status === 'HADIR') {
        statusBadge = 'HADIR';
      } else if (attRecord?.status === 'TERLAMBAT') {
        statusBadge = 'TERLAMBAT';
      } else if (absReq) {
        if (absReq.status === 'APPROVED') statusBadge = 'ABSENCE_APPROVED';
        else if (absReq.status === 'REJECTED') statusBadge = 'ABSENCE_REJECTED';
        else statusBadge = 'ABSENCE_PENDING';
      } else if (attRecord?.status === 'IZIN' || attRecord?.status === 'SAKIT') {
        statusBadge = 'ABSENCE_APPROVED';
      }

      const checkInTimeFormatted = attRecord?.checkInTime
        ? formatIndonesianTime(attRecord.checkInTime)
        : null;

      let methodLabel: string | null = null;
      if (attRecord?.method === 'QR_SCAN_STUDENT') methodLabel = 'Scan QR Dinamis';
      else if (attRecord?.method === 'CARD_SCAN_TEACHER') methodLabel = 'Scan Kartu Santri';
      else if (attRecord?.method === 'MANUAL_TEACHER') methodLabel = 'Presensi Manual Ustadz';

      return {
        student,
        relationshipType: rel.relationshipType,
        attendanceRecord: attRecord
          ? {
              status: attRecord.status,
              checkInTime: checkInTimeFormatted,
              method: methodLabel,
              notes: attRecord.notes,
            }
          : null,
        absenceRequest: absReq
          ? {
              id: absReq.id,
              absenceType: absReq.absenceType,
              reason: absReq.notes,
              status: absReq.status,
            }
          : null,
        statusBadge,
        directPresensiUrl: `/auth/direct?target=presensi_ortu&scheduleId=${primarySchedule.id}&studentId=${student.id}&token=${token}`,
      };
    });

    return {
      success: true,
      parent: parentUser,
      schedule: {
        id: primarySchedule.id,
        title: primarySchedule.title,
        dayDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venuePlaceName: primarySchedule.venuePlaceName || 'Masjid Kelompok',
        notes: primarySchedule.notes,
        organizationName: primarySchedule.organization.name,
        teachers: primarySchedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar',
        materials: primarySchedule.scheduleMaterials.map((m) => m.material.title).join(', ') || 'Materi Rutin',
      },
      childrenData,
    };
  } catch (err: any) {
    console.error('[getFamilyActionHubData Error]:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat portal aksi keluarga.',
    };
  }
}

/**
 * 3. Ajukan Izin / Sakit Santri dari Family Action Hub
 */
export async function submitFamilyChildAbsence({
  token,
  studentId,
  scheduleId,
  absenceType,
  notes,
  attachmentUrl,
}: {
  token: string;
  studentId: string;
  scheduleId: string;
  absenceType: 'IZIN' | 'SAKIT';
  notes: string;
  attachmentUrl?: string;
}) {
  const verified = verifyFamilyActionHubToken(token);
  if (!verified.valid || !verified.parentUserId) {
    return { success: false, error: 'Tautan portal tidak sah atau kedaluwarsa.' };
  }

  const cleanNotes = (notes || '').trim();
  if (cleanNotes.length < 3) {
    return {
      success: false,
      error: 'Mohon cantumkan keterangan alasan berhalangan hadir dengan jelas (minimal 3 karakter).',
    };
  }

  try {
    const [relation, schedule] = await Promise.all([
      prisma.studentParentRelation.findFirst({
        where: {
          parentUserId: verified.parentUserId,
          studentUserId: studentId,
        },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              generationId: true,
              generation: { select: { id: true, name: true } },
            },
          },
          parent: {
            select: {
              id: true,
              fullName: true,
              gender: true,
              phoneNumber: true,
            },
          },
        },
      }),
      prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          organization: true,
          class: true,
          targetClasses: { include: { class: true } },
        },
      }),
    ]);

    if (!relation || !schedule) {
      return { success: false, error: 'Data relasi santri atau jadwal tidak ditemukan.' };
    }

    // 1. Simpan StudentAbsenceRequest
    const createdRequest = await prisma.studentAbsenceRequest.create({
      data: {
        scheduleId,
        studentId,
        submittedByUserId: verified.parentUserId,
        submittedByRole: 'PARENT',
        absenceType,
        notes: cleanNotes,
        attachmentUrl: attachmentUrl || null,
        status: 'PENDING',
        approvedCount: 1,
      },
    });

    // Otomatis catat persetujuan dari orang tua pengaju
    await prisma.studentAbsenceApproval.create({
      data: {
        requestId: createdRequest.id,
        approverUserId: verified.parentUserId,
        approverRole: 'PARENT',
        action: 'APPROVED',
        notes: 'Diajukan langsung oleh Orang Tua / Wali Santri via Portal Keluarga',
      },
    });

    // 2. Cari Wali Kelas untuk notifikasi WhatsApp otomatis
    let homeroomTeacher: any = null;
    const targetClass = schedule.class || schedule.targetClasses?.[0]?.class;
    if (targetClass?.homeroomTeacherId) {
      homeroomTeacher = await prisma.user.findUnique({
        where: { id: targetClass.homeroomTeacherId },
        select: { id: true, fullName: true, phoneNumber: true, gender: true },
      });
    }

    if (homeroomTeacher && homeroomTeacher.phoneNumber) {
      try {
        const confirmToken = generateStudentAbsenceApprovalToken(
          createdRequest.id,
          homeroomTeacher.id,
          'HOMEROOM_TEACHER'
        );

        await sendStudentAbsenceRequestInvitationNotification({
          recipientPhone: homeroomTeacher.phoneNumber,
          recipientName: homeroomTeacher.fullName,
          recipientGender: homeroomTeacher.gender,
          approverRole: 'HOMEROOM_TEACHER',
          studentName: relation.student.fullName,
          className: relation.student.generation?.name
            ? `Kelas ${relation.student.generation.name}`
            : (schedule.class?.name || 'Santri'),
          scheduleTitle: schedule.title,
          dayDate: formatIndonesianDate(schedule.startTime),
          startTime: formatIndonesianTime(schedule.startTime),
          endTime: formatIndonesianTime(schedule.endTime),
          venueName: schedule.venuePlaceName || 'Masjid Kelompok',
          organizationName: schedule.organization?.name || 'Kelompok',
          absenceType,
          reasonNotes: cleanNotes,
          hasAttachment: Boolean(attachmentUrl),
          confirmToken,
          requestId: createdRequest.id,
          recipientUserId: homeroomTeacher.id,
        });
      } catch (waErr) {
        console.warn('[submitFamilyChildAbsence] Gagal kirim WA ke wali kelas:', waErr);
      }
    }

    try {
      revalidatePath(`/keluarga/sesi/${token}`);
    } catch (_) {
      // Safe fallback outside Next.js request context
    }

    return {
      success: true,
      message: `Pengajuan izin ${absenceType.toLowerCase()} untuk ananda ${relation.student.fullName} berhasil dikirimkan dan menunggu verifikasi Wali Kelas.`,
    };
  } catch (err: any) {
    console.error('[submitFamilyChildAbsence Error]:', err);
    return {
      success: false,
      error: 'Gagal mengirimkan pengajuan izin santri.',
    };
  }
}
