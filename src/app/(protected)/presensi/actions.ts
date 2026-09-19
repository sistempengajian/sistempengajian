'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import {
  generateSessionSecret,
  generateQrPayload,
  verifyQrPayload,
  TOTP_STEP_SECONDS,
} from '@/lib/totp';
import { AttendanceStatus, AttendanceMethod, AbsenceReasonType, AbsenceConfirmationStatus } from '@prisma/client';
import crypto from 'crypto';
import { uploadTaskImage } from '@/lib/storage/mediaUploader';

/**
 * Mendapatkan atau membuka sesi presensi aktif untuk jadwal tertentu
 */
export async function getOrOpenSession(scheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  // Cek apakah sudah ada sesi aktif untuk jadwal ini
  let session = await prisma.attendanceSession.findFirst({
    where: {
      scheduleId,
      isActive: true,
    },
    include: {
      records: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              generation: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!session) {
    // Buat sesi baru dengan secret TOTP dinamis
    const dynamicQrSecret = generateSessionSecret();
    session = await prisma.attendanceSession.create({
      data: {
        scheduleId,
        dynamicQrSecret,
        isActive: true,
        qrRefreshSeconds: TOTP_STEP_SECONDS,
        openedAt: new Date(),
      },
      include: {
        records: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                generation: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Update status jadwal menjadi ACTIVE
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: 'ACTIVE' },
    });
  }

  revalidatePath('/presensi');
  return {
    success: true,
    sessionId: session.id,
    scheduleId: session.scheduleId,
    isActive: session.isActive,
    qrRefreshSeconds: session.qrRefreshSeconds,
    records: session.records,
  };
}

/**
 * Menghasilkan token TOTP live terkini untuk sesi presensi (dipanggil secara periodik oleh layar ustadz)
 */
export async function getLiveSessionToken(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      dynamicQrSecret: true,
      qrRefreshSeconds: true,
      isActive: true,
    },
  });

  if (!session || !session.isActive) {
    return {
      success: false as const,
      message: 'Sesi presensi telah ditutup atau tidak ditemukan.',
    };
  }

  const payload = generateQrPayload(session.id, session.dynamicQrSecret, session.qrRefreshSeconds);

  return {
    success: true as const,
    sessionId: session.id,
    ...payload,
  };
}

/**
 * Menutup sesi presensi aktif
 */
export async function closeAttendanceSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const session = await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      closedAt: new Date(),
    },
  });

  // Tandai jadwal sebagai COMPLETED
  await prisma.schedule.update({
    where: { id: session.scheduleId },
    data: { status: 'COMPLETED' },
  });

  revalidatePath('/presensi');
  revalidatePath('/dashboard');
  return { success: true, message: 'Sesi presensi berhasil ditutup.' };
}

/**
 * Membuka kembali sesi presensi yang telah ditutup
 */
export async function reopenAttendanceSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const session = await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: {
      isActive: true,
      closedAt: null,
    },
  });

  // Tandai jadwal kembali ACTIVE
  await prisma.schedule.update({
    where: { id: session.scheduleId },
    data: { status: 'ACTIVE' },
  });

  revalidatePath('/presensi');
  revalidatePath('/dashboard');
  revalidatePath(`/jadwal/${session.scheduleId}`);
  return { success: true, message: 'Sesi presensi berhasil dibuka kembali.' };
}

/**
 * Memproses scan QR oleh Santri via pemindai kamera
 */
