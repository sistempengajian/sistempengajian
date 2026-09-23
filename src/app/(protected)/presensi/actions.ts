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
 * Mengisi status awal ALPA di database untuk seluruh santri target jadwal yang belum memiliki catatan presensi
 * Memastikan data di server sinkron dengan tampilan default Alpa sejak sesi dibuka maupun saat ditutup.
 */
export async function populateDefaultAbsenceForSession(sessionId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      schedule: {
        include: {
          class: true,
          targetClasses: { include: { class: true } },
          targetGenerations: true,
        },
      },
      records: { select: { studentId: true } },
    },
  });

  if (!session || !session.schedule) return { count: 0 };

  const schedule = session.schedule;

  // Kumpulkan daftar kelas target jadwal (baik kelas utama maupun multi-kelas gabungan)
  const targetClassesMap = new Map<
    string,
    { id: string; name: string; organizationId: string; generationId: string }
  >();

  if (schedule.class) {
    targetClassesMap.set(schedule.class.id, {
      id: schedule.class.id,
      name: schedule.class.name,
      organizationId: schedule.class.organizationId,
      generationId: schedule.class.generationId,
    });
  }

  if (schedule.targetClasses && schedule.targetClasses.length > 0) {
    for (const tc of schedule.targetClasses) {
      if (tc.class) {
        targetClassesMap.set(tc.class.id, {
          id: tc.class.id,
          name: tc.class.name,
          organizationId: tc.class.organizationId,
          generationId: tc.class.generationId,
        });
      }
    }
  }

  const targetClassesList = Array.from(targetClassesMap.values());

  // Filter santri
  const studentWhere: any = {
    roles: {
      some: { role: 'SANTRI' },
    },
  };

  if (targetClassesList.length > 0) {
    studentWhere.OR = targetClassesList.map((c) => ({
      organizationId: c.organizationId,
      generationId: c.generationId,
    }));
  } else {
    const orgIds: string[] = [schedule.organizationId];
    if (schedule.tierLevel === 'DESA') {
      const subOrgs = await prisma.organization.findMany({
        where: { parentId: schedule.organizationId },
        select: { id: true },
      });
      orgIds.push(...subOrgs.map((o) => o.id));
    } else if (schedule.tierLevel === 'DAERAH') {
      const desaOrgs = await prisma.organization.findMany({
        where: { parentId: schedule.organizationId },
        select: { id: true },
      });
      const desaIds = desaOrgs.map((o) => o.id);
      orgIds.push(...desaIds);
      if (desaIds.length > 0) {
        const kelompokOrgs = await prisma.organization.findMany({
          where: { parentId: { in: desaIds } },
          select: { id: true },
        });
        orgIds.push(...kelompokOrgs.map((o) => o.id));
      }
    }

    studentWhere.organizationId = { in: orgIds };

    if (schedule.targetGenerations && schedule.targetGenerations.length > 0) {
      studentWhere.generationId = {
        in: schedule.targetGenerations.map((g) => g.generationId),
      };
    }
  }

  const targetStudents = await prisma.user.findMany({
    where: studentWhere,
    select: { id: true },
  });

  const existingStudentIds = new Set(session.records.map((r) => r.studentId));
  const missingStudentIds = targetStudents
    .map((s) => s.id)
    .filter((sId) => !existingStudentIds.has(sId));

  if (missingStudentIds.length > 0) {
    await prisma.attendanceRecord.createMany({
      data: missingStudentIds.map((sId) => ({
        sessionId: session.id,
        studentId: sId,
        method: AttendanceMethod.MANUAL_TEACHER,
        status: AttendanceStatus.ALPA,
        notes: 'Status awal presensi sesi (Belum hadir)',
      })),
      skipDuplicates: true,
    });
  }

  return { count: missingStudentIds.length };
}

/**
 * Mendapatkan atau membuka sesi presensi aktif untuk jadwal tertentu
 * Mengisi status awal ALPA untuk seluruh santri terdaftar (Opsi B)
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

  // Inisialisasi awal seluruh santri target jadwal menjadi ALPA di database jika belum memiliki record
  await populateDefaultAbsenceForSession(session.id);

  // Ambil data records terkini yang sudah lengkap terisi
  const updatedRecords = await prisma.attendanceRecord.findMany({
    where: { sessionId: session.id },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          generation: { select: { name: true } },
        },
      },
    },
  });

  revalidatePath('/presensi');
  return {
    success: true,
    sessionId: session.id,
    scheduleId: session.scheduleId,
    isActive: session.isActive,
    qrRefreshSeconds: session.qrRefreshSeconds,
    records: updatedRecords,
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
 * Memastikan seluruh santri yang belum tercatat presensinya otomatis terisi ALPA di database
 */
