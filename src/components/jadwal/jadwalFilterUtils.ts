import { ScheduleStatus, TierLevel } from '@prisma/client';
import type { RoleTheme } from '@/lib/theme';
import type { ScheduleItem } from './ScheduleCard';

export type StatusFilterValue = 'PENDING' | ScheduleStatus;
export type RoleScopeFilterValue = 'TEACHING' | 'HOMEROOM';

export interface JadwalFilterState {
  tiers: TierLevel[];
  statuses: StatusFilterValue[];
  roleScopes: RoleScopeFilterValue[];
}

export const EMPTY_JADWAL_FILTERS: JadwalFilterState = {
  tiers: [],
  statuses: [],
  roleScopes: [],
};

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
}

export const TIER_FILTER_OPTIONS: readonly FilterChipOption<TierLevel>[] = [
  { value: 'KELOMPOK', label: 'Kelompok' },
  { value: 'DESA', label: 'Desa' },
  { value: 'DAERAH', label: 'Daerah' },
];

export const STATUS_FILTER_OPTIONS: readonly FilterChipOption<StatusFilterValue>[] = [
  { value: 'SCHEDULED', label: 'Terjadwal' },
  { value: 'ACTIVE', label: 'Berlangsung' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Diliburkan' },
  { value: 'PENDING', label: 'Menunggu Persetujuan' },
];

export const ROLE_SCOPE_FILTER_OPTIONS: readonly FilterChipOption<RoleScopeFilterValue>[] = [
  { value: 'TEACHING', label: 'Sesi Mengajar' },
  { value: 'HOMEROOM', label: 'Sesi Kelas Binaan' },
];

export interface CalendarAccentTokens {
  selectedDay: string;
  todayDay: string;
  scheduledDay: string;
  countBadge: string;
  buttonPrimary: string;
  softPill: string;
  selectedChip: string;
  chipCheckBg: string;
  iconText: string;
  dotScheduled: string;
  dotRingSelected: string;
  ringFocus: string;
  sheetHeaderTint: string;
}

export const CALENDAR_ACCENT_MAP: Record<RoleTheme['roleKey'], CalendarAccentTokens> = {
  SANTRI: {
    selectedDay: 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50 font-bold scale-[1.02]',
    todayDay: 'bg-emerald-50 text-emerald-900 border-2 border-emerald-500 font-bold hover:bg-emerald-100/70',
    scheduledDay: 'bg-emerald-50/75 text-slate-800 hover:bg-emerald-100/80 border border-emerald-300/60',
    countBadge: 'bg-emerald-100 text-emerald-800',
    buttonPrimary: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-700/20 border-emerald-500/40',
    softPill: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/70',
    selectedChip: 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-1 ring-emerald-400/40',
    chipCheckBg: 'bg-emerald-600 text-white',
    iconText: 'text-emerald-600',
    dotScheduled: 'bg-emerald-600',
    dotRingSelected: 'bg-emerald-200 ring-2 ring-emerald-700',
    ringFocus: 'focus:ring-emerald-500/20',
    sheetHeaderTint: 'from-emerald-50/80 via-white to-white',
  },
  PENGAJAR: {
    selectedDay: 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400/50 font-bold scale-[1.02]',
    todayDay: 'bg-teal-50 text-teal-900 border-2 border-teal-500 font-bold hover:bg-teal-100/70',
    scheduledDay: 'bg-teal-50/75 text-slate-800 hover:bg-teal-100/80 border border-teal-300/60',
    countBadge: 'bg-teal-100 text-teal-800',
    buttonPrimary: 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 shadow-teal-700/20 border-teal-500/40',
    softPill: 'text-teal-700 bg-teal-50 hover:bg-teal-100 border-teal-200/70',
    selectedChip: 'bg-teal-50 text-teal-900 border-teal-500 ring-1 ring-teal-400/40',
    chipCheckBg: 'bg-teal-600 text-white',
    iconText: 'text-teal-600',
    dotScheduled: 'bg-teal-600',
    dotRingSelected: 'bg-teal-200 ring-2 ring-teal-700',
    ringFocus: 'focus:ring-teal-500/20',
    sheetHeaderTint: 'from-teal-50/80 via-white to-white',
  },
  ORANG_TUA: {
    selectedDay: 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/50 font-bold scale-[1.02]',
    todayDay: 'bg-indigo-50 text-indigo-900 border-2 border-indigo-500 font-bold hover:bg-indigo-100/70',
    scheduledDay: 'bg-indigo-50/75 text-slate-800 hover:bg-indigo-100/80 border border-indigo-200/80',
    countBadge: 'bg-indigo-100 text-indigo-800',
    buttonPrimary: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-700/20 border-indigo-500/40',
    softPill: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/70',
    selectedChip: 'bg-indigo-50 text-indigo-900 border-indigo-500 ring-1 ring-indigo-400/40',
    chipCheckBg: 'bg-indigo-600 text-white',
    iconText: 'text-indigo-600',
    dotScheduled: 'bg-indigo-600',
    dotRingSelected: 'bg-indigo-200 ring-2 ring-indigo-700',
    ringFocus: 'focus:ring-indigo-500/20',
    sheetHeaderTint: 'from-indigo-50/80 via-white to-white',
  },
  PJ: {
    selectedDay: 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/50 font-bold scale-[1.02]',
    todayDay: 'bg-sky-50 text-blue-900 border-2 border-blue-500 font-bold hover:bg-sky-100/70',
    scheduledDay: 'bg-sky-50/75 text-slate-800 hover:bg-sky-100/80 border border-sky-200/80',
    countBadge: 'bg-blue-100 text-blue-800',
    buttonPrimary: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-700/20 border-blue-500/40',
    softPill: 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200/70',
    selectedChip: 'bg-sky-50 text-blue-900 border-blue-500 ring-1 ring-blue-400/40',
    chipCheckBg: 'bg-blue-600 text-white',
    iconText: 'text-blue-600',
    dotScheduled: 'bg-blue-600',
    dotRingSelected: 'bg-sky-200 ring-2 ring-blue-700',
    ringFocus: 'focus:ring-blue-500/20',
    sheetHeaderTint: 'from-sky-50/80 via-white to-white',
  },
  ADMIN_MASTER: {
    selectedDay: 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400/50 font-bold scale-[1.02]',
    todayDay: 'bg-purple-50 text-purple-900 border-2 border-purple-500 font-bold hover:bg-purple-100/70',
    scheduledDay: 'bg-purple-50/75 text-slate-800 hover:bg-purple-100/80 border border-purple-200/80',
    countBadge: 'bg-purple-100 text-purple-800',
    buttonPrimary: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-700/20 border-purple-500/40',
    softPill: 'text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200/70',
    selectedChip: 'bg-purple-50 text-purple-900 border-purple-500 ring-1 ring-purple-400/40',
    chipCheckBg: 'bg-purple-600 text-white',
    iconText: 'text-purple-600',
    dotScheduled: 'bg-purple-600',
    dotRingSelected: 'bg-purple-200 ring-2 ring-purple-700',
    ringFocus: 'focus:ring-purple-500/20',
    sheetHeaderTint: 'from-purple-50/80 via-white to-white',
  },
};

export function cloneFilterState(filters: JadwalFilterState): JadwalFilterState {
  return {
    tiers: [...filters.tiers],
    statuses: [...filters.statuses],
    roleScopes: [...filters.roleScopes],
  };
}

export function toggleFilterChip<T extends string>(items: readonly T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function countActiveFilters(
  filters: JadwalFilterState,
  hasHomeroomSchedules: boolean
): number {
  return (
    filters.tiers.length +
    filters.statuses.length +
    (hasHomeroomSchedules ? filters.roleScopes.length : 0)
  );
}

/**
 * Menyaring daftar jadwal dengan logika:
 * - OR di dalam 1 jenis filter (mis. Kelompok atau Desa)
 * - AND lintas jenis filter (Tingkat DAN Status DAN Peran Sesi)
 */
export function applyScheduleFilters(
  schedules: ScheduleItem[],
  searchQuery: string,
  filters: JadwalFilterState,
  currentUserId?: string | null,
  hasHomeroomSchedules = false
): ScheduleItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return schedules.filter((sch) => {
    if (normalizedQuery) {
      const teacherMatch = sch.teachers?.some((t) =>
        t.teacher?.fullName.toLowerCase().includes(normalizedQuery)
      );
      const titleMatch = sch.title.toLowerCase().includes(normalizedQuery);
      const venueMatch = sch.venuePlaceName.toLowerCase().includes(normalizedQuery);
      const classMatch = sch.class?.name.toLowerCase().includes(normalizedQuery) || false;
      const studentMatch = sch.connectedStudents?.some((s) =>
        s.fullName.toLowerCase().includes(normalizedQuery)
      );
      const targetClassMatch = sch.targetClasses?.some((tc) =>
        tc.class.name.toLowerCase().includes(normalizedQuery)
      );

      if (
        !titleMatch &&
        !venueMatch &&
        !teacherMatch &&
        !classMatch &&
        !studentMatch &&
        !targetClassMatch
      ) {
        return false;
      }
    }

    if (filters.tiers.length > 0 && !filters.tiers.includes(sch.tierLevel)) {
      return false;
    }

    if (filters.statuses.length > 0) {
      const matchesAnyStatus = filters.statuses.some((statusKey) =>
        statusKey === 'PENDING' ? sch.approvalStatus === 'PENDING' : sch.status === statusKey
      );
      if (!matchesAnyStatus) {
        return false;
      }
    }

    if (hasHomeroomSchedules && filters.roleScopes.length > 0 && currentUserId) {
      const isUserTeaching = Boolean(
        sch.teachers?.some((t) => t.teacher?.id === currentUserId)
      );
      const isUserHomeroom =
        !isUserTeaching &&
        Boolean(
          sch.class?.homeroomTeacherId === currentUserId ||
            sch.targetClasses?.some((tc) => tc.class.homeroomTeacherId === currentUserId)
        );

      const matchesRoleScope = filters.roleScopes.some(
        (scope) =>
          (scope === 'TEACHING' && isUserTeaching) ||
          (scope === 'HOMEROOM' && isUserHomeroom)
      );
      if (!matchesRoleScope) {
        return false;
      }
    }

    return true;
  });
}