export async function submitStudentQrScan(rawContent: string, scheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, message: 'Sesi login Anda telah berakhir. Silakan login kembali.' };
  }

  // Cari sesi aktif untuk schedule ini
  const session = await prisma.attendanceSession.findFirst({
    where: {
      scheduleId,
      isActive: true,
    },
  });

  if (!session) {
    return { success: false, message: 'Sesi presensi pengajian belum dibuka oleh pengajar.' };
  }

  // Verifikasi keaslian dan masa berlaku token TOTP (15 detik + window toleransi)
  const verification = verifyQrPayload(
    rawContent,
    session.id,
    session.dynamicQrSecret,
    session.qrRefreshSeconds
  );

  if (!verification.isValid) {
    return { success: false, message: verification.message };
  }

  // Catat atau perbarui absensi santri menjadi HADIR
  const now = new Date();
  const attendance = await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId: authUser.id,
      },
    },
    update: {
      method: AttendanceMethod.QR_SCAN_STUDENT,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      notes: 'Presensi mandiri via scan Dynamic QR TOTP',
    },
    create: {
      sessionId: session.id,
      studentId: authUser.id,
      method: AttendanceMethod.QR_SCAN_STUDENT,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      notes: 'Presensi mandiri via scan Dynamic QR TOTP',
    },
  });

  // Tambah Poin Gamifikasi Santri (+10 Poin) & Update Streak
  try {
    await prisma.userGamification.upsert({
      where: { userId: authUser.id },
      update: {
        totalPoints: { increment: 10 },
        currentStreakDays: { increment: 1 },
        updatedAt: now,
      },
      create: {
        userId: authUser.id,
        totalPoints: 10,
        currentStreakDays: 1,
        highestStreakDays: 1,
        level: 1,
      },
    });
  } catch (error) {
    console.error('Gamification update warning:', error);
  }

  revalidatePath('/presensi');
  revalidatePath('/dashboard');

  return {
    success: true,
    message: 'Alhamdulillah! Presensi Anda berhasil tercatat tepat waktu.',
    checkInTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    pointsEarned: 10,
  };
}

/**
 * Memproses scan Dynamic QR oleh Orang Tua atas nama Ananda/Santri
 */
export async function submitParentQrScan(rawContent: string, scheduleId: string, studentId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, message: 'Sesi login Anda telah berakhir. Silakan login kembali.' };
  }

  // 1. Verifikasi relasi: pastikan authUser adalah orang tua dari studentId
  const relation = await prisma.studentParentRelation.findUnique({
    where: {
      studentUserId_parentUserId: {
        studentUserId: studentId,
        parentUserId: authUser.id,
      },
    },
  });

  if (!relation) {
    return {
      success: false,
      message: 'Akses ditolak: Anda tidak terdaftar sebagai orang tua dari santri ini.',
    };
  }

  // 2. Ambil data santri untuk pesan notifikasi
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { fullName: true },
  });

  // 3. Cari sesi aktif untuk schedule ini
  const session = await prisma.attendanceSession.findFirst({
    where: {
      scheduleId,
      isActive: true,
    },
  });

  if (!session) {
    return { success: false, message: 'Sesi presensi pengajian belum dibuka oleh pengajar.' };
  }

  // 4. Verifikasi keaslian dan masa berlaku token TOTP
  const verification = verifyQrPayload(
    rawContent,
    session.id,
    session.dynamicQrSecret,
    session.qrRefreshSeconds
  );

  if (!verification.isValid) {
    return { success: false, message: verification.message };
  }

  // 5. Catat kehadiran santri menjadi HADIR
  const now = new Date();
  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId,
      },
    },
    update: {
      method: AttendanceMethod.QR_SCAN_STUDENT,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      markedByUserId: authUser.id,
      notes: 'Presensi dicatat via scan Dynamic QR oleh orang tua',
    },
    create: {
      sessionId: session.id,
      studentId,
      method: AttendanceMethod.QR_SCAN_STUDENT,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      markedByUserId: authUser.id,
      notes: 'Presensi dicatat via scan Dynamic QR oleh orang tua',
    },
  });

  // 6. Tambah Poin Gamifikasi Santri (+10 Poin) & Update Streak
  try {
    await prisma.userGamification.upsert({
      where: { userId: studentId },
      update: {
        totalPoints: { increment: 10 },
        currentStreakDays: { increment: 1 },
        updatedAt: now,
      },
      create: {
        userId: studentId,
        totalPoints: 10,
        currentStreakDays: 1,
        highestStreakDays: 1,
        level: 1,
      },
    });
  } catch (error) {
    console.error('Gamification update warning:', error);
  }

  revalidatePath('/presensi');
  revalidatePath(`/jadwal/${scheduleId}`);

  return {
    success: true,
    message: `Alhamdulillah! Presensi untuk ${student?.fullName || 'ananda'} berhasil dicatat tepat waktu.`,
    checkInTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    pointsEarned: 10,
  };
}

