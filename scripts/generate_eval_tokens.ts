import prisma from '../src/lib/prisma';
import { createEvaluationToken } from '../src/lib/studentEvaluationToken';

async function main() {
  const now = new Date();
  const month = parseInt(process.env.MONTH || '', 10) || now.getMonth() + 1;
  const year = parseInt(process.env.YEAR || '', 10) || now.getFullYear();

  const baseUrl = process.env.APP_URL || 'http://localhost:3001';

  console.log('\n=============================================================');
  console.log(`📋 GENERATOR TAUTAN LEMBAR EVALUASI SANTRI ZERO-LOGIN (SiPanji)`);
  console.log(`   Periode: Bulan ${month} / Tahun ${year}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log('=============================================================\n');

  // Ambil santri aktif
  const students = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      organizationId: { not: null },
      generationId: { not: null },
    },
    take: 6,
    select: {
      id: true,
      fullName: true,
      organization: { select: { name: true } },
      generation: { select: { name: true } },
    },
  });

  if (students.length === 0) {
    console.log('⚠️ Tidak ada santri aktif dengan organisasi dan jenjang.');
    return;
  }

  console.log('1. TAUTAN EVALUASI 1 ANAK (SINGLE CHILD):');
  console.log('-------------------------------------------------------------');
  students.slice(0, 3).forEach((s, idx) => {
    const token = createEvaluationToken({
      studentIds: [s.id],
      month,
      year,
      expiresInDays: 45,
    });
    console.log(`[${idx + 1}] Santri: ${s.fullName} (${s.generation?.name} - ${s.organization?.name})`);
    console.log(`    👉 ${baseUrl}/evaluasi/${token}\n`);
  });

  if (students.length >= 2) {
    console.log('2. TAUTAN EVALUASI MULTI-ANAK (2 SANTRI DALAM 1 TOKEN):');
    console.log('-------------------------------------------------------------');
    const multiIds = [students[0].id, students[1].id];
    const multiToken = createEvaluationToken({
      studentIds: multiIds,
      month,
      year,
      expiresInDays: 45,
    });
    console.log(`Santri: ${students[0].fullName} & ${students[1].fullName}`);
    console.log(`👉 ${baseUrl}/evaluasi/${multiToken}\n`);
  }

  console.log('3. TAUTAN TOKEN TIDAK VALID / KEDALUWARSA (UJI ERROR STATE):');
  console.log('-------------------------------------------------------------');
  console.log(`👉 ${baseUrl}/evaluasi/token-palsu-atau-kedaluwarsa\n`);

  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
