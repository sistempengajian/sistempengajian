'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TOUCH_TARGET } from '@/lib/design-tokens';
import {
  ClipboardList,
  ClipboardCheck,
  CheckCircle2,
  Trophy,
  Award,
  Users,
  UserCheck,
  Calendar,
  GraduationCap,
  Shield,
  Inbox,
  Activity,
  X,
  Clock,
  MapPin,
  Sparkles,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { RoleTheme } from '@/lib/theme';
import { formatWibDate } from '@/lib/utils';
import ProgressCircle from './ProgressCircle';
import { calculateLevelInfo } from '@/app/(protected)/gamifikasi/types';

export interface StatusData {
  fullName: string;
  kelompokName?: string;
  generationName?: string;
  gamification?: {
    level: number;
    totalPoints: number;
    currentStreakDays: number;
    highestStreakDays?: number;
  } | null;
  childrenList?: Array<{
    id: string;
    fullName: string;
    generationName?: string;
    points?: number;
    relationshipType?: string;
    curriculumProgressPercent?: number;
    monthlyProgressPercent?: number;
    attendancePercentage?: number;
    attendanceHadir?: number;
    attendanceTotal?: number;
  }>;
  homeroomClassesCount?: number;
  teacherMonthlySessionsCount?: number;
  teacherPendingGradingsCount?: number;
  pendingApprovalsCount?: number;
  dbHealth?: string;
  nextScheduleTitle?: string;
  nextScheduleTime?: string;
  nextScheduleVenue?: string;
  hafalanProgressPercent?: number;
  monthlyProgressPercent?: number;
  monthlyProgressCompleted?: number;
  monthlyProgressTotal?: number;
  monthlyAttendancePercent?: number;
  monthlyAttendanceHadir?: number;
  monthlyAttendanceTotal?: number;
  monthLabel?: string;
  recentPassedMaterials?: Array<{ title: string; isCompleted: boolean }>;
  alpaCount?: number;
  badgesList?: Array<{ name: string; category?: string }>;
  pendingTasksCount?: number;
  pendingTasksList?: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    pointsReward: number;
  }>;
}

interface StatusGridSectionProps {
  roleKey: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' | 'ADMIN_MASTER';
  theme: RoleTheme;
  data: StatusData;
}

interface StatusItem {
  id: string;
  title: string;
  metricValue: string;
  metricClass?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconGradientClass: string;
  iconGlowShadow: string;
  modalTitle: string;
  modalBadge: string;
}