/**
 * Mencatat absensi secara manual oleh Ustadz / Pengajar (1-Tap button)
 */
export async function recordManualAttendance(
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  notes?: string
) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const now = new Date();
  const record = await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId,
        studentId,
      },
    },
    update: {
      method: AttendanceMethod.MANUAL_TEACHER,
      status,
      checkInTime: status === 'HADIR' ? now : null,
      markedByUserId: authUser.id,
      notes: notes || `Diperbarui manual oleh pengajar menjadi ${status}`,
    },
    create: {
      sessionId,
      studentId,
      method: AttendanceMethod.MANUAL_TEACHER,
      status,
      checkInTime: status === 'HADIR' ? now : null,
      markedByUserId: authUser.id,
      notes: notes || `Dicatat manual oleh pengajar`,
    },
  });

  revalidatePath('/presensi');
  return { success: true, record };
}

/**
 * Menandai semua santri yang belum diabsen menjadi HADIR
 */
export async function markAllPresent(sessionId: string, studentIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const now = new Date();
  await Promise.all(
    studentIds.map((studentId) =>
      prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId,
          },
        },
        update: {
          method: AttendanceMethod.MANUAL_TEACHER,
          status: AttendanceStatus.HADIR,
          checkInTime: now,
          markedByUserId: authUser.id,
          notes: 'Diset Hadir massal oleh pengajar',
        },
        create: {
          sessionId,
          studentId,
          method: AttendanceMethod.MANUAL_TEACHER,
          status: AttendanceStatus.HADIR,
          checkInTime: now,
          markedByUserId: authUser.id,
          notes: 'Diset Hadir massal oleh pengajar',
        },
      })
    )
  );

  revalidatePath('/presensi');
  return { success: true, count: studentIds.length };
}

/**
 * Memproses scan kartu fisik QR santri (Caberawit) oleh pengajar
 */
export async function recordBatchCardScan(sessionId: string, cardQrContent: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { success: false, message: 'Tidak terautentikasi' };
  }

  // Validasi format kartu santri: santri:<uuid>
  let studentId = cardQrContent.trim();
  if (studentId.startsWith('santri:')) {
    studentId = studentId.replace('santri:', '');
  }

  // Verifikasi santri ada di database
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      generation: { select: { name: true } },
    },
  });

  if (!student) {
    return { success: false, message: 'ID Kartu Santri tidak ditemukan dalam sistem.' };
  }

  const now = new Date();
  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId,
        studentId: student.id,
      },
    },
    update: {
      method: AttendanceMethod.CARD_SCAN_TEACHER,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      markedByUserId: authUser.id,
      notes: 'Scan cepat kartu fisik ber-QR oleh pengajar',
    },
    create: {
      sessionId,
      studentId: student.id,
      method: AttendanceMethod.CARD_SCAN_TEACHER,
      status: AttendanceStatus.HADIR,
      checkInTime: now,
      markedByUserId: authUser.id,
      notes: 'Scan cepat kartu fisik ber-QR oleh pengajar',
    },
  });

  revalidatePath('/presensi');
  return {
    success: true,
    message: `${student.fullName} (${student.generation?.name || 'Santri'}) tercatat HADIR.`,
    studentName: student.fullName,
  };
}

export interface TargetCapaianInput {
  checklistItemId: string;
  score?: number | null;
  isCompleted: boolean;
  teacherFeedback?: string;
  pointsWeight?: number;
}

/**
 * Menyimpan evaluasi menyeluruh: Skor Adab, Keaktifan, Catatan, dan Penilaian Target Capaian Materi
 */
