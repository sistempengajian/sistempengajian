# 🛡️ AI HANDOVER & EXECUTION RULES — PROYEK SIPANJI

> **Status Proyek:** LIVE di Production (Vercel `sin1`)  
> **Tech Stack:** Next.js 15 (App Router) + React 19 + TypeScript + Prisma + Supabase + Tailwind CSS 3.x  
> **Progress Saat Ini:**
> - ✅ **Fase 0 (Selesai):** Fondasi Design System & Komponen UI Global (`src/components/ui/`)
> - ✅ **Fase 1 (Selesai):** Migrasi Modul Presensi & Jadwal
> - 🔄 **Target Sekarang:** Melanjutkan **Fase 2 hingga Fase 5** secara bertahap tanpa regresi.

---

## 🚨 1. ATURAN MUTLAK (ZERO-HALLUCINATION PROTOCOL)

Kamu adalah agen AI yang melanjutkan pekerjaan dari arsitek sebelumnya. Patuhi 7 hukum berikut tanpa kompromi:

1. **READ BEFORE WRITE (Dilarang Menebak Props):**
   Sebelum memodifikasi komponen apa pun, kamu **WAJIB** membaca file di `src/components/ui/` (`Toast.tsx`, `ConfirmModal.tsx`, `CustomSelect.tsx`, `LoadingButton.tsx`, `Skeleton.tsx`) untuk mengetahui *exact interface/props* yang sudah dibuat di Fase 0. Jangan mengarang nama prop baru.
2. **GOLDEN REFERENCE (Acuan Implementasi):**
   Jika ragu bagaimana cara mengganti `alert()`, `confirm()`, atau `<select>`, buka dan baca file di `src/components/jadwal/` atau `src/components/presensi/` yang sudah dimigrasi pada Fase 1. Tiru pola *state management* dan pemanggilan komponennya 100%.
3. **SURGICAL EDITS ONLY (Dilarang Mengubah Logika Bisnis):**
   Untuk Fase 2 & 3, fokus HANYA pada penggantian elemen UI dan umpan balik pengguna. **JANGAN** mengubah nama fungsi Server Actions, query Prisma, kalkulasi bisnis, atau struktur *props* antar komponen yang tidak berkaitan.
4. **NO LAZY PLACEHOLDERS:**
   Dilarang keras menulis komentar pemotong seperti `// ... sisa kode tetap sama` atau `// ... existing code` yang menghapus implementasi asli saat mengedit file besar (seperti `KurikulumInfiniteList.tsx` 62KB atau `tugas/actions.ts` 73KB). Gunakan *diff/replace* secara presisi pada baris yang terdampak saja.
5. **PERHATIKAN EVENT HANDLER `<CustomSelect>`:**
   Elemen `<select>` native menggunakan `onChange={(e) => setState(e.target.value)}`. Pastikan saat migrasi ke `<CustomSelect>`, kamu menyesuaikan *callback*-nya sesuai dengan *signature* prop di `src/components/ui/CustomSelect.tsx` (apakah menerima `value: string` langsung atau *object*).
6. **ISOLASI EKSEKUSI (Satu Sub-Modul per Waktu):**
   Jangan memodifikasi file di luar modul yang sedang diperintahkan oleh user.
7. **VERIFIKASI WAJIB DI AKHIR TUGAS:**
   Setiap selesai mengerjakan 1 sub-modul, kamu **WAJIB** menjalankan perintah terminal untuk mengecek *type-safety* dan memastikan tidak ada elemen native yang tertinggal.

---

## 🎨 2. REFERENSI DESIGN SYSTEM & TOKENS

Seluruh komponen baru (seperti `EmptyState.tsx`) atau penyesuaian *styling* wajib mematuhi token berikut dan mempertahankan sistem `getRoleTheme()` dari `src/lib/theme.ts`:

- **Semantic Colors:**
  - Success: `#059669` (`emerald-600`), Bg: `#ECFDF5` (`emerald-50`)
  - Warning: `#D97706` (`amber-600`), Bg: `#FFFBEB` (`amber-50`)
  - Error/Danger: `#E11D48` (`rose-600`), Bg: `#FFF1F2` (`rose-50`)
  - Info: `#4F46E5` (`indigo-600`), Bg: `#EEF2FF` (`indigo-50`)
