import { WhatsAppMessageType } from './types';

export interface WhatsAppTemplateDefinition {
  code: string;
  name: string;
  category: WhatsAppMessageType;
  templateBody: string;
  variables: string[];
}

export const DEFAULT_TEMPLATES: Record<string, WhatsAppTemplateDefinition> = {
  ATTENDANCE_ALPA_MAGIC: {
    code: 'ATTENDANCE_ALPA_MAGIC',
    name: 'Notifikasi Alpa & Magic Link Izin',
    category: 'ATTENDANCE_ALERT',
    variables: ['nama_ortu', 'nama_santri', 'judul_pengajian', 'waktu_sesi', 'tempat_pengajian', 'magic_link_izin', 'nama_kelompok'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. Bapak/Ibu {{nama_ortu}} (Wali dari {{nama_santri}}).

Menginfokan bahwa pada sesi pengajian:
📅 *{{judul_pengajian}}*
⏰ *{{waktu_sesi}}*
📍 *{{tempat_pengajian}}*

Ananda *{{nama_santri}}* tercatat belum hadir (Alpa) pada sesi absensi hari ini.

Apabila ananda berhalangan hadir karena Sakit atau Izin keluarga, Bapak/Ibu dapat mengonfirmasi surat izin cukup dengan *klik tautan instan di bawah ini (tanpa perlu login)*:

👉 {{magic_link_izin}}

_(Tautan konfirmasi ini berlaku selama 24 jam)_

Alhamdulillah Jazakumullahu Khairan Katsiran.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  PARENT_TASK_PARAF: {
    code: 'PARENT_TASK_PARAF',
    name: 'Permintaan Paraf Tugas Pembiasaan',
    category: 'PARENT_TASK_PARAF',
    variables: ['nama_ortu', 'nama_santri', 'judul_tugas', 'poin_tugas', 'magic_link_paraf', 'bonus_poin', 'nama_wali_kelas', 'nama_kelompok'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. Bapak/Ibu {{nama_ortu}}.

Ananda *{{nama_santri}}* telah menyelesaikan tugas pembiasaan:
📝 *{{judul_tugas}}*
⭐ Poin Capaian: *+{{poin_tugas}} XP*

Mohon kesediaan Bapak/Ibu untuk memeriksa dan memberikan *Paraf Digital* melalui tautan berikut:

👉 {{magic_link_paraf}}

Dengan memberikan paraf, ananda akan mendapatkan bonus *+{{bonus_poin}} XP* dan menjaga streak belajarnya! 🔥

Alhamdulillah Jazakumullahu Khairan Katsiran.
— *Wali Kelas {{nama_wali_kelas}} ({{nama_kelompok}})*`,
  },

  SCHEDULE_REMINDER: {
    code: 'SCHEDULE_REMINDER',
    name: 'Pengingat Jadwal Mengajar & Badal Ustadz',
    category: 'SCHEDULE_REMINDER',
    variables: ['nama_ustadz', 'judul_materi', 'tingkat_jenjang', 'nama_kelas', 'tempat_pengajian', 'waktu_lengkap', 'is_badal_text', 'dashboard_jadwal_url'],
    templateBody: `Assalamu'alaikum Ustadz {{nama_ustadz}},

Mengingatkan amanah jadwal mengajar pengajian:
📖 Materi: *{{judul_materi}}*
🏛️ Tingkat: *{{tingkat_jenjang}} {{nama_kelas}}*
📍 Lokasi: *{{tempat_pengajian}}*
⏰ Waktu: *{{waktu_lengkap}}*
{{is_badal_text}}
Mohon konfirmasi kehadiran atau buka ruang absensi digital melalui dashboard:
👉 {{dashboard_jadwal_url}}

Alhamdulillah Jazakumullahu Khairan Katsiran.`,
  },

  SCHEDULE_REMINDER_H1_STUDENT: {
    code: 'SCHEDULE_REMINDER_H1_STUDENT',
    name: 'Pengingat Jadwal H-1 (Santri & Wali Santri)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'nama_penerima',
      'nama_santri',
      'jenjang_santri',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'judul_materi',
      'nama_ustadz',
      'url_jadwal',
      'magic_link_izin',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. *{{nama_penerima}}* (Ananda {{nama_santri}} - {{jenjang_santri}}).

Mengingatkan agenda pengajian rutin *Sistem Generasi Qur'ani* untuk esok hari:

📅 *Hari / Tgl:* {{hari_tanggal}}
⏰ *Waktu:* {{waktu_mulai}} - {{waktu_selesai}} WIB
🕌 *Tempat:* {{nama_tempat}} ({{nama_kelompok}})
📖 *Materi:* {{judul_materi}}
👳‍♂️ *Pengajar:* {{nama_ustadz}}

🎒 *Perlengkapan yang Wajib Dibawa:*
1. Al-Qur'an & Kitab Materi
2. Buku Catatan & Alat Tulis
3. Memakai busana rapi, sopan, dan menutup aurat

👉 *Buka Portal Belajar & Materi:*
{{url_jadwal}}

⚠️ *Berhalangan Hadir?*
Konfirmasi izin lebih awal agar tercatat di sistem:
👉 {{magic_link_izin}}

Alhamdulillah Jazakumullahu Khairan Katsiran.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_H1_TEACHER: {
    code: 'SCHEDULE_REMINDER_H1_TEACHER',
    name: 'Pengingat Jadwal H-1 (Pengajar / Ustadz)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'nama_ustadz',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'jenjang_santri',
      'nama_kelas',
      'judul_materi',
      'is_badal_text',
      'url_jadwal',
      'url_request_badal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. *Ustadz {{nama_ustadz}}*.

Mengingatkan amanah jadwal mengajar pengajian *Sistem Generasi Qur'ani* untuk esok hari:

📅 *Hari / Tgl:* {{hari_tanggal}}
⏰ *Waktu:* {{waktu_mulai}} - {{waktu_selesai}} WIB
🕌 *Tempat:* {{nama_tempat}} ({{nama_kelompok}})
👥 *Target Peserta:* {{jenjang_santri}} {{nama_kelas}}
📖 *Materi:* {{judul_materi}}
{{is_badal_text}}

👉 *Buka Rincian Jadwal & Materi Ajar:*
{{url_jadwal}}

⚠️ *Berhalangan Mengajar?*
Mohon segera ajukan permohonan Guru Badal (Pengganti) melalui sistem agar PJ kelompok dapat menugaskan pengganti tepat waktu:
👉 {{url_request_badal}}

Alhamdulillah Jazakumullahu Khairan Katsiran atas keikhlasan dan dedikasi Ustadz.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_COUNTDOWN: {
    code: 'SCHEDULE_REMINDER_COUNTDOWN',
    name: 'Pengingat Hari-H (Countdown 2 Jam)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'nama_penerima',
      'nama_santri',
      'judul_sesi',
      'waktu_mulai',
      'nama_tempat',
      'judul_materi',
      'nama_ustadz',
      'url_jadwal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. *{{nama_penerima}}* ({{nama_santri}}).

Pengajian sesi *{{judul_sesi}}* akan dimulai dalam *2 jam ke depan*:

⏰ *Jam Mulai:* {{waktu_mulai}} WIB (Tepat Waktu)
📍 *Lokasi:* {{nama_tempat}}
📖 *Materi:* {{judul_materi}}
👳 *Ustadz Pengampu:* {{nama_ustadz}}

Mohon segera bersiap, berwudhu dari rumah, dan hadir 10 menit sebelum pengajian dimulai untuk presensi kehadiran tepat waktu ⭐.

👉 *Lihat Jadwal:* {{url_jadwal}}

Alhamdulillah Jazakumullahu Khairan.`,
  },

  SCHEDULE_CHANGE_EMERGENCY: {
    code: 'SCHEDULE_CHANGE_EMERGENCY',
    name: 'Pemberitahuan Perubahan Jadwal Darurat (Hari-H)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'nama_penerima',
      'nama_kelompok',
      'judul_sesi',
      'status_perubahan_keterangan',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_ustadz',
      'url_jadwal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. Jamaah Pengajian *{{nama_kelompok}}* ({{nama_penerima}}).

Terdapat PEMBARUAN JADWAL DARURAT HARI INI untuk sesi *{{judul_sesi}}*:

⚠️ *STATUS PERUBAHAN:*
{{status_perubahan_keterangan}}

📌 *Detail Jadwal Terbaru:*
• *Hari / Tgl:* {{hari_tanggal}}
• *Waktu:* {{waktu_mulai}} - {{waktu_selesai}} WIB
• *Tempat:* {{nama_tempat}}
• *Pengajar:* {{nama_ustadz}}

👉 *Lihat Jadwal Terupdate:* {{url_jadwal}}

Mohon maklum dan atas perhatiannya disampaikan Alhamdulillah Jazakumullahu Khairan Katsiran.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  REPORT_CARD: {
    code: 'REPORT_CARD',
    name: 'Laporan Progres Belajar & Rapor Santri',
    category: 'REPORT_CARD',
    variables: ['nama_ortu', 'nama_santri', 'nama_bulan', 'persentase_hadir', 'total_hadir', 'tepat_waktu', 'terlambat', 'streak_hari', 'materi_tuntas', 'total_materi', 'nilai_adab', 'nilai_keaktifan', 'posisi_rank', 'nama_wilayah', 'lencana_terbaru', 'url_rapor_lengkap'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. Bapak/Ibu {{nama_ortu}}.

Berikut ringkasan capaian belajar ananda *{{nama_santri}}* periode *{{nama_bulan}}*:

📊 *Kedisiplinan & Kehadiran:*
• Kehadiran: *{{persentase_hadir}}%* ({{total_hadir}} Sesi Hadir)
• Tepat Waktu: {{tepat_waktu}}x | Terlambat: {{terlambat}}x
• Streak Belajar: *{{streak_hari}} Sesi Berturut-turut* 🔥

📖 *Capaian Kurikulum:*
• Materi Tuntas: *{{materi_tuntas}} dari {{total_materi}}*
• Nilai Rata-rata Adab: *{{nilai_adab}}/100*
• Nilai Keaktifan: *{{nilai_keaktifan}}/100*

🏆 *Lencana & Gamifikasi:*
• Peringkat Wilayah: *Juara {{posisi_rank}} di {{nama_wilayah}}*
• Lencana Terbaru: *{{lencana_terbaru}}*

Lihat rapor digital lengkap ananda di:
👉 {{url_rapor_lengkap}}

Alhamdulillah Jazakumullahu Khairan Katsiran atas bimbingan dan doa Bapak/Ibu di rumah.`,
  },

  BROADCAST_ANNOUNCEMENT: {
    code: 'BROADCAST_ANNOUNCEMENT',
    name: 'Pengumuman Resmi Wilayah & Jenjang',
    category: 'BROADCAST_ANNOUNCEMENT',
    variables: ['nama_penerima', 'judul_pengumuman', 'isi_pengumuman', 'nama_wilayah', 'nama_pengirim'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. {{nama_penerima}}.

📢 *PENGUMUMAN RESMI {{nama_wilayah}}*
----------------------------------------
*{{judul_pengumuman}}*

{{isi_pengumuman}}
----------------------------------------
Alhamdulillah Jazakumullahu Khairan Katsiran.
— *{{nama_pengirim}}*`,
  },
};

/**
 * Mengganti placeholder {{variable_name}} dengan nilai dari objek variabel
 */
export function renderTemplate(
  templateBody: string,
  variables: Record<string, string | number | undefined | null> = {}
): string {
  let result = templateBody;

  for (const [key, value] of Object.entries(variables)) {
    const valStr = value !== undefined && value !== null ? String(value) : '';
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, valStr);
  }

  // Bersihkan placeholder sisa yang tidak terisi jika ada
  result = result.replace(/{{\s*[\w_]+\s*}}/g, '');

  return result.trim();
}
