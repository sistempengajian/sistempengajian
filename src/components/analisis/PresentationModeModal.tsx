'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Shield,
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
} from 'lucide-react';
import { AnalyticsDashboardData, PerformerStudentItem } from '@/app/(protected)/analisis/types';

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

  const totalSlides = 5;

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

  const { summary, scopeInfo, attendanceTrends, curriculumCategories, characterRadar, topPerformers, atRiskStudents } = data;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-6 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span>PRESENTASI EKSEKUTIF PEMBINAAN</span>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs text-indigo-300 font-semibold border border-indigo-500/30">
                16:9
              </span>
            </h2>
            <p className="text-xs text-slate-400">
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
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${
              isPrivacyMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white hover:border-rose-500 transition-colors"
            title="Tutup Mode Presentasi (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas (16:9 Aspect Ratio Focus) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12 flex items-center justify-center">
        <div className="w-full max-w-6xl aspect-[16/9] min-h-[500px] flex flex-col justify-between rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-950 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow Background */}
          <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

          {/* ============================================================ */}
          {/* SLIDE 1: OVERVIEW & EKSEKUTIF KPI */}
          {/* ============================================================ */}
          {currentSlide === 0 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Slide 1 / 5 • Ringkasan Eksekutif</span>
                </div>
                <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Musyawarah Pembinaan Santri
                </h1>
                <p className="mt-1 text-sm sm:text-lg text-slate-400 font-medium">
                  Cakupan: <span className="text-white font-semibold">{scopeInfo.name}</span> • {scopeInfo.dateRangeLabel}
                </p>
              </div>

              {/* 4 Big KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 my-6">
                {/* KPI 1: Presensi */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-emerald-500">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-slate-400">Rata-rata Presensi</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <UserCheck className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-5xl font-black text-white">{summary.attendanceRate}%</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <span>Tepat Waktu: {summary.onTimeRate}%</span>
                    <span className="text-rose-400">Alpa: {summary.absentRate}%</span>
                  </div>
                </div>

                {/* KPI 2: Kurikulum */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-cyan-500">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-slate-400">Ketuntasan Materi</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                      <BookOpen className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-5xl font-black text-white">{summary.curriculumMasteryRate}%</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <span>Target Capaian</span>
                    <span className="text-cyan-300 font-medium">Berjalan</span>
                  </div>
                </div>

                {/* KPI 3: Karakter */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-purple-500">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-slate-400">Indeks Karakter & Adab</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                      <HeartHandshake className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-5xl font-black text-white">{summary.characterAverage}</span>
                    <span className="text-xs text-slate-400">/100</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <span>Predikat Umum</span>
                    <span className="text-purple-300 font-semibold">
                      {summary.characterAverage >= 80 ? 'Amat Baik' : 'Baik'}
                    </span>
                  </div>
                </div>

                {/* KPI 4: Kohort Santri */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg border-l-4 border-l-amber-500">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-slate-400">Santri Terpantau</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                      <Layers className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-5xl font-black text-white">{summary.totalStudents}</span>
                    <span className="text-xs text-slate-400">santri</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5">
                    <span className="text-emerald-400 font-medium">Unggul: {summary.topPerformerCount}</span>
                    <span className="text-rose-400 font-medium">Perlu Penguatan: {summary.atRiskCount}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs sm:text-sm text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Rata-rata keaktifan kumulatif berada pada tingkat yang stabil dengan {summary.averageStreak} pertemuan beruntun.
                </span>
                <span className="text-slate-500 text-xs font-mono hidden sm:inline">Tekan panah ➔ untuk slide berikutnya</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 2: TREN PRESENSI */}
          {/* ============================================================ */}
          {currentSlide === 1 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Slide 2 / 5 • Dinamika Presensi Berkala</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
                  Tren Kehadiran & Ketepatan Waktu
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Fluktuasi kehadiran santri per interval waktu pada periode terpilih
                </p>
              </div>

              {/* Chart Visual Presentation */}
              <div className="my-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <div className="grid grid-cols-4 gap-4 sm:gap-8 items-end h-56 border-b border-slate-800 pb-4">
                  {attendanceTrends.map((t, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                      <div className="text-xs sm:text-sm font-bold text-emerald-400">{t.rate}%</div>
                      <div className="w-full max-w-[64px] bg-slate-800 rounded-t-xl overflow-hidden flex flex-col justify-end h-44">
                        <div
                          className="bg-emerald-500 rounded-t-xl transition-all duration-500"
                          style={{ height: `${Math.max(10, t.rate)}%` }}
                        />
                      </div>
                      <span className="text-[11px] sm:text-xs font-medium text-slate-300 text-center truncate w-full">
                        {t.periodLabel}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-2 mt-4 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <p className="text-[10px] text-emerald-400/80">Hadir</p>
                    <p className="font-bold text-sm">{attendanceTrends.reduce((acc, c) => acc + c.hadir, 0)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <p className="text-[10px] text-amber-400/80">Terlambat</p>
                    <p className="font-bold text-sm">{attendanceTrends.reduce((acc, c) => acc + c.terlambat, 0)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    <p className="text-[10px] text-blue-400/80">Izin</p>
                    <p className="font-bold text-sm">{attendanceTrends.reduce((acc, c) => acc + c.izin, 0)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    <p className="text-[10px] text-purple-400/80">Sakit</p>
                    <p className="font-bold text-sm">{attendanceTrends.reduce((acc, c) => acc + c.sakit, 0)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    <p className="text-[10px] text-rose-400/80">Alpa</p>
                    <p className="font-bold text-sm">{attendanceTrends.reduce((acc, c) => acc + c.alpa, 0)}</p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
                <span>Rasio Ketepatan Waktu: {summary.onTimeRate}% • Rasio Keterlambatan: {summary.lateRate}%</span>
                <span className="text-emerald-400 font-semibold">Tingkat Absensi Tanpa Keterangan: {summary.absentRate}%</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 3: KURIKULUM & 5 DIMENSI KARAKTER */}
          {/* ============================================================ */}
          {currentSlide === 2 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Slide 3 / 5 • Capaian Materi & Karakter</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
                  Ketuntasan Kurikulum & 5 Dimensi Adab
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Perbandingan capaian materi pembelajaran checklist dan profil budi pekerti santri
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-4">
                {/* Left: Kurikulum Breakdown */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-cyan-400" />
                    <span>Penguasaan Bidang Studi</span>
                  </h3>
                  <div className="space-y-3">
                    {curriculumCategories.map((cat, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-300">{cat.category}</span>
                          <span className="font-bold text-cyan-400">{cat.masteryRate}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, cat.masteryRate)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {cat.completedItems} dari {cat.totalItems} materi diselesaikan
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Karakter Radar Dimensions */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <HeartHandshake className="h-4 w-4 text-purple-400" />
                    <span>5 Dimensi Pembinaan Karakter</span>
                  </h3>
                  <div className="space-y-3">
                    {characterRadar.map((dim, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-300">{dim.dimension}</span>
                          <span className="font-bold text-purple-400">{dim.score}/100</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, dim.score)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span>Target Standar: {dim.benchmark}</span>
                          <span className={dim.score >= dim.benchmark ? 'text-emerald-400' : 'text-amber-400'}>
                            {dim.score >= dim.benchmark ? 'Memenuhi Standar' : 'Perlu Ditingkatkan'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 border-t border-slate-800 pt-3">
                Capaian materi terintegrasi dengan jurnal harian pengajar & checklist verifikasi kompetensi.
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 4: SANTRI BERPRESTASI & UNGGUL */}
          {/* ============================================================ */}
          {currentSlide === 3 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>Slide 4 / 5 • Apresiasi Santri Teladan</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
                  Santri Unggul & Berprestasi
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Santri dengan presensi konsisten, capaian kurikulum di atas target, serta teladan adab
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-4">
                {topPerformers.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    Belum ada santri yang memenuhi kualifikasi unggul pada periode ini.
                  </div>
                ) : (
                  topPerformers.slice(0, 6).map((s, idx) => (
                    <div
                      key={s.studentId}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                            #{idx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm sm:text-base">
                              {formatName(s.fullName)}
                            </h4>
                            <p className="text-xs text-slate-400">{s.className} • {s.organizationName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20">
                          <Sparkles className="h-3 w-3" />
                          <span>{s.compositeScore}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400">Presensi</p>
                          <p className="font-bold text-emerald-400">{s.attendanceRate}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Kurikulum</p>
                          <p className="font-bold text-cyan-400">{s.curriculumRate}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Karakter</p>
                          <p className="font-bold text-purple-400">{s.characterScore}</p>
                        </div>
                      </div>

                      {s.reasons.length > 0 && (
                        <div className="mt-2.5 rounded-lg bg-slate-900/60 p-2 text-[11px] text-slate-300">
                          ⭐ {s.reasons[0]}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="text-xs text-slate-400 border-t border-slate-800 pt-3 flex items-center justify-between">
                <span>Rekomendasi: Berikan sertifikat apresiasi & amanat tutor sebaya untuk memotivasi santri lain.</span>
                <span className="text-amber-400 font-semibold">{topPerformers.length} Santri Unggul Teridentifikasi</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SLIDE 5: SANTRI PERLU PENGUATAN & REKOMENDASI INTERVENSI */}
          {/* ============================================================ */}
          {currentSlide === 4 && (
            <div className="flex-1 flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Slide 5 / 5 • Rencana Aksi Pendampingan</span>
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
                  Santri Perlu Penguatan & Pendampingan
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Identifikasi kendala (kehadiran terhambat / materi tertinggal) dan rumusan tindak lanjut pembinaan
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-4">
                {/* Left: At-risk students list */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 overflow-y-auto max-h-[300px]">
                  <h3 className="text-xs sm:text-sm font-semibold text-rose-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Daftar Santri Memerlukan Bimbingan Khusus ({atRiskStudents.length})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {atRiskStudents.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-400">
                        Alhamdulillah, tidak ada santri dalam kategori perlu perhatian khusus pada periode ini.
                      </p>
                    ) : (
                      atRiskStudents.slice(0, 6).map((s) => (
                        <div
                          key={s.studentId}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-white">{formatName(s.fullName)}</p>
                            <p className="text-[11px] text-slate-400">{s.className} • {s.organizationName}</p>
                            {s.reasons.length > 0 && (
                              <p className="text-[10px] text-rose-300/80 mt-0.5">⚠️ {s.reasons[0]}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-rose-400">{s.attendanceRate}% Hadir</span>
                            <p className="text-[10px] text-slate-400">{s.curriculumRate}% Materi</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Recommended Actions */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span>Rencana Aksi Intervensi Hasil Musyawarah</span>
                    </h3>
                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                        <p className="font-semibold text-amber-300">1. Komunikasi Persuasif dengan Wali Santri</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Wali kelas / pembina menghubungi orang tua melalui WhatsApp atau kunjungan ramah untuk mendiskusikan kendala kehadiran santri.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                        <p className="font-semibold text-cyan-300">2. Program Privat / Remedial Terarah</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Santri dengan capaian materi kurikulum di bawah 50% dijadwalkan sesi bimbingan khusus di luar jam halqah reguler.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                        <p className="font-semibold text-purple-300">3. Pendampingan Budi Pekerti & Motivasi</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Menugaskan santri berprestasi sebagai pendamping sebaya (*peer mentor*) untuk menumbuhkan kenyamanan dan semangat santri.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 border-t border-slate-800 pt-3 flex items-center justify-between">
                <span>Musyawarah Pembinaan: Bersama wujudkan generasi sholih, cerdas, dan berakhlaq mulia.</span>
                <span className="text-white font-medium">Alhamdulillahirabbil &apos;aalamin</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation & Controls */}
      <div className="flex h-16 items-center justify-between border-t border-slate-800/80 bg-slate-900/80 px-6 backdrop-blur-md shrink-0">
        {/* Previous Button */}
        <button
          type="button"
          disabled={currentSlide === 0}
          onClick={handlePrev}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Sebelumnya</span>
        </button>

        {/* Slide Indicator Dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`h-2.5 rounded-full transition-all ${
                currentSlide === idx
                  ? 'w-8 bg-indigo-500 shadow-md shadow-indigo-500/50'
                  : 'w-2.5 bg-slate-700 hover:bg-slate-600'
              }`}
              title={`Beralih ke Slide ${idx + 1}`}
            />
          ))}
          <span className="ml-2 text-xs font-mono text-slate-400">
            {currentSlide + 1} / {totalSlides}
          </span>
        </div>

        {/* Next / Finish Button */}
        <button
          type="button"
          onClick={currentSlide === totalSlides - 1 ? onClose : handleNext}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-colors"
        >
          <span>{currentSlide === totalSlides - 1 ? 'Selesai Presentasi' : 'Berikutnya'}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
export default PresentationModeModal;
