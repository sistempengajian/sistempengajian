import prisma from '../src/lib/prisma';
import { AttendanceMethod, AttendanceStatus, RollingTargetScope, ScheduleStatus, TierLevel } from '@prisma/client';
import crypto from 'crypto';

// Mapping nama santri ke ID di database
const STUDENT_MAP = {
  huma: '1eb338fb-0dc0-4864-ab01-afab9437b2c4',
  dienka: 'cfeb5334-4e46-4c5b-b36e-81b2abad9944',
  fayza: '469ba1e8-20da-4023-8b58-71fa74e56794',
  syafa: '920a6641-8707-483e-a646-e3280aadc1fc', // Humairo Nur Musyafa'ah
  ica: '9aa781ae-21bc-4dcd-af6a-bc706add733e', // Icha
  kaisan: '2c58282d-52fb-4c09-aa4f-b39cd51f04a9', // Muhammad Kaysan Virendra Arsakha
  dika: 'b0c285d8-04cd-4a97-85ad-649d565d1f8f', // Muhammad Rizki Fauzan Dika Ramadhan
  abidzar: '018820e8-dc2b-414d-acf1-7da307f2b057',
  aisah: '40315c87-2f72-4faa-a55c-a89b46a40d7a', // Aisyah Dika Salsabila
};

// Data kehadiran per tanggal dari user
const ATTENDANCE_BY_DATE: Record<number, string[]> = {
  1: ['huma', 'dienka', 'fayza', 'syafa', 'ica', 'aisah'],
  2: ['huma', 'fayza', 'syafa', 'ica', 'dika', 'abidzar', 'aisah'],
  3: ['huma', 'fayza', 'syafa', 'ica', 'kaisan', 'aisah'],
  8: ['huma', 'dienka', 'fayza', 'syafa', 'ica', 'kaisan', 'dika', 'aisah'],
  9: ['huma', 'dienka', 'fayza', 'syafa', 'ica', 'kaisan', 'aisah'],
  10: ['huma', 'fayza', 'syafa', 'ica', 'kaisan', 'dika'],
  15: ['huma', 'fayza', 'syafa', 'ica', 'aisah'],
  16: ['kaisan', 'dika'],
  23: ['huma', 'syafa', 'ica', 'kaisan', 'dika', 'abidzar'],
  24: ['fayza', 'kaisan', 'dika', 'abidzar'],
  25: ['dienka', 'fayza', 'abidzar'],
};

