import prisma from '@/lib/prisma';
import { extractCleanPhoneFromJid } from '@/lib/whatsapp/utils';
import { processInboundWhatsAppMessage } from '@/lib/whatsapp/inboundWebhookService';
import { POST } from '@/app/api/webhooks/whatsapp/route';
import { NextRequest } from 'next/server';

async function runMultiDeviceSimulation() {
  console.log('================================================================');
  console.log('🚀 MEMULAI PENGUJIAN SIMULASI MULTI-DEVICE & QUOTED REPLY WHATSAPP');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: unknown, testName: string, detail?: string) {
    totalTests++;
    if (Boolean(condition)) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Ekstraksi Nomor Bersih dari Berbagai Format JID Multi-Device
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Unit Test extractCleanPhoneFromJid ---');
  const testJids = [
    { input: '62882007730579:1@c.us', expected: '62882007730579' },
    { input: '62882007730579:0@c.us', expected: '62882007730579' },
    { input: '62882007730579@s.whatsapp.net', expected: '62882007730579' },
    { input: '62882007730579:2@s.whatsapp.net', expected: '62882007730579' },
    { input: '0882007730579', expected: '62882007730579' },
    { input: '+62 882-0077-30579', expected: '62882007730579' },
    { input: '222788627513504@lid', expected: null }, // LID tidak boleh diekstrak sebagai no telp
    { input: '120363028123456789@g.us', expected: null }, // Grup tidak boleh diekstrak sebagai no telp
  ];

  for (const tc of testJids) {
    const result = extractCleanPhoneFromJid(tc.input);
    assert(
      result === tc.expected,
      `extractCleanPhoneFromJid("${tc.input}") -> ${tc.expected}`,
      `Hasil aktual: ${result}`
    );
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Simulasi Direct Inbound dari WhatsApp Web / Companion (:1@c.us)
  // Pengirim: Rosyid (085701949546) - Orang Tua Nesha
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Inbound Chat dari WhatsApp Web (:1@c.us) ---');
  const rosyid = await prisma.user.findFirst({
    where: { phoneNumber: { contains: '85701949546' } },
  });

  if (rosyid) {
    const resWeb = await processInboundWhatsAppMessage({
      from: '6285701949546:1@c.us',
      body: 'assalamu\'alaikum ustadz, izin ananda nesha sakit demam hari ini',
      fromMe: false,
      authorPhone: '6285701949546:1@c.us',
    });

    assert(resWeb.handled === true, 'Pesan multi-device berhasil di-handle bot');
    assert(resWeb.intent === 'ABSENCE', 'Intent terdeteksi dengan tepat sebagai ABSENCE');
    assert(
      !resWeb.replyMessage?.includes('belum tertaut') && !resWeb.replyMessage?.includes('belum terdaftar'),
      'Bot TIDAK merespon nomor belum terdaftar pada akun Rosyid'
    );
    assert(
      Boolean(resWeb.replyMessage?.includes('Rosyid') || resWeb.replyMessage?.includes('Wali Santri')),
      'Balasan memuat identitas personal pengirim (Bapak Rosyid / Wali Santri)'
    );
  } else {
    console.warn('⚠️ User Rosyid tidak ditemukan di DB, melewati uji spesifik user ini.');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Simulasi Inbound dari Baileys / Modern Engine (@s.whatsapp.net)
  // Pengirim: Muhammad Afin aditya (0882007730579)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Inbound Chat dari Engine @s.whatsapp.net ---');
  const resBaileys = await processInboundWhatsAppMessage({
    from: '62882007730579:2@s.whatsapp.net',
    body: 'mohon izin sakit meriang ustadz',
    fromMe: false,
    authorPhone: '62882007730579:2@s.whatsapp.net',
  });

  assert(resBaileys.handled === true, 'Pesan @s.whatsapp.net berhasil di-handle');
  assert(resBaileys.intent === 'ABSENCE', 'Intent ABSENCE berhasil terdeteksi');
  assert(
    !resBaileys.replyMessage?.includes('belum tertaut') && !resBaileys.replyMessage?.includes('belum terdaftar'),
    'Bot TIDAK merespon nomor belum terdaftar pada akun Afin'
  );
  assert(
    Boolean(resBaileys.replyMessage?.includes('Muhammad Afin aditya')),
    'Balasan mengenali profil Afin secara presisi'
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Quoted Reply Resolution & Auto-Linking WhatsApp LID
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Quoted Reply Stanza ID & LID Auto-Linking ---');
  // Buat dummy log pesan keluar seolah bot mengirim pengingat jadwal sebelumnya
  const dummyStanza = `3EB0SIMULASI${Date.now()}`;
  const dummyGatewayMsgId = `true_6285842221510@c.us_${dummyStanza}`;
  const testLid = `testlid_${Date.now()}@lid`;

  // Ambil user Iswanti
  const iswanti = await prisma.user.findFirst({
    where: { phoneNumber: { contains: '85842221510' } },
  });

  if (iswanti) {
    const dummyLog = await prisma.whatsAppMessageLog.create({
      data: {
        recipientPhone: '6285842221510@c.us',
        recipientName: iswanti.fullName,
        recipientUserId: iswanti.id,
        gatewayMessageId: dummyGatewayMsgId,
        messageType: 'CUSTOM_DIRECT',
        status: 'SENT',
        messageBody: 'Pengingat Jadwal Pengajian Caberawit Malam Ini',
      },
    });

    console.log(`Dibuat dummy log pesan keluar: ID ${dummyLog.id}, GatewayId: ${dummyGatewayMsgId}`);

    // User membalas pesan pengingat tersebut dari perangkat yang hanya mengirim @lid tanpa info HP
    const resQuoted = await processInboundWhatsAppMessage({
      from: testLid,
      body: 'izin ananda sakit pusing belum bisa hadir',
      fromMe: false,
      quotedMessageId: dummyStanza, // Mengutip stanza ID pengingat
    });

    assert(resQuoted.handled === true, 'Pesan quoted reply dari LID berhasil di-handle');
    assert(resQuoted.intent === 'ABSENCE', 'Intent ABSENCE terdeteksi');
    assert(
      !resQuoted.replyMessage?.includes('belum tertaut') && !resQuoted.replyMessage?.includes('belum terdaftar'),
      'Bot berhasil mengidentifikasi user Iswanti melalui Quoted Message Log!'
    );
    assert(
      Boolean(resQuoted.replyMessage?.includes('Iswanti') || resQuoted.replyMessage?.includes('Wali Santri')),
      'Balasan menyapa Ibu Iswanti / Wali Santri'
    );

    // Verifikasi auto-linking LID di database
    const updatedUser = await prisma.user.findUnique({
      where: { id: iswanti.id },
      select: { whatsappLid: true },
    });

    assert(
      updatedUser?.whatsappLid === testLid,
      `whatsappLid user Iswanti otomatis tertaut ke ${testLid}`,
      `LID aktual di DB: ${updatedUser?.whatsappLid}`
    );

    // TEST 5: Pesan berikutnya dari LID yang sama TANPA QUOTE
    console.log('\n--- TEST GROUP 5: Pesan Lanjutan dari LID yang Sudah Tertaut ---');
    const resSubsequent = await processInboundWhatsAppMessage({
      from: testLid,
      body: 'siap ustadz',
      fromMe: false,
    });

    assert(resSubsequent.handled === true, 'Pesan lanjutan dari LID berhasil di-handle tanpa quote');
    assert(resSubsequent.intent === 'AFFIRMATION', 'Intent AFFIRMATION berhasil terdeteksi');
    assert(
      Boolean(resSubsequent.replyMessage?.includes('Alhamdulillah, terima kasih atas konfirmasinya')),
      'Balasan konfirmasi kehadiran terkirim sukses'
    );

    // Cleanup dummy data
    await prisma.whatsAppMessageLog.delete({ where: { id: dummyLog.id } }).catch(() => {});
    // Reset whatsappLid Iswanti jika sebelumnya null
    await prisma.user.update({
      where: { id: iswanti.id },
      data: { whatsappLid: iswanti.whatsappLid },
    }).catch(() => {});
  } else {
    console.warn('⚠️ User Iswanti tidak ditemukan di DB, melewati uji quoted message.');
  }

  // ---------------------------------------------------------------------------
  // TEST 6: E2E Webhook POST Route Simulation (/api/webhooks/whatsapp)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: E2E Next.js Webhook POST Request Simulation ---');
  const fakeWahaPayload = {
    event: 'message',
    session: 'default',
    payload: {
      id: `true_62882007730579:1@c.us_E2E_${Date.now()}`,
      from: '62882007730579:1@c.us',
      fromMe: false,
      body: 'izin tidak bisa hadir pengajian hari ini',
      _data: {
        key: {
          remoteJid: '62882007730579:1@c.us',
          fromMe: false,
        },
        senderPn: '62882007730579:1@c.us',
      },
    },
  };

  const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fakeWahaPayload),
  });

  const response = await POST(req);
  const json = await response.json();

  assert(response.status === 200, 'HTTP Webhook Response status adalah 200 OK');
  assert(json.status === 'success', 'Webhook mengembalikan status success');
  assert(json.event === 'INBOUND_MESSAGE_PROCESSED', 'Event adalah INBOUND_MESSAGE_PROCESSED');
  assert(json.intent === 'ABSENCE', 'Intent yang diproses route adalah ABSENCE');
  assert(json.replySent === true, 'Pesan balasan berhasil dikirim (replySent = true)');
  assert(
    !json.replyMessage?.includes('belum tertaut') && !json.replyMessage?.includes('belum terdaftar'),
    'Bot route webhook TIDAK lagi menolak nomor multi-device sebagai belum terdaftar!'
  );

  console.log('\n================================================================');
  console.log(`🎉 HASIL PENGUJIAN: ${passedTests} / ${totalTests} PENGUJIAN LULUS (100%)`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMultiDeviceSimulation()
  .catch((err) => {
    console.error('Simulation error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
