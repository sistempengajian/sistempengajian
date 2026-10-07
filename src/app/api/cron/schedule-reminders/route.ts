import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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
import { ScheduleStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s execution

/**
 * Endpoint Cron Scheduler: Pengingat Jadwal Pengajian Otomatis via WhatsApp
 * Mendukung mode ?dry_run=true untuk simulasi pengujian tanpa mengirim pesan riil
 */
export async function GET(request: NextRequest) {
  return handleScheduleReminders(request);
}

export async function POST(request: NextRequest) {
  return handleScheduleReminders(request);
}

async function handleScheduleReminders(request: NextRequest) {
  try {
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

    const now = new Date();
    console.log(
      `[Cron ScheduleReminders] Mulai pemindaian jadwal pada ${now.toISOString()} ${
        isDryRun ? '(MODE DRY-RUN: SIMULASI AMAN)' : ''
      }`
    );

    // Rentang Waktu Pemindaian:
    // A. Jendela H-1 (Pengingat malam hari untuk pengajian besok):
    //    Jadwal yang dimulai dalam rentang 18 jam s/d 30 jam ke depan
    const h1Start = new Date(now.getTime() + 18 * 60 * 60 * 1000);
    const h1End = new Date(now.getTime() + 30 * 60 * 60 * 1000);

    // B. Jendela Hari-H (Countdown 1-3 jam sebelum mulai):
    //    Jadwal yang dimulai dalam rentang 45 menit s/d 180 menit (3 jam) ke depan
    const countdownStart = new Date(now.getTime() + 45 * 60 * 1000);
    const countdownEnd = new Date(now.getTime() + 180 * 60 * 1000);

    // 2. Query Jadwal Mendatang yang Terjadwal & Disetujui
    const upcomingSchedules = await prisma.schedule.findMany({
      where: {
        status: {
          in: [ScheduleStatus.SCHEDULED, ScheduleStatus.ACTIVE],
        },
        OR: [
          // Match H-1 Window
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
    });

    console.log(`[Cron ScheduleReminders] Ditemukan ${upcomingSchedules.length} jadwal dalam jendela pengingat.`);

    let sentCount = 0;
    let skippedCount = 0;
    const processLogs: string[] = [];
    const dryRunRecipients: any[] = [];

    // Preload semua log pengiriman 24 jam terakhir dalam 1 query (Menghindari ratusan N+1 DB queries)
    const existingLogs = await prisma.whatsAppMessageLog.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        magicToken: { not: null },
      },
      select: { magicToken: true },
    });
    const sentTokensSet = new Set(existingLogs.map((l) => l.magicToken));

    // Kumpulkan seluruh item pengiriman yang valid dan belum pernah dikirim
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

      const isH1Reminder = diffHours >= 18 && diffHours <= 30;
      const isCountdownReminder = diffHours >= 0.75 && diffHours <= 3.0;

      const reminderType = isH1Reminder ? 'H1' : isCountdownReminder ? 'COUNTDOWN_2H' : 'GENERAL';
      const dayDateStr = formatIndonesianDate(schedule.startTime);
      const startTimeStr = formatTime(schedule.startTime);
      const endTimeStr = formatTime(schedule.endTime);
      const orgName = schedule.organization.name;
      const venueName = schedule.venuePlaceName || 'Masjid Kelompok';

      // Rangkum nama ustadz dan materi
      const teacherNames = schedule.teachers.map((t) => t.teacher.fullName).join(', ') || 'Dewan Pengajar';
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

      // 3. Pengajar / Ustadz/Ustadzah
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

      // 4. Target Santri & Orang Tua
      const targetStudents = await getTargetStudentsForSchedule(schedule);

      for (const student of targetStudents) {
        const genName = student.generation?.name || 'Santri';

        // Orang Tua
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

        // Santri
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

    // Eksekusi antrean pesan dengan batching dan batas waktu ketat (Maks 10 detik)
    const startTimeMs = Date.now();
    const MAX_EXECUTION_TIME_MS = 10000;
    const BATCH_SIZE = 5;
    let consecutiveErrors = 0;

    for (let i = 0; i < dispatchQueue.length; i += BATCH_SIZE) {
      if (Date.now() - startTimeMs > MAX_EXECUTION_TIME_MS) {
        processLogs.push(`[Peringatan] Batas waktu pemrosesan tercapai. Sisa ${dispatchQueue.length - i} pesan akan dilanjutkan pada putaran cron berikutnya.`);
        break;
      }

      if (consecutiveErrors >= 3) {
        processLogs.push(`[Circuit Breaker] Gateway WhatsApp tidak merespons (Offline/Timeout berulang). Menghentikan sisa antrean.`);
        break;
      }

      const batch = dispatchQueue.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((item) => item.execute()));

      for (const res of results) {
        if (res.status === 'fulfilled') {
          if (res.value.success) {
            sentCount++;
            consecutiveErrors = 0;
            processLogs.push(res.value.log);
          } else {
            consecutiveErrors++;
            processLogs.push(`[Gagal] ${res.value.log}: ${res.value.error || 'Unknown'}`);
          }
        } else {
          consecutiveErrors++;
          processLogs.push(`[Error] Eksekusi pesan gagal: ${res.reason?.message || 'Error'}`);
        }
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

    console.log(`[Cron ScheduleReminders] Selesai: ${sentCount} terkirim, ${skippedCount} dilewati.`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedSchedules: upcomingSchedules.length,
      sentCount,
      skippedCount,
      totalQueued: dispatchQueue.length,
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
  }
}
