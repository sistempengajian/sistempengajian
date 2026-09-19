import {
  PrismaClient,
  GenerationCode,
  TierLevel,
  MaterialUsageScope,
  CompletionTierLevel,
  ScheduleType,
  ScheduleStatus,
  ApprovalStatus,
} from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function seedFase2() {
  console.log('🌱 Menjalankan Seeding Tambahan untuk Fase 2 (Kurikulum & Penjadwalan)...');

  // 1. Ambil Generasi
  const caberawit = await prisma.generation.findUnique({ where: { code: GenerationCode.CABERAWIT } });
  const praRemaja = await prisma.generation.findUnique({ where: { code: GenerationCode.PRA_REMAJA } });
  const remaja = await prisma.generation.findUnique({ where: { code: GenerationCode.REMAJA } });
  const mandiri = await prisma.generation.findUnique({ where: { code: GenerationCode.MANDIRI } });

  // 2. Ambil Organisasi & User
  const daerah = await prisma.organization.findFirst({ where: { type: 'DAERAH' } });
  const kelompok = await prisma.organization.findFirst({ where: { type: 'KELOMPOK' } });
  const ustadzAbdullah = await prisma.user.findFirst({ where: { username: 'ustadz_abdullah' } });
  const ustadzahKhadijah = await prisma.user.findFirst({ where: { username: 'ustadzah_khadijah' } });
  const farhan = await prisma.user.findFirst({ where: { username: 'farhan_fauzi' } });
  const aisyah = await prisma.user.findFirst({ where: { username: 'aisyah_salsabila' } });

  if (!caberawit || !daerah || !kelompok || !ustadzAbdullah) {
    console.error('Data dasar belum lengkap, jalankan seed awal terlebih dahulu.');
    return;
  }

  // 3. Tambah Materi Caberawit 1 (Wajib dengan Kunci Daerah 🔒)
  console.log('📚 Menambahkan Materi Master Caberawit & Sub-Capaian Terkunci Daerah (🔒)...');
  const matCaberawitWajib = await prisma.material.create({
    data: {
      title: 'Tahsin Makhorijul Huruf & Tajwid Dasar',
      description: 'Fondasi pelafalan huruf hijaiyah sesuai makhraj aslinya dan hukum nun mati/tanwin.',
      creatorTierLevel: TierLevel.DAERAH,
      organizationId: daerah.id,
      targetGenerationId: caberawit.id,
      isMandatoryForTarget: true,
      allowedUsageScope: MaterialUsageScope.ALL_TIERS,
      checklistItems: {
        create: [
          {
            itemTitle: 'Makhraj Huruf Halqiyah (Hamzah, Ha, Ain, Hha, Ghain, Kha)',
            description: 'Melafalkan 6 huruf tenggorokan tanpa memantul atau berdengung berlebihan.',
            completionTierLevel: CompletionTierLevel.ANY_TIER,
            pointsWeight: 10,
            orderIndex: 1,
          },
          {
            itemTitle: 'Hukum Bacaan Idzhar Halqi & Idgham Bighunnah',
            description: 'Membedakan bacaan nun mati jelas dan melebur berdengung 2 harakat.',
            completionTierLevel: CompletionTierLevel.ANY_TIER,
            pointsWeight: 15,
            orderIndex: 2,
          },
          {
            itemTitle: 'Sertifikasi Makhraj & Tajwid Murni Penguji Daerah',
            description: 'Ujian lisan langsung di hadapan Tim Tahsin Daerah Jakarta Timur sebagai syarat mutlak kelulusan jenjang Caberawit.',
            completionTierLevel: CompletionTierLevel.DAERAH_ONLY, // 🔒 TERKUNCI KHUSUS DAERAH
            pointsWeight: 30,
            orderIndex: 3,
          },
        ],
      },
    },
  });

  // 4. Tambah Materi Caberawit 2 (Pengayaan / Suplemen)
  await prisma.material.create({
    data: {
      title: 'Hafalan Doa Harian & Adab Santri',
      description: 'Doa makan, masuk masjid, berpakaian, dan pembiasaan adab tangan kanan.',
      creatorTierLevel: TierLevel.KELOMPOK,
      organizationId: kelompok.id,
      targetGenerationId: caberawit.id,
      isMandatoryForTarget: false,
      allowedUsageScope: MaterialUsageScope.ALL_TIERS,
      checklistItems: {
        create: [
          {
            itemTitle: 'Doa Masuk dan Keluar Masjid beserta Langkah Kaki Kanan/Kiri',
            completionTierLevel: CompletionTierLevel.ANY_TIER,
            pointsWeight: 10,
            orderIndex: 1,
          },
          {
            itemTitle: 'Doa Sebelum dan Sesudah Tidur beserta Adab Kebersihan',
            completionTierLevel: CompletionTierLevel.ANY_TIER,
            pointsWeight: 10,
            orderIndex: 2,
          },
        ],
      },
    },
  });

  // 5. Tambah Materi Pra-Remaja (Wajib)
  if (praRemaja) {
    console.log('📚 Menambahkan Materi Master Pra-Remaja...');
    await prisma.material.create({
      data: {
        title: 'Fiqih Thaharah & Tata Cara Sholat Khusyu',
        description: 'Syarat sah sholat, rukun wudhu, mandi wajib baligh, dan bacaan sholat tartil.',
        creatorTierLevel: TierLevel.DAERAH,
        organizationId: daerah.id,
        targetGenerationId: praRemaja.id,
        isMandatoryForTarget: true,
        allowedUsageScope: MaterialUsageScope.ALL_TIERS,
        checklistItems: {
          create: [
            {
              itemTitle: 'Rukun dan Pembatal Wudhu beserta Doa Pasca Wudhu',
              completionTierLevel: CompletionTierLevel.ANY_TIER,
              pointsWeight: 15,
              orderIndex: 1,
            },
            {
              itemTitle: 'Ujian Praktik Mandi Junub & Wudhu Bersama Tim Fiqih Daerah',
              description: 'Pengesahan pemahaman thaharah pra-remaja menjelang usia baligh.',
              completionTierLevel: CompletionTierLevel.DAERAH_ONLY, // 🔒 TERKUNCI KHUSUS DAERAH
              pointsWeight: 35,
              orderIndex: 2,
            },
          ],
        },
      },
    });
  }

  // 6. Tambah Materi Remaja
  if (remaja) {
    console.log('📚 Menambahkan Materi Master Remaja...');
    await prisma.material.create({
      data: {
        title: 'Kajian Hadits Karakter Luhur & Fiqih Muamalah',
        description: 'Pemantapan 6 Thobiat Luhur (Jujur, Amanah, Hemat, Rukun, Kompak, Kerja Sama).',
        creatorTierLevel: TierLevel.DAERAH,
        organizationId: daerah.id,
        targetGenerationId: remaja.id,
        isMandatoryForTarget: true,
        allowedUsageScope: MaterialUsageScope.ALL_TIERS,
        checklistItems: {
          create: [
            {
              itemTitle: 'Hafalan 10 Hadits Akhlaqul Karimah',
              completionTierLevel: CompletionTierLevel.ANY_TIER,
              pointsWeight: 20,
              orderIndex: 1,
            },
            {
              itemTitle: 'Ujian Pemahaman Ushulul Fiqih & Karakter Daerah',
              completionTierLevel: CompletionTierLevel.DAERAH_ONLY, // 🔒 TERKUNCI KHUSUS DAERAH
              pointsWeight: 40,
              orderIndex: 2,
            },
          ],
        },
      },
    });
  }

  // 7. Tambah Jadwal Rutin Bulan Berjalan untuk Mengaktifkan Dot Merah #F43F5E di Kalender
  console.log('📅 Menambahkan Jadwal Pengajian Rutin Bulan Berjalan...');
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Jadwal 1: Hari ini (Sore)
  const schToday = new Date(y, m, now.getDate(), 16, 30);
  const schTodayEnd = new Date(y, m, now.getDate(), 17, 45);

  // Jadwal 2: 2 Hari ke depan
  const schNext1 = new Date(y, m, now.getDate() + 2, 19, 30);
  const schNext1End = new Date(y, m, now.getDate() + 2, 21, 0);

  // Jadwal 3: 5 Hari ke depan
  const schNext2 = new Date(y, m, now.getDate() + 5, 16, 30);
  const schNext2End = new Date(y, m, now.getDate() + 5, 17, 45);

  await prisma.schedule.create({
    data: {
      title: '🕌 Pengajian Rutin Caberawit & Remaja',
      scheduleType: ScheduleType.REGULAR_ROUTINE,
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompok.id,
      venuePlaceName: 'Masjid Baitul Makmur (Ruang Utama)',
      startTime: schToday,
      endTime: schTodayEnd,
      status: ScheduleStatus.SCHEDULED,
      teachers: {
        create: [
          {
            teacherId: ustadzAbdullah.id,
            isPrimary: true,
            isSubstitute: false,
          },
        ],
      },
    },
  });

  await prisma.schedule.create({
    data: {
      title: '📖 Kajian Tafsir Al-Qur\'an & Hadits Malam',
      scheduleType: ScheduleType.REGULAR_ROUTINE,
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompok.id,
      venuePlaceName: 'Masjid Baitul Makmur (Aula Atas)',
      startTime: schNext1,
      endTime: schNext1End,
      status: ScheduleStatus.SCHEDULED,
      teachers: {
        create: [
          {
            teacherId: ustadzahKhadijah ? ustadzahKhadijah.id : ustadzAbdullah.id,
            isPrimary: true,
            isSubstitute: false,
          },
        ],
      },
    },
  });

  await prisma.schedule.create({
    data: {
      title: '🕌 Pengajian Rutin Akhir Pekan',
      scheduleType: ScheduleType.REGULAR_ROUTINE,
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompok.id,
      venuePlaceName: 'Masjid Baitul Makmur (Ruang Utama)',
      startTime: schNext2,
      endTime: schNext2End,
      status: ScheduleStatus.SCHEDULED,
      teachers: {
        create: [
          {
            teacherId: ustadzAbdullah.id,
            isPrimary: true,
            isSubstitute: false,
          },
        ],
      },
    },
  });

  // 8. Tambah Pengajian Private Remedial Pending (Untuk diuji oleh PJ)
  console.log('🤝 Menambahkan 1 Pengajuan Private Remedial untuk Diuji di Approval Box...');
  const schPrivate = new Date(y, m, now.getDate() + 1, 16, 0);
  const schPrivateEnd = new Date(y, m, now.getDate() + 1, 17, 0);

  await prisma.schedule.create({
    data: {
      title: '🤝 Remedial Khusus: Setoran Makhorijul Huruf & Tajwid',
      scheduleType: ScheduleType.PRIVATE_REMEDIAL,
      tierLevel: TierLevel.KELOMPOK,
      organizationId: kelompok.id,
      venuePlaceName: 'Masjid Baitul Makmur (Ruang Khusus Remedial)',
      startTime: schPrivate,
      endTime: schPrivateEnd,
      maxStudentsQuota: 5,
      status: ScheduleStatus.SCHEDULED,
      requestedByUserId: ustadzAbdullah.id,
      requesterType: 'PENGAJAR',
      approvalStatus: ApprovalStatus.PENDING,
      teachers: {
        create: [
          {
            teacherId: ustadzAbdullah.id,
            isPrimary: true,
            isSubstitute: false,
          },
        ],
      },
    },
  });

  console.log('✅ Seeding Fase 2 berhasil selesai!');
}

seedFase2()
  .catch((e) => {
    console.error('❌ Error seeding Fase 2:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
