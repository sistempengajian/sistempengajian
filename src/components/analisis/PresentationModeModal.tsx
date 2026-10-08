'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Trophy,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  UserCheck,
  TrendingUp,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Layers,
  Award,
  Users,
  Flame,
  CheckCheck,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  MessageSquareQuote,
  Target,
} from 'lucide-react';
import { AnalyticsDashboardData } from '@/app/(protected)/analisis/types';

interface PresentationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AnalyticsDashboardData;
  isPrivacyMode: boolean;
  onTogglePrivacyMode: () => void;
}

export const PresentationModeModal: React.FC<PresentationModeModalProps> = ({
  isOpen,
  onClose,
  data,
  isPrivacyMode,
  onTogglePrivacyMode,
}) => {
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const totalSlides = 7;

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onTogglePrivacyMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, onTogglePrivacyMode]);

  // Sync fullscreen change event
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (!isOpen) return null;

  // Mask name helper
  const formatName = (name: string) => {
    if (!isPrivacyMode) return name;
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 3) + '***';
    return `${parts[0]} ${parts.slice(1).map((p) => p[0] + '***').join(' ')}`;
  };

  const {
    summary,
    scopeInfo,
    attendanceTrends,
    curriculumCategories,
    characterRadar,
    benchmarkComparison,
    topPerformers,
    atRiskStudents,
    parentEngagement,
  } = data;

  const slideTitles = [
    'Ringkasan Eksekutif & KPI',
    'Dinamika Tren Presensi',
    'Penguasaan Kurikulum',
    'Evaluasi 5 Dimensi Karakter',
    'Komparasi Benchmark Unit',
    'Keterlibatan Orang Tua',
    'Kohort & Rencana Tindak Lanjut',
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-md select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 shadow-xs backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>MODE RAPAT MUSYAWARAH</span>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700 font-semibold border border-teal-200/70">
                16:9 Full View
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md">
              {scopeInfo.name} • {scopeInfo.periodLabel} ({scopeInfo.dateRangeLabel})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Privacy Toggle */}
          <button
            type="button"
            onClick={onTogglePrivacyMode}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
              isPrivacyMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
            }`}
            title="Toggle Sensor Nama Santri (P)"
          >
            {isPrivacyMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isPrivacyMode ? 'Sensor Aktif' : 'Sensor Nonaktif'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-colors cursor-pointer shadow-2xs"
            title="Tutup Mode Rapat (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas (16:9 Aspect Ratio Focus) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 flex items-center justify-center bg-slate-100/80">
        <div className="w-full max-w-6xl aspect-[16/9] min-h-[540px] flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 lg:p-10 shadow-xl relative overflow-hidden text-slate-800">
          {/* Subtle Ambient Decorative Gradients */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-indigo-500/5 blur-3xl" />

          {/* ============================================================ */}
          {/* SLIDE 1: OVERVIEW & EKSEKUTIF KPI */}
          {/* ============================================================ */}
          {currentSlide === 0 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1 text-xs font-bold text-teal-800 shadow-2xs">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  <span>Slide 1 / {totalSlides} • Ringkasan Eksekutif</span>
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">
                  Laporan Hasil Pembinaan &amp; Musyawarah
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
                  Cakupan: <span className="text-slate-900 font-bold">{scopeInfo.name}</span> • Periode: {scopeInfo.periodLabel} ({scopeInfo.dateRangeLabel}) • {summary.completedSessionsCount} Sesi Pengajian Terlaksana
                </p>
              </div>

              {/* 4 Big KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 my-4">
                {/* KPI 1: Presensi */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 shadow-xs border-l-4 border-l-emerald-500 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Presensi</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <UserCheck className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">{summary.attendanceRate}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Rerata kehadiran santri</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-200/80 pt-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Tepat</span>
                      <span className="font-bold text-emerald-700">{summary.onTimeRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Terlambat</span>
                      <span className="font-bold text-amber-700">{summary.lateRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Alpa</span>
                      <span className="font-bold text-rose-700">{summary.absentRate}%</span>
                    </div>
                  </div>
                </div>

                {/* KPI 2: Kurikulum */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 shadow-xs border-l-4 border-l-cyan-500 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kurikulum</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                        <BookOpen className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">{summary.curriculumMasteryRate}%</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Materi checklist tuntas</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
                    <span className="text-slate-500">Kategori Aktif</span>
                    <span className="font-bold text-cyan-800">{curriculumCategories.length} Bidang</span>
                  </div>
                </div>

                {/* KPI 3: Karakter */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 shadow-xs border-l-4 border-l-purple-500 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Adab &amp; Akhlaq</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                        <HeartHandshake className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">{summary.characterAverage}</span>
                      <span className="text-xs font-semibold text-slate-400">/100</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Indeks perilaku &amp; keaktifan</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
                    <span className="text-slate-500">Predikat</span>
                    <span className="font-bold text-purple-800">
                      {summary.characterAverage >= 85 ? 'Istimewa' : summary.characterAverage >= 70 ? 'Baik' : 'Perlu Bimbingan'}
                    </span>
                  </div>
                </div>

                {/* KPI 4: Kohort Santri */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 shadow-xs border-l-4 border-l-indigo-500 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Santri Aktif</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <Users className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">{summary.totalStudents}</span>
                      <span className="text-xs font-semibold text-slate-500">anak</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Santri terdaftar di lingkup</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/80 pt-2 text-[11px]">
                    <span className="font-bold text-emerald-700">{summary.topPerformerCount} Unggul</span>
                    <span className="font-bold text-rose-700">{summary.atRiskCount} Butuh Bina</span>
                  </div>
                </div>
              </div>

              {/* Bottom Insight Footer */}
              <div className="rounded-2xl border border-slate-200 bg-teal-50/70 p-3.5 text-xs text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>
                    Tingkat kedisiplinan dan capaian santri terpantau secara real-time dari data jurnal presensi serta buku penghubung ustadz.
                  </span>
                </span>
                <span className="text-teal-800 font-bold hidden sm:inline text-xs">Tekan panah kanan ➔</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 2: TREN PRESENSI */}
          {/* ============================================================ */}
          {currentSlide === 1 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 shadow-2xs">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Slide 2 / {totalSlides} • Dinamika Presensi Berkala</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Tren Kehadiran &amp; Ketepatan Waktu Pekanan
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Grafik fluktuasi persentase kehadiran santri per rentang pekan pada periode berjalan
                </p>
              </div>

              {/* Chart Visual Presentation */}
              <div className="my-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5">
                {attendanceTrends.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                    Belum ada sesi presensi pengajian yang tercatat pada periode ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div
                      className="grid gap-3 sm:gap-5 items-end h-44 border-b border-slate-200 pb-3 min-w-[480px]"
                      style={{ gridTemplateColumns: `repeat(${attendanceTrends.length}, minmax(0, 1fr))` }}
                    >
                      {attendanceTrends.map((t, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                          <div className="text-xs font-extrabold text-slate-900">{t.rate}%</div>
                          <div className="w-full max-w-[56px] bg-slate-200/80 rounded-t-xl overflow-hidden flex flex-col justify-end h-32">
                            <div
                              className={`rounded-t-xl transition-all duration-500 ${
                                t.rate >= 85 ? 'bg-emerald-500' : t.rate >= 70 ? 'bg-teal-500' : 'bg-amber-500'
                              }`}
                              style={{ height: `${Math.max(12, t.rate)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-600 text-center truncate w-full" title={t.periodLabel}>
                            {t.periodLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total Stats Counters */}
                <div className="grid grid-cols-5 gap-2 mt-3.5 text-center text-xs">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/80">
                    <p className="text-[10px] font-semibold text-emerald-700">Hadir</p>
                    <p className="font-black text-base">{attendanceTrends.reduce((acc, c) => acc + c.hadir, 0)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/80">
                    <p className="text-[10px] font-semibold text-amber-700">Terlambat</p>
                    <p className="font-black text-base">{attendanceTrends.reduce((acc, c) => acc + c.terlambat, 0)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-200/80">
                    <p className="text-[10px] font-semibold text-blue-700">Izin</p>
                    <p className="font-black text-base">{attendanceTrends.reduce((acc, c) => acc + c.izin, 0)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-900 border border-purple-200/80">
                    <p className="text-[10px] font-semibold text-purple-700">Sakit</p>
                    <p className="font-black text-base">{attendanceTrends.reduce((acc, c) => acc + c.sakit, 0)}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-900 border border-rose-200/80">
                    <p className="text-[10px] font-semibold text-rose-700">Alpa</p>
                    <p className="font-black text-base">{attendanceTrends.reduce((acc, c) => acc + c.alpa, 0)}</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-between border-t border-slate-200 pt-2.5">
                <span>Rasio Ketepatan Waktu: <strong className="text-slate-800">{summary.onTimeRate}%</strong> • Keterlambatan: <strong className="text-slate-800">{summary.lateRate}%</strong></span>
                <span className="text-rose-700 font-bold">Rasio Alpa / Tanpa Keterangan: {summary.absentRate}%</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 3: KURIKULUM & TARGET MATERI */}
          {/* ============================================================ */}
          {currentSlide === 2 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-1 text-xs font-bold text-cyan-800 shadow-2xs">
                  <BookOpen className="h-3.5 w-3.5 text-cyan-600" />
                  <span>Slide 3 / {totalSlides} • Capaian Materi Kurikulum</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Ketuntasan Target Pembelajaran Santri
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Rekapitulasi penguasaan materi checklist per bidang studi kurikulum pengajian
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-3">
                {/* Left: Kurikulum Breakdown */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-cyan-600" />
                    <span>Penguasaan Bidang Studi Target</span>
                  </h3>
                  <div className="space-y-3">
                    {curriculumCategories.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">Belum ada target kurikulum yang dijadwalkan.</p>
                    ) : (
                      curriculumCategories.map((cat, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700">{cat.category}</span>
                            <span className="font-black text-cyan-900">{cat.masteryRate}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden shadow-inner">
                            <div
                              className="h-full rounded-full bg-cyan-600 transition-all duration-500"
                              style={{ width: `${Math.min(100, cat.masteryRate)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{cat.completedItems} dari {cat.totalItems} materi tuntas</span>
                            <span className={cat.masteryRate >= 70 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                              {cat.masteryRate >= 70 ? '✓ Sesuai Target' : '⚠ Perlu Akselerasi'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Summary Box */}
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-cyan-950 mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-cyan-700" />
                      <span>Ringkasan Ketuntasan Materi Rombel</span>
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Rata-rata ketuntasan materi santri di lingkup ini mencapai <strong>{summary.curriculumMasteryRate}%</strong>. Capaian ini dihitung dari seluruh checklist materi yang telah diselesaikan santri dan diverifikasi oleh dewan guru/ustadz pengampu.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-cyan-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 block font-medium">Status Capaian</span>
                        <span className="font-bold text-cyan-900 text-sm">
                          {summary.curriculumMasteryRate >= 80 ? 'Sangat Optimal' : summary.curriculumMasteryRate >= 50 ? 'Berjalan Baik' : 'Butuh Pendampingan'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-cyan-200/80 shadow-2xs">
                        <span className="text-[10px] text-slate-500 block font-medium">Sesi Pengajian Selesai</span>
                        <span className="font-bold text-slate-900 text-sm">{summary.completedSessionsCount} Pertemuan</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3 border border-cyan-200/60 text-xs text-slate-600 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-600 shrink-0" />
                    <span>Ustadz dapat menyelenggarakan sesi halaqah tambahan untuk materi yang persentasenya masih di bawah target.</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-2.5">
                Target capaian kurikulum terintegrasi langsung dengan verifikasi checklist harian pada cockpit presensi.
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 4: 5 DIMENSI KARAKTER & ADAB */}
          {/* ============================================================ */}
          {currentSlide === 3 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1 text-xs font-bold text-purple-800 shadow-2xs">
                  <HeartHandshake className="h-3.5 w-3.5 text-purple-600" />
                  <span>Slide 4 / {totalSlides} • Pembinaan Adab &amp; Karakter</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Evaluasi 5 Dimensi Karakter Santri
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Penilaian adab, akhlakul karimah, ketertiban sesi, serta disiplin kehadiran santri
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3">
                {characterRadar.map((dim, idx) => {
                  const isAbove = dim.score >= dim.benchmark;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{dim.dimension}</span>
                        <div className="flex items-center gap-1">
                          <span className={`font-black ${isAbove ? 'text-purple-900' : 'text-amber-800'}`}>
                            {dim.score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">/ 100</span>
                        </div>
                      </div>

                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isAbove ? 'bg-purple-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, dim.score)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-0.5">
                        <span className="text-slate-500 font-medium">Standar Target: {dim.benchmark}</span>
                        <span className={isAbove ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {isAbove ? '✓ Memenuhi Target' : '⚠ Perlu Pembinaan'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-2.5 flex items-center justify-between">
                <span>Nilai karakter dihitung dari penilaian sesi tatap muka ustadz serta penalti ketidakhadiran alfa secara proporsional.</span>
                <span className="text-purple-800 font-bold">Rerata Indeks Karakter: {summary.characterAverage}/100</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 5: BENCHMARK ANTAR UNIT / KELAS */}
          {/* ============================================================ */}
          {currentSlide === 4 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-800 shadow-2xs">
                  <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Slide 5 / {totalSlides} • Komparasi Benchmark Antar Unit</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Perbandingan Capaian Antar Kelompok / Kelas
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Pemetaan kinerja presensi, kurikulum, dan adab pada masing-masing sub-unit
                </p>
              </div>

              <div className="my-3 overflow-y-auto max-h-[300px] pr-1">
                {benchmarkComparison.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Belum ada data sub-unit untuk dikomparasikan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {benchmarkComparison.map((unit) => {
                      const overall = Math.round((unit.attendanceRate + unit.curriculumRate + unit.characterScore) / 3);
                      return (
                        <div
                          key={unit.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 shadow-xs hover:bg-white transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[180px]">
                                {unit.name}
                              </h4>
                              <p className="text-[10px] text-slate-500">{unit.studentCount} Santri Terdaftar</p>
                            </div>
                            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-black text-indigo-900">
                              {overall}%
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs pt-1 border-t border-slate-200/70">
                            <div>
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-slate-600">Presensi</span>
                                <span className="font-bold text-emerald-700">{unit.attendanceRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${unit.attendanceRate}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-slate-600">Kurikulum</span>
                                <span className="font-bold text-cyan-700">{unit.curriculumRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${unit.curriculumRate}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[11px] mb-0.5">
                                <span className="text-slate-600">Karakter</span>
                                <span className="font-bold text-purple-700">{unit.characterScore}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${unit.characterScore}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-2.5">
                Komparasi ini berguna untuk pembinaan silang dan berbagi praktik baik antarpembina.
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 6: KETERLIBATAN WALI SANTRI */}
          {/* ============================================================ */}
          {currentSlide === 5 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-800 shadow-2xs">
                  <CheckCheck className="h-3.5 w-3.5 text-amber-600" />
                  <span>Slide 6 / {totalSlides} • Sinergi Wali Santri</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Keterlibatan Orang Tua &amp; Verifikasi Tugas
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Pemantauan keaktifan paraf amalan mandiri dan respon komunikasi wali santri
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-3">
                {/* Left: Overall Verification KPI */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Statistik Verifikasi Paraf Orang Tua</span>
                    </h3>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Tingkat Verifikasi Global
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 block">
                          {parentEngagement?.overallVerificationRate ?? 100}%
                        </span>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {parentEngagement && parentEngagement.overallVerificationRate >= 80 ? 'Sangat Aktif' : 'Cukup Aktif'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-medium">Tugas Paraf</span>
                        <span className="font-bold text-slate-800 text-sm">{parentEngagement?.totalRequiredTasks || 0}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                        <span className="text-[10px] text-emerald-700 block font-medium">Terverifikasi</span>
                        <span className="font-bold text-emerald-800 text-sm">{parentEngagement?.totalVerifiedTasks || 0}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 shadow-2xs">
                        <span className="text-[10px] text-amber-700 block font-medium">Tertunda</span>
                        <span className="font-bold text-amber-800 text-sm">{parentEngagement?.totalPendingTasks || 0}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-3 italic">
                    Paraf orang tua membuktikan adanya kolaborasi aktif di rumah dalam membimbing hafalan dan ibadah ananda.
                  </p>
                </div>

                {/* Right: Parent list / recommendations */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-teal-600" />
                      <span>Rekomendasi Penguatan Kerjasama Wali Santri</span>
                    </h3>

                    <div className="space-y-2 text-xs text-slate-700 mt-3">
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <p className="font-bold text-teal-800">1. Pemanfaatan Laporan Rapor Digital &amp; WhatsApp Blast</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Kirimkan rekap kemajuan belajar secara berkala langsung ke nomor WhatsApp orang tua.</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <p className="font-bold text-indigo-800">2. Silaturahim Pembina &amp; Wali Kelas</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Melakukan kontak persuasif kepada wali santri yang memiliki catatan ketidakhadiran berulang.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-[11px] text-teal-800 font-semibold bg-teal-50 p-2.5 rounded-xl border border-teal-200/60">
                    ✓ Fitur WhatsApp Gateway telah terhubung untuk mendukung pengiriman laporan otomatis.
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-2.5">
                Dukungan dan doa orang tua adalah kunci keberhasilan pencapaian generasi sholih.
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 7: KOHORT SANTRI & RENCANA AKSI MUSYAWARAH */}
          {/* ============================================================ */}
          {currentSlide === 6 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1 text-xs font-bold text-indigo-800 shadow-2xs">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span>Slide 7 / {totalSlides} • Rencana Tindak Lanjut Rapat</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
                  Evaluasi Kohort &amp; Keputusan Musyawarah
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Apresiasi santri unggul dan rencana aksi pendampingan bagi santri yang memerlukan penguatan
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-3">
                {/* Left: Top & At Risk Highlights */}
                <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
                  {/* Top Performers Section */}
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      <span>Santri Unggul Berprestasi ({topPerformers.length})</span>
                    </h4>
                    {topPerformers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Belum ada santri berkualifikasi unggul pada periode ini.</p>
                    ) : (
                      topPerformers.slice(0, 3).map((s, i) => (
                        <div key={s.studentId} className="p-2 rounded-xl bg-white border border-emerald-200/60 flex items-center justify-between text-xs shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center">
                              #{i + 1}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{formatName(s.fullName)}</p>
                              <p className="text-[10px] text-slate-400">{s.className}</p>
                            </div>
                          </div>
                          <span className="font-black text-emerald-700">{s.compositeScore} Poin</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* At-Risk Section */}
                  <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-3.5 space-y-2">
                    <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                      <span>Santri Membutuhkan Penguatan ({atRiskStudents.length})</span>
                    </h4>
                    {atRiskStudents.length === 0 ? (
                      <p className="text-[11px] text-emerald-700 font-semibold italic">Alhamdulillah, seluruh santri berada dalam kategori stabil dan unggul.</p>
                    ) : (
                      atRiskStudents.slice(0, 3).map((s) => (
                        <div key={s.studentId} className="p-2 rounded-xl bg-white border border-rose-200/60 flex items-center justify-between text-xs shadow-2xs">
                          <div>
                            <p className="font-bold text-slate-900">{formatName(s.fullName)}</p>
                            <p className="text-[10px] text-rose-600 font-medium truncate max-w-[200px]">
                              {s.reasons[0] || 'Perlu bimbingan kehadiran & materi'}
                            </p>
                          </div>
                          <span className="font-bold text-rose-700">{s.attendanceRate}% Hadir</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Rencana Aksi Musyawarah */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Rencana Aksi Intervensi Musyawarah</span>
                    </h3>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <p className="font-bold text-amber-900">1. Pendampingan Khusus Santri Alfa</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Wali kelas segera berkomunikasi dengan wali santri terkait kendala kehadiran.</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <p className="font-bold text-cyan-900">2. Bimbingan Belajar Privat / Remedial</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Jadwalkan sesi singkat sebelum/sesudah halaqah untuk materi yang belum tuntas.</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <p className="font-bold text-purple-900">3. Apresiasi &amp; Tutor Sebaya</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Berikan penghargaan kepada santri teladan dan libatkan untuk menyemangati temannya.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-center text-xs font-semibold text-slate-500">
                    _Alhamdulillah Jazakumullahu Khairan Katsiran._
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 border-t border-slate-200 pt-2.5 flex items-center justify-between">
                <span>Musyawarah Pembinaan Pengajian Santri Berkelanjutan</span>
                <span className="text-teal-800 font-bold">Dokumen Rapat Sah</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation & Controls */}
      <div className="flex h-16 items-center justify-between border-t border-slate-200/80 bg-white/95 px-4 sm:px-6 shadow-xs backdrop-blur-md shrink-0">
        {/* Previous Button */}
        <button
          type="button"
          disabled={currentSlide === 0}
          onClick={handlePrev}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Sebelumnya</span>
        </button>

        {/* Slide Indicator Dots & Labels */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${
                currentSlide === idx
                  ? 'w-8 bg-teal-600 shadow-xs'
                  : 'w-2.5 bg-slate-300 hover:bg-slate-400'
              }`}
              title={`Beralih ke: ${slideTitles[idx]}`}
            />
          ))}
          <span className="ml-2 text-xs font-bold text-slate-600 hidden md:inline">
            Slide {currentSlide + 1}/{totalSlides}: <span className="text-slate-900">{slideTitles[currentSlide]}</span>
          </span>
        </div>

        {/* Next / Finish Button */}
        <button
          type="button"
          onClick={currentSlide === totalSlides - 1 ? onClose : handleNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-xs transition-colors cursor-pointer"
        >
          <span>{currentSlide === totalSlides - 1 ? 'Selesai Mode Rapat' : 'Berikutnya'}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
export default PresentationModeModal;