- **Mobile-First Touch Targets:**
  - Tinggi/Lebar minimal elemen interaktif: `44px × 44px` (`min-h-[44px]`)
  - Jarak antar tombol klik: minimal `8px` (`gap-2`)
- **Border Radius:**
  - Badge/Chip: `rounded-full`
  - Button & Input: `rounded-xl` (`0.75rem` / `12px`)
  - Card: `rounded-2xl` (`1rem` / `16px`)
  - Modal & Bottom Sheet: `rounded-3xl` (`1.5rem` / `24px`, `rounded-t-3xl` untuk bottom sheet)

---

## 📋 3. DAFTAR TUGAS & TARGET FILE (FASE 2 - FASE 5)

### 🔹 FASE 2: Migrasi Halaman Inti Kedua
#### Batch 2A — Modul Kurikulum (`src/components/kurikulum/`)
- [x] `KurikulumInfiniteList.tsx`: Ganti **3 `alert()`** → `useToast()`, dan **2 `<select>`** → `<CustomSelect>`
- [x] `MonthlyTargetModal.tsx`: Ganti **1 `confirm()`** → `<ConfirmModal>`, dan **1 `<select>`** → `<CustomSelect>`
- [x] `ChecklistItemModal.tsx`: Ganti **2 `confirm()`** → `<ConfirmModal>`, dan **1 `<select>`** → `<CustomSelect>`
- [x] `MaterialCustomizeModal.tsx`: Ganti **1 `confirm()`** → `<ConfirmModal>`
- [x] `MaterialFormModal.tsx`: Ganti **1 `<select>`** → `<CustomSelect>`
- *(Catatan: Pertahankan `DeleteConfirmModal.tsx` yang sudah berjalan baik)*

#### Batch 2B — Modul Kelas & Users (`src/components/kelas/` & `src/components/users/`)
- [x] `ClassFilterBar.tsx`: Ganti **2 `<select>`** → `<CustomSelect>`
- [x] `HomeroomClassView.tsx`: Ganti **1 `<select>`** → `<CustomSelect>`
- [x] `ParentClassView.tsx`: Ganti **1 `<select>`** → `<CustomSelect>`
- [x] `UserFilterBar.tsx`: Ganti **2 `<select>`** → `<CustomSelect>`
- [x] `form/EditUserForm.tsx`: Ganti **2 `<select>`** → `<CustomSelect>`
- [x] `UserManagementView.tsx`: Hapus state toast ad-hoc lokal (`toastMessage`), migrasi ke global `useToast()`

#### Batch 2C — Modul Tugas, Analisis & Leaderboard
- [x] `src/components/tugas/TeacherTaskDetail.tsx`: Ganti **2 `alert()`** → `useToast()`
- [x] `src/components/tugas/AssignmentCreateModal.tsx`: Ganti **1 `<select>`** → `<CustomSelect>`
- [x] `src/components/analisis/AnalyticsFilterBar.tsx`: Ganti **1 `alert()`** → `useToast()`, dan **1 `<select>`** → `<CustomSelect>`
- [x] `src/components/leaderboard/LeaderboardClientWrapper.tsx`: Ganti **4 `<select>`** → `<CustomSelect>`

---

### 🔹 FASE 3: Migrasi Halaman Penunjang & Route Publik
#### Batch 3A — Organisasi, Generasi, Gamifikasi, Remedial, Profil
- [x] `src/components/organisasi/OrganizationManagementView.tsx`: Migrasi toast ad-hoc lokal → global `useToast()`
- [x] `src/components/generasi/GenerationManagementView.tsx`: Migrasi toast ad-hoc lokal → global `useToast()`
- [x] `src/components/generasi/EditGenerationForm.tsx`: Ganti **1 `<select>`** → `<CustomSelect>`
- [x] `src/components/gamifikasi/MissionTrackerCard.tsx`: Migrasi toast ad-hoc lokal → global `useToast()`
- [x] `src/components/private-remedial/PrivateRemedialForm.tsx`: Ganti **1 `alert()`** → `useToast()`, dan **1 `<select>`** → `<CustomSelect>`
- [x] `src/components/profil/`: Pastikan `LogoutCard` menggunakan `<ConfirmModal>` dan modal edit aman dari *virtual keyboard overlap* di mobile.

