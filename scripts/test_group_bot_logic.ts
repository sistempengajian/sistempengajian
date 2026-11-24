import {
  isBotMentionedInGroup,
  cleanGroupQuery,
  extractMentionedJids,
} from '../src/lib/whatsapp/groupInboundWebhookService';

function runTests() {
  console.log('================================================================');
  console.log('🤖 MENJALANKAN UJI INTEGRASI LOGIKA BOT GRUP WHATSAPP');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
    }
  }

  // 1. Uji ekstraksi mentionedJid dari berbagai payload WAHA / Baileys
  const samplePayloads = [
    {
      payload: { mentionedJidList: ['6285165868482@s.whatsapp.net'] },
      expected: '6285165868482@s.whatsapp.net',
    },
    {
      payload: { _data: { message: { extendedTextMessage: { contextInfo: { mentionedJid: ['214006056919268@lid'] } } } } },
      expected: '214006056919268@lid',
    },
    {
      payload: { mentionedJids: ['628123456789@s.whatsapp.net'] },
      expected: '628123456789@s.whatsapp.net',
    },
  ];

  for (const tc of samplePayloads) {
    const extracted = extractMentionedJids(tc);
    assert(extracted.includes(tc.expected), `extractMentionedJids menemukan ${tc.expected}`);
  }

  // 2. Uji isBotMentionedInGroup
  // 2a. Mention native WA
  assert(
    isBotMentionedInGroup('halo semua', ['6285165868482@s.whatsapp.net']),
    'Mendeteksi mention JID bot 6285165868482'
  );
  assert(
    isBotMentionedInGroup('halo', ['214006056919268@lid']),
    'Mendeteksi mention LID bot 214006056919268'
  );

  // 2b. Mention keyword teks
  assert(isBotMentionedInGroup('@bot jadwal'), 'Mendeteksi @bot jadwal');
  assert(isBotMentionedInGroup('@no_bot bayar kas'), 'Mendeteksi @no_bot bayar kas');
  assert(isBotMentionedInGroup('@nobot menu'), 'Mendeteksi @nobot menu');
  assert(isBotMentionedInGroup('@asisten jadwal hari ini'), 'Mendeteksi @asisten');
  assert(isBotMentionedInGroup('@pengajian info'), 'Mendeteksi @pengajian');
  assert(isBotMentionedInGroup('@sipanji jadwal'), 'Mendeteksi @sipanji');
  assert(isBotMentionedInGroup('@6285165868482 jadwal'), 'Mendeteksi @6285165868482');
  assert(isBotMentionedInGroup('@085165868482 jadwal'), 'Mendeteksi @085165868482');

  // 2c. Slash & dot & bang commands
  assert(isBotMentionedInGroup('/jadwal'), 'Mendeteksi /jadwal');
  assert(isBotMentionedInGroup('/kas'), 'Mendeteksi /kas');
  assert(isBotMentionedInGroup('/menu'), 'Mendeteksi /menu');
  assert(isBotMentionedInGroup('/info'), 'Mendeteksi /info');
  assert(isBotMentionedInGroup('/pengajar'), 'Mendeteksi /pengajar');
  assert(isBotMentionedInGroup('!jadwal'), 'Mendeteksi !jadwal');
  assert(isBotMentionedInGroup('.jadwal'), 'Mendeteksi .jadwal');

  // 2d. Chat biasa tanpa mention harus diabaikan (anti-spam)
  assert(!isBotMentionedInGroup('jadwal hari ini'), 'Mengabaikan chat biasa "jadwal hari ini"');
  assert(!isBotMentionedInGroup('bayar kas'), 'Mengabaikan chat biasa "bayar kas"');
  assert(!isBotMentionedInGroup('assalamu\'alaikum'), 'Mengabaikan chat biasa "assalamu\'alaikum"');

  // 3. Uji cleanGroupQuery
  assert(cleanGroupQuery('@no_bot jadwal hari ini') === 'jadwal hari ini', 'cleanGroupQuery @no_bot');
  assert(cleanGroupQuery('/jadwal mingguan') === 'mingguan', 'cleanGroupQuery /jadwal');
  assert(cleanGroupQuery('.kas') === '', 'cleanGroupQuery .kas');

  console.log('\n================================================================');
  console.log(`🎉 HASIL PENGUJIAN: ${passed} / ${total} LULUS (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed !== total) process.exit(1);
}

runTests();
