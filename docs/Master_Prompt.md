# ROLE & OBJECTIVE
Kamu adalah Senior Frontend Engineer spesialis React, TypeScript, Tailwind CSS, dan UI Animation. 
Tugasmu adalah membuat fitur baru berupa halaman **"Interactive Branching Product Tour" (Panduan Interaktif Berjalan Otomatis)** untuk peran **Pengajar** pada aplikasi **Sistem Pengajian**.

Fitur ini BUKAN pemutar file video MP4, melainkan simulasi UI interaktif yang berjalan otomatis layaknya video (dilengkapi Virtual Cursor yang bergerak dan mengklik elemen secara otomatis), namun akan berhenti (PAUSE) pada titik percabangan agar user bisa memilih skenario mode presensi mana yang ingin dipelajari terlebih dahulu.

---

# STRICT TECHNICAL CONSTRAINTS (WAJIB DIIKUTI)
1. **Self-Contained & Zero Database Mutation**: Gunakan 100% Mock/Dummy Data statis di dalam komponen ini. Jangan pernah memanggil API backend atau mengubah database asli.
2. **Deterministic State Machine**: Gunakan tipe state yang ketat (`StepId`). Perpindahan antar-scene otomatis wajib dikontrol oleh satu `useEffect` terpusat yang membaca waktu dari `subStep` (timeline internal tiap scene) dan bisa di-pause (`isPlaying: boolean`).
3. **Percentage-Based Virtual Cursor**: Komponen kursor palsu (`VirtualCursor`) wajib bergerak menggunakan koordinat persentase (`x: number`, `y: number` dalam skala `0-100%` relatif terhadap container simulasi) agar posisi klik tidak pernah meleset di layar HP maupun Desktop.
4. **Clean Icons & Styling**: Gunakan `lucide-react` untuk seluruh ikon dan Tailwind CSS untuk styling. Gunakan transisi CSS (`transition-all duration-500 ease-in-out`) untuk pergerakan kursor dan efek klik (`animate-ping`).
5. **No Placeholders**: Tulis kode secara LENGKAP dari baris pertama hingga terakhir. Dilarang menulis komentar seperti `// ... tambahkan sisa kode di sini` atau `// TODO`.

---

# ARCHITECTURE & STATE MACHINE SPECIFICATION

Buat dalam rute/komponen mandiri (misal: `PengajarProductTour.tsx`). Gunakan definisi `StepId` berikut:

```tsx
export type StepId =
  | 'SCENE_1_WA_NOTIF_H1'       // H-1: Notif WA muncul di atas layar HP & diklik
  | 'SCENE_1_WA_CHAT_H1'        // H-1: Chat WA terbuka & klik link pilih capaian
  | 'SCENE_1_SELECT_CAPAIAN'    // H-1: Pilih 2 capaian materi -> muncul badge "Prioritas" -> klik Simpan
  | 'SCENE_2_WA_CHAT_H2JAM'     // H-2 Jam: Chat WA pengingat jadwal & klik link halaman presensi
  | 'SCENE_3_BRANCH_MENU'       // PAUSE INTERAKTIF: Modal 3 tombol pilihan mode presensi
  | 'SCENE_3A_QR_DINAMIS'       // Cabang 1: Tampilkan QR Dinamis + simulasi santri scan otomatis
  | 'SCENE_3B_PRESENSI_MANUAL'  // Cabang 2: Klik tombol status (Hadir, Izin, Sakit) per baris santri
  | 'SCENE_3C_SCAN_KARTU'       // Cabang 3: Simulasi kamera scanner membaca Kartu QR Santri
  | 'SCENE_4_JURNAL_PENILAIAN'  // Pindah tab Jurnal -> materi "Prioritas" di paling atas -> input nilai -> Simpan
  | 'SCENE_5_COMPLETED';        // Layar selesai (Tombol Ulangi Tutorial / Kembali ke Dashboard)