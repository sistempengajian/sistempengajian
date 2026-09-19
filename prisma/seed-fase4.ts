import { PrismaClient, TaskType, SubmissionStatus } from '@prisma/client';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

function generateMagicToken(submissionId: string, parentUserId?: string, hoursValid = 72): string {
  const secret = process.env.MAGIC_LINK_SECRET || 'sistem-pengajian-magic-secret-key-2026';
  const exp = Math.floor(Date.now() / 1000) + hoursValid * 3600;
  const data = `${submissionId}:${parentUserId || ''}:${exp}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

const prisma = new PrismaClient();

async function seedFase4() {
  console.log('🌱 Menjalankan Seeding untuk Fase 4 (Tugas Pasca-Pengajian & Koreksi)...');

  // Ambil user yang diperlukan
  const ustadzAbdullah = await prisma.user.findFirst({ where: { username: 'ustadz_abdullah' } });
  const farhan = await prisma.user.findFirst({ where: { username: 'farhan_fauzi' } });
  const aisyah = await prisma.user.findFirst({ where: { username: 'aisyah_salsabila' } });
  const bapakAhmad = await prisma.user.findFirst({ where: { username: 'bapak_ahmad' } });

  const kelompok = await prisma.organization.findFirst({ where: { type: 'KELOMPOK' } });
  const kelasCaberawit = await prisma.class.findFirst({ where: { name: { contains: 'Caberawit' } } });
  const tahsinMaterial = await prisma.material.findFirst({ where: { title: { contains: 'Tahsin' } } });
  const adabMaterial = await prisma.material.findFirst({ where: { title: { contains: 'Adab' } } });

  if (!ustadzAbdullah || !farhan || !kelompok) {
    console.error('Data dasar belum lengkap. Pastikan seed sebelumnya sudah berjalan.');
    return;
  }

  // Bersihkan data tugas lama untuk seeding fresh
  await prisma.assignmentParentVerification.deleteMany({});
  await prisma.assignmentSubmission.deleteMany({});
  await prisma.assignment.deleteMany({});

  // 1. Tugas 1: Setoran Hafalan Audio (AUDIO_MEMORIZATION)
  console.log('🎙️ Membuat Tugas 1: Setoran Hafalan Audio...');
  const taskAudio = await prisma.assignment.create({
    data: {
      title: 'Setoran Hafalan Makhorijul Huruf Halqiyah',
      description: 'Rekam pelafalan 6 huruf halqiyah (Hamzah, Ha, Ain, Hha, Ghain, Kha) dengan durasi 30-60 detik sesuai makhraj yang benar.',
      taskType: TaskType.AUDIO_MEMORIZATION,
      requiresParentVerification: true,
      pointsReward: 25,
      parentBonusPoints: 10,
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000), // 3 hari ke depan
      teacherId: ustadzAbdullah.id,
      organizationId: kelompok.id,
      classId: kelasCaberawit?.id,
      materialId: tahsinMaterial?.id,
    },
  });

  // Submission untuk Farhan (Menunggu Paraf Orang Tua)
  const sampleAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
  const subAudio = await prisma.assignmentSubmission.create({
    data: {
      assignmentId: taskAudio.id,
      studentId: farhan.id,
      submissionText: 'Alhamdulillah sudah saya latih bersama Abi di rumah, mohon koreksi dan bimbingannya Ustadz.',
      mediaFileUrl: sampleAudioUrl,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 jam lalu
    },
  });

  // Magic token paraf untuk orang tua
  const parentId = bapakAhmad?.id || farhan.id;
  const magicToken = generateMagicToken(subAudio.id, parentId, 72);
  await prisma.assignmentParentVerification.create({
    data: {
      submissionId: subAudio.id,
      parentUserId: parentId,
      magicToken,
      tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      isVerifiedByParent: false,
    },
  });
  console.log(`🔗 Magic Token Dibuat untuk Setoran Farhan: ${magicToken}`);

  // 2. Tugas 2: Checklist Amalan Harian (DAILY_HABIT)
  console.log('📋 Membuat Tugas 2: Amalan Ibadah Mandiri...');
  const taskHabit = await prisma.assignment.create({
    data: {
      title: 'Amalan Yaumiyah & Adab Harian Santri',
      description: 'Centang checklist ibadah harian: Sholat berjamaah 5 waktu, tilawah Al-Qur\'an, dan membantu orang tua di rumah.',
      taskType: TaskType.DAILY_HABIT,
      requiresParentVerification: true,
      pointsReward: 20,
      parentBonusPoints: 10,
      dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      teacherId: ustadzAbdullah.id,
      organizationId: kelompok.id,
      classId: kelasCaberawit?.id,
      materialId: adabMaterial?.id,
    },
  });

  // Submission Farhan (Sudah Diparaf Orang Tua)
  const habitText = JSON.stringify([
    'Sholat Fardhu 5 Waktu Tepat Waktu',
    'Membaca Al-Qur\'an / Tilawah Minimal 1 Halaman',
    'Dzikir & Doa Pagi / Petang',
    'Membantu Pekerjaan Rumah Orang Tua dengan Khidmat',
  ]);

  const subHabit = await prisma.assignmentSubmission.create({
    data: {
      assignmentId: taskHabit.id,
      studentId: farhan.id,
      submissionText: habitText,
      status: SubmissionStatus.VERIFIED_BY_PARENT,
      submittedAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });

  await prisma.assignmentParentVerification.create({
    data: {
      submissionId: subHabit.id,
      parentUserId: parentId,
      magicToken: generateMagicToken(subHabit.id, parentId, 72),
      tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      isVerifiedByParent: true,
      parentFeedback: 'Alhamdulillah Farhan disiplin sholat subuh berjamaah dan tilawah setiap ba\'da maghrib.',
      verifiedAt: new Date(Date.now() - 12 * 3600 * 1000),
    },
  });

  // 3. Tugas 3: Lembar Kerja Tertulis (WRITTEN_SUBMISSION) - Sudah Dikoreksi Pengajar
  if (aisyah) {
    console.log('✍️ Membuat Tugas 3: Lembar Kerja Tertulis...');
    const taskWritten = await prisma.assignment.create({
      data: {
        title: 'Ringkasan Hukum Nun Mati & Tanwin',
        description: 'Tuliskan bagan pembagian 4 hukum nun mati/tanwin (Idzhar, Idgham, Ikhfa, Iqlab) beserta contoh lafadznya.',
        taskType: TaskType.WRITTEN_SUBMISSION,
        requiresParentVerification: false,
        pointsReward: 20,
        parentBonusPoints: 0,
        dueDate: new Date(Date.now() - 24 * 3600 * 1000),
        teacherId: ustadzAbdullah.id,
        organizationId: kelompok.id,
        classId: kelasCaberawit?.id,
        materialId: tahsinMaterial?.id,
      },
    });

    await prisma.assignmentSubmission.create({
      data: {
        assignmentId: taskWritten.id,
        studentId: aisyah.id,
        submissionText: '1. Idzhar Halqi: Huruf Hamzah dkk (contoh: man aamana)\n2. Idgham Bighunnah: Yanmu (contoh: may yaquulu)\n3. Idgham Bilaghunnah: Lam & Ra (contoh: mir rabbihim)\n4. Iqlab: Ba (contoh: mim ba\'di)\n5. Ikhfa Haqiqi: 15 huruf sisa (contoh: min qablikum)',
        status: SubmissionStatus.GRADED,
        score: 95,
        teacherFeedback: '✓ Makhraj Sempurna. Tulisan dan contoh sangat rapi, pemahaman tajwid mantap. Pertahankan!',
        submittedAt: new Date(Date.now() - 36 * 3600 * 1000),
      },
    });
  }

  console.log('✅ Seeding Fase 4 Selesai dengan Sukses!');
}

seedFase4()
  .catch((e) => {
    console.error('Error saat seeding Fase 4:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