async function main() {
  console.log('=== MEMULAI INPUT ABSENSI BULAN SEPTEMBER SESI GABUNGAN CABERAWIT ===\n');

  const edisti = await prisma.user.findFirst({
    where: { fullName: { contains: 'Edisti', mode: 'insensitive' } },
  });
  if (!edisti) throw new Error('Pengajar Edisti tidak ditemukan!');
  const teacherId = edisti.id;

  const org = await prisma.organization.findFirst({ where: { name: 'Ujungrusi' } });
  if (!org) throw new Error('Organisasi Ujungrusi tidak ditemukan!');

  const caberawitClass = await prisma.class.findFirst({
    where: { name: 'Kelas Caberawit A (Ujungrusi)' },
  });
  if (!caberawitClass) throw new Error('Kelas Caberawit A tidak ditemukan!');

  // Ambil seluruh kelas target Caberawit gabungan
  const allTargetClasses = await prisma.class.findMany({
    where: {
      generation: {
        name: {
          in: [
            'PAUD',
            'TK A',
            'TK B',
            'Caberawit A',
            'Caberawit B',
            'Caberawit C',
            'Caberawit D',
            'Caberawit E',
            'Caberawit F',
          ],
        },
      },
    },
  });

  // Ambil seluruh santri target di kelas-kelas Caberawit (khusus kelompok Ujungrusi)
  const targetStudents = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      roles: { some: { role: 'SANTRI' } },
      generation: {
        name: {
          in: [
            'PAUD',
            'TK A',
            'TK B',
            'Caberawit A',
            'Caberawit B',
            'Caberawit C',
            'Caberawit D',
            'Caberawit E',
            'Caberawit F',
          ],
        },
      },
    },
    select: { id: true, fullName: true },
  });

  console.log(`Ditemukan ${targetStudents.length} santri dalam jenjang Caberawit/TK/PAUD.`);

  // Cek jadwal tanggal 25 September 2026, jika belum ada buat baru
  let scheduleSept25 = await prisma.schedule.findFirst({
    where: {
      title: { contains: 'Caberawit' },
      startTime: {
        gte: new Date('2026-09-25T00:00:00.000Z'),
        lte: new Date('2026-09-25T23:59:59.999Z'),
      },
    },
  });

  if (!scheduleSept25) {
    console.log('Jadwal Caberawit 25 September 2026 belum ada, membuat jadwal baru...');
    scheduleSept25 = await prisma.schedule.create({
      data: {
        title: 'Caberawit',
        scheduleType: 'REGULAR_ROUTINE',
        tierLevel: TierLevel.KELOMPOK,
        organizationId: org.id,
        classId: caberawitClass.id,
        venuePlaceName: 'Masjid Al-Kautsar',
        venueType: 'MASJID',
        startTime: new Date('2026-09-25T09:00:00.000Z'),
        endTime: new Date('2026-09-25T10:00:00.000Z'),
        status: ScheduleStatus.COMPLETED,
        targetScope: RollingTargetScope.KELAS,
        targetClasses: {
          create: allTargetClasses.map((c) => ({ classId: c.id })),
        },
        teachers: {
          create: [{ teacherId: teacherId, isPrimary: true }],
        },
      },
    });
    console.log(`✓ Jadwal 25 September 2026 berhasil dibuat: ${scheduleSept25.id}`);
  }

  // Proses masing-masing tanggal
  const targetDays = Object.keys(ATTENDANCE_BY_DATE).map((d) => parseInt(d, 10));

  for (const day of targetDays) {
    const dayStr = day.toString().padStart(2, '0');
    const dateStart = new Date(`2026-09-${dayStr}T00:00:00.000Z`);
    const dateEnd = new Date(`2026-09-${dayStr}T23:59:59.999Z`);

    const schedule = await prisma.schedule.findFirst({
      where: {
        title: { contains: 'Caberawit' },
        startTime: { gte: dateStart, lte: dateEnd },
      },
      include: { attendanceSessions: true },
    });

    if (!schedule) {
      console.warn(`⚠️ Jadwal untuk tanggal ${day} September 2026 tidak ditemukan!`);
      continue;
    }

    // Pastikan session ada
    let session = schedule.attendanceSessions[0];
    if (!session) {
      session = await prisma.attendanceSession.create({
        data: {
          scheduleId: schedule.id,
          dynamicQrSecret: crypto.randomBytes(16).toString('hex'),
          isActive: false,
          openedAt: schedule.startTime,
          closedAt: schedule.endTime,
        },
      });
      console.log(`✓ Dibuat session baru untuk tgl ${day} Sept (ID: ${session.id})`);
    } else {
      // Pastikan session ditutup & schedule status COMPLETED
      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          closedAt: session.closedAt || schedule.endTime,
        },
      });
    }

    // Update status jadwal ke COMPLETED
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: ScheduleStatus.COMPLETED },
    });

    // Ambil santri yang hadir pada hari ini
    const presentKeys = ATTENDANCE_BY_DATE[day] || [];
    const presentStudentIds = new Set(presentKeys.map((k) => STUDENT_MAP[k as keyof typeof STUDENT_MAP]));

    // Upsert record presensi untuk seluruh santri target di sesi ini
    let presentCount = 0;
    let alpaCount = 0;

    for (const student of targetStudents) {
      const isPresent = presentStudentIds.has(student.id);

      if (isPresent) {
        await prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: student.id,
            },
          },
          update: {
            status: AttendanceStatus.HADIR,
            method: AttendanceMethod.MANUAL_TEACHER,
            checkInTime: schedule.startTime,
            markedByUserId: teacherId,
            notes: 'Dicatat manual oleh pengajar (Hadir)',
          },
          create: {
            sessionId: session.id,
            studentId: student.id,
            status: AttendanceStatus.HADIR,
            method: AttendanceMethod.MANUAL_TEACHER,
            checkInTime: schedule.startTime,
            markedByUserId: teacherId,
            notes: 'Dicatat manual oleh pengajar (Hadir)',
          },
        });
        presentCount++;
      } else {
        await prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: student.id,
            },
          },
          update: {
            status: AttendanceStatus.ALPA,
            method: AttendanceMethod.MANUAL_TEACHER,
            notes: 'Status awal presensi sesi (Belum hadir)',
          },
          create: {
            sessionId: session.id,
            studentId: student.id,
            status: AttendanceStatus.ALPA,
            method: AttendanceMethod.MANUAL_TEACHER,
            notes: 'Status awal presensi sesi (Belum hadir)',
          },
        });
        alpaCount++;
      }
    }

    console.log(
      `Tanggal ${day} Sept: ${presentCount} Hadir (${presentKeys.join(', ')}), ${alpaCount} Alpa.`
    );
  }

  console.log('\n=== SELESAI INPUT ABSENSI ===\n');
}

main()
  .catch((e) => {
    console.error('Error saat input absensi:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