#### Batch 3B — Halaman Publik (Magic Link) & Empty State
- [x] `src/app/badal/ajukan/[token]/`: Ganti **1 `confirm()`** → `<ConfirmModal>`
- [x] `src/app/badal/konfirmasi/[token]/`: Ganti **1 `confirm()`** → `<ConfirmModal>` & **1 `alert()`** → `useToast()`
- [x] `src/app/izin/ajukan/[token]/`: Ganti **1 `alert()`** (validasi ukuran file) → `useToast()`
- [x] `src/app/izin/konfirmasi/[token]/`: Ganti **1 `confirm()`** → `<ConfirmModal>` & **1 `alert()`** → `useToast()`
- [x] Buat `src/components/ui/EmptyState.tsx` (props: `icon`, `title`, `description`, `actionLabel`, `onAction`) dan pasang pada tampilan list yang kosong.

---

### 🔹 FASE 4: Security Hardening (WAJIB BERHATI-HATI!)
> **Acuan Standar Zod:** Baca `src/app/(protected)/kelas/actions.ts` terlebih dahulu. Ikuti pola deklarasi schema Zod dan cara pengembalian pesan error tanpa mengubah *return signature* yang dibutuhkan oleh komponen Client.

#### Batch 4A — Implementasi Zod di Server Actions (Kerjakan maks 3 file per eksekusi)
- [ ] Grup 1: `organisasi/actions.ts`, `generasi/actions.ts`, `profil/actions.ts`
- [ ] Grup 2: `users/actions.ts`, `private-remedial/actions.ts`, `gamifikasi/actions.ts`
- [ ] Grup 3: `kurikulum/actions.ts`, `jadwal/actions.ts`, `laporan/actions.ts`, `analisis/actions.ts`
- [ ] Grup 4 (File Besar): `presensi/actions.ts` (70KB), `tugas/actions.ts` (73KB)

#### Batch 4B — Mitigasi Celah Keamanan Spesifik
- [ ] **Cron Secret:** Di `src/lib/whatsapp/broadcastMagicLoginService.ts` (sekitar L35), hapus fallback `'pengajian-cron-secret-2026'`. Wajib gunakan `process.env.CRON_SECRET` dan *throw error* atau return `401 Unauthorized` jika env kosong/tidak cocok.
- [ ] **Timing-Safe Token Comparison:** Gunakan `crypto.timingSafeEqual` (pastikan panjang `Buffer` dicek terlebih dahulu agar tidak throw range error) pada verifikasi token magic link (`/badal`, `/izin`, `/pengajar/sesi`).
- [ ] **Bot Honeypot:** Tambahkan input tersembunyi `<input type="text" name="website_url" tabIndex={-1} autoComplete="off" className="hidden" />` di form publik `/badal/ajukan` dan `/izin/ajukan`. Tolak proses di Server Action jika field tersebut berisi nilai.
- [ ] **IDOR & API Auth Check:** Pastikan seluruh mutasi di `actions.ts` dan route `/api/kelas/classes/route.ts` memverifikasi sesi via `getEffectiveAuthUser()` dan ruang lingkup organisasi via `getScopedOrganizationIds()`.

---

### 🔹 FASE 5: Polish UX & Performance (Opsional / Bertahap)
- [ ] Sticky filter bar (`sticky top-0 z-20 backdrop-blur-md`) pada halaman daftar santri, jadwal, dan kurikulum.
- [ ] Haptic feedback helper (`if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(50)`) saat sukses presensi/kirim tugas.
- [ ] Table ↔ Card view toggle di layar mobile untuk data tabular.
- [ ] Optimistic UI (`useOptimistic`) & Offline Queue (Dexie IndexedDB) untuk pencatatan presensi.

---

## ✅ 4. CHECKLIST VERIFIKASI (DEFINITION OF DONE)

Sebelum kamu melaporkan bahwa sebuah Batch/Fase telah selesai kepada user, **jalankan perintah berikut di terminal** dan pastikan hasilnya bersih:

1. **Cek Sisa `alert()` di Modul Terkait:**
   ```bash
   grep -rn "window\.alert\|alert(" src/components/<nama-folder>