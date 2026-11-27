import type { RoleTabId, RoleTabItem } from '@/components/navigation/RoleNavTabs';

export type { RoleTabId, RoleTabItem };

export const ACTIVE_ROLE_COOKIE = 'sipanji_active_role';
export const ACTIVE_ROLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

/**
 * Daftar rute halaman yang memiliki tampilan terpisah per peran.
 * FloatingRoleSwitcher hanya tampil dan melakukan auto-peek 1 detik di rute-rute ini.
 */
export const ROLE_AWARE_ROUTES = [
  '/dashboard',
  '/jadwal',
  '/presensi',
  '/tugas',
  '/kurikulum',
  '/laporan',
  '/kelas',
] as const;

export interface GlobalRoleItem extends RoleTabItem {
  shortLabel: string;
}

export interface RoleCapabilityInput {
  roleCodes: string[];
  hasChildren?: boolean;
  hasHomeroomClasses?: boolean;
  hasScheduleAssignments?: boolean;
  generationId?: string | null;
  generationName?: string | null;
  organizationId?: string | null;
}

/**
 * Menormalkan string peran URL/cookie menjadi RoleTabId kanonik (`manage | teacher | parent | student`).
 */
export function normalizeRoleTabParam(raw?: string | null): RoleTabId | null {
  const val = (raw || '').trim().toLowerCase();
  if (
    val === 'manage' ||
    val === 'admin' ||
    val === 'admin_master' ||
    val === 'pj'
  ) {
    return 'manage';
  }
  if (
    val === 'teacher' ||
    val === 'pengajar' ||
    val === 'wali_kelas'
  ) {
    return 'teacher';
  }
  if (val === 'parent' || val === 'orang_tua' || val === 'wali') {
    return 'parent';
  }
  if (val === 'student' || val === 'santri') {
    return 'student';
  }
  return null;
}

/**
 * Memeriksa apakah pathname saat ini termasuk rute dengan tampilan khusus tiap peran.
 */
export function isRoleAwarePathname(pathname?: string | null): boolean {
  if (!pathname) return false;
  return ROLE_AWARE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Menyusun kapabilitas peran dan daftar item global role switcher secara konsisten (SSOT).
 */
export function buildGlobalRoleItems(input: RoleCapabilityInput): {
  items: GlobalRoleItem[];
  isManager: boolean;
  isAdmin: boolean;
  isPj: boolean;
  isTeacher: boolean;
  isParent: boolean;
  isSantri: boolean;
} {
  const {
    roleCodes,
    hasChildren = false,
    hasHomeroomClasses = false,
    hasScheduleAssignments = false,
    generationId,
    generationName,
    organizationId,
  } = input;

  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isPj = isPjDaerah || isPjDesa || isPjKelompok;
  const isManager = isAdmin || isPj;

  const isTeacher =
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    hasHomeroomClasses ||
    hasScheduleAssignments;

  const isParent = roleCodes.includes('ORANG_TUA') || hasChildren;

  const isSantri =
    roleCodes.includes('SANTRI') ||
    (Boolean(generationId) && Boolean(organizationId) && !isManager && !isTeacher);

  const items: GlobalRoleItem[] = [];

  if (isManager) {
    let badge = 'PJ Wilayah';
    let shortLabel = 'PJ Wilayah';
    if (isAdmin) {
      badge = 'Admin Master';
      shortLabel = 'Admin';
    } else if (isPjDaerah) {
      badge = 'PJ Daerah';
      shortLabel = 'PJ Daerah';
    } else if (isPjDesa) {
      badge = 'PJ Desa';
      shortLabel = 'PJ Desa';
    } else if (isPjKelompok) {
      badge = 'PJ Kelompok';
      shortLabel = 'PJ Kelompok';
    }

    items.push({
      id: 'manage',
      label: isAdmin ? 'Admin Master' : badge,
      shortLabel,
      roleTitle: isAdmin ? 'Admin Master Sistem' : badge,
      badge,
      subtitle: 'Tata kelola wilayah, jadwal, dan analitika',
      iconName: 'ShieldCheck',
      colorTheme: 'sky',
      href: '?role=manage',
    });
  }

  if (isTeacher) {
    const isWali = roleCodes.includes('WALI_KELAS') || hasHomeroomClasses;
    items.push({
      id: 'teacher',
      label: 'Pengajar',
      shortLabel: 'Pengajar',
      roleTitle: isWali ? 'Wali Kelas & Pengajar' : 'Pengajar / Ustadz',
      badge: isWali ? 'Wali Kelas' : 'Pengajar',
      subtitle: 'Kelas binaan, sesi QR presensi, & penilaian',
      iconName: 'GraduationCap',
      colorTheme: 'teal',
      href: '?role=teacher',
    });
  }

  if (isParent) {
    items.push({
      id: 'parent',
      label: 'Orang Tua',
      shortLabel: 'Orang Tua',
      roleTitle: 'Orang Tua / Wali Santri',
      badge: 'Orang Tua',
      subtitle: 'Pantau progres belajar & kehadiran ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: '?role=parent',
    });
  }

  if (isSantri) {
    items.push({
      id: 'student',
      label: 'Santri',
      shortLabel: 'Santri',
      roleTitle: 'Santri / Siswa',
      badge: generationName || 'Santri',
      subtitle: 'Jadwal mengaji, presensi QR, & target pribadi',
      iconName: 'School',
      colorTheme: 'emerald',
      href: '?role=student',
    });
  }

  return {
    items,
    isManager,
    isAdmin,
    isPj,
    isTeacher,
    isParent,
    isSantri,
  };
}

/**
 * Mengembalikan subset kode peran DB untuk tab peran aktif sehingga tema, header, dan BottomNav mengikuti role aktif.
 */
export function getScopedRoleCodesForTab(
  tabId: RoleTabId,
  allRoleCodes: string[]
): string[] {
  if (tabId === 'manage') {
    const manageRoles = allRoleCodes.filter((r) =>
      ['ADMIN_MASTER', 'PJ_DAERAH', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r)
    );
    return manageRoles.length > 0 ? manageRoles : allRoleCodes;
  }
  if (tabId === 'teacher') {
    const teacherRoles = allRoleCodes.filter((r) =>
      ['PENGAJAR', 'WALI_KELAS'].includes(r)
    );
    return teacherRoles.length > 0 ? teacherRoles : ['PENGAJAR'];
  }
  if (tabId === 'parent') {
    return ['ORANG_TUA'];
  }
  if (tabId === 'student') {
    return ['SANTRI'];
  }
  return allRoleCodes;
}