export async function saveComprehensiveEvaluation({
  scheduleId,
  studentId,
  adabScore,
  keaktifanScore,
  teacherPrivateNote,
  targetCapaianUpdates,
}: {
  scheduleId: string;
  studentId: string;
  adabScore: number;
  keaktifanScore: number;
  teacherPrivateNote?: string;
  targetCapaianUpdates?: TargetCapaianInput[];
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  // 1. Simpan atau perbarui catatan adab & keaktifan
  const existingEval = await prisma.studentEvaluation.findFirst({
    where: {
      scheduleId,
      studentId,
    },
    orderBy: { createdAt: 'desc' },
  });

  const evaluation = existingEval
    ? await prisma.studentEvaluation.update({
        where: { id: existingEval.id },
        data: {
          adabScore,
          keaktifanScore,
          teacherPrivateNote: teacherPrivateNote || null,
        },
      })
    : await prisma.studentEvaluation.create({
        data: {
          scheduleId,
          studentId,
          adabScore,
          keaktifanScore,
          teacherPrivateNote,
        },
      });

  // 2. Dapatkan profil & peran authUser untuk validasi hak otorisasi penguji
  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: true },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canCompleteDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const canCompleteDesa = roleCodes.includes('PJ_DESA') || canCompleteDaerah;

  // 3. Simpan atau perbarui progres checklist target capaian
  let totalPointsGained = 0;
  if (targetCapaianUpdates && targetCapaianUpdates.length > 0) {
    for (const update of targetCapaianUpdates) {
      // Validasi hak penguji jika item ditandai tuntas (isCompleted: true)
      if (update.isCompleted) {
        const itemMeta = await prisma.materialChecklistItem.findUnique({
          where: { id: update.checklistItemId },
          select: { completionTierLevel: true, itemTitle: true },
        });

        if (itemMeta?.completionTierLevel === 'DAERAH_ONLY' && !canCompleteDaerah) {
          console.warn(
            `Pencegahan Keamanan: User ${authUser.id} tidak memiliki hak mengesahkan capaian Daerah: ${itemMeta.itemTitle}`
          );
          continue;
        }

        if (itemMeta?.completionTierLevel === 'DESA_AND_ABOVE' && !canCompleteDesa) {
          console.warn(
            `Pencegahan Keamanan: User ${authUser.id} tidak memiliki hak mengesahkan capaian Desa: ${itemMeta.itemTitle}`
          );
          continue;
        }
      }

      const prev = await prisma.materialChecklistProgress.findUnique({
        where: {
          checklistItemId_studentId: {
            checklistItemId: update.checklistItemId,
            studentId,
          },
        },
      });

      await prisma.materialChecklistProgress.upsert({
        where: {
          checklistItemId_studentId: {
            checklistItemId: update.checklistItemId,
            studentId,
          },
        },
        update: {
          scheduleId,
          score: update.isCompleted ? (typeof update.score === 'number' ? update.score : 85) : null,
          isCompleted: update.isCompleted,
          teacherFeedback: update.teacherFeedback || null,
          evaluatedAt: new Date(),
        },
        create: {
          checklistItemId: update.checklistItemId,
          studentId,
          scheduleId,
          score: update.isCompleted ? (typeof update.score === 'number' ? update.score : 85) : null,
          isCompleted: update.isCompleted,
          teacherFeedback: update.teacherFeedback || null,
          evaluatedAt: new Date(),
        },
      });

      // Jika baru ditandai tuntas, tambahkan poin reward santri
      if (update.isCompleted && (!prev || !prev.isCompleted)) {
        totalPointsGained += update.pointsWeight || 10;
      }
    }

    if (totalPointsGained > 0) {
      await prisma.userGamification.upsert({
        where: { userId: studentId },
        update: {
          totalPoints: { increment: totalPointsGained },
          updatedAt: new Date(),
        },
        create: {
          userId: studentId,
          totalPoints: totalPointsGained,
          currentStreakDays: 1,
          highestStreakDays: 1,
          level: 1,
        },
      });
    }
  }

  revalidatePath('/presensi');
  revalidatePath('/dashboard');
  revalidatePath('/kurikulum');
  revalidatePath(`/jadwal/${scheduleId}`);

  return {
    success: true,
    evaluation,
    pointsGained: totalPointsGained,
  };
}

