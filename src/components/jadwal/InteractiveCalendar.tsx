'use client';

import React, { useState, useTransition, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  CalendarDays,
  List,
  Search,
  SlidersHorizontal,
  CalendarCheck,
  X,
} from 'lucide-react';
import { TierLevel } from '@prisma/client';
import { deleteSchedule } from '@/app/(protected)/jadwal/actions';
import ScheduleCard, { ScheduleItem } from './ScheduleCard';
import JadwalFilterSheet from './JadwalFilterSheet';
import SessionListSheet from './SessionListSheet';
import {
  CALENDAR_ACCENT_MAP,
  EMPTY_JADWAL_FILTERS,
  JadwalFilterState,
  applyScheduleFilters,
  countActiveFilters,
} from './jadwalFilterUtils';
import { getRoleRollingTheme, getRoleTheme, type RoleTheme } from '@/lib/theme';

const ScheduleFormModal = dynamic(() => import('./ScheduleFormModal'), {
  ssr: false,
});
const RollingScheduleGeneratorModal = dynamic(
  () => import('./rolling-jadwal/RollingScheduleGeneratorModal'),
  { ssr: false }
);
const RollingWorkflowModal = dynamic(
  () => import('./rolling-jadwal/RollingWorkflowModal'),
  { ssr: false }
);
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

export interface AvailableTeacher {
  id: string;
  fullName: string;
}

export interface AvailableClass {
  id: string;
  name: string;
  tierLevel: TierLevel;
  organizationId?: string;
  generation?: {
    name: string;
  } | null;
}

export interface AvailableMaterial {
  id: string;
  title: string;
  targetGeneration?: {
    id?: string;
    name: string;
  } | null;
}

export interface AvailableGeneration {
  id: string;
  name: string;
  code: string;
  color?: string | null;
}

export interface ScopedOrganization {
  id: string;
  name: string;
  type: TierLevel;
  parentId?: string | null;
}

interface InteractiveCalendarProps {
  schedules: ScheduleItem[];
  availableTeachers?: AvailableTeacher[];
  availableClasses?: AvailableClass[];
  availableMaterials?: AvailableMaterial[];
  availableGenerations?: AvailableGeneration[];
  scopedOrganizations?: ScopedOrganization[];
  currentUserOrgId?: string | null;
  canManage?: boolean;
  canPropose?: boolean;
  currentUserId?: string | null;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  roleCodes?: string[];
  activeRole?: 'manage' | 'teacher' | 'parent' | 'student';
  theme?: RoleTheme;
}

const AGENDA_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

interface FloatingCreateScheduleFabProps {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  hidden: boolean;
  canManage: boolean;
  buttonClassName: string;
  onClick: () => void;
}

/**
 * Tombol FAB mobile terisolasi agar IntersectionObserver saat scroll
 * tidak memicu re-render daftar kalender atau ratusan kartu Agenda.
 */