export async function closeAttendanceSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Tidak terautentikasi');
  }

  // Pastikan santri yang belum tercatat otomatis tersimpan sebagai ALPA di database
  await populateDefaultAbsenceForSession(sessionId);

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
 * Menyimpan evaluasi menyeluruh: Skor Adab, Keaktifan, Catatan, dan Penilaian Target Capaian Materi (Dioptimalkan)
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

  // 1. Dapatkan profil & peran authUser untuk validasi hak otorisasi penguji
  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: true },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canCompleteDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const canCompleteDesa = roleCodes.includes('PJ_DESA') || canCompleteDaerah;

  // 2. Batch fetch metadata checklist items untuk validasi hak otorisasi penguji
  const allowedUpdates: TargetCapaianInput[] = [];
  if (targetCapaianUpdates && targetCapaianUpdates.length > 0) {
    const itemIds = targetCapaianUpdates.map((u) => u.checklistItemId);
    const itemsMeta = await prisma.materialChecklistItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, completionTierLevel: true, itemTitle: true },
    });
    const itemMetaMap = new Map(itemsMeta.map((i) => [i.id, i]));

    for (const update of targetCapaianUpdates) {
      if (update.isCompleted) {
        const itemMeta = itemMetaMap.get(update.checklistItemId);
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
      allowedUpdates.push(update);
    }
  }

  // 3. Batch fetch progres sebelumnya untuk menghitung poin reward santri
  let totalPointsGained = 0;
  if (allowedUpdates.length > 0) {
    const prevCompletedList = await prisma.materialChecklistProgress.findMany({
      where: {
        studentId,
        checklistItemId: { in: allowedUpdates.map((u) => u.checklistItemId) },
        isCompleted: true,
      },
      select: { checklistItemId: true },
    });
    const prevCompletedSet = new Set(prevCompletedList.map((p) => p.checklistItemId));

    for (const update of allowedUpdates) {
      if (update.isCompleted && !prevCompletedSet.has(update.checklistItemId)) {
        totalPointsGained += update.pointsWeight || 10;
      }
    }
  }

  // 4. Eksekusi seluruh persistensi dalam satu transaksi atomik berkecepatan tinggi
  const evaluation = await prisma.$transaction(
    async (tx) => {
      const now = new Date();

      // A. Simpan atau perbarui catatan adab & keaktifan
      const existingEval = await tx.studentEvaluation.findFirst({
        where: { scheduleId, studentId },
        orderBy: { createdAt: 'desc' },
      });

      const evalRecord = existingEval
        ? await tx.studentEvaluation.update({
            where: { id: existingEval.id },
            data: {
              adabScore,
              keaktifanScore,
              teacherPrivateNote: teacherPrivateNote || null,
            },
          })
        : await tx.studentEvaluation.create({
            data: {
              scheduleId,
              studentId,
              adabScore,
              keaktifanScore,
              teacherPrivateNote,
            },
          });

      // B. Batch upsert progres checklist target capaian
      for (const update of allowedUpdates) {
        await tx.materialChecklistProgress.upsert({
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
            evaluatedAt: now,
          },
          create: {
            checklistItemId: update.checklistItemId,
            studentId,
            scheduleId,
            score: update.isCompleted ? (typeof update.score === 'number' ? update.score : 85) : null,
            isCompleted: update.isCompleted,
            teacherFeedback: update.teacherFeedback || null,
            evaluatedAt: now,
          },
        });
      }

      // C. Poin gamifikasi santri
      if (totalPointsGained > 0) {
        await tx.userGamification.upsert({
          where: { userId: studentId },
          update: {
            totalPoints: { increment: totalPointsGained },
            updatedAt: now,
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

      return evalRecord;
    },
    { timeout: 10000 }
  );

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
 * Menyimpan evaluasi menyeluruh secara massal untuk beberapa atau seluruh santri yang hadir (Dioptimalkan)
 * Menerapkan Batch Pre-fetching dan Pipelined Chunked Transaction untuk performa ultra-cepat
 */
export async function saveBulkComprehensiveEvaluation({
  scheduleId,
  studentIds,
  adabScore,
  keaktifanScore,
  teacherPrivateNote,
  targetCapaianUpdates,
}: {
  scheduleId: string;
  studentIds: string[];
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

  if (!studentIds || studentIds.length === 0) {
    throw new Error('Tidak ada santri yang dipilih untuk penilaian massal');
  }

  // 1. Dapatkan profil & peran authUser untuk validasi hak otorisasi penguji
  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: true },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canCompleteDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const canCompleteDesa = roleCodes.includes('PJ_DESA') || canCompleteDaerah;

  // 2. Batch fetch metadata checklist items untuk validasi hak otorisasi penguji (1 Query O(1))
  const allowedUpdates: TargetCapaianInput[] = [];
  if (targetCapaianUpdates && targetCapaianUpdates.length > 0) {
    const itemIds = targetCapaianUpdates.map((u) => u.checklistItemId);
    const itemsMeta = await prisma.materialChecklistItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, completionTierLevel: true, itemTitle: true },
    });
    const itemMetaMap = new Map(itemsMeta.map((i) => [i.id, i]));

    for (const update of targetCapaianUpdates) {
      if (update.isCompleted) {
        const itemMeta = itemMetaMap.get(update.checklistItemId);
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
      allowedUpdates.push(update);
    }
  }

  // 3. Pre-fetch seluruh evaluasi santri yang sudah ada pada sesi jadwal ini (1 Query O(1))
  const existingEvals = await prisma.studentEvaluation.findMany({
    where: {
      scheduleId,
      studentId: { in: studentIds },
    },
    select: { id: true, studentId: true },
  });
  const existingEvalMap = new Map(existingEvals.map((e) => [e.studentId, e.id]));

  // 4. Pre-fetch status checklist tuntas sebelumnya untuk seluruh santri target (1 Query O(1))
  const prevCompletedList =
    allowedUpdates.length > 0
      ? await prisma.materialChecklistProgress.findMany({
          where: {
            studentId: { in: studentIds },
            checklistItemId: { in: allowedUpdates.map((u) => u.checklistItemId) },
            isCompleted: true,
          },
          select: { studentId: true, checklistItemId: true },
        })
      : [];

  const prevCompletedSet = new Set(
    prevCompletedList.map((p) => `${p.studentId}_${p.checklistItemId}`)
  );

  // 5. Hitung poin reward gamifikasi per santri di memori (In-memory calculation)
  const pointsPerStudentMap = new Map<string, number>();
  let totalPointsDistributed = 0;

  for (const sId of studentIds) {
    let studentPoints = 0;
    for (const update of allowedUpdates) {
      if (update.isCompleted) {
        const key = `${sId}_${update.checklistItemId}`;
        if (!prevCompletedSet.has(key)) {
          studentPoints += update.pointsWeight || 10;
        }
      }
    }
    if (studentPoints > 0) {
      pointsPerStudentMap.set(sId, studentPoints);
      totalPointsDistributed += studentPoints;
    }
  }

  // 6. Eksekusi Batch Transaksi per Kelompok Santri (Batch Chunking: 25 santri per chunk)
  // Menjamin transaksi tidak pernah timeout bahkan saat submit 100+ santri sekaligus
  const CHUNK_SIZE = 25;
  for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
    const chunkStudentIds = studentIds.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        // A. Batch Update/Create Student Evaluation
        for (const sId of chunkStudentIds) {
          const existingEvalId = existingEvalMap.get(sId);
          if (existingEvalId) {
            await tx.studentEvaluation.update({
              where: { id: existingEvalId },
              data: {
                adabScore,
                keaktifanScore,
                teacherPrivateNote: teacherPrivateNote || null,
              },
            });
          } else {
            await tx.studentEvaluation.create({
              data: {
                scheduleId,
                studentId: sId,
                adabScore,
                keaktifanScore,
                teacherPrivateNote,
              },
            });
          }
        }

        // B. Batch Upsert Material Checklist Progress
        if (allowedUpdates.length > 0) {
          for (const sId of chunkStudentIds) {
            for (const update of allowedUpdates) {
              await tx.materialChecklistProgress.upsert({
                where: {
                  checklistItemId_studentId: {
                    checklistItemId: update.checklistItemId,
                    studentId: sId,
                  },
                },
                update: {
                  scheduleId,
                  score: update.isCompleted ? (typeof update.score === 'number' ? update.score : 85) : null,
                  isCompleted: update.isCompleted,
                  teacherFeedback: update.teacherFeedback || null,
                  evaluatedAt: now,
                },
                create: {
                  checklistItemId: update.checklistItemId,
                  studentId: sId,
                  scheduleId,
                  score: update.isCompleted ? (typeof update.score === 'number' ? update.score : 85) : null,
                  isCompleted: update.isCompleted,
                  teacherFeedback: update.teacherFeedback || null,
                  evaluatedAt: now,
                },
              });
            }
          }
        }

        // C. Batch Update Gamifikasi Santri
        for (const sId of chunkStudentIds) {
          const points = pointsPerStudentMap.get(sId);
          if (points && points > 0) {
            await tx.userGamification.upsert({
              where: { userId: sId },
              update: {
                totalPoints: { increment: points },
                updatedAt: now,
              },
              create: {
                userId: sId,
                totalPoints: points,
                currentStreakDays: 1,
                highestStreakDays: 1,
                level: 1,
              },
            });
          }
        }
      },
      { timeout: 15000 }
    );
  }

  revalidatePath('/presensi');
  revalidatePath('/dashboard');
  revalidatePath('/kurikulum');
  revalidatePath(`/jadwal/${scheduleId}`);

  return {
    success: true,
    count: studentIds.length,
    totalPointsDistributed,
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
