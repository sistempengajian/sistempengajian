import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { whatsAppClient } from '@/lib/whatsapp/WhatsAppClient';
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
  sendFamilyScheduleReminderH1,
  sendFamilyActionLinkH1,
  sendFamilyScheduleReminderCountdown,
  sendFamilyActionLinks2h,
  sendUnifiedTeacherParentReminder,
  sendTeacherWithDispensationReminder,
  sendTeacherAttendanceReminder30m,
  sendTeacherJournalReminder30m,
} from '@/lib/whatsapp/triggers';
import {
  formatIndonesianDate,
  formatTime,
  getTargetStudentsForSchedule,
  getPersonalizedSessionInfoForStudent,
} from '@/lib/whatsapp/scheduleNotificationService';
import { isScheduleCombined } from '@/lib/whatsapp/groupScheduleNotificationService';
import { normalizePhoneNumber } from '@/lib/whatsapp/utils';
import { ScheduleStatus, AttendanceStatus, AttendanceMethod } from '@prisma/client';
import {
  generateStudentAbsenceRequestToken,
  generateFamilyActionHubToken,
} from '@/lib/studentAbsenceToken';
import { handleBroadcastMagicLogin } from '@/lib/whatsapp/broadcastMagicLoginService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s execution limit (Vercel)

const LOCK_KEY = 'cron:lock:schedule-reminders';
const LOCK_TTL_SECONDS = 28; // Lock kedaluwarsa otomatis dalam 28 detik

/**
 * Menghitung jeda acak dalam milidetik (antara minSec s/d maxSec)
 * Membantu pencegahan blokir WhatsApp (Anti-Ban Jitter Rate Limiting)
 */
