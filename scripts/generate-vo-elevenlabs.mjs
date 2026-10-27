import fs from 'fs';
import path from 'path';

// Auto-load .env jika belum ada di process.env
if (!process.env.ELEVENLABS_API_KEY && fs.existsSync('.env')) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile();
    }
  } catch {}
  if (!process.env.ELEVENLABS_API_KEY) {
    const envContent = fs.readFileSync('.env', 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Default ke Premade Voice 'Jessica' (cgSgspJ2msm6clMCkdW9) yang didukung penuh di Free & Paid Tier
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
const MODEL_ID = 'eleven_turbo_v2_5';

const OUTPUT_DIR = path.resolve('public/audio/tour/pengajar');

// Daftar 20 file audio sesuai pemetaan Anchor Moment + ejaan fonetik yang sudah dioptimasi
const VO_MANIFEST = [
  {
    filename: 'SCENE_1_WA_NOTIF_H1_1.mp3',
    text: 'Nah, malam sebelum hari mengajar, sistem otomatis mengirimkan pengingat jadwal lewat WhatsApp. Yuk, kita buka pesannya!'
  },
  {
    filename: 'SCENE_1_WA_CHAT_H1_1.mp3',
    text: 'Di sini ada info kelas dan santri yang akan diajar. Cukup klik tautan ini untuk menentukan materi yang mau kita ajarkan besok.'
  },
  {
    filename: 'SCENE_1_SELECT_CAPAIAN_1.mp3',
    text: 'Buka materi kelas kita. Di dalamnya sudah ada capaian pembelajaran yang siap kita tentukan.'
  },
  {
    filename: 'SCENE_1_SELECT_CAPAIAN_2.mp3',
    text: 'Tinggal centang capaian yang ingin diprioritaskan. Materi yang dicentang akan otomatis menjadi target ajar besok!'
  },
  {
    filename: 'SCENE_1_SELECT_CAPAIAN_4.mp3',
    text: 'Klik simpan, dan rencana mengajar kita sudah selesai disiapkan. Praktis banget, kan?'
  },
  {
    filename: 'SCENE_2_TIMELAPSE_COUNTDOWN_0.mp3',
    text: 'Waktu berjalan... Sekarang kita lompat ke dua jam sebelum sesi mengajar dimulai!'
  },
  {
    filename: 'SCENE_2_WA_NOTIF_H2JAM_1.mp3',
    text: 'Dua jam sebelum kelas, ada notifikasi WhatsApp lagi untuk membuka ruang kelas digital kita.'
  },
  {
    filename: 'SCENE_2_WA_CHAT_H2JAM_1.mp3',
    text: 'Tinggal klik tautan ajaib ini. Kita langsung masuk ke ruang kendali kelas tanpa perlu repot login lagi.'
  },
  {
    filename: 'SCENE_3_BRANCH_MENU_0.mp3',
    text: 'Sistem Pengajian punya tiga pilihan presensi: Q-R Dinamis, Absensi Manual, atau Scan Kartu. Pilih salah satu untuk melihat caranya!'
  },
  {
    filename: 'SCENE_3A_PRESENSI_QR_0.mp3',
    text: 'Ini mode Q-R Dinamis. Kode Q-R akan berganti otomatis setiap lima belas detik di layar ponsel kita.'
  },
  {
    filename: 'SCENE_3A_PRESENSI_QR_1.mp3',
    text: 'Santri tinggal scan dari HP masing-masing, dan presensi langsung tercatat otomatis. Bebas titip absen!'
  },
  {
    filename: 'SCENE_3B_PRESENSI_MANUAL_0.mp3',
    text: 'Kalau santri tidak bawa HP, pakai Absensi Manual. Secara bawaan, statusnya berada di Alfa.'
  },
  {
    filename: 'SCENE_3B_PRESENSI_MANUAL_1.mp3',
    text: 'Cukup satu klik saja untuk mengubah status jadi Hadir, Izin, atau Sakit. Cepat dan tanpa ribet!'
  },
  {
    filename: 'SCENE_3C_SCAN_KARTU_0.mp3',
    text: 'Bisa juga dengan memindai kartu fisik santri. Cukup arahkan kartu ke kamera HP kita, dan santri langsung terdata hadir!'
  },
  {
    filename: 'SCENE_4_JURNAL_PENILAIAN_1.mp3',
    text: 'Setelah presensi, buka Tab Jurnal. Materi prioritas yang kita pilih semalam sudah langsung ada di urutan teratas.'
  },
  {
    filename: 'SCENE_4_JURNAL_PENILAIAN_2.mp3',
    text: 'Satu kali klik tombol status, berubah jadi Proses, untuk santri yang masih butuh bimbingan estafet.'
  },
  {
    filename: 'SCENE_4_JURNAL_PENILAIAN_3.mp3',
    text: 'Klik sekali lagi, berubah jadi Tuntas. Di sini kita bisa langsung pilih skor nilai dan catatan khususnya.'
  },
  {
    filename: 'SCENE_4_JURNAL_PENILAIAN_5.mp3',
    text: 'Kita bisa mengombinasikan materi yang berstatus Tuntas dan yang masih Proses dalam satu sesi yang sama.'
  },
  {
    filename: 'SCENE_4_JURNAL_PENILAIAN_6.mp3',
    text: 'Terakhir, klik Simpan Jurnal dan Selesai Mengajar. Seluruh data kelas resmi tersimpan rapi ke sistem!'
  },
  {
    filename: 'SCENE_5_COMPLETED_0.mp3',
    text: 'Alhamdulillah! Seluruh siklus mengajar berhasil Anda kuasai. Selamat mengajar dan semoga berkah untuk para santri!'
  }
];

async function generateAllVoiceOvers() {
  if (!ELEVENLABS_API_KEY) {
    console.error('❌ Error: Environment variable ELEVENLABS_API_KEY belum disetel!');
    console.log('💡 Contoh penggunaan:');
    console.log('   ELEVENLABS_API_KEY="sk_xxx..." node scripts/generate-vo-elevenlabs.mjs');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`🎙️ Memulai generate ${VO_MANIFEST.length} file audio via ElevenLabs...`);
  console.log(`📂 Output directory: ${OUTPUT_DIR}\n`);

  let successCount = 0;
  let skipCount = 0;

  for (const item of VO_MANIFEST) {
    const filePath = path.join(OUTPUT_DIR, item.filename);
    if (fs.existsSync(filePath)) {
      console.log(`⏩ Skip (Sudah ada): ${item.filename}`);
      skipCount++;
      continue;
    }

    console.log(`⏳ Generating: ${item.filename}...`);
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: item.text,
            model_id: MODEL_ID,
            voice_settings: {
              stability: 0.50,        // Seimbang agar ekspresif & hangat
              similarity_boost: 0.78, // Jernih dan konsisten
              style: 0.25,            // Sedikit gaya sapaan ramah
              use_speaker_boost: true
            }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ Gagal pada ${item.filename} [HTTP ${response.status}]:`, errText);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      console.log(`✅ Tersimpan: public/audio/tour/pengajar/${item.filename}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error jaringan saat generate ${item.filename}:`, err.message);
    }
  }

  console.log(`\n🎉 Selesai! Berhasil dibuat: ${successCount}, Dilewati: ${skipCount}, Total: ${VO_MANIFEST.length}`);
}

generateAllVoiceOvers();
