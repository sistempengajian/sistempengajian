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
    variables: [
      'sapaan_ortu',
      'nama_santri',
      'judul_pengajian',
      'hari_tanggal',
      'waktu_sesi',
      'tempat_pengajian',
      'magic_link_izin',
      'nama_kelompok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ortu}}

Menginfokan kehadiran santri pada sesi pengajian
*{{judul_pengajian}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_sesi}}\`\`\`
*• Tempat* _{{tempat_pengajian}}_
*• Santri* _{{nama_santri}}_
*• Status Presensi* _Belum Hadir (Alpa)_

Apabila ananda berhalangan hadir karena Sakit atau Izin keluarga, Bapak/Ibu dapat mengonfirmasi surat izin cukup dengan *klik tautan instan di bawah ini (tanpa perlu login)*:

{{magic_link_izin}}

_(Tautan konfirmasi ini berlaku selama 24 jam)_

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  PARENT_TASK_PARAF: {
    code: 'PARENT_TASK_PARAF',
    name: 'Permintaan Paraf Tugas Pembiasaan',
    category: 'PARENT_TASK_PARAF',
    variables: [
      'sapaan_ortu',
      'nama_santri',
      'judul_tugas',
      'hari_tanggal',
      'poin_tugas',
      'magic_link_paraf',
      'bonus_poin',
      'nama_wali_kelas',
      'nama_kelompok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ortu}}

Menginfokan tugas pembiasaan ananda
*{{judul_tugas}}*
*{{hari_tanggal}}*

*• Santri* _{{nama_santri}}_
*• Poin Capaian* _+{{poin_tugas}} XP_
*• Status* _Menunggu Paraf Digital_

Mohon kesediaan Bapak/Ibu untuk memeriksa dan memberikan *Paraf Digital* melalui tautan berikut:

{{magic_link_paraf}}

Dengan memberikan paraf, ananda akan mendapatkan bonus *+{{bonus_poin}} XP* dan menjaga streak belajarnya!

Alhamdulillah Jazakumullahu Khairan.
— *Wali Kelas {{nama_wali_kelas}} ({{nama_kelompok}})*`,
  },

  SCHEDULE_REMINDER: {
    code: 'SCHEDULE_REMINDER',
    name: 'Pengingat Jadwal Mengajar & Badal Ustadz',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_lengkap',
      'tempat_pengajian',
      'kelas_block',
      'materi_block',
      'is_badal_text',
      'catatan_tambahan',
      'dashboard_jadwal_url',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan amanah jadwal mengajar
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_lengkap}}\`\`\`
*• Tempat* _{{tempat_pengajian}}_
*• Kelas*{{kelas_block}}
*• Materi*{{materi_block}}{{is_badal_text}}{{catatan_tambahan}}

*Buka Ruang Absensi & Konfirmasi Kehadiran:*
{{dashboard_jadwal_url}}

Alhamdulillah Jazakumullahu Khairan.`,
  },

  SCHEDULE_REMINDER_H1_STUDENT: {
    code: 'SCHEDULE_REMINDER_H1_STUDENT',
    name: 'Pengingat Jadwal H-1 (Santri & Wali Santri)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'materi_block',
      'nama_ustadz',
      'catatan_tambahan',
      'url_jadwal',
      'url_presensi',
      'url_ajukan_izin',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

Mengingatkan agenda pengajian
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Materi*{{materi_block}}
*• Pengajar* _{{nama_ustadz}}_{{catatan_tambahan}}

*Buka Detail Jadwal & Materi:*
{{url_jadwal}}

*Buka Langsung Presensi Santri:*
{{url_presensi}}

*Halaman Khusus Pengajuan Izin / Sakit:*
{{url_ajukan_izin}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_FAMILY_DIGEST: {
    code: 'SCHEDULE_REMINDER_FAMILY_DIGEST',
    name: 'Pengingat Jadwal H-1 Keluarga (Multi-Santri)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ortu',
      'hari_tanggal',
      'nama_kelompok',
      'daftar_santri_ringkas',
      'catatan_tambahan',
      'url_aksi_keluarga',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ortu}}

Mengingatkan agenda pengajian ananda esok hari
*Pengajian Santri*
*{{hari_tanggal}}*

{{daftar_santri_ringkas}}{{catatan_tambahan}}

*Detail Jadwal & Konfirmasi Izin:*
{{url_aksi_keluarga}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_FAMILY_COUNTDOWN: {
    code: 'SCHEDULE_REMINDER_FAMILY_COUNTDOWN',
    name: 'Pengingat Hari-H Keluarga (Multi-Santri Countdown 2 Jam)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ortu',
      'hari_tanggal',
      'nama_kelompok',
      'daftar_santri_ringkas',
      'catatan_tambahan',
      'url_aksi_keluarga',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ortu}}

Pengajian ananda akan dimulai dalam 2 jam ke depan
*Pengajian Santri*
*{{hari_tanggal}}*

{{daftar_santri_ringkas}}{{catatan_tambahan}}

Mohon ananda dipersiapkan hadir tepat waktu.

*Detail Jadwal & Pantau Presensi:*
{{url_aksi_keluarga}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_H1_TEACHER: {
    code: 'SCHEDULE_REMINDER_H1_TEACHER',
    name: 'Pengingat Jadwal H-1 (Pengajar / Ustadz/Ustadzah)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'title_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'kelas_block',
      'materi_block',
      'is_badal_text',
      'catatan_tambahan',
      'url_jadwal',
      'url_absensi',
      'url_rencana_materi',
      'url_ajukan_badal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan amanah jadwal mengajar
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Kelas*{{kelas_block}}
*• Materi*{{materi_block}}{{is_badal_text}}{{catatan_tambahan}}

*Buka Detail Jadwal:*
{{url_jadwal}}

*Buka Ruang Presensi Kelas:*
{{url_absensi}}

*Akses Rencana Materi & Capaian Sesi:*
{{url_rencana_materi}}

*Berhalangan Mengajar (Ajukan Badal):*
{{url_ajukan_badal}}

Alhamdulillah Jazakumullahu Khairan atas keikhlasan & dedikasi {{title_ustadz}}.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_UNIFIED_TEACHER_PARENT: {
    code: 'SCHEDULE_REMINDER_UNIFIED_TEACHER_PARENT',
    name: 'Pengingat Terpadu (Pengajar Merangkap Wali Santri)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'title_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'kelas_block',
      'materi_block',
      'is_badal_text',
      'catatan_tambahan',
      'url_absensi',
      'url_rencana_materi',
      'url_ajukan_badal',
      'daftar_santri_ringkas',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan amanah jadwal mengajar
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Kelas*{{kelas_block}}
*• Materi*{{materi_block}}{{is_badal_text}}{{catatan_tambahan}}

*Buka Ruang Presensi Kelas:*
{{url_absensi}}

*Akses Rencana Materi & Capaian Sesi:*
{{url_rencana_materi}}

*Berhalangan Mengajar (Ajukan Badal):*
{{url_ajukan_badal}}

*Ananda Binaan Anda Pada Sesi Ini:*
{{daftar_santri_ringkas}}

Alhamdulillah Jazakumullahu Khairan atas perjuangan & dedikasi {{title_ustadz}}.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_TEACHER_WITH_DISPENSATION: {
    code: 'SCHEDULE_REMINDER_TEACHER_WITH_DISPENSATION',
    name: 'Pengingat Mengajar Disertai Dispensasi Sesi Santri Bentrok',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'title_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'kelas_block',
      'materi_block',
      'is_badal_text',
      'catatan_tambahan',
      'url_absensi',
      'url_ajukan_badal',
      'sesi_santri_bentrok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan amanah jadwal mengajar
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Kelas*{{kelas_block}}
*• Materi*{{materi_block}}{{is_badal_text}}{{catatan_tambahan}}

*Buka Ruang Presensi Kelas:*
{{url_absensi}}

*Berhalangan Mengajar (Ajukan Badal):*
{{url_ajukan_badal}}

*Dispensasi Sesi Santri:*
Jadwal mengajar Anda bersamaan dengan sesi santri *{{sesi_santri_bentrok}}*. Kehadiran Anda di sesi tersebut otomatis tercatat: *HADIR (Tugas Mengajar)*.

Alhamdulillah Jazakumullahu Khairan atas khidmah & perjuangan {{title_ustadz}}.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SUBSTITUTE_REQUEST_INVITATION: {
    code: 'SUBSTITUTE_REQUEST_INVITATION',
    name: 'Permohonan Delegasi Guru Badal (Ke Calon Badal & PJ)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'peran_penerima_text',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'jenjang_kelas',
      'judul_materi',
      'nama_pemohon',
      'alasan_berhalangan',
      'url_konfirmasi_badal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

{{peran_penerima_text}} permohonan Guru Badal (Pengganti) untuk sesi pengajian
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Kelas* _{{jenjang_kelas}}_
*• Materi* _{{judul_materi}}_
*• Pengampu* _{{nama_pemohon}}_
*• Alasan* _{{alasan_berhalangan}}_

*Buka Halaman Konfirmasi Badal (Setujui / Tolak):*
{{url_konfirmasi_badal}}

Alhamdulillah Jazakumullahu Khairan.
— *Sistem Notifikasi Pengajian*`,
  },

  SUBSTITUTE_REQUEST_APPROVED: {
    code: 'SUBSTITUTE_REQUEST_APPROVED',
    name: 'Pemberitahuan Badal Disetujui (Ke Pengajar Pemohon)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_pemohon',
      'judul_sesi',
      'hari_tanggal',
      'nama_badal',
      'nama_penyetuju',
      'catatan_persetujuan',
      'nama_kelompok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_pemohon}}

Alhamdulillah permohonan Guru Badal Anda telah disetujui untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Guru Badal* _{{nama_badal}}_
*• Disetujui Oleh* _{{nama_penyetuju}}_
*• Status* _Disetujui (Tugas Mengajar Didelegasikan)_{{catatan_persetujuan}}

Semoga keperluan Anda diberikan kemudahan dan kelancaran.

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SUBSTITUTE_REQUEST_REJECTED: {
    code: 'SUBSTITUTE_REQUEST_REJECTED',
    name: 'Pemberitahuan Badal Ditolak (Ke Pengajar Pemohon)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_pemohon',
      'judul_sesi',
      'hari_tanggal',
      'nama_penyetuju',
      'catatan_penolakan',
      'url_ajukan_badal_ulang',
      'nama_kelompok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_pemohon}}

Pemberitahuan mengenai permohonan Guru Badal untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Status* _Belum Disetujui_
*• Ditinjau Oleh* _{{nama_penyetuju}}_
*• Catatan* _{{catatan_penolakan}}_

Mohon segera pilih dan ajukan kembali ke Ustadz Badal pengganti lainnya melalui tautan berikut:
{{url_ajukan_badal_ulang}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  STUDENT_ABSENCE_REQUEST_INVITATION: {
    code: 'STUDENT_ABSENCE_REQUEST_INVITATION',
    name: 'Permohonan Izin/Sakit Santri (Ke Ortu, Wali Kelas, PJ)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'peran_penerima_text',
      'nama_santri',
      'nama_kelas',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'jenis_izin_text',
      'catatan_alasan',
      'lampiran_text',
      'url_konfirmasi_izin',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

{{peran_penerima_text}} permohonan {{jenis_izin_text}} santri untuk sesi pengajian
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Santri* _{{nama_santri}} ({{nama_kelas}})_
*• Jenis Izin* _{{jenis_izin_text}}_
*• Keterangan* _{{catatan_alasan}}_{{lampiran_text}}

*Buka Halaman Konfirmasi (Setujui / Tolak):*
{{url_konfirmasi_izin}}

Alhamdulillah Jazakumullahu Khairan.
— *Sistem Notifikasi Pengajian*`,
  },

  STUDENT_ABSENCE_DECISION_NOTIFICATION: {
    code: 'STUDENT_ABSENCE_DECISION_NOTIFICATION',
    name: 'Pemberitahuan Konfirmasi Izin Santri (Ke Santri / Ortu)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'nama_santri',
      'judul_sesi',
      'hari_tanggal',
      'jenis_izin',
      'peran_penyetuju',
      'nama_penyetuju',
      'catatan_penyetuju',
      'status_persetujuan_text',
      'nama_kelompok',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

Pemberitahuan hasil konfirmasi permohonan {{jenis_izin}} santri untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Santri* _{{nama_santri}}_
*• Jenis Izin* _{{jenis_izin}}_
*• Dikonfirmasi Oleh* _{{peran_penyetuju}} ({{nama_penyetuju}})_
*• Status* _{{status_persetujuan_text}}_{{catatan_penyetuju}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_REMINDER_COUNTDOWN: {
    code: 'SCHEDULE_REMINDER_COUNTDOWN',
    name: 'Pengingat Hari-H Santri (Countdown 2 Jam)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'materi_block',
      'nama_ustadz',
      'catatan_tambahan',
      'url_jadwal',
      'url_presensi',
      'url_ajukan_izin',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

Mengingatkan agenda pengajian
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Materi*{{materi_block}}
*• Pengajar* _{{nama_ustadz}}_{{catatan_tambahan}}

*Buka Detail Jadwal & Materi:*
{{url_jadwal}}

*Buka Langsung Presensi Santri:*
{{url_presensi}}

*Halaman Khusus Pengajuan Izin / Sakit:*
{{url_ajukan_izin}}

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  SCHEDULE_CHANGE_EMERGENCY: {
    code: 'SCHEDULE_CHANGE_EMERGENCY',
    name: 'Pemberitahuan Perubahan Jadwal Darurat (Hari-H)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_penerima',
      'nama_kelompok',
      'judul_sesi',
      'status_perubahan_keterangan',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_ustadz',
      'catatan_tambahan',
      'url_jadwal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

Terdapat pembaruan jadwal darurat untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Status Perubahan* _{{status_perubahan_keterangan}}_
*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}}_
*• Pengajar* _{{nama_ustadz}}_{{catatan_tambahan}}

*Lihat Detail Jadwal Terupdate:*
{{url_jadwal}}

Mohon maklum dan atas perhatiannya disampaikan Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  REPORT_CARD: {
    code: 'REPORT_CARD',
    name: 'Laporan Progres Belajar & Rapor Santri',
    category: 'REPORT_CARD',
    variables: [
      'sapaan_ortu',
      'nama_santri',
      'nama_bulan',
      'persentase_hadir',
      'total_hadir',
      'tepat_waktu',
      'terlambat',
      'streak_hari',
      'materi_tuntas',
      'total_materi',
      'nilai_adab',
      'nilai_keaktifan',
      'posisi_rank',
      'nama_wilayah',
      'lencana_terbaru',
      'url_rapor_lengkap',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ortu}}

Berikut ringkasan capaian belajar santri periode
*{{nama_santri}}*
*{{nama_bulan}}*

*• Kehadiran* _{{persentase_hadir}}% ({{total_hadir}} Sesi Hadir)_
*• Ketepatan* _Tepat Waktu: {{tepat_waktu}}x | Terlambat: {{terlambat}}x_
*• Streak Belajar* _{{streak_hari}} Sesi Berturut-turut_
*• Capaian Kurikulum* _{{materi_tuntas}} dari {{total_materi}} Materi Tuntas_
*• Nilai Adab* _{{nilai_adab}}/100_
*• Nilai Keaktifan* _{{nilai_keaktifan}}/100_
*• Peringkat* _Juara {{posisi_rank}} di {{nama_wilayah}}_
*• Lencana* _{{lencana_terbaru}}_

Lihat rapor digital lengkap ananda di:
{{url_rapor_lengkap}}

Alhamdulillah Jazakumullahu Khairan atas bimbingan dan doa Bapak/Ibu di rumah.`,
  },

  BROADCAST_ANNOUNCEMENT: {
    code: 'BROADCAST_ANNOUNCEMENT',
    name: 'Pengumuman Resmi Wilayah & Jenjang',
    category: 'BROADCAST_ANNOUNCEMENT',
    variables: ['nama_penerima', 'judul_pengumuman', 'isi_pengumuman', 'nama_wilayah', 'nama_pengirim'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{nama_penerima}}

*PENGUMUMAN RESMI {{nama_wilayah}}*
*{{judul_pengumuman}}*

{{isi_pengumuman}}

Alhamdulillah Jazakumullahu Khairan.
— *{{nama_pengirim}}*`,
  },

  BROADCAST_MAGIC_LOGIN: {
    code: 'BROADCAST_MAGIC_LOGIN',
    name: 'Broadcast Tautan Masuk Akun Baru (Magic Link Onboarding)',
    category: 'CUSTOM_DIRECT',
    variables: ['sapaan_penerima', 'magic_login_url', 'nama_kelompok'],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_penerima}}

Selamat datang di Sistem Informasi & Manajemen Pengajian Generasi Penerus

Berikut adalah tautan masuk instan (Magic Link) resmi akun Anda untuk mengakses sistem presensi digital, jadwal pengajian, kurikulum, dan rapor capaian:

{{magic_login_url}}

*Panduan Masuk:*
• Cukup klik tautan di atas, Anda akan langsung masuk ke aplikasi tanpa perlu repot memasukkan kata sandi (password).
• Tautan ini bersifat pribadi untuk 1x aktivasi login pertama.
• Setelah berhasil masuk, Anda dapat memasang aplikasi ke layar utama HP (PWA) untuk akses cepat setiap saat.

Alhamdulillah Jazakumullahu Khairan.
— *Pengurus Pengajian {{nama_kelompok}}*`,
  },

  TEACHER_ATTENDANCE_REMINDER_30M: {
    code: 'TEACHER_ATTENDANCE_REMINDER_30M',
    name: 'Pengingat Presensi Belum Dibuka/Diisi (30 Menit Sesi)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'title_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_mulai',
      'waktu_selesai',
      'nama_tempat',
      'nama_kelompok',
      'url_presensi',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan bahwa presensi kehadiran santri terpantau belum dibuka untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_mulai}} - {{waktu_selesai}} WIB\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Status Presensi* _Belum Dibuka / Diisi_

Mohon kesediaan {{title_ustadz}} untuk segera membuka dan mengisi presensi santri melalui tautan akses cepat berikut:
{{url_presensi}}

Alhamdulillah Jazakumullahu Khairan.
— *Sistem Informasi Pengajian {{nama_kelompok}}*`,
  },

  TEACHER_JOURNAL_REMINDER_30M: {
    code: 'TEACHER_JOURNAL_REMINDER_30M',
    name: 'Pengingat Jurnal Penilaian Santri Belum Diisi (30 Menit Sesi)',
    category: 'SCHEDULE_REMINDER',
    variables: [
      'sapaan_ustadz',
      'title_ustadz',
      'judul_sesi',
      'hari_tanggal',
      'waktu_lengkap',
      'judul_materi',
      'jumlah_hadir',
      'nama_tempat',
      'nama_kelompok',
      'url_jurnal',
    ],
    templateBody: `Assalamu'alaikum Warahmatullahi Wabarakatuh,
{{sapaan_ustadz}}

Mengingatkan bahwa jurnal capaian materi santri terpantau belum diisi untuk sesi
*{{judul_sesi}}*
*{{hari_tanggal}}*

*• Waktu* \`\`\`{{waktu_lengkap}}\`\`\`
*• Tempat* _{{nama_tempat}} ({{nama_kelompok}})_
*• Materi* _{{judul_materi}}_
*• Santri Hadir* _{{jumlah_hadir}} Santri_
*• Status Jurnal* _Belum Diisi / Dilengkapi_

Mohon kesediaan {{title_ustadz}} untuk melengkapi jurnal penilaian santri melalui tautan akses cepat berikut:
{{url_jurnal}}

Alhamdulillah Jazakumullahu Khairan.
— *Sistem Informasi Pengajian {{nama_kelompok}}*`,
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