function getRandomDelayMs(minSec = 3, maxSec = 15): number {
  const minMs = minSec * 1000;
  const maxMs = maxSec * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Endpoint Cron Scheduler: Pengingat Jadwal Pengajian Otomatis via WhatsApp
 * Fitur:
 * - Interval pemicu 1 menit (cron-job.org)
 * - Jeda acak sekuensial 3 s/d 15 detik per pesan
 * - Anti Overlapping Request via Redis Concurrency Lock
 * - Pre-flight Health Check WAHA
 * - Anti-Pesan Basi (Context Expiry Guard)
 * - Pengaturan Mandiri Wali Kelas: Toggle ON/OFF, Target Scope (Keduanya/Hanya Ortu/Hanya Santri), dan Opsi Ortu (Keduanya/Salah Satu)
 * - Pesan ke Pengajar SELALU dikirimkan (20 jam sebelum sesi)
 * - Laporan BATCH NOTIFIKASI WA Admin dengan observabilitas komprehensif seluruh penyebab tidak terkirim
 */
export async function GET(request: NextRequest) {
  return handleScheduleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleScheduleReminders(request);
}

async function handleScheduleReminders(request: NextRequest) {
  // 0. Cek apakah dipicu untuk Broadcast Magic Login Link
  const action = request.nextUrl.searchParams.get('action');
  const hasBroadcast =
    request.nextUrl.searchParams.has('broadcast') ||
    action === 'broadcast_login' ||
    action === 'broadcast';
  if (hasBroadcast) {
    return handleBroadcastMagicLogin(request);
  }

  // 0b. Cek pemicu pengiriman manual Rangkuman Jadwal 1 Pekan Grup WA
  if (action === 'weekly_digest' || action === 'weekly_group_digest') {
    try {
      const { dispatchAllWeeklyScheduleDigests } = await import(
        '@/lib/whatsapp/groupScheduleNotificationService'
      );
      const result = await dispatchAllWeeklyScheduleDigests({
        force: request.nextUrl.searchParams.get('force') === 'true',
      });
      return NextResponse.json({
        success: true,
        message: `Rangkuman mingguan grup diproses: ${result.totalSent} terkirim, ${result.totalSkipped} dilewati.`,
        result,
      });
    } catch (digestErr: any) {
      console.error('[CRON WeeklyDigest Error]:', digestErr);
      return NextResponse.json(
        { success: false, error: digestErr.message || 'Gagal memproses rangkuman mingguan grup' },
        { status: 500 }
      );
    }
  }

  // 1. Validasi Keamanan Token Cron
  const authHeader = request.headers.get('authorization');
  const secretParam = request.nextUrl.searchParams.get('key');
  const isDryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
  const expectedSecret =
    process.env.CRON_SECRET ||
    (process.env.NODE_ENV === 'production' ? undefined : 'pengajian-cron-secret-2026');

  if (process.env.NODE_ENV === 'production' && !expectedSecret) {
    console.error('[CRON SECURITY ERROR]: CRON_SECRET is not configured in production environment variables.');
    return NextResponse.json(
      { success: false, message: 'Server configuration error: CRON_SECRET is not configured.' },
      { status: 500 }
    );
  }

  const isAuthorized =
    (Boolean(expectedSecret) &&
      (authHeader === `Bearer ${expectedSecret}` || secretParam === expectedSecret)) ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json(
      { success: false, message: 'Akses ditolak: Token otorisasi cron tidak valid.' },
      { status: 401 }
    );
  }

  // 2. Concurrency Lock: Mencegah Overlapping Request jika cron dipicu tiap 1 menit
  const runId = `cron_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let lockAcquired = false;

  if (redis) {
    try {
      const acquire = await redis.set(LOCK_KEY, runId, { nx: true, ex: LOCK_TTL_SECONDS });
      if (!acquire) {
        console.warn(
          `[Cron ScheduleReminders] ⚠️ Eksekusi dilewati: Batch cron sebelumnya masih aktif berjalan (RunID Lock aktif).`
        );
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Batch cron sebelumnya masih berjalan (Concurrency Lock aktif).',
        });
      }
      lockAcquired = true;
    } catch (redisErr) {
      console.warn('[Cron ScheduleReminders] Peringatan Redis lock (melanjutkan tanpa lock):', redisErr);
    }
  }

  try {
    const now = new Date();
    console.log(
      `[Cron ScheduleReminders] Mulai pemindaian jadwal pada ${now.toISOString()} ${
        isDryRun ? '(MODE DRY-RUN: SIMULASI AMAN)' : ''
      }`
    );

    // 3. Pre-flight WAHA Health Check (Hanya pada eksekusi riil)
    let isWahaConnected = true;
    if (!isDryRun) {
      try {
        const deviceStatus = await whatsAppClient.checkDeviceStatus();
        if (!deviceStatus.isConnected) {
          isWahaConnected = false;
          console.warn('[Cron ScheduleReminders] ⚠️ Gateway WAHA terputus/offline. Menunda pengiriman batch.');

          return NextResponse.json({
            success: false,
            wahaConnected: false,
            message: 'Gateway WAHA sedang offline/terputus. Pengiriman otomatis ditunda hingga pulih.',
          });
        }
      } catch (healthErr) {
        console.error('[Cron ScheduleReminders] Gagal memeriksa status WAHA:', healthErr);
      }
    }

    // 4. Rentang Waktu Pemindaian Database:
    // A. Jendela H-1: Jadwal yang dimulai dalam rentang 18 jam s/d 22 jam ke depan (Target 20 jam)
    const h1Start = new Date(now.getTime() + 18 * 60 * 60 * 1000);
    const h1End = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    // B. Jendela Hari-H: Countdown 45 menit s/d 180 menit (3 jam) ke depan (Target ~2 jam)
    const countdownStart = new Date(now.getTime() + 45 * 60 * 1000);
    const countdownEnd = new Date(now.getTime() + 180 * 60 * 1000);

    // Query Jadwal Mendatang yang Terjadwal & Disetujui
    const upcomingSchedules = await prisma.schedule.findMany({
      where: {
        status: {
          in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE],
        },
        OR: [
          // Match H-1 Window (~23h)
          { startTime: { gte: h1Start, lte: h1End } },
          // Match Countdown 2 Hours Window
          { startTime: { gte: countdownStart, lte: countdownEnd } },
        ],
        AND: [
          {
            OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
          },
        ],
      },
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
      orderBy: {
        startTime: 'asc',
      },
    });

    console.log(
      `[Cron ScheduleReminders] Ditemukan ${upcomingSchedules.length} jadwal dalam jendela pengingat.`
    );

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let lastErrorMessage: string | null = null;
    const processLogs: string[] = [];
    const dryRunRecipients: any[] = [];

    // Wadah Audit Observabilitas Lengkap untuk Laporan Admin
    const auditMetrics = {
      homeroomDisabledClasses: new Set<string>(),
      gap30hSameTitleSchedules: new Set<string>(),
      studentsWithoutPhone: new Set<string>(),
      studentsWithoutParent: new Set<string>(),
      parentsWithoutPhone: new Set<string>(),
      scopeFilteredStudents: 0,
      scopeFilteredParents: 0,
      singleParentFiltered: 0,
    };

    // Preload semua log pesan berhasil & in-flight 24 jam terakhir dalam 1 query DB (termasuk pesan grup)
    const existingLogs = await prisma.whatsAppMessageLog.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
        OR: [
          { magicToken: { not: null } },
          { templateCode: 'GROUP_SCHEDULE_REMINDER_H1', referenceId: { not: null } },
        ],
      },
      select: { magicToken: true, templateCode: true, referenceId: true },
    });
    const sentTokensSet = new Set<string>();
    for (const l of existingLogs) {
      if (l.magicToken) sentTokensSet.add(l.magicToken);
      if (l.templateCode === 'GROUP_SCHEDULE_REMINDER_H1' && l.referenceId) {
        sentTokensSet.add(`GROUP_H1_REMINDER_${l.referenceId}`);
      }
    }

    type DispatchItem = {
      type: 'USTADZ' | 'ORANG_TUA' | 'SANTRI';
      name: string;
      phone: string;
      execute: () => Promise<{
        success: boolean;
        skipped?: boolean;
        sentCount?: number;
        skippedCount?: number;
        log: string;
        error?: string;
      }>;
    };

    const dispatchQueue: DispatchItem[] = [];

    for (const schedule of upcomingSchedules) {
      const scheduleTimeMs = schedule.startTime.getTime();
      const diffHours = (scheduleTimeMs - now.getTime()) / (1000 * 60 * 60);

      const isH1Reminder = diffHours >= 18.0 && diffHours <= 20.0;
      const isCountdownReminder = diffHours >= 0.75 && diffHours <= 3.0;

      // Anti-Pesan Basi (Context Expiry Guard)
      if (isH1Reminder && diffHours < 12) {
        processLogs.push(
          `[Context Expired] H-1 untuk "${schedule.title}" kedaluwarsa (sisa waktu ${diffHours.toFixed(
            1
          )} jam < 12 jam). Beralih ke Countdown.`
        );
        continue;
      }
      if (isCountdownReminder && diffHours <= 0) {
        processLogs.push(
          `[Context Expired] Countdown untuk "${schedule.title}" dibatalkan (jadwal sudah mulai/lewat).`
        );
        continue;
      }

      if (!isH1Reminder && !isCountdownReminder) {
        continue;
      }

      const reminderType = isH1Reminder ? 'H1' : 'COUNTDOWN_2H';
      const dayDateStr = formatIndonesianDate(schedule.startTime);
      const startTimeStr = formatTime(schedule.startTime);
      const endTimeStr = formatTime(schedule.endTime);
      const orgName = schedule.organization.name;
      const venueName = schedule.venuePlaceName || 'Masjid Kelompok';

      // Rangkum nama ustadz dan materi
      const teacherNames =
        schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';
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

      // Penyaringan Jenjang Tanpa Santri (Hanya jenjang yang memiliki santri aktif > 0)
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

      // Fallback jika belum ada data santri agar jadwal tidak kosong
      if (validGenerations.length === 0 && candidateGenMap.size > 0) {
        for (const gen of candidateGenMap.values()) {
          validGenerations.push(gen);
          validGenIdSet.add(gen.id);
        }
      }

      const validGenNames = validGenerations.map((g) => g.name);

      // Kumpulkan target kelas yang valid
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

      // Tentukan daftar kelas/jenjang yang ditampilkan
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

      const uniqueGenNames = validGenNames.join(', ') || 'Seluruh Jenjang';

      // Cek apakah sesi gabungan & format judul sesi
      const isCombined =
        isScheduleCombined(schedule) ||
        validGenerations.length > 1 ||
        validClassNames.length > 1;

      const cleanTitle = schedule.title.replace(/^\[GABUNGAN\]\s*/i, '').trim();
      const displayScheduleTitle = isCombined ? `[GABUNGAN] ${cleanTitle}` : cleanTitle;

      // =========================================================================
      // 5. ATURAN KHUSUS & KONTROL MANDIRI WALI KELAS
      // =========================================================================
      let allowStudentH1 = true;
      if (isH1Reminder) {
        const previousSchedule = await prisma.schedule.findFirst({
          where: {
            organizationId: schedule.organizationId,
            id: { not: schedule.id },
            endTime: { lte: schedule.startTime },
            status: {
              in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE, ScheduleStatus.COMPLETED],
            },
          },
          orderBy: {
            endTime: 'desc',
          },
          select: {
            id: true,
            title: true,
            endTime: true,
          },
        });

        if (previousSchedule) {
          const gapHours =
            (schedule.startTime.getTime() - previousSchedule.endTime.getTime()) / (1000 * 60 * 60);
          const isSameTitle =
            schedule.title.trim().toLowerCase() === previousSchedule.title.trim().toLowerCase();

          if (gapHours < 30) {
            if (isSameTitle) {
              allowStudentH1 = false;
              auditMetrics.gap30hSameTitleSchedules.add(
                `"${schedule.title}" (${gapHours.toFixed(1)} jam setelah "${previousSchedule.title}")`
              );
              processLogs.push(
                `[H-1 Santri Dilewati] "${schedule.title}" berjarak ${gapHours.toFixed(
                  1
                )} jam (< 30 jam) dari jadwal sebelumnya "${previousSchedule.title}" dengan judul sesi SAMA.`
              );
            } else {
              allowStudentH1 = true;
              processLogs.push(
                `[H-1 Santri Diizinkan] "${schedule.title}" berjarak ${gapHours.toFixed(
                  1
                )} jam (< 30 jam) dari jadwal sebelumnya "${previousSchedule.title}", tetapi JUDUL SESI BERBEDA.`
              );
            }
          }
        }
      }

      const allTargetClasses = [
        ...(schedule.targetClasses?.map((tc) => tc.class) || []),
        ...(schedule.class ? [schedule.class] : []),
      ];

      const uniqueTargetClasses = Array.from(
        new Map(allTargetClasses.map((c) => [c.id, c])).values()
      );

      const hasAnyClassEnabled =
        uniqueTargetClasses.length === 0 ||
        uniqueTargetClasses.some((c) => c.waNotificationEnabled !== false);

      if (!hasAnyClassEnabled) {
        const classNames = uniqueTargetClasses.map((c) => c.name).join(', ');
        auditMetrics.homeroomDisabledClasses.add(classNames || schedule.title);
        processLogs.push(
          `[Wali Kelas OFF] Seluruh kelas binaan (${classNames || schedule.title}) dinonaktifkan oleh Wali Kelas. Melewati santri & orang tua.`
        );
      }

      // =========================================================================
      // 6. RESOLUSI PERAN GANDA & PENGUMPULAN TARGET BERBASIS NOMOR HP (PHONE-CENTRIC)
      // =========================================================================
      const scheduledTeachers = schedule.teachers;
      const scheduledTeacherIds = new Set(scheduledTeachers.map((st) => st.teacher.id));

      // Ambil daftar santri terdaftar untuk sesi ini
      const rawTargetStudents = await getTargetStudentsForSchedule(schedule);

      // KASUS 1: Peer-Teaching (Santri Mengajar di Sesi Sendiri)
      // Peran Pengajar mengeskalasi peran santri. Otomatis presensi HADIR dan tidak kirim pesan santri ke ortu.
      const nonPeerTeachingStudents: typeof rawTargetStudents = [];
      for (const student of rawTargetStudents) {
        if (scheduledTeacherIds.has(student.id)) {
          try {
            const currentSession = await prisma.attendanceSession.findFirst({
              where: { scheduleId: schedule.id },
              orderBy: { createdAt: 'desc' },
            });
            if (currentSession) {
              await prisma.attendanceRecord.upsert({
                where: {
                  sessionId_studentId: {
                    sessionId: currentSession.id,
                    studentId: student.id,
                  },
                },
                create: {
                  sessionId: currentSession.id,
                  studentId: student.id,
                  status: AttendanceStatus.HADIR,
                  notes: 'Hadir (Pengajar Sesi Ini)',
                  method: AttendanceMethod.MANUAL_TEACHER,
                  checkInTime: new Date(),
                },
                update: {
                  status: AttendanceStatus.HADIR,
                  notes: 'Hadir (Pengajar Sesi Ini)',
                },
              });
            }
          } catch (peerErr) {
            console.warn(`[PeerTeaching AutoHadir] Gagal upsert attendance untuk ${student.fullName}:`, peerErr);
          }
          processLogs.push(
            `[Peer-Teaching] Santri "${student.fullName}" adalah pengajar di sesi ini. Dikecualikan dari audiens santri, status presensi otomatis HADIR.`
          );
          continue;
        }
        nonPeerTeachingStudents.push(student);
      }

      // KASUS 2: Bentrok Jam Mengajar di Sesi Lain (Concurrent Teaching Conflict)
      // Santri sedang bertugas mengajar di jadwal lain yang jamnya bersinggungan.
      // Status presensi di sesi santri ini otomatis HADIR (Tugas Mengajar), bebas pesan santri & bebas tuduhan alpa.
      const validStudentsForNotification: typeof rawTargetStudents = [];
      const teachingConflictMap = new Map<string, string>(); // studentId -> title sesi mengajar

      for (const student of nonPeerTeachingStudents) {
        const teachingConflict = await prisma.scheduleTeacher.findFirst({
          where: {
            teacherId: student.id,
            schedule: {
              id: { not: schedule.id },
              status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE] },
              startTime: { lt: schedule.endTime },
              endTime: { gt: schedule.startTime },
            },
          },
          include: {
            schedule: {
              select: { id: true, title: true, startTime: true, endTime: true },
            },
          },
        });

        if (teachingConflict) {
          try {
            const currentSession = await prisma.attendanceSession.findFirst({
              where: { scheduleId: schedule.id },
              orderBy: { createdAt: 'desc' },
            });
            if (currentSession) {
              await prisma.attendanceRecord.upsert({
                where: {
                  sessionId_studentId: {
                    sessionId: currentSession.id,
                    studentId: student.id,
                  },
                },
                create: {
                  sessionId: currentSession.id,
                  studentId: student.id,
                  status: AttendanceStatus.HADIR,
                  notes: `Hadir (Tugas Mengajar di ${teachingConflict.schedule.title})`,
                  method: AttendanceMethod.MANUAL_TEACHER,
                  checkInTime: new Date(),
                },
                update: {
                  status: AttendanceStatus.HADIR,
                  notes: `Hadir (Tugas Mengajar di ${teachingConflict.schedule.title})`,
                },
              });
            }
          } catch (conflictErr) {
            console.warn(`[TeachingConflict AutoHadir] Gagal upsert attendance untuk ${student.fullName}:`, conflictErr);
          }

          teachingConflictMap.set(student.id, teachingConflict.schedule.title);
          processLogs.push(
            `[Dispensasi Mengajar] Santri "${student.fullName}" sedang mengajar di "${teachingConflict.schedule.title}". Dikecualikan dari sesi santri "${schedule.title}", status presensi otomatis HADIR.`
          );
          continue;
        }

        validStudentsForNotification.push(student);
      }

      // =========================================================================
      // 7. WADAH AGREGASI PENERIMA BERBASIS NOMOR TELEPON (PHONE-CENTRIC BUCKET)
      // Mencegah pesan dobel, menggabungkan multi-santri, dan menyatukan peran Guru+Ortu
      // =========================================================================
      interface PhoneBucket {
        phone: string;
        name: string;
        gender?: string | null;
        relationshipType?: string | null;
        userId?: string;
        isTeacher: boolean;
        teacherSt?: any;
        concurrentStudentTitle?: string;
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

      const recipientPhoneMap = new Map<string, PhoneBucket>();

      const getOrCreatePhoneBucket = (rawPhone: string, defaultName: string, userId?: string): PhoneBucket | null => {
        const norm = normalizePhoneNumber(rawPhone);
        if (!norm) return null;
        let bucket = recipientPhoneMap.get(norm);
        if (!bucket) {
          bucket = {
            phone: rawPhone,
            name: defaultName,
            userId,
            isTeacher: false,
            studentsAsParent: [],
            isDirectStudent: false,
          };
          recipientPhoneMap.set(norm, bucket);
        }
        return bucket;
      };

      // A. Masukkan Seluruh Dewan Pengajar (H-1 dan Countdown 2 Jam)
      if (isH1Reminder || isCountdownReminder) {
        for (const st of scheduledTeachers) {
          const teacher = st.teacher;
          if (!teacher.phoneNumber) continue;

          const bucket = getOrCreatePhoneBucket(teacher.phoneNumber, teacher.fullName, teacher.id);
          if (bucket) {
            bucket.isTeacher = true;
            bucket.teacherSt = st;
            bucket.gender = teacher.gender;

            // Periksa apakah guru ini punya sesi santri bentrok di jadwal lain
            const concurrentStudentSchedule = await prisma.schedule.findFirst({
              where: {
                id: { not: schedule.id },
                status: { in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE] },
                startTime: { lt: schedule.endTime },
                endTime: { gt: schedule.startTime },
                OR: [
                  {
                    targetClasses: {
                      some: {
                        class: {
                          organizationId: teacher.organizationId || undefined,
                          generationId: teacher.generationId || undefined,
                        },
                      },
                    },
                  },
                  {
                    targetGenerations: {
                      some: {
                        generationId: teacher.generationId || undefined,
                      },
                    },
                  },
                ],
              },
              select: { title: true },
            });

            if (concurrentStudentSchedule) {
              bucket.concurrentStudentTitle = concurrentStudentSchedule.title;
            }
          }
        }
      }

      // B. Masukkan Santri dan Orang Tua (Jika diizinkan kelas & aturan 30h)
      const isStudentAllowedThisSchedule = hasAnyClassEnabled && (!isH1Reminder || allowStudentH1);

      if (isStudentAllowedThisSchedule) {
        // Ambil target materi bulanan kalender (dalam zona waktu WIB)
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

        for (const student of validStudentsForNotification) {
          const isOrgMatching =
            uniqueTargetClasses.length > 0
              ? uniqueTargetClasses.some((c) => c.organizationId === student.organizationId)
              : student.organizationId === schedule.organizationId;

          if (!isOrgMatching) continue;

          const studentClass =
            uniqueTargetClasses.find(
              (c) =>
                c.organizationId === student.organizationId &&
                c.generationId === student.generationId
            ) ||
            schedule.class ||
            null;

          const isStudentClassEnabled = studentClass
            ? (studentClass.waNotificationEnabled ?? true)
            : true;

          if (!isStudentClassEnabled) continue;

          const recipientScope = studentClass ? (studentClass.waRecipientScope ?? 'BOTH') : 'BOTH';
          const parentOption = studentClass ? (studentClass.waParentOption ?? 'ALL_PARENTS') : 'ALL_PARENTS';

          const { className, generationName: genName, materialTitles: studentMaterialTitles } =
            getPersonalizedSessionInfoForStudent({
              schedule,
              student,
              monthlyTargets,
            });

          // 1. Orang Tua / Wali
          if (recipientScope !== 'STUDENTS_ONLY' && student.parents.length > 0) {
            let parentsToNotify =
              parentOption === 'SINGLE_PARENT' && student.parents.length > 1
                ? [student.parents[0]]
                : student.parents;

            // Filter preferensi kontak orang tua utama (waPreferredParent) dari data santri
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

              // Filter preferensi notifikasi orang tua pribadi
              if (isH1Reminder && parent.waNotifyH1 === false) continue;
              if (isCountdownReminder && parent.waNotifyCountdown === false) continue;

              // Filter preferensi waPreferredParent pada profil orang tua itu sendiri
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

              const bucket = getOrCreatePhoneBucket(parent.phoneNumber, parent.fullName, parent.id);
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
          }

          // 2. Santri Sendiri
          if (recipientScope !== 'PARENTS_ONLY' && student.phoneNumber) {
            const isStudentNotifyAllowed = isH1Reminder
              ? (student.waNotifyH1 ?? true)
              : (student.waNotifyCountdown ?? true);

            if (isStudentNotifyAllowed) {
              const normStudentPhone = normalizePhoneNumber(student.phoneNumber);
              if (normStudentPhone && !recipientPhoneMap.has(normStudentPhone)) {
                const bucket = getOrCreatePhoneBucket(student.phoneNumber, student.fullName, student.id);
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
        }
      }

      // =========================================================================
      // 8. DISPATCH QUEUE POPULATION DENGAN JAMINAN 1 NOMOR = 1 PESAN TERPADU
      // =========================================================================
      for (const [normPhone, bucket] of recipientPhoneMap.entries()) {
        const dedupKey = `SCHED_${schedule.id}_${normPhone}_${reminderType}`;

        if (sentTokensSet.has(dedupKey)) {
          skippedCount++;
          continue;
        }

        // Deteksi Pengajar Multi-Sesi pada H-1 (>= 2 Sesi Mengajar pada hari esok)
        let teacherTomorrowSchedules: any[] = [];
        let isMultiSessionTeacher = false;
        let multiSessionItems: TeacherMultiScheduleItem[] = [];

        if (bucket.isTeacher && isH1Reminder && bucket.userId) {
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
            isMultiSessionTeacher = true;
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

            // Tandai dedup key seluruh sesi mengajar di hari tersebut agar sesi berikutnya tidak memicu pesan H-1 lagi
            for (const otherSched of teacherTomorrowSchedules) {
              sentTokensSet.add(`SCHED_${otherSched.id}_${normPhone}_H1`);
            }
          }
        }

        if (isDryRun) {
          dryRunRecipients.push({
            phone: normPhone,
            name: bucket.name,
            isTeacher: bucket.isTeacher,
            parentStudentCount: bucket.studentsAsParent.length,
            isDirectStudent: bucket.isDirectStudent,
            type: isMultiSessionTeacher ? 'H1_MULTI_SESI' : reminderType,
            scheduleTitle: isMultiSessionTeacher
              ? `[MULTI-SESI] ${multiSessionItems.length} Sesi Agenda Mengajar`
              : schedule.title,
            multiSessionCount: isMultiSessionTeacher ? multiSessionItems.length : undefined,
          });
          continue;
        }

        sentTokensSet.add(dedupKey);

        dispatchQueue.push({
          type: bucket.isTeacher
            ? 'USTADZ'
            : (bucket.studentsAsParent.length > 0 ? 'ORANG_TUA' : 'SANTRI'),
          name: bucket.name,
          phone: bucket.phone,
          execute: async () => {
            // Auto-Revoke pesan lama jika ini pengingat Countdown H-2 Jam
            if (isCountdownReminder) {
              try {
                const prevLogs = await prisma.whatsAppMessageLog.findMany({
                  where: {
                    recipientPhone: normPhone,
                    referenceId: schedule.id,
                    status: 'SENT',
                    gatewayMessageId: { not: null },
                    templateCode: {
                      in: [
                        'SCHEDULE_REMINDER_H1_STUDENT',
                        'STUDENT_ACTION_LINK_H1',
                        'SCHEDULE_REMINDER_FAMILY_DIGEST',
                        'FAMILY_ACTION_LINK_H1',
                        'SCHEDULE_REMINDER_H1_TEACHER',
                        'TEACHER_ACTION_LINKS_H1',
                        'SCHEDULE_REMINDER_UNIFIED_TEACHER_PARENT',
                        'SCHEDULE_REMINDER_TEACHER_WITH_DISPENSATION',
                      ],
                    },
                  },
                });
                for (const prevLog of prevLogs) {
                  if (prevLog.gatewayMessageId) {
                    await whatsAppClient.deleteMessage(normPhone, prevLog.gatewayMessageId);
                  }
                }
              } catch (revokeErr) {
                console.warn(`[AutoRevoke] Gagal menarik pesan lama untuk ${normPhone}:`, revokeErr);
              }
            }

            let res;

            // Skenario Khusus H-1: Ustadz Multi-Sesi (>= 2 Sesi Mengajar Esok Hari)
            if (isMultiSessionTeacher && multiSessionItems.length > 1) {
              res = await sendTeacherMultiScheduleDigestH1({
                teacherPhone: bucket.phone,
                teacherName: bucket.name,
                teacherGender: bucket.gender,
                dayDate: dayDateStr,
                organizationName: orgName,
                items: multiSessionItems,
                magicToken: `${dedupKey}_MAIN`,
                teacherUserId: bucket.userId,
              });

              await sendTeacherMultiScheduleActionsH1({
                teacherPhone: bucket.phone,
                teacherName: bucket.name,
                teacherGender: bucket.gender,
                dayDate: dayDateStr,
                items: multiSessionItems,
                magicToken: `${dedupKey}_ACTION`,
                teacherUserId: bucket.userId,
              });

              // Tandai log di database untuk jadwal-jadwal lain agar eksekusi cron berikutnya tidak mengirim ulang
              for (const otherSched of teacherTomorrowSchedules) {
                if (otherSched.id !== schedule.id) {
                  try {
                    await prisma.whatsAppMessageLog.create({
                      data: {
                        recipientPhone: normPhone,
                        recipientName: bucket.name,
                        recipientUserId: bucket.userId,
                        messageType: 'SCHEDULE_REMINDER',
                        templateCode: 'TEACHER_MULTI_SCHEDULE_DIGEST_H1',
                        messageBody: `[Multi-Sesi Digest Bundled] Sesi ini telah disertakan dalam rangkuman multi-sesi bersama jadwal ${schedule.id}.`,
                        status: 'SENT',
                        magicToken: `SCHED_${otherSched.id}_${normPhone}_H1`,
                        referenceId: otherSched.id,
                      },
                    });
                  } catch (e) {
                    // Abaikan jika log sudah tersimpan
                  }
                }
              }

              return {
                success: Boolean(res.success),
                log: `[H1 Ustadz Multi-Sesi (${multiSessionItems.length} Sesi, 2 Pesan)] ${bucket.name} (Tanggal: ${dayDateStr})`,
                error: res.error,
              };
            }

            // Skenario A: Ustadz yang juga Orang Tua dari santri pada sesi ini (Unified)
            if (bucket.isTeacher && bucket.studentsAsParent.length > 0) {
              const st = bucket.teacherSt;
              res = await sendUnifiedTeacherParentReminder({
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
                scheduleId: schedule.id,
                scheduleTitle: displayScheduleTitle,
                magicToken: `${dedupKey}_MAIN`,
                teacherUserId: bucket.userId,
                students: bucket.studentsAsParent,
              });

              // Pesan 2 Terpisah: Aksi Materi & Badal (H-1) atau Akses Presensi (-2 Jam)
              if (isH1Reminder) {
                await sendTeacherActionLinksH1({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_ACTION`,
                });
              } else if (isCountdownReminder) {
                await sendTeacherPresensiLink2h({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_PRESENSI`,
                });
              }

              return {
                success: Boolean(res.success),
                log: `[${reminderType} Unified Ustadz+Ortu (2 Pesan)] ${bucket.name} (${displayScheduleTitle})`,
                error: res.error,
              };
            }

            // Skenario B: Ustadz yang memiliki sesi santri bentrok di tempat lain
            if (bucket.isTeacher && bucket.concurrentStudentTitle) {
              const st = bucket.teacherSt;
              res = await sendTeacherWithDispensationReminder({
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
                scheduleId: schedule.id,
                scheduleTitle: displayScheduleTitle,
                magicToken: `${dedupKey}_MAIN`,
                teacherUserId: bucket.userId,
                studentScheduleTitle: bucket.concurrentStudentTitle,
              });

              // Pesan 2 Terpisah: Aksi Materi & Badal (H-1) atau Akses Presensi (-2 Jam)
              if (isH1Reminder) {
                await sendTeacherActionLinksH1({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_ACTION`,
                });
              } else if (isCountdownReminder) {
                await sendTeacherPresensiLink2h({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_PRESENSI`,
                });
              }

              return {
                success: Boolean(res.success),
                log: `[${reminderType} Ustadz+Dispensasi (2 Pesan)] ${bucket.name} (${displayScheduleTitle})`,
                error: res.error,
              };
            }

            // Skenario C: Ustadz Reguler
            if (bucket.isTeacher) {
              const st = bucket.teacherSt;
              if (isCountdownReminder) {
                // Pesan 1: Pengingat Keberangkatan Countdown 2 Jam
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
                  scheduleId: schedule.id,
                  scheduleTitle: displayScheduleTitle,
                  magicToken: `${dedupKey}_MAIN`,
                  teacherUserId: bucket.userId,
                });

                // Pesan 2: Akses Cepat Presensi Kelas Langsung
                await sendTeacherPresensiLink2h({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_PRESENSI`,
                });
              } else {
                // H-1: Pesan 1: Detail Jadwal Mengajar & Link Detail Jadwal
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
                  scheduleId: schedule.id,
                  scheduleTitle: displayScheduleTitle,
                  magicToken: `${dedupKey}_MAIN`,
                  teacherUserId: bucket.userId,
                });

                // H-1: Pesan 2 Terpisah: Link Persiapan Materi & Link Pengajuan Badal
                await sendTeacherActionLinksH1({
                  teacherPhone: bucket.phone,
                  teacherName: bucket.name,
                  teacherGender: bucket.gender,
                  scheduleTitle: displayScheduleTitle,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  teacherUserId: bucket.userId,
                  magicToken: `${dedupKey}_ACTION`,
                });
              }

              return {
                success: Boolean(res.success),
                log: `[${reminderType} Ustadz (2 Pesan Terpisah)] ${bucket.name} (${displayScheduleTitle})`,
                error: res.error,
              };
            }

            // Skenario D: Orang Tua dengan Multi-Santri (>= 2 anak)
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

              if (isH1Reminder) {
                // Pesan 1 (H-1): Ringkasan Jadwal Pengajian Keluarga
                res = await sendFamilyScheduleReminderH1({
                  parentPhone: bucket.phone,
                  parentName: bucket.name,
                  parentGender: bucket.gender,
                  relationshipType: bucket.relationshipType,
                  dayDate: dayDateStr,
                  organizationName: orgName,
                  students: bucket.studentsAsParent,
                  notes: schedule.notes,
                  primaryScheduleId: schedule.id,
                  familyActionUrl,
                  magicToken: `${dedupKey}_MAIN`,
                  parentUserId: bucket.userId,
                });

                // Pesan 2 (H-1 Terpisah): Tautan Khusus Konfirmasi Izin Keluarga
                await sendFamilyActionLinkH1({
                  parentPhone: bucket.phone,
                  parentName: bucket.name,
                  dayDate: dayDateStr,
                  primaryScheduleId: schedule.id,
                  familyActionUrl,
                  magicToken: `${dedupKey}_ACTION`,
                  parentUserId: bucket.userId,
                });
              } else {
                // Pesan 1 (-2 Jam): Countdown Keberangkatan Pengajian Keluarga
                res = await sendFamilyScheduleReminderCountdown({
                  parentPhone: bucket.phone,
                  parentName: bucket.name,
                  parentGender: bucket.gender,
                  relationshipType: bucket.relationshipType,
                  dayDate: dayDateStr,
                  organizationName: orgName,
                  students: bucket.studentsAsParent,
                  notes: schedule.notes,
                  primaryScheduleId: schedule.id,
                  familyActionUrl,
                  magicToken: `${dedupKey}_MAIN`,
                  parentUserId: bucket.userId,
                });

                // Pesan 2 (-2 Jam Terpisah): Tautan Presensi & Izin Keluarga
                await sendFamilyActionLinks2h({
                  parentPhone: bucket.phone,
                  parentName: bucket.name,
                  dayDate: dayDateStr,
                  primaryScheduleId: schedule.id,
                  familyActionUrl,
                  magicToken: `${dedupKey}_ACTION`,
                  parentUserId: bucket.userId,
                });
              }
              return {
                success: Boolean(res.success),
                log: `[${reminderType} Family Digest (2 Pesan)] ${bucket.name} (${bucket.studentsAsParent.length} Santri)`,
                error: res.error,
              };
            }

            // Skenario E: Orang Tua dengan 1 Santri Tunggal
            if (bucket.studentsAsParent.length === 1) {
              const single = bucket.studentsAsParent[0];
              if (isH1Reminder) {
                // Pesan 1 (H-1): Detail Jadwal Santri
                res = await sendScheduleReminderH1ToStudent({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
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
                  scheduleId: schedule.id,
                  magicToken: `${dedupKey}_MAIN`,
                  recipientUserId: bucket.userId,
                  studentUserId: single.studentId,
                });

                // Pesan 2 (H-1 Terpisah): Tautan Khusus Pengajuan Izin / Sakit
                await sendStudentActionLinkH1({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
                  recipientUserId: bucket.userId,
                  scheduleTitle: schedule.title,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  studentUserId: single.studentId,
                  isParent: true,
                  magicToken: `${dedupKey}_ACTION`,
                });
              } else {
                // Pesan 1 (-2 Jam): Countdown Keberangkatan Santri
                res = await sendScheduleReminderCountdown({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
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
                  teacherGender: schedule.teachers[0]?.teacher?.gender,
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: `${dedupKey}_MAIN`,
                  recipientUserId: bucket.userId,
                  studentUserId: single.studentId,
                });

                // Pesan 2 (-2 Jam Terpisah): Tautan Presensi Mandiri & Pengajuan Izin
                await sendStudentActionLinks2h({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
                  recipientUserId: bucket.userId,
                  scheduleTitle: schedule.title,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  studentUserId: single.studentId,
                  isParent: true,
                  magicToken: `${dedupKey}_ACTION`,
                });
              }
              return {
                success: Boolean(res.success),
                log: `[${reminderType} Ortu Tunggal (2 Pesan)] ${bucket.name} (Ananda ${single.studentName})`,
                error: res.error,
              };
            }

            // Skenario F: Santri Mandiri Langsung
            if (bucket.isDirectStudent && bucket.directStudentInfo) {
              const direct = bucket.directStudentInfo;
              if (isH1Reminder) {
                // Pesan 1 (H-1): Detail Jadwal Santri
                res = await sendScheduleReminderH1ToStudent({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
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
                  scheduleId: schedule.id,
                  magicToken: `${dedupKey}_MAIN`,
                  recipientUserId: bucket.userId,
                  studentUserId: direct.studentId,
                });

                // Pesan 2 (H-1 Terpisah): Tautan Khusus Pengajuan Izin / Sakit
                await sendStudentActionLinkH1({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
                  recipientUserId: bucket.userId,
                  scheduleTitle: schedule.title,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  studentUserId: direct.studentId,
                  isParent: false,
                  magicToken: `${dedupKey}_ACTION`,
                });
              } else {
                // Pesan 1 (-2 Jam): Countdown Keberangkatan Santri
                res = await sendScheduleReminderCountdown({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
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
                  teacherGender: schedule.teachers[0]?.teacher?.gender,
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: `${dedupKey}_MAIN`,
                  recipientUserId: bucket.userId,
                  studentUserId: direct.studentId,
                });

                // Pesan 2 (-2 Jam Terpisah): Tautan Presensi Mandiri & Pengajuan Izin
                await sendStudentActionLinks2h({
                  recipientPhone: bucket.phone,
                  recipientName: bucket.name,
                  recipientUserId: bucket.userId,
                  scheduleTitle: schedule.title,
                  dayDate: dayDateStr,
                  scheduleId: schedule.id,
                  studentUserId: direct.studentId,
                  isParent: false,
                  magicToken: `${dedupKey}_ACTION`,
                });
              }
              return {
                success: Boolean(res.success),
                log: `[${reminderType} Santri Mandiri (2 Pesan)] ${bucket.name}`,
                error: res.error,
              };
            }

            return { success: false, skipped: true, log: `[Skipped Empty Bucket] ${bucket.name}` };
          },
        });
      }

      // =========================================================================
      // 7B. Pengingat Sesi H-1 ke Grup WhatsApp Jenjang Sasaran
      // =========================================================================
      if (isH1Reminder) {
        const groupH1Key = `GROUP_H1_REMINDER_${schedule.id}`;
        if (sentTokensSet.has(groupH1Key)) {
          skippedCount++;
        } else {
          // Cek juga di DB apakah sudah pernah ada log GROUP_SCHEDULE_REMINDER_H1 untuk schedule ini dalam 36 jam terakhir
          const existingDbGroupLog = await prisma.whatsAppMessageLog.findFirst({
            where: {
              referenceId: schedule.id,
              templateCode: 'GROUP_SCHEDULE_REMINDER_H1',
              status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
              createdAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
            },
            select: { id: true },
          });

          if (existingDbGroupLog) {
            sentTokensSet.add(groupH1Key);
            skippedCount++;
          } else {
            sentTokensSet.add(groupH1Key);
            dispatchQueue.push({
              type: 'ORANG_TUA' as any,
              name: `Grup WA Jenjang [${schedule.title}]`,
              phone: 'Grup WA',
              execute: async () => {
                const { dispatchGroupScheduleReminderH1 } = await import(
                  '@/lib/whatsapp/groupScheduleNotificationService'
                );
                const res = await dispatchGroupScheduleReminderH1(schedule.id);
                if (res.sentCount > 0) {
                  return {
                    success: true,
                    sentCount: res.sentCount,
                    log: `[Grup WA H-1: ${schedule.title}] ${res.sentCount} grup terkirim`,
                  };
                }
                return {
                  success: false,
                  skipped: true,
                  skippedCount: res.skippedCount,
                  log: `[Grup WA H-1: ${schedule.title}] 0 grup terkirim (${res.skippedCount} dilewati/idempoten)`,
                };
              },
            });
          }
        }
      }
    }

    // =========================================================================
    // 7C. Rangkuman Jadwal Mingguan Otomatis ke Grup WA (Setiap Ahad 16:00 - 20:00 WIB)
    // =========================================================================
    const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });
    const parts = jakartaFormatter.formatToParts(now);
    const jHour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const jDayOfWeek = new Date(now.getTime() + 7 * 3600 * 1000).getUTCDay();

    if (jDayOfWeek === 0 && jHour >= 16 && jHour <= 20) {
      const jakartaDateStr = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
      const weeklyDigestKey = `WEEKLY_DIGEST_${jakartaDateStr}`;
      if (!sentTokensSet.has(weeklyDigestKey)) {
        sentTokensSet.add(weeklyDigestKey);
        dispatchQueue.push({
          type: 'ORANG_TUA' as any,
          name: 'Rangkuman Jadwal Mingguan Grup Jenjang',
          phone: 'Grup WA Mingguan',
          execute: async () => {
            const { dispatchAllWeeklyScheduleDigests } = await import(
              '@/lib/whatsapp/groupScheduleNotificationService'
            );
            const res = await dispatchAllWeeklyScheduleDigests();
            if (res.totalSent > 0) {
              return {
                success: true,
                sentCount: res.totalSent,
                log: `[Rangkuman Mingguan Otomatis Ahad] ${res.totalSent} grup terkirim`,
              };
            }
            return {
              success: false,
              skipped: true,
              skippedCount: res.totalSkipped,
              log: `[Rangkuman Mingguan Otomatis Ahad] 0 grup terkirim (${res.totalSkipped} dilewati)`,
            };
          },
        });
      }
    }

    // =========================================================================
    // 8B. Pengingat Otomatis Pengajar: Presensi & Jurnal Penilaian Setelah 30 Menit Sesi Dimulai
    // Skenario 1: Belum mengisi absensi / belum buka presensi setelah 30 menit sesi dimulai
    // Skenario 2: Sudah mengisi presensi, tapi belum mengisi/mengirimkan jurnal penilaian santri
    // =========================================================================
    const inSessionMinStartTime = new Date(now.getTime() - 180 * 60 * 1000); // 3 jam lalu
    const inSessionMaxStartTime = new Date(now.getTime() - 30 * 60 * 1000);  // 30 menit lalu

    const inSessionSchedules = await prisma.schedule.findMany({
      where: {
        status: {
          in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE, ScheduleStatus.COMPLETED],
        },
        startTime: {
          gte: inSessionMinStartTime,
          lte: inSessionMaxStartTime,
        },
        AND: [
          {
            OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
          },
        ],
      },
      include: {
        organization: true,
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
        attendanceSessions: {
          include: {
            records: {
              select: {
                id: true,
                status: true,
                checkInTime: true,
                markedByUserId: true,
                updatedAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    for (const schedule of inSessionSchedules) {
      if (!schedule.teachers || schedule.teachers.length === 0) continue;

      const allSessions = schedule.attendanceSessions || [];
      const allRecords = allSessions.flatMap((s) => s.records || []);

      // Rekam kehadiran santri yang tercatat (HADIR, TERLAMBAT, IZIN, SAKIT, atau waktu/penilai terisi)
      const markedRecords = allRecords.filter(
        (r) =>
          r.status === 'HADIR' ||
          r.status === 'TERLAMBAT' ||
          r.status === 'IZIN' ||
          r.status === 'SAKIT' ||
          r.checkInTime !== null ||
          r.markedByUserId !== null
      );

      // Presensi dianggap sudah diisi jika minimal 1 santri telah dicatat atau sesi dibuka
      const hasFilledAttendance = markedRecords.length > 0;

      const presentCount = allRecords.filter(
        (r) => r.status === 'HADIR' || r.status === 'TERLAMBAT'
      ).length;

      // Hitung waktu update presensi paling akhir (Latest Attendance Update)
      // Mengambil timestamp terbaru dari record santri yang di-mark/di-update atau saat sesi dibuka
      let latestAttendanceUpdatedAt: Date | null = null;
      for (const session of allSessions) {
        if (session.openedAt) {
          if (!latestAttendanceUpdatedAt || session.openedAt.getTime() > latestAttendanceUpdatedAt.getTime()) {
            latestAttendanceUpdatedAt = session.openedAt;
          }
        }
      }
      for (const r of markedRecords) {
        const candidateDates = [r.updatedAt, r.checkInTime, r.createdAt].filter(Boolean) as Date[];
        for (const d of candidateDates) {
          if (!latestAttendanceUpdatedAt || d.getTime() > latestAttendanceUpdatedAt.getTime()) {
            latestAttendanceUpdatedAt = d;
          }
        }
      }

      // Cek apakah jurnal penilaian santri sudah diisi
      let hasFilledJournal = false;
      if (hasFilledAttendance) {
        const [evalCount, progressCount] = await Promise.all([
          prisma.studentEvaluation.count({ where: { scheduleId: schedule.id } }),
          prisma.materialChecklistProgress.count({ where: { scheduleId: schedule.id } }),
        ]);
        hasFilledJournal = evalCount > 0 || progressCount > 0;
      }

      // =======================================================================
      // ANTI-BUG PENGAJAR SUDAH LENGKAP:
      // Jika pengajar sudah mengisi presensi DAN sudah mengisi jurnal nilai,
      // MAKA SESI INI SELESAI & TIDAK BOLEH MENGIRIMKAN PESAN APA PUN!
      // =======================================================================
      if (hasFilledAttendance && hasFilledJournal) {
        processLogs.push(
          `[Sesi Lengkap] Jadwal "${schedule.title}": Presensi dan jurnal penilaian santri sudah terisi lengkap. Tidak ada pengingat yang dikirim.`
        );
        continue;
      }

      const startTimeStr = formatTime(schedule.startTime);
      const endTimeStr = formatTime(schedule.endTime);
      const venueName = schedule.venuePlaceName || 'Masjid Kelompok';
      const orgName = schedule.organization.name;
      const materialTitle =
        schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ') ||
        schedule.title ||
        'Materi Pengajian Rutin';

      for (const st of schedule.teachers) {
        const teacher = st.teacher;
        if (!teacher.phoneNumber) continue;

        // KASUS 1: Belum mengisi absensi / belum buka presensi setelah 30 menit sesi dimulai
        if (!hasFilledAttendance) {
          // Jika sesi sudah selesai/ditutup (COMPLETED), jangan kirim pengingat buka presensi
          if (schedule.status === ScheduleStatus.COMPLETED) {
            continue;
          }

          const attendanceReminderKey = `TEACHER_ATTENDANCE_REMINDER_30M_${schedule.id}_${teacher.id}`;

          if (sentTokensSet.has(attendanceReminderKey)) {
            skippedCount++;
            continue;
          }

          if (isDryRun) {
            dryRunRecipients.push({
              target: 'USTADZ_IN_SESSION',
              name: teacher.fullName,
              phone: teacher.phoneNumber,
              type: 'ATTENDANCE_REMINDER_30M',
              scheduleTitle: schedule.title,
              sessionTime: `${startTimeStr} - ${endTimeStr} WIB`,
              venue: venueName,
            });
            sentTokensSet.add(attendanceReminderKey);
            continue;
          }

          sentTokensSet.add(attendanceReminderKey);
          dispatchQueue.push({
            type: 'USTADZ',
            name: `${teacher.fullName} (Pengingat Presensi Belum Diisi)`,
            phone: teacher.phoneNumber,
            execute: async () => {
              const res = await sendTeacherAttendanceReminder30m({
                teacherPhone: teacher.phoneNumber!,
                teacherName: teacher.fullName,
                teacherGender: teacher.gender,
                scheduleTitle: schedule.title,
                startTime: startTimeStr,
                endTime: endTimeStr,
                venueName,
                organizationName: orgName,
                scheduleId: schedule.id,
                teacherUserId: teacher.id,
                magicToken: attendanceReminderKey,
              });
              return {
                success: Boolean(res.success),
                log: `[Pengingat Presensi 30M Ustadz] ${teacher.fullName} (${schedule.title})`,
                error: res.error,
              };
            },
          });
        }
        // KASUS 2: Sudah mengisi presensi, tapi belum mengisi/mengirimkan jurnal penilaian santri
        else if (presentCount > 0 && !hasFilledJournal) {
          const journalReminderKey = `TEACHER_JOURNAL_REMINDER_30M_${schedule.id}_${teacher.id}`;

          if (sentTokensSet.has(journalReminderKey)) {
            skippedCount++;
            continue;
          }

          // -------------------------------------------------------------------
          // JEDA 30 MENIT DARI UPDATE PRESENSI PALING AKHIR:
          // Jika pengajar baru saja melakukan presensi (misal santri 1-13 10 menit lalu,
          // lalu santri 14 baru datang dan di-update lagi), hitung jeda 30 menit dari
          // update presensi terbaru. Jeda waktu diulang kembali setiap ada update baru!
          // -------------------------------------------------------------------
          const JOURNAL_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 Menit
          if (latestAttendanceUpdatedAt) {
            const msSinceLastAttendanceUpdate = now.getTime() - latestAttendanceUpdatedAt.getTime();
            if (msSinceLastAttendanceUpdate < JOURNAL_GRACE_PERIOD_MS) {
              const remainingMinutes = Math.ceil((JOURNAL_GRACE_PERIOD_MS - msSinceLastAttendanceUpdate) / 60000);
              processLogs.push(
                `[Jeda Presensi Terbaru] Jadwal "${schedule.title}": Presensi terakhir diperbarui ${Math.floor(
                  msSinceLastAttendanceUpdate / 60000
                )} menit lalu. Menunggu jeda 30 menit (sisa ~${remainingMinutes}m) sebelum mengirim pengingat jurnal.`
              );
              continue;
            }
          }

          // Anti-flood: Jika pengingat absensi terkirim kurang dari 30 menit lalu, beri jeda ustadz mengisi jurnal
          const attendanceReminderSentRecently = await prisma.whatsAppMessageLog.findFirst({
            where: {
              magicToken: `TEACHER_ATTENDANCE_REMINDER_30M_${schedule.id}_${teacher.id}`,
              createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
              status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
            },
          });
          if (attendanceReminderSentRecently) {
            processLogs.push(
              `[Grace Period] Pengingat jurnal untuk ${teacher.fullName} (${schedule.title}) ditunda (kurang dari 30 menit sejak pengingat presensi).`
            );
            continue;
          }

          if (isDryRun) {
            dryRunRecipients.push({
              target: 'USTADZ_IN_SESSION',
              name: teacher.fullName,
              phone: teacher.phoneNumber,
              type: 'JOURNAL_REMINDER_30M',
              scheduleTitle: schedule.title,
              sessionTime: `${startTimeStr} - ${endTimeStr} WIB`,
              venue: venueName,
              presentCount,
            });
            sentTokensSet.add(journalReminderKey);
            continue;
          }

          sentTokensSet.add(journalReminderKey);
          dispatchQueue.push({
            type: 'USTADZ',
            name: `${teacher.fullName} (Pengingat Jurnal Penilaian Belum Diisi)`,
            phone: teacher.phoneNumber,
            execute: async () => {
              const res = await sendTeacherJournalReminder30m({
                teacherPhone: teacher.phoneNumber!,
                teacherName: teacher.fullName,
                teacherGender: teacher.gender,
                scheduleTitle: schedule.title,
                materialTitle,
                presentCount,
                venueName,
                organizationName: orgName,
                scheduleId: schedule.id,
                teacherUserId: teacher.id,
                magicToken: journalReminderKey,
              });
              return {
                success: Boolean(res.success),
                log: `[Pengingat Jurnal 30M Ustadz] ${teacher.fullName} (${schedule.title})`,
                error: res.error,
              };
            },
          });
        }
      }
    }

    // =========================================================================
    // 9. Eksekusi Antrean Sekuensial dengan Jeda Acak 3-15 Detik
    // Batas Runtime Maksimal 20 Detik (Sangat Aman dari Limit 30 Detik cron-job.org)
    // =========================================================================
    const startTimeMs = Date.now();
    const MAX_EXECUTION_TIME_MS = 20000;
    const MAX_DELAY_CUTOFF_MS = 16000;
    let consecutiveErrors = 0;

    for (let i = 0; i < dispatchQueue.length; i++) {
      const elapsedMs = Date.now() - startTimeMs;
      if (elapsedMs > MAX_EXECUTION_TIME_MS) {
        const remaining = dispatchQueue.length - i;
        processLogs.push(
          `[Cutoff Waktu] Waktu batch (${(elapsedMs / 1000).toFixed(
            1
          )}s) mendekati batas aman. Sisa ${remaining} pesan dilanjutkan pada menit berikutnya.`
        );
        break;
      }

      if (consecutiveErrors >= 3) {
        processLogs.push(
          `[Circuit Breaker] Gateway WhatsApp gagal berturut-turut (${consecutiveErrors}x). Menghentikan sisa batch.`
        );
        break;
      }

      const item = dispatchQueue[i];
      try {
        const res = await item.execute();
        if (res.skipped) {
          skippedCount += res.skippedCount !== undefined ? res.skippedCount : 1;
          processLogs.push(`[Dilewati] ${res.log}`);
        } else if (res.success) {
          const count = res.sentCount !== undefined ? res.sentCount : 1;
          sentCount += count;
          consecutiveErrors = 0;
          processLogs.push(res.log);
        } else {
          failedCount++;
          consecutiveErrors++;
          lastErrorMessage = res.error || 'Gagal mengirim pesan';
          processLogs.push(`[Gagal] ${res.log}: ${lastErrorMessage}`);
        }
      } catch (err: any) {
        failedCount++;
        consecutiveErrors++;
        lastErrorMessage = err.message || 'Eksepsi tidak dikenal';
        processLogs.push(`[Error] ${item.name}: ${lastErrorMessage}`);
      }

      // Beri jeda acak 3 s/d 15 detik jika masih ada pesan berikutnya dalam antrean
      if (i < dispatchQueue.length - 1) {
        const currentElapsed = Date.now() - startTimeMs;
        if (currentElapsed >= MAX_DELAY_CUTOFF_MS) {
          const remaining = dispatchQueue.length - (i + 1);
          processLogs.push(
            `[Safety Cutoff] Sisa waktu batch tidak mencukupi untuk jeda acak. Sisa ${remaining} pesan dialihkan ke menit berikutnya.`
          );
          break;
        }

        const randomDelay = getRandomDelayMs(3, 15);
        if (currentElapsed + randomDelay > MAX_EXECUTION_TIME_MS) {
          const remaining = dispatchQueue.length - (i + 1);
          processLogs.push(
            `[Safety Cutoff] Jeda acak ${(randomDelay / 1000).toFixed(
              1
            )}s akan melebihi batas waktu batch. Sisa ${remaining} pesan dialihkan ke menit berikutnya.`
          );
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }

    if (isDryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        mode: 'SIMULATION_PREVIEW',
        timestamp: new Date().toISOString(),
        totalSchedulesMatched: upcomingSchedules.length + inSessionSchedules.length,
        totalRecipientsCalculated: dryRunRecipients.length,
        schedules: [
          ...upcomingSchedules.map((s) => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime,
            venue: s.venuePlaceName,
            organization: s.organization.name,
            type: 'UPCOMING',
          })),
          ...inSessionSchedules.map((s) => ({
            id: s.id,
            title: s.title,
            startTime: s.startTime,
            venue: s.venuePlaceName,
            organization: s.organization.name,
            type: 'IN_SESSION_30M',
          })),
        ],
        auditMetrics: {
          homeroomDisabledClasses: Array.from(auditMetrics.homeroomDisabledClasses),
          gap30hSameTitleSchedules: Array.from(auditMetrics.gap30hSameTitleSchedules),
          studentsWithoutPhoneCount: auditMetrics.studentsWithoutPhone.size,
          studentsWithoutParentCount: auditMetrics.studentsWithoutParent.size,
          parentsWithoutPhoneCount: auditMetrics.parentsWithoutPhone.size,
          scopeFilteredStudents: auditMetrics.scopeFilteredStudents,
          scopeFilteredParents: auditMetrics.scopeFilteredParents,
          singleParentFiltered: auditMetrics.singleParentFiltered,
        },
        recipientsPreview: dryRunRecipients.slice(0, 50),
      });
    }

    // =========================================================================
    // 10. Fitur Rekap Laporan Admin Komprehensif (Observabilitas Penuh)
    // Dikirim ke nomor CRON_ADMIN_REPORT_PHONE HANYA jika ada aktivitas pengiriman riil
    // =========================================================================
    const adminPhoneRaw = process.env.CRON_ADMIN_REPORT_PHONE;
    const adminPhone = adminPhoneRaw ? normalizePhoneNumber(adminPhoneRaw) : null;

    // PENTING: Laporan batch admin HANYA dikirimkan jika ada aktivitas pengiriman riil (berhasil atau gagal)
    // pada batch menit tersebut. Ini mencegah spam pesan berulang ke nomor admin saat antrean sudah selesai / 0 pesan.
    const hasActivity = sentCount > 0 || failedCount > 0;
    const hasAuditFindings =
      auditMetrics.homeroomDisabledClasses.size > 0 ||
      auditMetrics.studentsWithoutPhone.size > 0 ||
      auditMetrics.studentsWithoutParent.size > 0 ||
      auditMetrics.parentsWithoutPhone.size > 0 ||
      auditMetrics.gap30hSameTitleSchedules.size > 0;

    const remainingInQueue = Math.max(0, dispatchQueue.length - (sentCount + failedCount));

    // Throttling: Jika tidak ada pesan gagal (failedCount === 0), batasi laporan admin maksimal 1 kali per 30 menit
    // untuk mencegah notifikasi laporan berulang tiap menit ketika cron berjalan rutin.
    let isThrottled = false;
    if (hasActivity && !isDryRun && adminPhone && failedCount === 0) {
      const recentAdminReport = await prisma.whatsAppMessageLog.findFirst({
        where: {
          recipientPhone: adminPhone,
          templateCode: 'CRON_ADMIN_BATCH_REPORT',
          createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
          status: { in: ['SENT', 'DELIVERED', 'READ', 'SENDING', 'QUEUED'] },
        },
      });
      if (recentAdminReport) {
        isThrottled = true;
        console.log('[Cron ScheduleReminders] ℹ️ Laporan batch admin dilewati (sudah terkirim dalam 30 menit terakhir).');
      }
    }

    if (hasActivity && !isDryRun && adminPhone && !isThrottled) {
      try {
        const timeStr = new Intl.DateTimeFormat('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Jakarta',
        }).format(new Date());

        const scheduleTitles = Array.from(new Set(upcomingSchedules.map((s) => s.title))).join(', ');

        let adminReportText =
          `📢 *LAPORAN BATCH NOTIFIKASI WA*\n` +
          `----------------------------------------\n` +
          `⏱️ *Waktu Batch:* ${timeStr} WIB\n` +
          `📌 *Jadwal Terkait:* ${scheduleTitles || '-'}\n\n` +
          `📊 *Hasil Pengiriman Menit Ini:*\n` +
          `• ✅ *Berhasil Terkirim:* ${sentCount} pesan\n` +
          `• ❌ *Gagal Terkirim:* ${failedCount} pesan\n` +
          `• ⏭️ *Dilewati (Sudah Terkirim):* ${skippedCount} pesan\n` +
          `• ⏳ *Sisa Antrean (Menit Berikutnya):* ${remainingInQueue} pesan\n`;

        // Bagian Audit Kondisi Penyebab Notifikasi Tidak Dikirimkan
        adminReportText += `\n📋 *Audit Kondisi Tidak Terkirim / Dilewati:*\n`;

        if (auditMetrics.homeroomDisabledClasses.size > 0) {
          adminReportText += `• 🚫 *Dinonaktifkan Wali Kelas:* ${Array.from(auditMetrics.homeroomDisabledClasses).join(', ')}\n`;
        }

        if (auditMetrics.gap30hSameTitleSchedules.size > 0) {
          adminReportText += `• ⏭️ *Jeda < 30 Jam (Judul Sama):* ${Array.from(auditMetrics.gap30hSameTitleSchedules).join(', ')}\n`;
        }

        if (auditMetrics.studentsWithoutPhone.size > 0) {
          const listNames = Array.from(auditMetrics.studentsWithoutPhone);
          const previewNames = listNames.slice(0, 3).join(', ');
          const extraCount = listNames.length > 3 ? `, +${listNames.length - 3} lainnya` : '';
          adminReportText += `• 📭 *Santri Tanpa No WA:* ${listNames.length} orang (${previewNames}${extraCount})\n`;
        }

        if (auditMetrics.studentsWithoutParent.size > 0) {
          const listNames = Array.from(auditMetrics.studentsWithoutParent);
          const previewNames = listNames.slice(0, 3).join(', ');
          const extraCount = listNames.length > 3 ? `, +${listNames.length - 3} lainnya` : '';
          adminReportText += `• ⚠️ *Santri Belum Terhubung Ortu:* ${listNames.length} anak (${previewNames}${extraCount})\n`;
        }

        if (auditMetrics.parentsWithoutPhone.size > 0) {
          const listNames = Array.from(auditMetrics.parentsWithoutPhone);
          const previewNames = listNames.slice(0, 3).join(', ');
          const extraCount = listNames.length > 3 ? `, +${listNames.length - 3} lainnya` : '';
          adminReportText += `• 📵 *Ortu Tanpa No WA:* ${listNames.length} kontak (${previewNames}${extraCount})\n`;
        }

        if (auditMetrics.scopeFilteredStudents > 0 || auditMetrics.scopeFilteredParents > 0 || auditMetrics.singleParentFiltered > 0) {
          const scopeNotes: string[] = [];
          if (auditMetrics.scopeFilteredStudents > 0) scopeNotes.push(`${auditMetrics.scopeFilteredStudents} santri (mode Hanya Ortu)`);
          if (auditMetrics.scopeFilteredParents > 0) scopeNotes.push(`${auditMetrics.scopeFilteredParents} ortu (mode Hanya Santri)`);
          if (auditMetrics.singleParentFiltered > 0) scopeNotes.push(`${auditMetrics.singleParentFiltered} ortu ke-2 (mode Salah Satu)`);
          adminReportText += `• 🎛️ *Disesuaikan Mode Kelas:* ${scopeNotes.join(', ')}\n`;
        }

        if (!hasAuditFindings) {
          adminReportText += `• (Semua peserta memenuhi syarat pengiriman)\n`;
        }

        if (failedCount > 0 && lastErrorMessage) {
          adminReportText += `\n⚠️ *Detail Kendala Terakhir:*\n${lastErrorMessage}\n`;
        }

        adminReportText +=
          `----------------------------------------\n` +
          `_Sistem Otomatisasi Pengajian & Notifikasi WA_`;

        await whatsAppClient.sendMessage({
          to: adminPhone,
          message: adminReportText,
          recipientName: 'Admin Pengajian',
          messageType: 'CUSTOM_DIRECT',
          templateCode: 'CRON_ADMIN_BATCH_REPORT',
        });
        console.log(`[Cron ScheduleReminders] 📲 Laporan batch komprehensif dikirim ke Admin (${adminPhone})`);
      } catch (adminSendErr) {
        console.error('[Cron ScheduleReminders] Gagal mengirim laporan batch ke Admin:', adminSendErr);
      }
    }

    console.log(
      `[Cron ScheduleReminders] Selesai: ${sentCount} terkirim, ${failedCount} gagal, ${skippedCount} dilewati.`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedSchedules: upcomingSchedules.length + inSessionSchedules.length,
      upcomingSchedulesCount: upcomingSchedules.length,
      inSessionSchedulesCount: inSessionSchedules.length,
      sentCount,
      failedCount,
      skippedCount,
      totalQueued: dispatchQueue.length,
      remainingInQueue,
      logs: processLogs.slice(0, 50),
    });
  } catch (error: any) {
    console.error('[Cron ScheduleReminders Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Terjadi kesalahan sistem saat menjalankan cron pengingat jadwal.',
      },
      { status: 500 }
    );
  } finally {
    // Melepas Concurrency Lock jika kita yang memegangnya
    if (redis && lockAcquired) {
      try {
        const currentLock = await redis.get(LOCK_KEY);
        if (currentLock === runId) {
          await redis.del(LOCK_KEY);
        }
      } catch (lockReleaseErr) {
        console.error('[Cron ScheduleReminders] Gagal melepas Redis lock:', lockReleaseErr);
      }
    }
  }
}
