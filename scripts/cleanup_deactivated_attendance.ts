import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('=== MEMERIKSA RESIDU RECORD PRESENSI SANTRI NONAKTIF PADA SESI BERJALAN ===\n');

  // Cari seluruh record default ALPA santri nonaktif di sesi yang sedang aktif / jadwal belum selesai
  const residualRecords = await prisma.attendanceRecord.findMany({
    where: {
      student: {
        status: { in: ['INACTIVE', 'SUSPENDED'] },
      },
      status: 'ALPA',
      notes: { contains: 'Status awal presensi sesi' },
      session: {
        OR: [
          { isActive: true },
          { schedule: { status: { in: ['ACTIVE', 'SCHEDULED'] } } },
        ],
      },
    },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          status: true,
        },
      },
      session: {
        select: {
          id: true,
          isActive: true,
          schedule: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
    },
  });

  console.log(`Ditemukan ${residualRecords.length} record residu presensi untuk santri nonaktif:`);
  residualRecords.forEach((r, idx) => {
    console.log(
      ` ${idx + 1}. Santri: ${r.student.fullName} (Status: ${r.student.status}) | Sesi: ${r.session.schedule?.title || r.session.id}`
    );
  });

  if (residualRecords.length > 0) {
    const recordIds = residualRecords.map((r) => r.id);
    const deleted = await prisma.attendanceRecord.deleteMany({
      where: {
        id: { in: recordIds },
      },
    });
    console.log(`\n Berhasil menghapus ${deleted.count} record residu dari sesi aktif.`);
  } else {
    console.log('\n Tidak ada residu record presensi santri nonaktif pada sesi aktif saat ini.');
  }
}

main()
  .catch((e) => {
    console.error('Error saat sanitasi data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
