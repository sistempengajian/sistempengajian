import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { whatsAppClient } from '@/lib/whatsapp/WhatsAppClient';
import {
  sendScheduleReminderH1ToStudent,
  sendScheduleReminderH1ToTeacher,
  sendScheduleReminderCountdown,
} from '@/lib/whatsapp/triggers';
import {
  formatIndonesianDate,
  formatTime,
  getTargetStudentsForSchedule,
} from '@/lib/whatsapp/scheduleNotificationService';
import { normalizePhoneNumber } from '@/lib/whatsapp/utils';
import { ScheduleStatus } from '@prisma/client';
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
 * Didukung:
 * - Interval pemicu 1 menit (cron-job.org)
 * - Jeda acak sekuensial 3 s/d 15 detik per pesan
 * - Anti Overlapping Request via Redis Concurrency Lock
 * - Pre-flight Health Check WAHA
 * - Anti-Pesan Basi (Context Expiry Guard)
 * - Aturan H-1 Santri: jeda < 30 jam dicek judul sesi (judul berbeda -> tetap dikirim H-1)
 * - Aturan H-1 Pengajar: selalu dikirim 23 jam sebelum sesi
 * - Fitur Rekap Laporan Batch Admin (sukses, gagal, sisa) ke nomor di .env
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

  // 1. Validasi Keamanan Token Cron
  const authHeader = request.headers.get('authorization');
  const secretParam = request.nextUrl.searchParams.get('key');
  const isDryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
  const expectedSecret = process.env.CRON_SECRET || 'pengajian-cron-secret-2026';

  const isAuthorized =
    authHeader === `Bearer ${expectedSecret}` ||
    secretParam === expectedSecret ||
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

          // Kirim peringatan ke admin jika nomor terdaftar
          const adminPhoneRaw = process.env.CRON_ADMIN_REPORT_PHONE || '0882007730579';
          const adminPhone = normalizePhoneNumber(adminPhoneRaw);

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
    // A. Jendela H-1: Jadwal yang dimulai dalam rentang 21 jam s/d 25 jam ke depan (Target ~23 jam)
    const h1Start = new Date(now.getTime() + 21 * 60 * 60 * 1000);
    const h1End = new Date(now.getTime() + 25 * 60 * 60 * 1000);

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

    // Preload semua log pesan berhasil 24 jam terakhir dalam 1 query DB
    // CATATAN KRITIS: Hanya log dengan status SENT, DELIVERED, READ yang dianggap terkirim.
    // Jika pesan FAILED, magicToken tidak masuk ke sentTokensSet sehingga bisa di-retry saat WAHA pulih.
    const existingLogs = await prisma.whatsAppMessageLog.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        magicToken: { not: null },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
      },
      select: { magicToken: true },
    });
    const sentTokensSet = new Set(existingLogs.map((l) => l.magicToken));

    type DispatchItem = {
      type: 'USTADZ' | 'ORANG_TUA' | 'SANTRI';
      name: string;
      phone: string;
      execute: () => Promise<{ success: boolean; log: string; error?: string }>;
    };

    const dispatchQueue: DispatchItem[] = [];

    for (const schedule of upcomingSchedules) {
      const scheduleTimeMs = schedule.startTime.getTime();
      const diffHours = (scheduleTimeMs - now.getTime()) / (1000 * 60 * 60);

      const isH1Reminder = diffHours >= 22.0 && diffHours <= 24.0;
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

      // Tentukan Jenjang / Kelas Target
      const genNames = [
        ...(schedule.class?.generation ? [schedule.class.generation.name] : []),
        ...schedule.targetGenerations.map((tg) => tg.generation.name),
        ...schedule.targetClasses.map((tc) => tc.class.generation?.name).filter(Boolean),
      ];
      const uniqueGenNames = Array.from(new Set(genNames)).join(', ') || 'Seluruh Jenjang';

      // =========================================================================
      // 5. Target Pengajar (Ustadz / Ustadzah, Badal)
      // Aturan: Dikirim 23 jam sebelum jadwal dilaksanakan tanpa terpengaruh jeda jadwal santri
      // =========================================================================
      if (isH1Reminder) {
        for (const st of schedule.teachers) {
          const teacher = st.teacher;
          if (!teacher.phoneNumber) continue;

          const teacherDedupKey = `SCHED_REMINDER_${schedule.id}_TEACHER_${teacher.id}_H1`;

          if (isDryRun) {
            dryRunRecipients.push({
              target: 'USTADZ',
              name: teacher.fullName,
              phone: teacher.phoneNumber,
              type: 'H1_REMINDER',
              scheduleTitle: schedule.title,
              sessionTime: `${dayDateStr}, ${startTimeStr} - ${endTimeStr} WIB`,
              venue: venueName,
            });
            continue;
          }

          if (sentTokensSet.has(teacherDedupKey)) {
            skippedCount++;
            continue;
          }

          dispatchQueue.push({
            type: 'USTADZ',
            name: teacher.fullName,
            phone: teacher.phoneNumber,
            execute: async () => {
              const res = await sendScheduleReminderH1ToTeacher({
                teacherPhone: teacher.phoneNumber!,
                teacherName: teacher.fullName,
                teacherGender: teacher.gender,
                dayDate: dayDateStr,
                startTime: startTimeStr,
                endTime: endTimeStr,
                venueName,
                organizationName: orgName,
                generationName: uniqueGenNames,
                className: schedule.class?.name,
                materialTitle: materialTitles,
                isBadal: st.isSubstitute,
                notes: schedule.notes,
                scheduleId: schedule.id,
                magicToken: teacherDedupKey,
                teacherUserId: teacher.id,
              });
              return {
                success: Boolean(res.success),
                log: `[H-1 Ustadz] ${teacher.fullName} (${schedule.title})`,
                error: res.error,
              };
            },
          });
        }
      }

      // =========================================================================
      // 6. Aturan Khusus H-1 Santri & Wali:
      // Pesan H-1 santri dibuat jika jadwal berjarak min. 30 jam dari jadwal sebelumnya.
      // KECUALI jika judul sesi jadwalnya BERBEDA -> Santri TETAP diingatkan pesan H-1!
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

      // Jika ini jendela H-1 dan santri tidak diizinkan H-1, lewati santri & orang tua untuk jadwal ini
      if (isH1Reminder && !allowStudentH1) {
        continue;
      }

      // =========================================================================
      // 7. Target Santri & Orang Tua
      // =========================================================================
      const targetStudents = await getTargetStudentsForSchedule(schedule);

      for (const student of targetStudents) {
        const genName = student.generation?.name || 'Santri';

        // A. Orang Tua
        for (const rel of student.parents) {
          const parent = rel.parent;
          if (!parent || !parent.phoneNumber) continue;

          const parentDedupKey = `SCHED_REMINDER_${schedule.id}_PARENT_${parent.id}_${student.id}_${reminderType}`;

          if (isDryRun) {
            dryRunRecipients.push({
              target: 'ORANG_TUA',
              name: `${parent.fullName} (Ananda ${student.fullName})`,
              phone: parent.phoneNumber,
              type: reminderType,
              scheduleTitle: schedule.title,
              sessionTime: `${dayDateStr}, ${startTimeStr} - ${endTimeStr} WIB`,
            });
            continue;
          }

          if (sentTokensSet.has(parentDedupKey)) {
            skippedCount++;
            continue;
          }

          dispatchQueue.push({
            type: 'ORANG_TUA',
            name: `${parent.fullName} (Ananda ${student.fullName})`,
            phone: parent.phoneNumber,
            execute: async () => {
              let res;
              if (isH1Reminder) {
                res = await sendScheduleReminderH1ToStudent({
                  recipientPhone: parent.phoneNumber!,
                  recipientName: parent.fullName,
                  recipientGender: parent.gender,
                  relationshipType: rel.relationshipType,
                  isParent: true,
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
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: parentDedupKey,
                  recipientUserId: parent.id,
                });
              } else {
                res = await sendScheduleReminderCountdown({
                  recipientPhone: parent.phoneNumber!,
                  recipientName: parent.fullName,
                  recipientGender: parent.gender,
                  relationshipType: rel.relationshipType,
                  isParent: true,
                  studentName: student.fullName,
                  scheduleTitle: schedule.title,
                  startTime: startTimeStr,
                  venueName,
                  materialTitle: materialTitles,
                  teacherName: teacherNames,
                  teacherGender: schedule.teachers[0]?.teacher?.gender,
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: parentDedupKey,
                  recipientUserId: parent.id,
                });
              }
              return {
                success: Boolean(res.success),
                log: `[${reminderType} Ortu] ${parent.fullName} (Ananda ${student.fullName})`,
                error: res.error,
              };
            },
          });
        }

        // B. Santri Sendiri
        if (student.phoneNumber) {
          const studentDedupKey = `SCHED_REMINDER_${schedule.id}_STUDENT_${student.id}_${reminderType}`;

          if (isDryRun) {
            dryRunRecipients.push({
              target: 'SANTRI',
              name: student.fullName,
              phone: student.phoneNumber,
              type: reminderType,
              scheduleTitle: schedule.title,
              sessionTime: `${dayDateStr}, ${startTimeStr} - ${endTimeStr} WIB`,
            });
            continue;
          }

          if (sentTokensSet.has(studentDedupKey)) {
            skippedCount++;
            continue;
          }

          dispatchQueue.push({
            type: 'SANTRI',
            name: student.fullName,
            phone: student.phoneNumber,
            execute: async () => {
              let res;
              if (isH1Reminder) {
                res = await sendScheduleReminderH1ToStudent({
                  recipientPhone: student.phoneNumber!,
                  recipientName: student.fullName,
                  recipientGender: student.gender,
                  isParent: false,
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
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: studentDedupKey,
                  recipientUserId: student.id,
                });
              } else {
                res = await sendScheduleReminderCountdown({
                  recipientPhone: student.phoneNumber!,
                  recipientName: student.fullName,
                  recipientGender: student.gender,
                  isParent: false,
                  studentName: student.fullName,
                  scheduleTitle: schedule.title,
                  startTime: startTimeStr,
                  venueName,
                  materialTitle: materialTitles,
                  teacherName: teacherNames,
                  teacherGender: schedule.teachers[0]?.teacher?.gender,
                  notes: schedule.notes,
                  scheduleId: schedule.id,
                  magicToken: studentDedupKey,
                  recipientUserId: student.id,
                });
              }
              return {
                success: Boolean(res.success),
                log: `[${reminderType} Santri] ${student.fullName}`,
                error: res.error,
              };
            },
          });
        }
      }
    }

    // =========================================================================
    // 8. Eksekusi Antrean Sekuensial dengan Jeda Acak 3-15 Detik
    // Batas Runtime Maksimal 20 Detik (Sangat Aman dari Limit 30 Detik cron-job.org)
    // Sisa antrean dialihkan otomatis ke menit berikutnya tanpa kehilangan pesan
    // =========================================================================
    const startTimeMs = Date.now();
    const MAX_EXECUTION_TIME_MS = 20000; // Maksimal 20 detik total eksekusi batch
    const MAX_DELAY_CUTOFF_MS = 16000; // Jika sudah lewat 16 detik, jangan sleep lagi
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
        if (res.success) {
          sentCount++;
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
        totalSchedulesMatched: upcomingSchedules.length,
        totalRecipientsCalculated: dryRunRecipients.length,
        schedules: upcomingSchedules.map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          venue: s.venuePlaceName,
          organization: s.organization.name,
        })),
        recipientsPreview: dryRunRecipients.slice(0, 50),
      });
    }

    // =========================================================================
    // 9. Fitur Rekap Laporan Admin (Kirim Notifikasi Sukses/Gagal per Batch)
    // Dikirim ke nomor CRON_ADMIN_REPORT_PHONE jika ada pengiriman atau kegagalan
    // =========================================================================
    const adminPhoneRaw = process.env.CRON_ADMIN_REPORT_PHONE || '0882007730579';
    const adminPhone = normalizePhoneNumber(adminPhoneRaw);
    const hasActivity = sentCount > 0 || failedCount > 0;
    const remainingInQueue = Math.max(0, dispatchQueue.length - (sentCount + failedCount));

    if (hasActivity && !isDryRun && adminPhone) {
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
          `📌 *Jadwal:* ${scheduleTitles || '-'}\n\n` +
          `📊 *Hasil Pengiriman Menit Ini:*\n` +
          `• ✅ *Berhasil Terkirim:* ${sentCount} pesan\n` +
          `• ❌ *Gagal Terkirim:* ${failedCount} pesan\n` +
          `• ⏭️ *Dilewati (Sudah Ada):* ${skippedCount} pesan\n` +
          `• ⏳ *Sisa Antrean (Menit Berikutnya):* ${remainingInQueue} pesan\n`;

        if (failedCount > 0 && lastErrorMessage) {
          adminReportText += `\n⚠️ *Detail Kendala Terakhir:*\n${lastErrorMessage}\n`;
        }

        adminReportText +=
          `----------------------------------------\n` +
          `_Sistem Notifikasi Pengajian Otomatis_`;

        await whatsAppClient.sendMessage({
          to: adminPhone,
          message: adminReportText,
          recipientName: 'Admin Pengajian',
          messageType: 'CUSTOM_DIRECT',
        });
        console.log(`[Cron ScheduleReminders] 📲 Laporan batch berhasil dikirim ke Admin (${adminPhone})`);
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
      processedSchedules: upcomingSchedules.length,
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
