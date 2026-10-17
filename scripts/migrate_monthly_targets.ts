import prisma from '../src/lib/prisma';

const MONTH_MAP: Record<string, { month: number; shortName: string; pattern: RegExp }> = {
  januari: { month: 1, shortName: 'jan', pattern: /\b(bulan\s+)?januari\b/i },
  februari: { month: 2, shortName: 'feb', pattern: /\b(bulan\s+)?februari\b/i },
  maret: { month: 3, shortName: 'mar', pattern: /\b(bulan\s+)?maret\b/i },
  april: { month: 4, shortName: 'apr', pattern: /\b(bulan\s+)?april\b/i },
  mei: { month: 5, shortName: 'mei', pattern: /\b(bulan\s+)?mei\b/i },
  juni: { month: 6, shortName: 'jun', pattern: /\b(bulan\s+)?juni\b/i },
  juli: { month: 7, shortName: 'jul', pattern: /\b(bulan\s+)?juli\b/i },
  agustus: { month: 8, shortName: 'ags', pattern: /\b(bulan\s+)?agustus\b/i },
  september: { month: 9, shortName: 'sep', pattern: /\b(bulan\s+)?september\b/i },
  oktober: { month: 10, shortName: 'okt', pattern: /\b(bulan\s+)?oktober\b/i },
  november: { month: 11, shortName: 'nov', pattern: /\b(bulan\s+)?november\b/i },
  desember: { month: 12, shortName: 'des', pattern: /\b(bulan\s+)?desember\b/i },
};

function getOrderIndex(title: string): number {
  const t = title.toUpperCase();
  if (t.includes('ALIM') || t.includes('FAQIH')) return 0;
  if (t.includes('AKHLAQ') || t.includes('AKHLAK')) return 1;
  if (t.includes('KEMANDIRIAN')) return 2;
  return 3;
}

function shortenTitle(title: string): { newTitle: string; month: number; shortName: string } | null {
  for (const [_, info] of Object.entries(MONTH_MAP)) {
    if (info.pattern.test(title)) {
      const isUpper = title === title.toUpperCase();
      const shortName = isUpper ? info.shortName.toUpperCase() : info.shortName.toLowerCase();
      const newTitle = title.replace(info.pattern, shortName).replace(/\s+/g, ' ').trim();
      return { newTitle, month: info.month, shortName: info.shortName };
    }
  }
  return null;
}

async function main() {
  console.log('--- Memulai Migrasi Judul Materi & Target Kurikulum Bulanan ---');

  const materials = await prisma.material.findMany({
    select: {
      id: true,
      title: true,
      targetGenerationId: true,
      organizationId: true,
      creatorTierLevel: true,
    },
  });

  console.log(`Ditemukan total ${materials.length} materi.`);

  let updatedTitleCount = 0;
  const targetRecords: Array<{
    materialId: string;
    generationId: string;
    organizationId: string | null;
    tierLevel: any;
    year: number;
    month: number;
    orderIndex: number;
    notes: string;
  }> = [];

  for (const m of materials) {
    const res = shortenTitle(m.title);
    if (res) {
      // 1. Update judul materi jika berbeda
      if (res.newTitle !== m.title) {
        await prisma.material.update({
          where: { id: m.id },
          data: { title: res.newTitle },
        });
        updatedTitleCount++;
      }

      // 2. Siapkan data target bulanan untuk tahun 2026 dan 2027
      const orderIdx = getOrderIndex(m.title);

      // Tahun 2026
      targetRecords.push({
        materialId: m.id,
        generationId: m.targetGenerationId,
        organizationId: m.organizationId,
        tierLevel: m.creatorTierLevel,
        year: 2026,
        month: res.month,
        orderIndex: orderIdx,
        notes: `Target Kurikulum ${res.shortName.toUpperCase()} 2026`,
      });

      // Tahun 2027 (untuk kelanjutan tahun ajaran 2026/2027)
      targetRecords.push({
        materialId: m.id,
        generationId: m.targetGenerationId,
        organizationId: m.organizationId,
        tierLevel: m.creatorTierLevel,
        year: 2027,
        month: res.month,
        orderIndex: orderIdx,
        notes: `Target Kurikulum ${res.shortName.toUpperCase()} 2027`,
      });
    }
  }

  console.log(`Berhasil memperbarui ${updatedTitleCount} judul materi menjadi lebih ringkas.`);

  // 3. Simpan ke MaterialMonthlyTarget
  console.log(`Menyimpan ${targetRecords.length} data MaterialMonthlyTarget (2026 & 2027)...`);

  const createdTargets = await prisma.materialMonthlyTarget.createMany({
    data: targetRecords,
    skipDuplicates: true,
  });

  console.log(`✅ Berhasil membuat ${createdTargets.count} data MaterialMonthlyTarget!`);
}

main()
  .catch((e) => {
    console.error('Terjadi kesalahan migrasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
