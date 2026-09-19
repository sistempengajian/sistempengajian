/**
 * Role Theme Palette Utility
 * Menyediakan palet gradasi pastel lembut dan token warna sesuai peran pengguna
 * Sesuai prinsip desain minimalis, clean, dan diferensiasi peran pengguna.
 */

export interface RoleTheme {
  roleKey: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' | 'ADMIN_MASTER';
  roleTitle: string;
  bgGradient: string;
  heroGradient: string;
  badgeClass: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentLine: string;
  hoverBorder: string;
  menuIconClass: string;
  cardClass: string;
}

export const COMMON_THEME = {
  cardClass: 'bg-white/30 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-2xs',
  cardClassPadded: 'bg-white/30 backdrop-blur-md border border-slate-200/50 rounded-2xl shadow-2xs p-4 sm:p-5',
  cardClassHero: 'bg-white/30 backdrop-blur-md border border-slate-200/50 shadow-2xs rounded-2xl p-5 sm:p-6',
  statCardClass: 'p-3 rounded-xl bg-white/40 border border-slate-200/50 flex items-center gap-3 transition-colors hover:bg-white/60',
  titleClass: 'text-lg sm:text-xl font-bold text-slate-900 tracking-tight',
  sectionTitleClass: 'text-base sm:text-lg font-bold text-slate-900 tracking-tight',
  labelClass: 'text-xs font-semibold text-slate-400 uppercase tracking-wider',
};

export function getRoleTheme(roleCodes: string[] = []): RoleTheme {
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');
  const isOrangTua = roleCodes.includes('ORANG_TUA');

  if (isAdmin) {
    return {
      roleKey: 'ADMIN_MASTER',
      roleTitle: 'Admin Master Sistem',
      bgGradient: 'bg-role-admin',
      heroGradient: 'from-purple-200/60 via-purple-50/30 to-transparent',
      badgeClass: 'bg-purple-100/90 text-purple-800 border-purple-200',
      accentColor: 'text-purple-700',
      accentBg: 'bg-purple-50',
      accentBorder: 'border-purple-200',
      accentLine: 'border-l-purple-600',
      hoverBorder: 'hover:border-purple-300',
      menuIconClass: 'bg-purple-50/90 text-purple-700 border border-purple-200/80 group-hover:bg-purple-100 group-hover:border-purple-300',
      cardClass: COMMON_THEME.cardClass,
    };
  }

  if (isPj) {
    const label = roleCodes.includes('PJ_DAERAH')
      ? 'PJ Daerah'
      : roleCodes.includes('PJ_DESA')
        ? 'PJ Desa'
        : 'PJ Kelompok';
    return {
      roleKey: 'PJ',
      roleTitle: label,
      bgGradient: 'bg-role-pj',
      heroGradient: 'from-sky-200/60 via-sky-50/30 to-transparent',
      badgeClass: 'bg-blue-100/90 text-blue-800 border-blue-200',
      accentColor: 'text-blue-700',
      accentBg: 'bg-blue-50',
      accentBorder: 'border-blue-200',
      accentLine: 'border-l-blue-600',
      hoverBorder: 'hover:border-blue-300',
      menuIconClass: 'bg-blue-50/90 text-blue-700 border border-blue-200/80 group-hover:bg-blue-100 group-hover:border-blue-300',
      cardClass: COMMON_THEME.cardClass,
    };
  }

  if (isPengajar) {
    const isWali = roleCodes.includes('WALI_KELAS');
    return {
      roleKey: 'PENGAJAR',
      roleTitle: isWali ? 'Wali Kelas & Pengajar' : 'Pengajar / Ustadz',
      bgGradient: 'bg-role-pengajar',
      heroGradient: 'from-teal-200/60 via-teal-50/30 to-transparent',
      badgeClass: 'bg-teal-100/90 text-teal-800 border-teal-200',
      accentColor: 'text-teal-700',
      accentBg: 'bg-teal-50',
      accentBorder: 'border-teal-200',
      accentLine: 'border-l-teal-600',
      hoverBorder: 'hover:border-teal-300',
      menuIconClass: 'bg-teal-50/90 text-teal-700 border border-teal-200/80 group-hover:bg-teal-100 group-hover:border-teal-300',
      cardClass: COMMON_THEME.cardClass,
    };
  }

  if (isOrangTua) {
    return {
      roleKey: 'ORANG_TUA',
      roleTitle: 'Orang Tua / Wali Santri',
      bgGradient: 'bg-role-orang-tua',
      heroGradient: 'from-indigo-200/60 via-indigo-50/30 to-transparent',
      badgeClass: 'bg-indigo-100/90 text-indigo-800 border-indigo-200',
      accentColor: 'text-indigo-700',
      accentBg: 'bg-indigo-50',
      accentBorder: 'border-indigo-200',
      accentLine: 'border-l-indigo-600',
      hoverBorder: 'hover:border-indigo-300',
      menuIconClass: 'bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 group-hover:bg-indigo-100 group-hover:border-indigo-300',
      cardClass: COMMON_THEME.cardClass,
    };
  }

  // Default: Siswa / Santri (Campuran hijau pastel di atas dan putih di bagian bawah)
  return {
    roleKey: 'SANTRI',
    roleTitle: 'Santri / Siswa',
    bgGradient: 'bg-role-santri',
    heroGradient: 'from-emerald-200/60 via-emerald-50/30 to-transparent',
    badgeClass: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
    accentColor: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    accentLine: 'border-l-emerald-600',
    hoverBorder: 'hover:border-emerald-300',
    menuIconClass: 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 group-hover:bg-emerald-100 group-hover:border-emerald-300',
    cardClass: COMMON_THEME.cardClass,
  };
}