const FloatingCreateScheduleFab = React.memo(function FloatingCreateScheduleFab({
  anchorRef,
  hidden,
  canManage,
  buttonClassName,
  onClick,
}: FloatingCreateScheduleFabProps) {
  const [isScrolledPast, setIsScrolledPast] = useState(false);

  useEffect(() => {
    const target = anchorRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = !entry.isIntersecting && entry.boundingClientRect.top < 80;
        setIsScrolledPast((prev) => (prev === nextVisible ? prev : nextVisible));
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [anchorRef]);

  const visible = isScrolledPast && !hidden;

  return (
    <div
      aria-hidden={!visible}
      className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom)+var(--pwa-banner-clearance,0px))] right-4 sm:hidden z-30 transition-[transform,opacity] duration-200 ease-out will-change-transform ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <button
        type="button"
        tabIndex={visible ? 0 : -1}
        onClick={onClick}
        className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 ${buttonClassName} text-white rounded-2xl font-bold text-xs shadow-lg border active:scale-95 transition-transform cursor-pointer`}
      >
        <Plus className="w-4 h-4" />
        <span>{canManage ? 'Buat Jadwal' : 'Ajukan Jadwal'}</span>
      </button>
    </div>
  );
});

export default function InteractiveCalendar({
  schedules = [],
  availableTeachers = [],
  availableClasses = [],
  availableMaterials = [],
  availableGenerations = [],
  scopedOrganizations = [],
  currentUserOrgId = null,
  canManage = false,
  canPropose = false,
  currentUserId = null,
  userTierLevel,
  roleCodes = [],
  activeRole,
  theme,
}: InteractiveCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSessionSheetExpanded, setIsSessionSheetExpanded] = useState(false);

  const resolvedTheme = theme || getRoleTheme(roleCodes);
  const accent = CALENDAR_ACCENT_MAP[resolvedTheme.roleKey] || CALENDAR_ACCENT_MAP.PENGAJAR;
  const rollingTheme = getRoleRollingTheme(roleCodes);

  // Filter States (Multi-select bergaya Shopee)
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<JadwalFilterState>(EMPTY_JADWAL_FILTERS);

  // Modal & Mobile FAB Anchor States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<ScheduleItem | null>(null);
  const [isRollingWorkflowOpen, setIsRollingWorkflowOpen] = useState(false);
  const [isRollingModalOpen, setIsRollingModalOpen] = useState(false);
  const topActionsRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { open: openConfirm, ConfirmModalComponent } = useConfirm();

  // Prefetch sub-halaman rolling agar saat user mengklik menu atau tombol, transisi instan
  useEffect(() => {
    if (canManage) {
      router.prefetch('/jadwal/rolling-materi');
      router.prefetch('/jadwal/rolling-pengajar');
      router.prefetch('/jadwal/rolling-pengajian');
      router.prefetch('/jadwal/rolling-jadwal');
    }
  }, [canManage, router]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonthThisMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const hasHomeroomSchedules = useMemo(() => {
    if (!currentUserId) return false;
    return schedules.some((sch) => {
      const isUserTeaching = sch.teachers?.some((t) => t.teacher?.id === currentUserId);
      const isUserHomeroom =
        !isUserTeaching &&
        Boolean(
          sch.class?.homeroomTeacherId === currentUserId ||
            sch.targetClasses?.some((tc) => tc.class.homeroomTeacherId === currentUserId)
        );
      return isUserHomeroom;
    });
  }, [schedules, currentUserId]);

  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedFilters, hasHomeroomSchedules),
    [appliedFilters, hasHomeroomSchedules]
  );

  // Filtered schedules berdasarkan search & multi-select filter (OR dalam jenis, AND lintas jenis)
  const filteredSchedules = useMemo(
    () =>
      applyScheduleFilters(
        schedules,
        searchQuery,
        appliedFilters,
        currentUserId,
        hasHomeroomSchedules
      ),
    [schedules, searchQuery, appliedFilters, currentUserId, hasHomeroomSchedules]
  );

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    filteredSchedules.forEach((sch) => {
      const d = new Date(sch.startTime);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const existing = map.get(dateKey) || [];
      existing.push(sch);
      map.set(dateKey, existing);
    });
    return map;
  }, [filteredSchedules]);

  const selectedDateKey = `${year}-${month + 1}-${selectedDay}`;
  const selectedDaySchedules = scheduleMap.get(selectedDateKey) || [];

  const agendaGrouped = useMemo(() => {
    const sorted = [...filteredSchedules].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const groups: { dateKey: string; dateObj: Date; items: ScheduleItem[] }[] = [];
    sorted.forEach((sch) => {
      const d = new Date(sch.startTime);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      let group = groups.find((g) => g.dateKey === key);
      if (!group) {
        group = { dateKey: key, dateObj: d, items: [] };
        groups.push(group);
      }
      group.items.push(sch);
    });
    return groups;
  }, [filteredSchedules]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(1);
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.getDate());
  };

  const handleShiftSelectedDay = (deltaDays: -1 | 1) => {
    const nextDate = new Date(year, month, selectedDay + deltaDays);
    setCurrentDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setSelectedDay(nextDate.getDate());
  };

  const handleOpenCreateModal = useCallback((specificDay?: number) => {
    setScheduleToEdit(null);
    if (specificDay) {
      setSelectedDay(specificDay);
    }
    setIsModalOpen(true);
  }, []);

  const handleOpenCreateForSelectedDay = useCallback(() => {
    setScheduleToEdit(null);
    setIsModalOpen(true);
  }, []);

  const handleOpenCreateDefault = useCallback(() => {
    handleOpenCreateModal();
  }, [handleOpenCreateModal]);

  const handleOpenEditModal = useCallback((schedule: ScheduleItem) => {
    setScheduleToEdit(schedule);
    setIsModalOpen(true);
  }, []);

  const handleOpenFilterModal = useCallback(() => {
    setIsFilterSheetOpen(true);
  }, []);

  const handleDeleteSchedule = useCallback(
    (scheduleId: string) => {
      openConfirm(
        {
          title: 'Hapus Jadwal Pengajian?',
          description: 'Apakah Anda yakin ingin menghapus jadwal pengajian ini?',
          variant: 'danger',
          confirmText: 'Ya, Hapus',
        },
        async () => {
          startTransition(async () => {
            const res = await deleteSchedule(scheduleId);
            if (res.error) {
              toastRef.current.error(res.error);
            }
          });
        }
      );
    },
    [openConfirm]
  );

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const activeSelectedDate = new Date(year, month, selectedDay);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Baris Kontrol Atas: Kapsul Toggle Terpisah + Card Pencarian & Pemicu Modal Filter */}
      <div
        ref={topActionsRef}
        className="flex flex-col md:flex-row md:items-center gap-2"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Kapsul Toggle Terpisah: Ikon ringkas di Mobile, berlabel di sm:+ */}
          <div
            role="group"
            aria-label="Mode Tampilan Jadwal"
            className="inline-flex items-center gap-0.5 p-1 rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_8px_22px_-8px_rgba(15,23,42,0.08)] shrink-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              aria-pressed={viewMode === 'calendar'}
              aria-label="Tampilan Kalender"
              title="Kalender"
              className={`w-9 h-9 sm:w-auto sm:h-9 sm:px-3 flex items-center justify-center sm:gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                viewMode === 'calendar'
                  ? `border shadow-2xs ${accent.softPill}`
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Kalender</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSessionSheetExpanded(false);
                setViewMode('agenda');
              }}
              aria-pressed={viewMode === 'agenda'}
              aria-label={
                filteredSchedules.length > 0
                  ? `Tampilan Agenda (${filteredSchedules.length} sesi)`
                  : 'Tampilan Agenda'
              }
              title="Agenda"
              className={`relative w-9 h-9 sm:w-auto sm:h-9 sm:px-3 flex items-center justify-center sm:gap-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                viewMode === 'agenda'
                  ? `border shadow-2xs ${accent.softPill}`
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <List className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Agenda</span>
              {filteredSchedules.length > 0 && (
                <>
                  <span
                    aria-hidden="true"
                    className={`sm:hidden absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                      viewMode === 'agenda' ? accent.dotScheduled : 'bg-slate-400'
                    }`}
                  />
                  <span
                    className={`hidden sm:inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none shrink-0 ${accent.countBadge}`}
                  >
                    {filteredSchedules.length}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Card Pencarian + Tombol Pemicu Filter Bottom Sheet */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 p-1 rounded-2xl bg-white/85 backdrop-blur-md border border-white/90 shadow-[0_8px_22px_-8px_rgba(15,23,42,0.08)]">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari jadwal, ustadz, kelas..."
                className={`w-full min-h-[38px] pl-8 sm:pl-9 pr-8 py-1.5 text-xs bg-slate-50/75 border border-transparent rounded-xl focus:bg-white focus:border-slate-200 focus:outline-none focus:ring-2 ${accent.ringFocus} text-slate-800 font-medium placeholder:text-slate-400`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center absolute right-0.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFilterSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isFilterSheetOpen}
              aria-label={
                activeFilterCount > 0
                  ? `Buka filter jadwal (${activeFilterCount} filter aktif)`
                  : 'Buka filter jadwal'
              }
              title="Filter Jadwal"
              className={`min-h-[38px] min-w-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
                activeFilterCount > 0
                  ? `px-2.5 sm:px-3 ${accent.softPill}`
                  : 'px-2.5 sm:px-3 bg-slate-50/90 hover:bg-slate-100 text-slate-700 border-slate-200/80'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${accent.countBadge}`}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tombol Aksi (khusus Pengajar / PJ / Admin) */}
        {(canManage || canPropose) && (
          <div className="grid grid-cols-2 md:flex items-center gap-2 shrink-0 w-full md:w-auto">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsRollingWorkflowOpen(true)}
                className={`min-h-[40px] sm:min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 bg-gradient-to-r ${rollingTheme.buttonGradient} text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${rollingTheme.buttonShadow} border ${rollingTheme.buttonBorder} cursor-pointer shrink-0`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">Rolling</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className={`min-h-[40px] sm:min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 ${accent.buttonPrimary} text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm border cursor-pointer shrink-0 ${!canManage ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">{canManage ? 'Buat Jadwal' : 'Ajukan Jadwal'}</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: KALENDER BULANAN (BERDIRI SENDIRI) + PANEL SESI TERPISAH DI BAWAHNYA */}
      {viewMode === 'calendar' && (
        <div className="space-y-3.5 sm:space-y-4">
          <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-white/90 p-4 sm:p-5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.09)] space-y-3.5">
          {/* Calendar Header: Bulan, Tahun, dan Tombol Navigasi */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {monthNames[month]} {year}
              </h3>
              {!isCurrentMonthThisMonth && (
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className={`min-h-[34px] text-xs font-bold border px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${accent.softPill}`}
                >
                  Hari Ini
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 transition-all active:scale-95 shadow-2xs cursor-pointer"
                title="Bulan sebelumnya"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] flex items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 transition-all active:scale-95 shadow-2xs cursor-pointer"
                title="Bulan berikutnya"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 py-1 border-b border-slate-200/60">
            <div>Min</div>
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} className="h-11 sm:h-12" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayKey = `${year}-${month + 1}-${day}`;
              const daySchedules = scheduleMap.get(dayKey) || [];
              const hasSchedules = daySchedules.length > 0;
              const isSelected = day === selectedDay;

              const isToday =
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day;

              const hasBadal = daySchedules.some((s) =>
                s.teachers.some((t) => t.isSubstitute)
              );
              const hasActive = daySchedules.some((s) => s.status === 'ACTIVE');
              const hasCancelled = daySchedules.some((s) => s.status === 'CANCELLED');

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`h-11 sm:h-12 rounded-xl relative flex items-center justify-center p-1 transition-all text-xs font-semibold cursor-pointer active:scale-95 select-none ${
                    isSelected
                      ? accent.selectedDay
                      : isToday
                        ? accent.todayDay
                        : hasSchedules
                          ? accent.scheduledDay
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <div className="relative inline-flex items-center justify-center">
                    <span className="text-sm font-semibold leading-none px-1 tabular-nums">{day}</span>

                    {hasSchedules && (
                      <div className="absolute -top-[4px] -right-[1px] translate-x-[2px] flex items-center pointer-events-none">
                        {hasActive ? (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-white" />
                          </span>
                        ) : hasBadal ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-amber-300 ring-2 ring-slate-900/20' : 'bg-amber-500 ring-2 ring-white'
                            }`}
                            title="Ada pengajar badal"
                          />
                        ) : hasCancelled ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-rose-300 ring-2 ring-slate-900/20' : 'bg-rose-500 ring-2 ring-white'
                            }`}
                            title="Sesi diliburkan"
                          />
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? accent.dotRingSelected : `${accent.dotScheduled} ring-2 ring-white`
                            }`}
                            title="Ada sesi pengajian"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 1-Line Mini Legend Status Titik Kalender */}
          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 pt-0.5 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${accent.dotScheduled}`} />
              <span>Terjadwal</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Berlangsung</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Badal</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Libur</span>
            </span>
          </div>
        </div>

        {/* Panel Sesi Terpisah (Bisa Ditarik ke Atas Menutup Layar) */}
        <SessionListSheet
          selectedDate={activeSelectedDate}
          schedules={selectedDaySchedules}
          activeFilterCount={activeFilterCount}
          searchQuery={searchQuery}
          canManage={canManage}
          canPropose={canPropose}
          currentUserId={currentUserId}
          availableTeachers={availableTeachers}
          activeRole={activeRole}
          roleKey={resolvedTheme.roleKey}
          accent={accent}
          isExpanded={isSessionSheetExpanded}
          onExpandedChange={setIsSessionSheetExpanded}
          onShiftDay={handleShiftSelectedDay}
          onOpenCreateModal={handleOpenCreateForSelectedDay}
          onOpenFilterSheet={handleOpenFilterModal}
          onEditSchedule={handleOpenEditModal}
          onDeleteSchedule={handleDeleteSchedule}
          hasOverlayAbove={
            isFilterSheetOpen ||
            isModalOpen ||
            isRollingWorkflowOpen ||
            isRollingModalOpen
          }
        />
      </div>
      )}

      {/* VIEW 2: AGENDA SESI */}
      {viewMode === 'agenda' && (
        <div className="space-y-3.5">
          {agendaGrouped.map((group) => {
            const isToday =
              today.getFullYear() === group.dateObj.getFullYear() &&
              today.getMonth() === group.dateObj.getMonth() &&
              today.getDate() === group.dateObj.getDate();

            return (
              <div
                key={group.dateKey}
                className="rounded-3xl bg-white/95 border border-white/90 p-4 sm:p-5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.08)] space-y-3"
              >
                {/* Header Tanggal Agenda */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border ${
                        isToday
                          ? accent.selectedDay.replace('scale-[1.02]', '')
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {group.dateObj.getDate()}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                      {AGENDA_DATE_FORMATTER.format(group.dateObj)}
                    </h4>
                  </div>

                  {isToday && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${accent.softPill}`}
                    >
                      Hari Ini
                    </span>
                  )}
                </div>

                {/* Sesi-sesi pada tanggal ini */}
                <div className="space-y-3">
                  {group.items.map((sch) => (
                    <ScheduleCard
                      key={sch.id}
                      schedule={sch}
                      canManage={canManage}
                      canPropose={canPropose}
                      currentUserId={currentUserId}
                      availableTeachers={availableTeachers}
                      activeRole={activeRole}
                      roleKey={resolvedTheme.roleKey}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteSchedule}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {agendaGrouped.length === 0 && (
            <div className="text-center py-12 px-4 text-xs text-slate-500 bg-white/85 backdrop-blur-md rounded-3xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center gap-2">
              <CalendarCheck className="w-8 h-8 text-slate-400" />
              <span className="font-bold text-sm text-slate-700">
                Tidak ada jadwal sesi pengajian ditemukan
              </span>
              <span className="text-xs text-slate-500 max-w-sm">
                Coba sesuaikan filter pencarian atau {canManage ? 'buat jadwal sesi pengajian baru' : 'ajukan jadwal sesi pengajian baru'}.
              </span>
              {(canManage || canPropose) && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal()}
                  className={`mt-2 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 ${accent.buttonPrimary} text-white rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 shadow-xs`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{canManage ? 'Buat Jadwal Baru' : 'Ajukan Jadwal'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button (FAB) Terisolasi untuk Mobile */}
      {(canManage || canPropose) && (
        <FloatingCreateScheduleFab
          anchorRef={topActionsRef}
          hidden={
            isSessionSheetExpanded ||
            isFilterSheetOpen ||
            isModalOpen ||
            isRollingWorkflowOpen ||
            isRollingModalOpen
          }
          canManage={canManage}
          buttonClassName={accent.buttonPrimary}
          onClick={handleOpenCreateDefault}
        />
      )}

      {/* Modal Bottom Sheet Filter Multi-Select Gaya Shopee */}
      <JadwalFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        schedules={schedules}
        searchQuery={searchQuery}
        appliedFilters={appliedFilters}
        onApplyFilters={setAppliedFilters}
        hasHomeroomSchedules={hasHomeroomSchedules}
        currentUserId={currentUserId}
        accent={accent}
      />

      {/* Modal Alur 4 Tahap Rolling Jadwal (Full Screen) */}
      {isRollingWorkflowOpen && (
        <RollingWorkflowModal
          isOpen={isRollingWorkflowOpen}
          onClose={() => setIsRollingWorkflowOpen(false)}
          onOpenGenerator={() => setIsRollingModalOpen(true)}
          roleCodes={roleCodes}
        />
      )}

      {/* Modal Form Tambah / Edit Jadwal */}
      {isModalOpen && (
        <ScheduleFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setScheduleToEdit(null);
          }}
          scheduleToEdit={scheduleToEdit}
          isProposalMode={!canManage && canPropose}
          availableTeachers={availableTeachers}
          availableClasses={availableClasses}
          availableMaterials={availableMaterials}
          availableGenerations={availableGenerations}
          scopedOrganizations={scopedOrganizations}
          currentUserOrgId={currentUserOrgId}
          userTierLevel={userTierLevel}
          roleCodes={roleCodes}
          defaultDate={activeSelectedDate}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Modal Generator Jadwal Rolling */}
      {isRollingModalOpen && (
        <RollingScheduleGeneratorModal
          isOpen={isRollingModalOpen}
          onClose={() => setIsRollingModalOpen(false)}
          onSuccess={() => setIsRollingModalOpen(false)}
          roleCodes={roleCodes}
        />
      )}

      {ConfirmModalComponent()}
    </div>
  );
}