/**
 * Menyimpan evaluasi & penilaian belajar santri per sesi (Wrapper kompatibilitas)
 */
export async function saveStudentEvaluation(
  scheduleId: string,
  studentId: string,
  adabScore: number,
  keaktifanScore: number,
  teacherPrivateNote?: string
) {
  return saveComprehensiveEvaluation({
    scheduleId,
    studentId,
    adabScore,
    keaktifanScore,
    teacherPrivateNote,
  });
}

/**
 * Mengambil rekapitulasi data presensi terkini untuk sesi tertentu (Real-time sync)
 */
export async function getSessionAttendanceRecords(sessionId: string) {
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: {
        studentId: true,
        status: true,
        method: true,
        checkInTime: true,
        absenceConfirmation: {
          select: {
            id: true,
            status: true,
            reasonType: true,
            parentNotes: true,
            attachmentUrl: true,
            confirmedAt: true,
            parent: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      records: records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        method: r.method,
        checkInTime: r.checkInTime
          ? new Date(r.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : null,
        absenceConfirmation: r.absenceConfirmation
          ? {
              id: r.absenceConfirmation.id,
              status: r.absenceConfirmation.status,
              reasonType: r.absenceConfirmation.reasonType,
              parentNotes: r.absenceConfirmation.parentNotes,
              attachmentUrl: r.absenceConfirmation.attachmentUrl,
              parentName: r.absenceConfirmation.parent?.fullName || null,
              confirmedAt: r.absenceConfirmation.confirmedAt
                ? r.absenceConfirmation.confirmedAt.toISOString()
                : null,
            }
          : null,
      })),
    };
  } catch (error) {
    console.error('Gagal mengambil data absensi sesi:', error);
    return {
      success: false,
      records: [],
      error: 'Gagal menyinkronkan data presensi',
    };
  }
}

/**
 * Mengajukan permohonan izin atau sakit santri secara mandiri oleh orang tua / wali (Surat Izin Digital)
 */
