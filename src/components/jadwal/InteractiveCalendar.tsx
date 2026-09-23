'use client';

import React, { useState, useTransition, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Users,
  Sparkles,
  UserCheck,
  AlertCircle,
  Plus,
  CalendarDays,
  List,
  Search,
  Filter,
  CheckCircle2,
  CalendarCheck,
  Building2,
  X,
  Layers,
  History,
  ArrowUpRight,
} from 'lucide-react';
import { ScheduleStatus, ScheduleType, TierLevel } from '@prisma/client';
import { deleteSchedule } from '@/app/(protected)/jadwal/actions';
import ScheduleCard, { ScheduleItem } from './ScheduleCard';
import ScheduleFormModal from './ScheduleFormModal';
import RollingScheduleGeneratorModal from './rolling-jadwal/RollingScheduleGeneratorModal';
import RollingWorkflowModal from './rolling-jadwal/RollingWorkflowModal';
import { getRoleRollingTheme } from '@/lib/theme';

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
}

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
}: InteractiveCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');

  const rollingTheme = getRoleRollingTheme(roleCodes);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'ALL' | TierLevel>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PENDING' | ScheduleStatus>('ALL');
  const [selectedRoleScopeFilter, setSelectedRoleScopeFilter] = useState<'ALL' | 'TEACHING' | 'HOMEROOM'>('ALL');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<ScheduleItem | null>(null);
  const [isRollingWorkflowOpen, setIsRollingWorkflowOpen] = useState(false);
  const [isRollingModalOpen, setIsRollingModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  // Filtered schedules berdasarkan search, tier, status
  const filteredSchedules = useMemo(() => {
    return schedules.filter((sch) => {
      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const primary = sch.teachers?.find((t) => t.isPrimary)?.teacher.fullName.toLowerCase() || '';
        const substitute = sch.teachers?.find((t) => t.isSubstitute)?.teacher.fullName.toLowerCase() || '';
        const title = sch.title.toLowerCase();
        const venue = sch.venuePlaceName.toLowerCase();
        const cls = sch.class?.name.toLowerCase() || '';
        const studentMatch = sch.connectedStudents?.some((s) => s.fullName.toLowerCase().includes(q));
        const targetClassMatch = sch.targetClasses?.some((tc) => tc.class.name.toLowerCase().includes(q));

        if (
          !title.includes(q) &&
          !venue.includes(q) &&
          !primary.includes(q) &&
          !substitute.includes(q) &&
          !cls.includes(q) &&
          !studentMatch &&
          !targetClassMatch
        ) {
          return false;
        }
      }

      // Filter tier
      if (selectedTierFilter !== 'ALL' && sch.tierLevel !== selectedTierFilter) {
        return false;
      }

      // Filter status
      if (selectedStatusFilter === 'PENDING') {
        if (sch.approvalStatus !== 'PENDING') {
          return false;
        }
      } else if (selectedStatusFilter !== 'ALL') {
        if (sch.status !== selectedStatusFilter) {
          return false;
        }
      }

      // Filter role scope (Mengajar vs Kelas Binaan)
      if (selectedRoleScopeFilter !== 'ALL' && currentUserId) {
        const isUserTeaching = sch.teachers?.some((t) => t.teacher?.id === currentUserId);
        const isUserHomeroom = !isUserTeaching && Boolean(
          sch.class?.homeroomTeacherId === currentUserId ||
          sch.targetClasses?.some((tc) => tc.class.homeroomTeacherId === currentUserId)
        );

        if (selectedRoleScopeFilter === 'TEACHING' && !isUserTeaching) {
          return false;
        }
        if (selectedRoleScopeFilter === 'HOMEROOM' && !isUserHomeroom) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, searchQuery, selectedTierFilter, selectedStatusFilter, selectedRoleScopeFilter, currentUserId]);

  // Cek apakah ada jadwal yang berstatus kelas binaan untuk user saat ini
  const hasHomeroomSchedules = useMemo(() => {
    if (!currentUserId) return false;
    return schedules.some((sch) => {
      const isUserTeaching = sch.teachers?.some((t) => t.teacher?.id === currentUserId);
      const isUserHomeroom = !isUserTeaching && Boolean(
        sch.class?.homeroomTeacherId === currentUserId ||
        sch.targetClasses?.some((tc) => tc.class.homeroomTeacherId === currentUserId)
      );
      return isUserHomeroom;
    });
  }, [schedules, currentUserId]);

  // Map schedules ke "YYYY-M-D"
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

  // Sesi pada tanggal yang dipilih
  const selectedDateKey = `${year}-${month + 1}-${selectedDay}`;
  const selectedDaySchedules = scheduleMap.get(selectedDateKey) || [];

  // Pengelompokan kronologis untuk Mode Agenda
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

  const handleOpenCreateModal = (specificDay?: number) => {
    setScheduleToEdit(null);
    if (specificDay) {
      setSelectedDay(specificDay);
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (schedule: ScheduleItem) => {
    setScheduleToEdit(schedule);
    setIsModalOpen(true);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal pengajian ini?')) return;
    startTransition(async () => {
      const res = await deleteSchedule(scheduleId);
      if (res.error) {
        alert(res.error);
      }
    });
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const activeSelectedDate = new Date(year, month, selectedDay);

  return (
    <div className="space-y-4">
      {/* Top Bar: Navigasi View Mode & Tombol Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/70 p-3 sm:p-4 shadow-2xs">
        {/* Toggle Mode: Kalender vs Agenda */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'calendar'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Kalender</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'agenda'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Agenda Sesi</span>
            {filteredSchedules.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">
                {filteredSchedules.length}
              </span>
            )}
          </button>
        </div>

        {/* Tombol Aksi: Rolling Jadwal (PJ) & Buat / Ajukan Jadwal Baru */}
        {(canManage || canPropose) && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {canManage && (
              <button
                type="button"
                onClick={() => setIsRollingWorkflowOpen(true)}
                className={`inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r ${rollingTheme.buttonGradient} text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm ${rollingTheme.buttonShadow} border ${rollingTheme.buttonBorder} cursor-pointer shrink-0`}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Rolling Jadwal</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-teal-700/20 border border-teal-500/40 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{canManage ? 'Buat Jadwal Baru' : 'Ajukan Jadwal'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/70 p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul materi, ustadz, masjid, atau kelas..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* Filter Tingkat */}
            <select
              value={selectedTierFilter}
              onChange={(e) => setSelectedTierFilter(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium shrink-0"
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="KELOMPOK">Kelompok</option>
              <option value="DESA">Desa</option>
              <option value="DAERAH">Daerah</option>
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50/70 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium shrink-0"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Menunggu Persetujuan</option>
              <option value="SCHEDULED">Terjadwal</option>
              <option value="ACTIVE">Berlangsung</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Diliburkan</option>
            </select>

            {/* Filter Peran Sesi (Tampil jika ada jadwal kelas binaan di samping jadwal mengajar) */}
            {hasHomeroomSchedules && (
              <select
                value={selectedRoleScopeFilter}
                onChange={(e) => setSelectedRoleScopeFilter(e.target.value as any)}
                className="px-3 py-2 text-xs bg-teal-50/70 border border-teal-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-teal-900 font-semibold shrink-0"
              >
                <option value="ALL">Semua Sesi</option>
                <option value="TEACHING">Sesi Mengajar</option>
                <option value="HOMEROOM">Sesi Kelas Binaan</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: KALENDER BULANAN */}
      {viewMode === 'calendar' && (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-2xs space-y-4">
          {/* Calendar Header: Bulan, Tahun, dan Tombol Navigasi */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {monthNames[month]} {year}
              </h3>
              {!isCurrentMonthThisMonth && (
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                >
                  Hari Ini
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 transition-all active:scale-95 shadow-2xs cursor-pointer"
                title="Bulan sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-600 transition-all active:scale-95 shadow-2xs cursor-pointer"
                title="Bulan berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-bold text-slate-400 py-1 border-b border-slate-200/40">
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
            {/* Blank leading days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`blank-${i}`} className="h-11 sm:h-13" />
            ))}

            {/* Days of current month */}
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
                  className={`h-11 sm:h-13 rounded-xl relative flex items-center justify-center p-1 transition-all text-xs font-semibold cursor-pointer active:scale-95 select-none ${isSelected
                    ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400/50 font-bold scale-[1.02]'
                    : isToday
                      ? 'bg-teal-50 text-teal-900 border-2 border-teal-500 font-bold hover:bg-teal-100/70'
                      : hasSchedules
                        ? 'bg-emerald-50/70 text-slate-800 hover:bg-emerald-100/80 border border-emerald-300/60'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                >
                  {/* Container relatif baru untuk membungkus Angka & Indikator agar posisinya selalu dekat */}
                  <div className="relative inline-flex items-center justify-center">
                    <span className="text-[14px] sm:text-sm font-semibold leading-none px-1">{day}</span>

                    {/* Indikator Titik Status Sesi (Tepat di atas angka tanggal sebelah kanan) */}
                    {hasSchedules && (
                      <div className="absolute -top-[4px] -right-[0px] translate-x-[2px] -translate-y-[0.5px] flex items-center pointer-events-none">
                        {hasActive ? (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-1.5 ring-white" />
                          </span>
                        ) : hasBadal ? (
                          <span
                            className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-300 ring-1.5 ring-teal-700' : 'bg-amber-500 ring-1.5 ring-white'
                              }`}
                            title="Ada pengajar badal"
                          />
                        ) : hasCancelled ? (
                          <span
                            className={`w-1 h-1 rounded-full ${isSelected ? 'bg-rose-300 ring-1.5 ring-teal-700' : 'bg-rose-500 ring-1.5 ring-white'
                              }`}
                            title="Sesi diliburkan"
                          />
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-teal-200 ring-1.5 ring-teal-700' : 'bg-teal-600 ring-1.5 ring-white'
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

          {/* Panel Sesi Tanggal Terpilih */}
          <div className="pt-4 border-t border-slate-200/60 space-y-3">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-start gap-2 ">
                <Clock className="w-4 h-4 text-teal-600" />
                <h4 className="text-[14px] sm:text-b font-bold text-slate-900">
                  Jadwal Sesi:{' '}
                  {activeSelectedDate.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h4>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                  {selectedDaySchedules.length} Sesi
                </span>

                {(canManage || canPropose) && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(selectedDay)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/70 px-2.5 py-1 rounded-lg transition-all cursor-pointer active:scale-95 "
                  >
                    <Plus className="w-3 h-3" />
                    {canManage ? 'Tambah Sesi' : 'Ajukan Sesi'}
                  </button>
                )}
              </div>
            </div>

            {/* List ScheduleCard */}
            {selectedDaySchedules.map((sch) => (
              <ScheduleCard
                key={sch.id}
                schedule={sch}
                canManage={canManage}
                canPropose={canPropose}
                currentUserId={currentUserId}
                availableTeachers={availableTeachers}
                activeRole={activeRole}
                onEdit={handleOpenEditModal}
                onDelete={handleDeleteSchedule}
              />
            ))}

            {selectedDaySchedules.length === 0 && (
              <div className="text-center py-8 px-4 text-xs text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center gap-2">
                <CalendarCheck className="w-6 h-6 text-slate-300" />
                <span className="font-semibold text-slate-700">
                  Tidak ada jadwal sesi pengajian pada tanggal ini
                </span>
                <span className="text-[11px] text-slate-400 max-w-sm">
                  Pilih tanggal lain di kalender atau {canManage ? 'buat sesi pengajian baru' : 'ajukan sesi pengajian baru'} untuk tanggal ini.
                </span>
                {(canManage || canPropose) && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(selectedDay)}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{canManage ? 'Buat Jadwal Sesi' : 'Ajukan Jadwal Sesi'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )
      }

      {/* VIEW 2: AGENDA SESI (LIST VIEW - IDEAL UNTUK MOBILE) */}
      {
        viewMode === 'agenda' && (
          <div className="space-y-4">
            {agendaGrouped.map((group) => {
              const isToday =
                today.getFullYear() === group.dateObj.getFullYear() &&
                today.getMonth() === group.dateObj.getMonth() &&
                today.getDate() === group.dateObj.getDate();

              return (
                <div
                  key={group.dateKey}
                  className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-2xs space-y-3"
                >
                  {/* Header Tanggal Agenda */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold border ${isToday
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                      >
                        {group.dateObj.getDate()}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                          {group.dateObj.toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </h4>
                      </div>
                    </div>

                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-800 border border-teal-500/30">
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
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteSchedule}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {agendaGrouped.length === 0 && (
              <div className="text-center py-12 px-4 text-xs text-slate-500 bg-white/70 backdrop-blur-md rounded-2xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center gap-2">
                <CalendarCheck className="w-8 h-8 text-slate-300" />
                <span className="font-bold text-sm text-slate-700">
                  Tidak ada jadwal sesi pengajian ditemukan
                </span>
                <span className="text-xs text-slate-400 max-w-sm">
                  Coba sesuaikan filter pencarian atau {canManage ? 'buat jadwal sesi pengajian baru' : 'ajukan jadwal sesi pengajian baru'}.
                </span>
                {(canManage || canPropose) && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{canManage ? '+ Buat Jadwal Baru' : '+ Ajukan Jadwal'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      }

      {/* Floating Action Button (FAB) untuk Mobile */}
      {
        (canManage || canPropose) && (
          <div className="fixed bottom-5 right-5 sm:hidden z-30 flex flex-col gap-2 items-end">
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-teal-900/20 ring-2 ring-teal-400/40 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{canManage ? '+ Buat Jadwal Baru' : '+ Ajukan Jadwal'}</span>
            </button>
          </div>
        )
      }

      {/* Modal Alur 4 Tahap Rolling Jadwal (Full Screen) */}
      <RollingWorkflowModal
        isOpen={isRollingWorkflowOpen}
        onClose={() => setIsRollingWorkflowOpen(false)}
        onOpenGenerator={() => setIsRollingModalOpen(true)}
        roleCodes={roleCodes}
      />

      {/* Modal Form Tambah / Edit Jadwal */}
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

      {/* Modal Generator Jadwal Rolling */}
      <RollingScheduleGeneratorModal
        isOpen={isRollingModalOpen}
        onClose={() => setIsRollingModalOpen(false)}
        onSuccess={() => setIsRollingModalOpen(false)}
        roleCodes={roleCodes}
      />
    </div >
  );
}
