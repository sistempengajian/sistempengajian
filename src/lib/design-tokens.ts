/**
 * Design Tokens Resmi — Sistem Pengajian UI Architecture (Phase 3)
 *
 * Konsolidasi konstanta spacing, kontainer, permukaan kartu, tipografi, dan target sentuh
 * agar seluruh modul mengikuti standar WCAG 2.1 AA dan responsivitas mobile-first.
 */

export const LAYOUT = {
  /** Kontainer standar mobile-first (Dashboard, Jadwal, Presensi, Tugas, Profil) */
  containerMobile: 'max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6',
  /** Kontainer menengah untuk manajemen master data */
  containerMedium: 'max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6',
  /** Kontainer lebar untuk analitika, laporan matriks, dan tabel eksekutif */
  containerWide: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6',
} as const;

export const TYPOGRAPHY = {
  /** Ukuran minimum teks informatif yang harus dibaca (12px — larang kelas sub-12px untuk teks informasi) */
  caption: 'text-xs leading-snug',
  /** Ukuran maksimum untuk chip/badge counter kompak (11px — hindari teks panjang) */
  badge: 'text-[11px] font-bold leading-none',
  /** Body teks utama nyaman dibaca di layar mobile outdoor */
  body: 'text-xs sm:text-sm text-slate-700 leading-relaxed',
  /** Heading halaman utama */
  h1: 'text-xl sm:text-2xl font-bold text-slate-900 tracking-tight',
  /** Heading bagian / kartu */
  h2: 'text-base sm:text-lg font-bold text-slate-900 tracking-tight',
  /** Teks sekunder kontras tinggi (WCAG AA compliant di latar terang) */
  mutedText: 'text-slate-600',
} as const;

export const SURFACE = {
  card: 'bg-white/90 backdrop-blur-md border border-slate-200/75 rounded-2xl shadow-xs',
  cardInteractive:
    'bg-white/90 backdrop-blur-md border border-slate-200/75 rounded-2xl shadow-xs hover:shadow-sm hover:border-slate-300/80 transition-all',
  sheetPanel:
    'bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-t-3xl sm:rounded-3xl shadow-2xl',
  overlay:
    '!mt-0 fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md',
} as const;

export const TOUCH_TARGET = {
  /** Target sentuh minimum WCAG / Apple HIG di perangkat layar sentuh */
  minButton: 'min-h-[44px] sm:min-h-[38px]',
  minIcon: 'min-w-[44px] min-h-[44px]',
} as const;
