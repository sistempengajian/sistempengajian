import { prisma } from '../src/lib/prisma';
import { populateDefaultAbsenceForSession } from '../src/app/(protected)/presensi/actions';

async function main() {
  console.log('=== MEMULAI MIGRASI / BACKFILL PRESENSI ALPA UNTUK SESI SELESAI ===\n');

  // Ambil seluruh sesi presensi dari jadwal yang berstatus COMPLETED
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      schedule: {
        status: 'COMPLETED',
      },
    },
    include: {
      schedule: {
        select: {
          id: true,
          title: true,
          status: true,
          startTime: true,
        },
      },
      records: {
        select: { id: true, studentId: true, status: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total sesi terdeteksi: ${sessions.length} sesi.\n`);

  let totalBackfilled = 0;
  let sessionsProcessed = 0;

  for (const session of sessions) {
    const prevRecordCount = session.records.length;
    const res = await populateDefaultAbsenceForSession(session.id);
    const addedCount = res.count;

    if (addedCount > 0) {
      totalBackfilled += addedCount;
      sessionsProcessed++;
      console.log(
        `✅ [Sesi ${session.id.slice(0, 8)}] Jadwal: "${session.schedule?.title || 'Tanpa Judul'}" (${session.schedule?.status || 'N/A'})`
      );
      console.log(
        `   -> Menambahkan ${addedCount} santri menjadi ALPA (Sebelumnya: ${prevRecordCount} record, Sekarang: ${prevRecordCount + addedCount} record)\n`
      );
    } else {
      console.log(
        `ℹ️ [Sesi ${session.id.slice(0, 8)}] Jadwal: "${session.schedule?.title || 'Tanpa Judul'}" -> Sudah lengkap (${prevRecordCount} record)`
      );
    }
  }

  console.log('\n=============================================================');
  console.log(`🎉 MIGRASI SELESAI!`);
  console.log(`Total santri yang di-backfill menjadi ALPA: ${totalBackfilled} santri`);
  console.log(`Total sesi yang diperbarui: ${sessionsProcessed} sesi`);
  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan saat migrasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
