import prisma from '../src/lib/prisma';
import crypto from 'crypto';
import { whatsAppClient } from '../src/lib/whatsapp/WhatsAppClient';
import {
  normalizePhoneNumber,
  formatStudentSalutation,
} from '../src/lib/whatsapp/utils';

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://sistempengajian.vercel.app').replace(/\/$/, '');
const VALIDITY_DAYS = 7;

async function runSantriBroadcast() {
  console.log('================================================================');
  console.log('🚀 MEMULAI BROADCAST MAGIC LOGIN LINK KE SELURUH SANTRI AKTIF');
  console.log(`🌐 Base URL Aplikasi: ${APP_BASE_URL}`);
  console.log(`⏱️  Masa Berlaku Token: ${VALIDITY_DAYS} Hari`);
  console.log('================================================================\n');

  // Pastikan tidak ada override testing phone
  if (process.env.WA_TEST_OVERRIDE_PHONE) {
    console.warn(`[PERINGATAN] WA_TEST_OVERRIDE_PHONE aktif: ${process.env.WA_TEST_OVERRIDE_PHONE}. Menghapus override untuk pengiriman nomor asli...`);
    delete process.env.WA_TEST_OVERRIDE_PHONE;
  }
  process.env.WA_MOCK_MODE = 'false';

  // 1. Ambil semua santri aktif
  const santriUsers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      phoneNumber: {
        not: null,
      },
      roles: {
        some: {
          role: 'SANTRI',
        },
      },
    },
    include: {
      roles: true,
      organization: true,
      generation: true,
    },
    orderBy: {
      fullName: 'asc',
    },
  });

  console.log(`📋 Total Santri Ditemukan: ${santriUsers.length} orang\n`);

  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const deliverySummary: Array<{
    nama: string;
    noHp: string;
    jenjang: string;
    status: string;
    loginUrl: string;
    error?: string;
  }> = [];

  const now = new Date();

  for (let i = 0; i < santriUsers.length; i++) {
    const user = santriUsers[i];
    const normalizedPhone = normalizePhoneNumber(user.phoneNumber);

    if (!normalizedPhone) {
      console.log(`⚠️ [${i + 1}/${santriUsers.length}] ${user.fullName}: Nomor HP tidak valid (${user.phoneNumber}), dilewati.`);
      skippedCount++;
      deliverySummary.push({
        nama: user.fullName,
        noHp: user.phoneNumber || '-',
        jenjang: user.generation?.name || '-',
        status: 'LEWAT (Nomor Tidak Valid)',
        loginUrl: '-',
      });
      continue;
    }

    const genName = user.generation?.name ? ` (Santri ${user.generation.name})` : '';
    const sapaanPenerima = `${formatStudentSalutation(user.fullName)}${genName}`;
    const orgName = user.organization?.name || 'Sistem Pengajian';

    // 2. Buat token magic login unik 7 hari
    const magicToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    const magicLoginUrl = `${APP_BASE_URL}/login/magic/${magicToken}`;
    const dedupKey = `BROADCAST_MAGIC_LOGIN_${user.id}`;

    console.log(`📤 [${i + 1}/${santriUsers.length}] Mengirim ke: ${sapaanPenerima} -> ${normalizedPhone}...`);

    try {
      // Simpan Token Login ke Database
      await prisma.whatsAppLoginToken.create({
        data: {
          token: magicToken,
          phoneNumber: normalizedPhone,
          userId: user.id,
          expiresAt,
          isUsed: false,
        },
      });

      // Kirim pesan WhatsApp ke nomor asli santri
      const sendRes = await whatsAppClient.sendMessage({
        to: normalizedPhone,
        recipientName: user.fullName,
        recipientUserId: user.id,
        messageType: 'CUSTOM_DIRECT',
        templateCode: 'BROADCAST_MAGIC_LOGIN',
        message: '',
        templateVariables: {
          sapaan_penerima: sapaanPenerima,
          magic_login_url: magicLoginUrl,
          nama_kelompok: orgName,
        },
        magicToken: dedupKey,
      });

      if (sendRes.success) {
        successCount++;
        console.log(`   ✅ BERHASIL TERKIRIM (Msg ID: ${sendRes.gatewayMessageId || 'OK'})`);
        deliverySummary.push({
          nama: user.fullName,
          noHp: normalizedPhone,
          jenjang: user.generation?.name || '-',
          status: 'BERHASIL TERKIRIM',
          loginUrl: magicLoginUrl,
        });
      } else {
        failedCount++;
        console.error(`   ❌ GAGAL: ${sendRes.error}`);
        deliverySummary.push({
          nama: user.fullName,
          noHp: normalizedPhone,
          jenjang: user.generation?.name || '-',
          status: 'GAGAL',
          loginUrl: magicLoginUrl,
          error: sendRes.error,
        });
      }
    } catch (err: any) {
      failedCount++;
      console.error(`   ❌ ERROR: ${err.message}`);
      deliverySummary.push({
        nama: user.fullName,
        noHp: normalizedPhone,
        jenjang: user.generation?.name || '-',
        status: 'ERROR',
        loginUrl: magicLoginUrl,
        error: err.message,
      });
    }

    // Pacing delay 500ms antar pesan
    if (i < santriUsers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log('\n================================================================');
  console.log('🏁 HASIL AKHIR BROADCAST SANTRI');
  console.log(`✅ Berhasil Terkirim : ${successCount}`);
  console.log(`❌ Gagal             : ${failedCount}`);
  console.log(`⏭️  Dilewati          : ${skippedCount}`);
  console.log(`📊 Total Santri      : ${santriUsers.length}`);
  console.log('================================================================\n');

  console.log(JSON.stringify(deliverySummary, null, 2));
}

runSantriBroadcast()
  .catch((e) => {
    console.error('Fatal execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