export interface RoleRollingTheme {
  roleTitle: string;
  buttonGradient: string;
  buttonShadow: string;
  buttonBorder: string;
  modalHeaderBadge: string;
  modalHeaderIconColor: string;
  modalHeaderIconBg: string;
  stepper4Bg: string;
  stepper4Border: string;
  stepper4Text: string;
  stepper4Badge: string;
  card4Gradient: string;
  card4Border: string;
  card4Shadow: string;
  card4Ring: string;
  card4IconBg: string;
  card4IconColor: string;
  card4Badge: string;
  card4Button: string;
  card4ButtonShadow: string;
  card4ButtonBorder: string;
}

export function getRoleRollingTheme(roleCodes: string[] = []): RoleRollingTheme {
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');

  if (isAdmin) {
    return {
      roleTitle: 'Admin Master',
      buttonGradient: 'from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500',
      buttonShadow: 'shadow-purple-700/25',
      buttonBorder: 'border-purple-400/40',
      modalHeaderBadge: 'bg-purple-50 text-purple-700 border border-purple-200',
      modalHeaderIconColor: 'text-purple-600',
      modalHeaderIconBg: 'from-purple-600 to-indigo-600',
      stepper4Bg: 'bg-purple-50',
      stepper4Border: 'border-purple-300',
      stepper4Text: 'text-purple-800',
      stepper4Badge: 'bg-purple-600 text-white',
      card4Gradient: 'from-purple-50/90 via-white to-indigo-50/60',
      card4Border: 'border-purple-400 hover:border-purple-500',
      card4Shadow: 'shadow-purple-500/10',
      card4Ring: 'ring-purple-400/20',
      card4IconBg: 'bg-gradient-to-br from-purple-600 to-indigo-600',
      card4IconColor: 'text-white',
      card4Badge: 'text-purple-700 bg-purple-100 border-purple-300',
      card4Button: 'from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white',
      card4ButtonShadow: 'shadow-purple-600/25',
      card4ButtonBorder: 'border-purple-500/30',
    };
  }

  if (isPj) {
    const label = roleCodes.includes('PJ_DAERAH')
      ? 'PJ Daerah'
      : roleCodes.includes('PJ_DESA')
        ? 'PJ Desa'
        : 'PJ Kelompok';
    return {
      roleTitle: label,
      buttonGradient: 'from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-sky-500',
      buttonShadow: 'shadow-blue-700/25',
      buttonBorder: 'border-blue-400/40',
      modalHeaderBadge: 'bg-blue-50 text-blue-700 border border-blue-200',
      modalHeaderIconColor: 'text-blue-600',
      modalHeaderIconBg: 'from-blue-600 to-sky-600',
      stepper4Bg: 'bg-blue-50',
      stepper4Border: 'border-blue-300',
      stepper4Text: 'text-blue-800',
      stepper4Badge: 'bg-blue-600 text-white',
      card4Gradient: 'from-blue-50/90 via-white to-sky-50/60',
      card4Border: 'border-blue-400 hover:border-blue-500',
      card4Shadow: 'shadow-blue-500/10',
      card4Ring: 'ring-blue-400/20',
      card4IconBg: 'bg-gradient-to-br from-blue-600 to-sky-600',
      card4IconColor: 'text-white',
      card4Badge: 'text-blue-700 bg-blue-100 border-blue-300',
      card4Button: 'from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-sky-500 text-white',
      card4ButtonShadow: 'shadow-blue-600/25',
      card4ButtonBorder: 'border-blue-500/30',
    };
  }

  if (isPengajar) {
    return {
      roleTitle: 'Pengajar',
      buttonGradient: 'from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-500 hover:to-emerald-500',
      buttonShadow: 'shadow-teal-700/25',
      buttonBorder: 'border-teal-400/40',
      modalHeaderBadge: 'bg-teal-50 text-teal-700 border border-teal-200',
      modalHeaderIconColor: 'text-teal-600',
      modalHeaderIconBg: 'from-teal-600 to-emerald-600',
      stepper4Bg: 'bg-teal-50',
      stepper4Border: 'border-teal-300',
      stepper4Text: 'text-teal-800',
      stepper4Badge: 'bg-teal-600 text-white',
      card4Gradient: 'from-teal-50/90 via-white to-emerald-50/60',
      card4Border: 'border-teal-400 hover:border-teal-500',
      card4Shadow: 'shadow-teal-500/10',
      card4Ring: 'ring-teal-400/20',
      card4IconBg: 'bg-gradient-to-br from-teal-600 to-emerald-600',
      card4IconColor: 'text-white',
      card4Badge: 'text-teal-700 bg-teal-100 border-teal-300',
      card4Button: 'from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white',
      card4ButtonShadow: 'shadow-teal-600/25',
      card4ButtonBorder: 'border-teal-500/30',
    };
  }

  return {
    roleTitle: 'Penanggung Jawab',
    buttonGradient: 'from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-sky-500',
    buttonShadow: 'shadow-blue-700/25',
    buttonBorder: 'border-blue-400/40',
    modalHeaderBadge: 'bg-blue-50 text-blue-700 border border-blue-200',
    modalHeaderIconColor: 'text-blue-600',
    modalHeaderIconBg: 'from-blue-600 to-sky-600',
    stepper4Bg: 'bg-blue-50',
    stepper4Border: 'border-blue-300',
    stepper4Text: 'text-blue-800',
    stepper4Badge: 'bg-blue-600 text-white',
    card4Gradient: 'from-blue-50/90 via-white to-sky-50/60',
    card4Border: 'border-blue-400 hover:border-blue-500',
    card4Shadow: 'shadow-blue-500/10',
    card4Ring: 'ring-blue-400/20',
    card4IconBg: 'bg-gradient-to-br from-blue-600 to-sky-600',
    card4IconColor: 'text-white',
    card4Badge: 'text-blue-700 bg-blue-100 border-blue-300',
    card4Button: 'from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-sky-500 text-white',
    card4ButtonShadow: 'shadow-blue-600/25',
    card4ButtonBorder: 'border-blue-500/30',
  };
}