export default function StatusGridSection({
  roleKey,
  theme,
  data,
}: StatusGridSectionProps) {
  const [activeModalId, setActiveModalId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const modalPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useFocusTrap(Boolean(activeModalId) && mounted, modalPanelRef, () => setActiveModalId(null));

  // Isolate floating BottomNav/PWA banner behind modal
  useEffect(() => {
    if (activeModalId) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [activeModalId]);

  // Determine the 3 status items with live metric values based on active role
  const getStatusItems = (): StatusItem[] => {
    if (roleKey === 'SANTRI') {
      const pendingTasks = data.pendingTasksCount ?? 0;
      const hasPendingTasks = pendingTasks > 0;
      const currentStreak = data.gamification?.currentStreakDays ?? 0;
      const highestStreak = data.gamification?.highestStreakDays ?? 0;
      const totalPoints = data.gamification?.totalPoints ?? 0;
      const levelInfo = calculateLevelInfo(totalPoints);
      const displayLevel = data.gamification?.level || levelInfo.level;

      return [
        {
          id: 'tugas',
          title: 'Tugas',
          metricValue: hasPendingTasks ? `${pendingTasks} Tugas` : '0 Tugas',
          metricClass: hasPendingTasks ? 'text-rose-700' : 'text-emerald-700',
          icon: hasPendingTasks ? ClipboardList : ClipboardCheck,
          iconGradientClass: hasPendingTasks
            ? 'from-rose-500 to-pink-600'
            : 'from-emerald-500 to-teal-600',
          iconGlowShadow: hasPendingTasks
            ? '0 4px 10px -2px rgba(244, 63, 94, 0.38)'
            : '0 4px 10px -2px rgba(16, 185, 129, 0.38)',
          modalTitle: 'Daftar Tugas & Pembiasaan Santri',
          modalBadge: hasPendingTasks ? `${pendingTasks} Belum Dikerjakan` : 'Semua Tuntas',
        },
        {
          id: 'streak',
          title: 'Streak',
          metricValue: `${currentStreak} Hari`,
          metricClass: currentStreak > 0 ? 'text-orange-700' : 'text-slate-700',
          icon: Flame,
          iconGradientClass: 'from-amber-400 to-orange-500',
          iconGlowShadow: '0 4px 10px -2px rgba(245, 158, 11, 0.38)',
          modalTitle: 'Konsistensi & Streak Kehadiran',
          modalBadge: highestStreak > 0 ? `Terbaik ${highestStreak} Hari` : 'Mulai Streak',
        },
        {
          id: 'prestasi',
          title: 'Prestasi',
          metricValue: `Lv.${displayLevel}`,
          metricClass: 'text-indigo-700',
          icon: Trophy,
          iconGradientClass: 'from-violet-500 to-indigo-600',
          iconGlowShadow: '0 4px 10px -2px rgba(99, 102, 241, 0.38)',
          modalTitle: 'Detail Prestasi & Level Gamifikasi',
          modalBadge: `${totalPoints} XP`,
        },
      ];
    }

    if (roleKey === 'PENGAJAR') {
      const shortScheduleDate = data.nextScheduleTime
        ? data.nextScheduleTime.split(' • ')[0]
        : 'Kosong';
      const pendingGradings = data.teacherPendingGradingsCount ?? 0;
      const monthlySessions = data.teacherMonthlySessionsCount ?? 0;
      return [
        {
          id: 'halaqah',
          title: 'Halaqah',
          metricValue: `${data.homeroomClassesCount ?? 0} Kelas`,
          metricClass: 'text-teal-700',
          icon: Users,
          iconGradientClass: 'from-teal-500 to-emerald-600',
          iconGlowShadow: '0 4px 10px -2px rgba(20, 184, 166, 0.36)',
          modalTitle: 'Detail Halaqah & Kelas Binaan',
          modalBadge:
            (data.homeroomClassesCount ?? 0) > 0 ? 'Wali Kelas' : 'Pengajar',
        },
        {
          id: 'keaktifan_guru',
          title: pendingGradings > 0 ? 'Koreksi' : 'Sesi Bln',
          metricValue:
            pendingGradings > 0
              ? `${pendingGradings} Tugas`
              : `${monthlySessions} Sesi`,
          metricClass: pendingGradings > 0 ? 'text-amber-700' : 'text-emerald-700',
          icon: UserCheck,
          iconGradientClass:
            pendingGradings > 0
              ? 'from-amber-400 to-orange-500'
              : 'from-emerald-500 to-teal-600',
          iconGlowShadow:
            pendingGradings > 0
              ? '0 4px 10px -2px rgba(245, 158, 11, 0.36)'
              : '0 4px 10px -2px rgba(16, 185, 129, 0.36)',
          modalTitle: 'Ringkasan Jadwal Mengajar & Antrean Koreksi',
          modalBadge: `${monthlySessions} Sesi Bulan Ini`,
        },
        {
          id: 'jadwal_pekan_ini',
          title: 'Jadwal',
          metricValue: shortScheduleDate,
          metricClass: 'text-sky-700',
          icon: Calendar,
          iconGradientClass: 'from-sky-500 to-blue-600',
          iconGlowShadow: '0 4px 10px -2px rgba(14, 165, 233, 0.36)',
          modalTitle: 'Sesi Pengajian Terjadwal Terdekat',
          modalBadge: data.nextScheduleTime ? 'Terjadwal' : 'Kosong',
        },
      ];
    }

    if (roleKey === 'ORANG_TUA') {
      const children = data.childrenList || [];
      const childProgressList = children
        .map((c) => c.curriculumProgressPercent)
        .filter((v): v is number => typeof v === 'number');
      const avgProgress =
        childProgressList.length > 0
          ? Math.round(
              childProgressList.reduce((acc, v) => acc + v, 0) /
                childProgressList.length
            )
          : 0;

      const totalChildHadir = children.reduce(
        (acc, c) => acc + (c.attendanceHadir ?? 0),
        0
      );
      const totalChildSessions = children.reduce(
        (acc, c) => acc + (c.attendanceTotal ?? 0),
        0
      );
      const avgAttendance =
        totalChildSessions > 0
          ? Math.round((totalChildHadir / totalChildSessions) * 100)
          : 0;

      return [
        {
          id: 'ananda',
          title: 'Ananda',
          metricValue: `${children.length} Anak`,
          metricClass: 'text-indigo-700',
          icon: Users,
          iconGradientClass: 'from-indigo-500 to-blue-600',
          iconGlowShadow: '0 4px 10px -2px rgba(99, 102, 241, 0.36)',
          modalTitle: 'Daftar Ananda dalam Binaan',
          modalBadge: `${children.length} Terhubung`,
        },
        {
          id: 'keaktifan_ananda',
          title: 'Hadir',
          metricValue: totalChildSessions > 0 ? `${avgAttendance}%` : '0 Sesi',
          metricClass: 'text-emerald-700',
          icon: CheckCircle2,
          iconGradientClass: 'from-emerald-500 to-teal-600',
          iconGlowShadow: '0 4px 10px -2px rgba(16, 185, 129, 0.36)',
          modalTitle: 'Rekap Kehadiran Ananda Bulan Ini (Sesi Terlaksana)',
          modalBadge:
            totalChildSessions > 0
              ? `${totalChildHadir}/${totalChildSessions} Sesi`
              : 'Belum Ada Sesi',
        },
        {
          id: 'progres_belajar',
          title: 'Jenjang',
          metricValue: `${avgProgress}%`,
          metricClass: 'text-purple-700',
          icon: GraduationCap,
          iconGradientClass: 'from-violet-500 to-purple-600',
          iconGlowShadow: '0 4px 10px -2px rgba(139, 92, 246, 0.36)',
          modalTitle: 'Progres Pembelajaran & Rapor Digital',
          modalBadge: 'Rata-rata Ananda',
        },
      ];
    }

    // Default: PJ & ADMIN
    const pendingCount = data.pendingApprovalsCount || 0;
    const isDbNormal = (data.dbHealth || 'Normal') === 'Normal';
    return [
      {
        id: 'wilayah',
        title: 'Wilayah',
        metricValue:
          data.kelompokName ||
          (roleKey === 'ADMIN_MASTER' ? 'Terpusat' : 'Binaan'),
        metricClass: 'text-blue-700',
        icon: Shield,
        iconGradientClass: 'from-blue-500 to-indigo-600',
        iconGlowShadow: '0 4px 10px -2px rgba(59, 130, 246, 0.36)',
        modalTitle: 'Metrik & Tata Kelola Wilayah',
        modalBadge: 'Otoritas Wilayah',
      },
      {
        id: 'approval',
        title: 'Approval',
        metricValue: `${pendingCount} Pending`,
        metricClass: pendingCount > 0 ? 'text-rose-700' : 'text-slate-900',
        icon: Inbox,
        iconGradientClass: 'from-rose-500 to-pink-600',
        iconGlowShadow: '0 4px 10px -2px rgba(244, 63, 94, 0.36)',
        modalTitle: 'Antrean Verifikasi Jadwal Private & Remedial',
        modalBadge: `${pendingCount} Menunggu`,
      },
      {
        id: 'sistem',
        title: 'Sistem',
        metricValue: data.dbHealth || 'Normal',
        metricClass: isDbNormal ? 'text-emerald-700' : 'text-rose-700',
        icon: Activity,
        iconGradientClass: isDbNormal
          ? 'from-emerald-500 to-teal-600'
          : 'from-rose-500 to-red-600',
        iconGlowShadow: isDbNormal
          ? '0 4px 10px -2px rgba(16, 185, 129, 0.36)'
          : '0 4px 10px -2px rgba(244, 63, 94, 0.36)',
        modalTitle: 'Integritas & Status Basis Data',
        modalBadge: isDbNormal ? 'Koneksi Sehat' : 'Perlu Pemeriksaan',
      },
    ];
  };

  const statusItems = getStatusItems();
  const activeItem = statusItems.find((item) => item.id === activeModalId);

  return (
    <>
      {/* 2. Slim Glassmorphism Status Bar: Mengambang dengan ikon gradien menonjol */}
      <section className="rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 p-1.5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-3 divide-x divide-slate-200/50">
          {statusItems.map((item) => {
            const IconComp = item.icon;
            const hideLabelVisually = roleKey === 'SANTRI';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModalId(item.id)}
                className={`group flex flex-col items-center justify-center px-1.5 sm:px-2.5 rounded-xl text-center transition-all duration-150 hover:bg-white/60 active:scale-[0.97] cursor-pointer min-w-0 ${
                  hideLabelVisually ? 'py-1.5 min-h-[44px]' : 'py-2 min-h-[54px]'
                }`}
                title={`Buka detail ${item.title}`}
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 max-w-full min-w-0">
                  <div
                    className={`relative overflow-hidden w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br ${item.iconGradientClass} text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
                    style={{ boxShadow: item.iconGlowShadow }}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-xl"
                      style={{
                        background:
                          'radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 64%)',
                        boxShadow:
                          'inset 0 1.5px 2px rgba(255, 255, 255, 0.45), inset 0 -2px 4px rgba(15, 23, 42, 0.16)',
                      }}
                    />
                    <IconComp className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.25]" />
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-extrabold tracking-tight leading-none tabular-nums truncate ${
                      item.metricClass || 'text-slate-900'
                    }`}
                  >
                    {item.metricValue}
                  </span>
                </div>

                <span
                  className={
                    hideLabelVisually
                      ? 'sr-only'
                      : 'mt-1 text-[11px] font-semibold text-slate-500 group-hover:text-slate-800 transition-colors leading-none truncate max-w-full'
                  }
                >
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Detail Modal Dialog — Bottom Sheet di Mobile, Centered Modal di Desktop (Portal ke document.body) */}
      {mounted && activeModalId && activeItem && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
          className="!mt-0 fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/45 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveModalId(null)}
        >
          <div
            ref={modalPanelRef}
            className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 relative text-left max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden flex justify-center -mt-2 mb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeItem.iconGradientClass} text-white flex items-center justify-center shrink-0`}
                  style={{ boxShadow: activeItem.iconGlowShadow }}
                >
                  <activeItem.icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="status-modal-title"
                      className="text-base font-bold text-slate-900 leading-tight"
                    >
                      {activeItem.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                      {activeItem.modalBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeItem.modalTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup dialog"
                aria-label="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Detail Content per Item */}
            <div className="space-y-3 py-1">
              {/* Santri: Tugas Aktif / Belum Dikerjakan */}
              {activeModalId === 'tugas' && (() => {
                const pendingCount = data.pendingTasksCount ?? 0;
                const pendingList = data.pendingTasksList ?? [];
                return (
                  <div className="space-y-3 text-xs">
                    <div
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        pendingCount > 0
                          ? 'bg-rose-50/70 border-rose-100'
                          : 'bg-emerald-50/70 border-emerald-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {pendingCount > 0
                            ? `${pendingCount} Tugas Belum Dikerjakan`
                            : 'Semua Tugas Sudah Tuntas'}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {pendingCount > 0
                            ? 'Segera kerjakan dan kirimkan tugas sebelum tenggat waktu berakhir.'
                            : 'Kerja bagus! Tidak ada tugas tertunda saat ini.'}
                        </p>
                      </div>
                      {pendingCount > 0 ? (
                        <ClipboardList className="w-6 h-6 text-rose-500 shrink-0" />
                      ) : (
                        <ClipboardCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                      )}
                    </div>

                    {pendingList.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-800 text-xs block">
                          Antrean Tugas Terdekat:
                        </span>
                        {pendingList.map((task) => (
                          <Link
                            key={task.id}
                            href={`/tugas/${encodeURIComponent(task.id)}`}
                            onClick={() => setActiveModalId(null)}
                            className="p-2.5 rounded-xl border border-slate-200/75 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">
                                {task.title}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {task.dueDate
                                  ? `Tenggat ${formatWibDate(task.dueDate, {
                                      day: 'numeric',
                                      month: 'short',
                                    })}`
                                  : 'Tanpa tenggat waktu'}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0">
                              +{task.pointsReward} XP
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <Link
                      href="/tugas?role=student"
                      onClick={() => setActiveModalId(null)}
                      className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                    >
                      <span>Buka Daftar Tugas</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })()}

              {/* Santri: Streak Hadir */}
              {activeModalId === 'streak' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-100">
                      <div className="text-base sm:text-lg font-bold text-orange-700">
                        {data.gamification?.currentStreakDays ?? 0} Hari
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Streak Aktif</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                      <div className="text-base sm:text-lg font-bold text-amber-800">
                        {data.gamification?.highestStreakDays ?? 0} Hari
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Rekor Terbaik</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <div className="text-base sm:text-lg font-bold text-slate-800">{data.alpaCount ?? 0}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Alpa Bulan Ini</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-orange-500" />
                      <span>Jaga Konsistensi Mengaji</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {(data.monthlyAttendanceTotal ?? 0) > 0
                        ? `Tercatat ${data.monthlyAttendanceHadir ?? 0} hadir dari ${data.monthlyAttendanceTotal ?? 0} sesi pengajian bulan ${data.monthLabel || 'ini'}.`
                        : 'Hadir tepat waktu pada sesi pengajian berikutnya untuk menjaga streak tetap menyala.'}
                    </p>
                  </div>

                  <Link
                    href="/laporan?role=student"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Lihat Rapor Kehadiran</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Santri: Prestasi */}
              {activeModalId === 'prestasi' && (() => {
                const totalPoints = data.gamification?.totalPoints ?? 0;
                const levelInfo = calculateLevelInfo(totalPoints);
                const displayLevel = data.gamification?.level || levelInfo.level;
                return (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          Lv.{displayLevel}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {totalPoints} Poin Gamifikasi
                          </div>
                          <div className="text-xs text-indigo-800 font-medium mt-0.5">
                            Tingkat: {levelInfo.levelTitle}
                          </div>
                        </div>
                      </div>
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-bold text-slate-800 text-xs block">Lencana Penghargaan:</span>
                      <div className="grid grid-cols-2 gap-2">
                        {data.badgesList && data.badgesList.length > 0 ? (
                          data.badgesList.map((b, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl border border-slate-200/70 bg-white flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="font-medium text-slate-800 truncate">{b.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-2 p-2.5 rounded-xl border border-slate-200/70 bg-white text-center text-slate-500">
                            Belum ada lencana terbuka. Hadir rutin &amp; selesaikan misi untuk mengumpulkan lencana.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/gamifikasi"
                        onClick={() => setActiveModalId(null)}
                        className={`${TOUCH_TARGET.minButton} py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-xs text-center truncate`}
                      >
                        <span>Misi &amp; Trofi</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>

                      <Link
                        href="/leaderboard"
                        onClick={() => setActiveModalId(null)}
                        className={`${TOUCH_TARGET.minButton} py-2.5 px-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-xs text-center truncate`}
                      >
                        <span>Leaderboard</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })()}

              {/* Pengajar: Halaqah */}
              {activeModalId === 'halaqah' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {data.homeroomClassesCount ?? 0} Kelas Binaan Aktif
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {(data.homeroomClassesCount ?? 0) > 0
                        ? 'Bertanggung jawab memonitor kehadiran, evaluasi hafalan, serta jurnal penilaian santri di halaqah masing-masing.'
                        : 'Belum ada kelas binaan yang ditugaskan kepada Anda. Hubungi pengurus wilayah untuk penugasan wali kelas.'}
                    </p>
                  </div>
                  <Link
                    href="/kurikulum?role=teacher"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Buka Jurnal Nilai &amp; Santri</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Pengajar: Ringkasan Aktivitas & Koreksi */}
              {activeModalId === 'keaktifan_guru' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
                      <div className="text-lg font-bold text-amber-800">
                        {data.teacherPendingGradingsCount ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Tugas Menunggu Koreksi</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-100">
                      <div className="text-lg font-bold text-teal-800">
                        {data.teacherMonthlySessionsCount ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Sesi Mengajar Bulan Ini</div>
                    </div>
                  </div>

                  <Link
                    href="/tugas?role=teacher"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Buka Antrean Koreksi Tugas</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Pengajar: Jadwal Terdekat */}
              {activeModalId === 'jadwal_pekan_ini' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-1.5">
                    <div className="font-bold text-slate-900">
                      {data.nextScheduleTitle || 'Belum Ada Jadwal Aktif Terdekat'}
                    </div>
                    {data.nextScheduleTime && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{data.nextScheduleTime}</span>
                      </div>
                    )}
                    {data.nextScheduleVenue && (
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{data.nextScheduleVenue}</span>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/jadwal?role=teacher"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Buka Kalender Pengajian</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Orang Tua: Ananda Binaan */}
              {activeModalId === 'ananda' && (
                <div className="space-y-3 text-xs">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.childrenList && data.childrenList.length > 0 ? (
                      data.childrenList.map((child) => (
                        <div
                          key={child.id}
                          className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{child.fullName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {child.generationName || 'Santri'} • Jenjang {child.curriculumProgressPercent ?? 0}% • Bulan ini {child.monthlyProgressPercent ?? 0}%
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                            {child.attendanceTotal
                              ? `${child.attendancePercentage ?? 0}% Hadir`
                              : '0 Sesi'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-4">Belum ada data ananda binaan.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Orang Tua: Kehadiran Ananda Bulan Ini */}
              {activeModalId === 'keaktifan_ananda' && (
                <div className="space-y-3 text-xs">
                  {data.childrenList && data.childrenList.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {data.childrenList.map((child) => (
                        <div
                          key={child.id}
                          className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{child.fullName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {child.attendanceTotal
                                ? `${child.attendanceHadir ?? 0} hadir dari ${child.attendanceTotal} sesi terlaksana bulan ini`
                                : 'Belum ada sesi terlaksana bulan ini'}
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-emerald-700 shrink-0">
                            {child.attendanceTotal ? `${child.attendancePercentage ?? 0}%` : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-center text-slate-500">
                      Belum ada data kehadiran ananda.
                    </div>
                  )}
                  <Link
                    href="/presensi?role=parent"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Pantau Presensi &amp; Izin</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Orang Tua: Progres Belajar */}
              {activeModalId === 'progres_belajar' && (
                <div className="space-y-3 text-xs">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.childrenList && data.childrenList.length > 0 ? (
                      data.childrenList.map((child) => (
                        <div
                          key={child.id}
                          className="p-3 rounded-xl border border-purple-100 bg-purple-50/40 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{child.fullName}</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Jenjang {child.curriculumProgressPercent ?? 0}% • Target bulan ini {child.monthlyProgressPercent ?? 0}%
                            </div>
                          </div>
                          <ProgressCircle percentage={child.curriculumProgressPercent ?? 0} size={38} />
                        </div>
                      ))
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-center text-slate-600">
                        Belum ada data capaian belajar ananda.
                      </div>
                    )}
                  </div>
                  <Link
                    href="/laporan?role=parent"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Lihat Rapor Capaian Anak</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* PJ / Admin: Wilayah */}
              {activeModalId === 'wilayah' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">{theme.roleTitle}</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Memonitor pelaksanaan kurikulum berjenjang, presensi jamaah, dan koordinasi antar dewan guru wilayah.
                    </p>
                  </div>
                </div>
              )}

              {/* PJ / Admin: Approval */}
              {activeModalId === 'approval' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {data.pendingApprovalsCount || 0} Pengajuan Menunggu
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pengajuan pengajian private remedial dari pengajar memerlukan verifikasi dan persetujuan pengurus.
                    </p>
                  </div>
                  <Link
                    href="/private-remedial"
                    onClick={() => setActiveModalId(null)}
                    className={`w-full ${TOUCH_TARGET.minButton} py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs`}
                  >
                    <span>Buka Antrean Approval</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* PJ / Admin: Sistem */}
              {activeModalId === 'sistem' && (() => {
                const isDbNormal = (data.dbHealth || 'Normal') === 'Normal';
                return (
                  <div className="space-y-3 text-xs">
                    <div
                      className={`p-3.5 rounded-2xl border space-y-1.5 ${
                        isDbNormal
                          ? 'bg-emerald-50/70 border-emerald-100'
                          : 'bg-rose-50/70 border-rose-100'
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-sm">
                        {isDbNormal
                          ? 'Basis Data Beroperasi Normal'
                          : 'Terdeteksi Gangguan Koneksi Basis Data'}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {isDbNormal
                          ? 'Pemeriksaan koneksi PostgreSQL pada permintaan ini berhasil dan merespons normal.'
                          : 'Pemeriksaan koneksi basis data gagal merespons. Periksa konektivitas server atau log aplikasi.'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