export async function submitParentAbsenceRequest({
  studentId,
  scheduleId,
  status,
  notes,
  attachmentData,
  removeAttachment = false,
}: {
  studentId: string;
  scheduleId: string;
  status: 'IZIN' | 'SAKIT';
  notes?: string;
  attachmentData?: string;
  removeAttachment?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  // 1. Verifikasi hubungan orang tua - santri (atau peran pengurus/admin/ustadz)
  const isParent = await prisma.studentParentRelation.findFirst({
    where: {
      parentUserId: authUser.id,
      studentUserId: studentId,
    },
  });

  if (!isParent) {
    const privilegedRole = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: authUser.id,
        role: { in: ['ADMIN_MASTER', 'PJ_DAERAH', 'PJ_DESA', 'PJ_KELOMPOK', 'PENGAJAR', 'WALI_KELAS'] },
      },
    });
    if (!privilegedRole) {
      throw new Error('Akses ditolak: Anda tidak memiliki wewenang mengajukan izin untuk santri ini.');
    }
  }

  // 2. Upload lampiran jika berupa base64 gambar baru
  let uploadedAttachmentUrl: string | null = null;
  if (attachmentData && attachmentData.trim() !== '') {
    try {
      uploadedAttachmentUrl = await uploadTaskImage(attachmentData);
    } catch (uploadErr) {
      console.error('Gagal upload lampiran surat izin:', uploadErr);
    }
  }

  // 3. Dapatkan atau buat sesi kehadiran
  let session = await prisma.attendanceSession.findFirst({
    where: { scheduleId },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    const dynamicQrSecret = generateSessionSecret();
    session = await prisma.attendanceSession.create({
      data: {
        scheduleId,
        dynamicQrSecret,
        isActive: false,
        openedAt: new Date(),
      },
    });
  }

  // 4. Periksa apakah sudah ada record presensi & konfirmasi izin sebelumnya (Batasan: 1 permohonan per sesi)
  const existingRecord = await prisma.attendanceRecord.findFirst({
    where: {
      sessionId: session.id,
      studentId,
    },
    include: {
      absenceConfirmation: true,
    },
  });

  const isUpdate = Boolean(existingRecord?.absenceConfirmation);

  // Batasi edit/perbarui: Hanya bisa diubah jika belum disetujui ustadz (status masih PENDING)
  if (isUpdate && existingRecord?.absenceConfirmation?.status === 'CONFIRMED') {
    throw new Error('Surat izin telah disetujui oleh ustadz pengampu dan tidak dapat diubah lagi.');
  }

  // 5. Upsert record kehadiran santri dengan status IZIN atau SAKIT
  const attendanceStatus = status === 'SAKIT' ? AttendanceStatus.SAKIT : AttendanceStatus.IZIN;
  const noteContent = notes ? `[Izin Orang Tua] ${notes}` : '[Izin Orang Tua] Diajukan oleh wali santri';

  const record = await prisma.attendanceRecord.upsert({
    where: {
      sessionId_studentId: {
        sessionId: session.id,
        studentId,
      },
    },
    update: {
      status: attendanceStatus,
      notes: noteContent,
      method: AttendanceMethod.MANUAL_TEACHER,
      markedByUserId: authUser.id,
      updatedAt: new Date(),
    },
    create: {
      sessionId: session.id,
      studentId,
      status: attendanceStatus,
      notes: noteContent,
      method: AttendanceMethod.MANUAL_TEACHER,
      markedByUserId: authUser.id,
    },
  });

  // Tentukan URL lampiran final (gambar baru diutamakan, atau hapus jika removeAttachment, atau pertahankan yang lama)
  let finalAttachmentUrl: string | null = null;
  if (uploadedAttachmentUrl) {
    finalAttachmentUrl = uploadedAttachmentUrl;
  } else if (removeAttachment) {
    finalAttachmentUrl = null;
  } else if (existingRecord?.absenceConfirmation?.attachmentUrl) {
    finalAttachmentUrl = existingRecord.absenceConfirmation.attachmentUrl;
  }

  // 6. Rekam / Perbarui AbsenceConfirmation (Surat Izin Digital)
  const magicToken = crypto.randomBytes(24).toString('hex');
  const confirmation = await prisma.absenceConfirmation.upsert({
    where: {
      attendanceRecordId: record.id,
    },
    update: {
      studentId,
      parentUserId: authUser.id,
      status: 'PENDING', // Diperbarui oleh ortu, butuh review ulang pengajar
      reasonType: status === 'SAKIT' ? 'SAKIT' : 'IZIN',
      parentNotes: notes || null,
      attachmentUrl: finalAttachmentUrl,
      confirmedAt: null,
    },
    create: {
      attendanceRecordId: record.id,
      studentId,
      parentUserId: authUser.id,
      magicToken,
      tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      reasonType: status === 'SAKIT' ? 'SAKIT' : 'IZIN',
      parentNotes: notes || null,
      attachmentUrl: finalAttachmentUrl,
    },
  });

  revalidatePath('/presensi');
  revalidatePath(`/jadwal/${scheduleId}`);

  return {
    success: true,
    isUpdate,
    message: isUpdate
      ? 'Surat izin berhasil diperbarui. Ustadz pengampu akan meninjau perubahan ini.'
      : 'Surat izin digital berhasil dikirimkan ke ustadz pengampu.',
    recordId: record.id,
    status: record.status,
    confirmationId: confirmation.id,
    attachmentUrl: confirmation.attachmentUrl,
  };
}

/**
 * Memverifikasi permohonan surat izin digital santri oleh Pengajar / Wali Kelas
 */
