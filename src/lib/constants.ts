// Application Constants for Sistem Manajemen Pengajian & Pembinaan Generasi Qur'ani
// Blueprint Version 2.0.0

export const APP_CONFIG = {
  name: 'Sistem Pengajian & Generasi Qur\'ani',
  shortName: 'PengajianApp',
  description: 'Platform Manajemen Pengajian & Pembinaan Generasi Qur\'ani Terintegrasi',
  version: '1.0.0',
};

// 1. Roles & Hierarchy
export const ROLES = {
  SANTRI: {
    code: 'SANTRI',
    label: 'Santri / Siswa',
    description: 'Peserta pengajian generasi penerus',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  ORANG_TUA: {
    code: 'ORANG_TUA',
    label: 'Orang Tua / Wali',
    description: 'Wali santri mitra pembinaan di rumah',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  PENGAJAR: {
    code: 'PENGAJAR',
    label: 'Pengajar / Ustadz',
    description: 'Pendidik pengajian dan penilai capaian materi',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  WALI_KELAS: {
    code: 'WALI_KELAS',
    label: 'Wali Kelas',
    description: 'Koordinator kelas dan pemantau presensi harian',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  PJ_KELOMPOK: {
    code: 'PJ_KELOMPOK',
    label: 'PJ Kelompok',
    description: 'Penanggung jawab pembinaan tingkat kelompok / masjid',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  PJ_DESA: {
    code: 'PJ_DESA',
    label: 'PJ Desa',
    description: 'Penanggung jawab koordinasi pengajian tingkat desa',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  PJ_DAERAH: {
    code: 'PJ_DAERAH',
    label: 'PJ Daerah',
    description: 'Pimpinan & pembina kurikulum tingkat daerah',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  ADMIN_MASTER: {
    code: 'ADMIN_MASTER',
    label: 'Admin Master',
    description: 'Administrator sistem IT & konfigurasi pusat',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
  },
} as const;

// 2. 4 Baku Jenjang Usia Generasi
export const GENERATIONS = {
  CABERAWIT: {
    code: 'CABERAWIT',
    name: 'Caberawit',
    ageRange: '4 - 12 Tahun',
    minAge: 4,
    maxAge: 12,
    educationLevel: 'PAUD - SD',
    focus: 'Fondasi baca Al-Qur\'an, tajwid dasar, hafalan surat pendek, doa harian & adab.',
    accentColor: '#10B981', // Pastel Mint
    lightBg: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
  },
  PRA_REMAJA: {
    code: 'PRA_REMAJA',
    name: 'Pra-Remaja',
    ageRange: '13 - 15 Tahun',
    minAge: 13,
    maxAge: 15,
    educationLevel: 'SMP',
    focus: 'Fiqih thaharah/sholat khusyu, hafalan Juz \'Amma, aqidah, pembiasaan ibadah mandiri.',
    accentColor: '#6366F1', // Soft Periwinkle
    lightBg: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
  },
  REMAJA: {
    code: 'REMAJA',
    name: 'Remaja',
    ageRange: '16 - 18 Tahun',
    minAge: 16,
    maxAge: 18,
    educationLevel: 'SMA / SMK',
    focus: 'Fiqih muamalah/munakahat, hadits pilihan, kepemimpinan, pemantapan karakter luhur.',
    accentColor: '#F59E0B', // Pastel Butter Amber
    lightBg: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
  },
  MANDIRI: {
    code: 'MANDIRI',
    name: 'Usia Mandiri',
    ageRange: '19 - 25+ Tahun',
    minAge: 19,
    maxAge: 35,
    educationLevel: 'Mahasiswa / Dewasa Muda',
    focus: 'Kajian tafsir & hadits besar, kemandirian hidup, pembekalan berkeluarga & manajemen dakwah.',
    accentColor: '#F43F5E', // Soft Coral
    lightBg: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
  },
} as const;

// 3. Organization Tiers
export const ORGANIZATION_TIERS = {
  DAERAH: {
    level: 'DAERAH',
    label: 'Tingkat Daerah',
    rank: 1,
    canManage: ['DESA', 'KELOMPOK'],
  },
  DESA: {
    level: 'DESA',
    label: 'Tingkat Desa',
    rank: 2,
    canManage: ['KELOMPOK'],
  },
  KELOMPOK: {
    level: 'KELOMPOK',
    label: 'Tingkat Kelompok / Masjid',
    rank: 3,
    canManage: [],
  },
} as const;

// 4. Attendance Status
export const ATTENDANCE_STATUS = {
  HADIR: {
    code: 'HADIR',
    label: 'Hadir',
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotClass: 'bg-emerald-500',
  },
  TERLAMBAT: {
    code: 'TERLAMBAT',
    label: 'Terlambat',
    color: 'amber',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500',
  },
  SAKIT: {
    code: 'SAKIT',
    label: 'Sakit',
    color: 'blue',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    dotClass: 'bg-blue-500',
  },
  IZIN: {
    code: 'IZIN',
    label: 'Izin',
    color: 'indigo',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    dotClass: 'bg-indigo-500',
  },
  ALPA: {
    code: 'ALPA',
    label: 'Alpa (Belum Hadir)',
    color: 'rose',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    dotClass: 'bg-rose-500',
  },
} as const;

// 5. Gamification Badges Seed Data
export const SEED_BADGES = [
  {
    codeName: 'TAHFIDZ_STARTER',
    name: 'Bintang Tahfidz Pemula',
    category: 'Tahfidz',
    iconName: 'Award',
    criteriaDescription: 'Menuntaskan setoran 5 surat pendek dengan tajwid baik',
    pointBonus: 50,
  },
  {
    codeName: 'PEJUANG_SHUBUH',
    name: 'Pejuang Shubuh Istiqomah',
    category: 'Ibadah',
    iconName: 'Sun',
    criteriaDescription: 'Presensi pengajian shubuh berturut-turut selama 7 hari',
    pointBonus: 75,
  },
  {
    codeName: 'DUTA_ADAB',
    name: 'Duta Adab & Karakter',
    category: 'Akhlaq',
    iconName: 'HeartHandshake',
    criteriaDescription: 'Mendapatkan nilai adab sempurna dari Ustadz & Wali Kelas selama 1 bulan',
    pointBonus: 100,
  },
  {
    codeName: 'KELUARGA_QURANI',
    name: 'Keluarga Qur\'ani Bersinergi',
    category: 'Sinergi Ortu',
    iconName: 'Home',
    criteriaDescription: 'Orang tua memaraf 10 tugas rumah secara tepat waktu via Magic Link',
    pointBonus: 120,
  },
  {
    codeName: 'JUARA_ISTIQOMAH',
    name: 'Juara Istiqomah 30 Hari',
    category: 'Kehadiran',
    iconName: 'Flame',
    criteriaDescription: 'Mempertahankan streak kehadiran pengajian selama 30 hari tanpa jeda',
    pointBonus: 200,
  },
];