export async function verifyAbsenceConfirmation({
  confirmationId,
  decision,
  reviewNotes,
}: {
  confirmationId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNotes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: true },
  });
  if (!user) throw new Error('Pengguna tidak ditemukan');

  const roleCodes = user.roles.map((r) => r.role);
  const isAuthorized = roleCodes.some((r) =>
    ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
  );
  if (!isAuthorized) {
    throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk memverifikasi surat izin.');
  }

  const confirmation = await prisma.absenceConfirmation.findUnique({
    where: { id: confirmationId },
    include: {
      attendanceRecord: {
        include: { session: true },
      },
    },
  });
  if (!confirmation) {
    throw new Error('Surat izin tidak ditemukan.');
  }

  const isApproved = decision === 'APPROVE';
  const newConfirmationStatus = isApproved ? 'CONFIRMED' : 'REJECTED';
  const newAttendanceStatus = isApproved
    ? confirmation.reasonType === 'SAKIT'
      ? AttendanceStatus.SAKIT
      : AttendanceStatus.IZIN
    : AttendanceStatus.ALPA;

  const currentNotes = confirmation.parentNotes ? `[Izin Orang Tua] ${confirmation.parentNotes}` : '';
  const noteSuffix = isApproved
    ? ` [Disetujui oleh ${user.fullName}]`
    : ` [Ditolak oleh ${user.fullName}${reviewNotes ? ': ' + reviewNotes : ''}]`;

  await prisma.absenceConfirmation.update({
    where: { id: confirmationId },
    data: {
      status: newConfirmationStatus as any,
      confirmedAt: new Date(),
    },
  });

  await prisma.attendanceRecord.update({
    where: { id: confirmation.attendanceRecordId },
    data: {
      status: newAttendanceStatus,
      markedByUserId: authUser.id,
      notes: currentNotes + noteSuffix,
      updatedAt: new Date(),
    },
  });

  revalidatePath('/presensi');
  if (confirmation.attendanceRecord?.session?.scheduleId) {
    revalidatePath(`/jadwal/${confirmation.attendanceRecord.session.scheduleId}`);
  }

  return {
    success: true,
    status: newConfirmationStatus,
    attendanceStatus: newAttendanceStatus,
  };
}

/**
 * Membatalkan / menghapus permohonan surat izin santri oleh orang tua (Hanya sebelum disetujui ustadz)
 */
export async function cancelParentAbsenceRequest(confirmationId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  const confirmation = await prisma.absenceConfirmation.findUnique({
    where: { id: confirmationId },
    include: {
      attendanceRecord: {
        include: { session: true },
      },
    },
  });

  if (!confirmation) {
    throw new Error('Surat izin tidak ditemukan.');
  }

  // Validasi kepemilikan: harus orang tua yang mengajukan
  if (confirmation.parentUserId !== authUser.id) {
    throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk membatalkan surat permohonan ini.');
  }

  // Batasan: Hanya surat yang belum disetujui pengajar yang bisa dibatalkan
  if (confirmation.status === 'CONFIRMED') {
    throw new Error('Surat izin telah disetujui oleh ustadz pengampu dan tidak dapat dibatalkan.');
  }

  const scheduleId = confirmation.attendanceRecord?.session?.scheduleId;
  const recordId = confirmation.attendanceRecordId;

  // Hapus attendance record (otomatis cascade menghapus absenceConfirmation)
  await prisma.attendanceRecord.delete({
    where: { id: recordId },
  });

  revalidatePath('/presensi');
  if (scheduleId) {
    revalidatePath(`/jadwal/${scheduleId}`);
  }

  return {
    success: true,
    message: 'Surat permohonan izin berhasil dibatalkan.',
  };
}

/**
 * Mengambil daftar sesi jadwal aktif dan mendatang yang relevan dengan ananda untuk pengajuan izin
 */
export async function getChildUpcomingSchedules(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) throw new Error('Tidak terautentikasi');

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      organizationId: true,
      generationId: true,
      organization: { select: { parentId: true } },
    },
  });

  if (!student) throw new Error('Santri tidak ditemukan');

  const studentClasses = await prisma.class.findMany({
    where: {
      generationId: student.generationId || undefined,
      OR: [
        { organizationId: student.organizationId || undefined },
        { organizationId: student.organization?.parentId || undefined },
      ],
    },
    select: { id: true },
  });
  const classIds = studentClasses.map((c) => c.id);

  const now = new Date();
  const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
  const oneWeekAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);

  const studentOrgIds = [
    student.organizationId,
    student.organization?.parentId,
  ].filter(Boolean) as string[];

  const schedules = await prisma.schedule.findMany({
    where: {
      endTime: { gte: oneWeekAgo },
      startTime: { lte: oneWeekAhead },
      organizationId: { in: studentOrgIds },
      OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
      AND: [
        {
          OR: [
            ...(classIds.length > 0
              ? [
                  { classId: { in: classIds } },
                  { targetClasses: { some: { classId: { in: classIds } } } },
                ]
              : []),
            ...(student.generationId
              ? [
                  { targetGenerations: { some: { generationId: student.generationId } } },
                  { class: { generationId: student.generationId } },
                ]
              : []),
            {
              classId: null,
              targetClasses: { none: {} },
              targetGenerations: { none: {} },
            },
          ],
        },
      ],
    },
    include: {
      teachers: {
        where: { isPrimary: true },
        include: { teacher: { select: { fullName: true } } },
      },
      class: { select: { name: true } },
      attendanceSessions: {
        select: {
          id: true,
          records: {
            where: { studentId },
            include: {
              absenceConfirmation: true,
            },
          },
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  return schedules.map((s) => {
    const record = s.attendanceSessions?.flatMap((sess) => sess.records || [])?.[0];
    return {
      id: s.id,
      title: s.title,
      startTime: s.startTime.toISOString(),
      endTime: s.endTime.toISOString(),
      venuePlaceName: s.venuePlaceName,
      primaryTeacherName: s.teachers?.[0]?.teacher?.fullName || 'Pengajar',
      className: s.class?.name || null,
      existingRecord: record
        ? {
            status: record.status,
            notes: record.notes,
            confirmationStatus: record.absenceConfirmation?.status || null,
            reasonType: record.absenceConfirmation?.reasonType || null,
            parentNotes: record.absenceConfirmation?.parentNotes || null,
            attachmentUrl: record.absenceConfirmation?.attachmentUrl || null,
            confirmationId: record.absenceConfirmation?.id || null,
          }
        : null,
    };
  });
}

/**
 * Mengambil riwayat pengajuan surat izin ananda oleh orang tua
 */
export async function getParentAbsenceHistory(studentId?: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) throw new Error('Tidak terautentikasi');

  const confirmations = await prisma.absenceConfirmation.findMany({
    where: {
      parentUserId: authUser.id,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      attendanceRecord: {
        include: {
          student: { select: { id: true, fullName: true } },
          session: {
            include: {
              schedule: {
                select: {
                  id: true,
                  title: true,
                  startTime: true,
                  endTime: true,
                  venuePlaceName: true,
                },
              },
            },
          },
          markedBy: { select: { fullName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return confirmations.map((c) => ({
    id: c.id,
    studentId: c.studentId,
    studentName: c.attendanceRecord?.student?.fullName || 'Santri',
    scheduleId: c.attendanceRecord?.session?.schedule?.id || '',
    scheduleTitle: c.attendanceRecord?.session?.schedule?.title || 'Sesi Pengajian',
    scheduleStartTime: c.attendanceRecord?.session?.schedule?.startTime?.toISOString() || '',
    reasonType: (c.reasonType || 'IZIN') as 'SAKIT' | 'IZIN',
    status: c.status,
    parentNotes: c.parentNotes,
    attachmentUrl: c.attachmentUrl,
    confirmedAt: c.confirmedAt?.toISOString() || null,
    verifiedByTeacherName: c.attendanceRecord?.markedBy?.fullName || null,
    createdAt: c.createdAt.toISOString(),
  }));
}
