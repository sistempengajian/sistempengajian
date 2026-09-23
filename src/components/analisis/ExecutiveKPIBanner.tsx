'use client';

import React from 'react';
import {
  UserCheck,
  BookOpen,
  HeartHandshake,
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Sparkles,
  Flame,
} from 'lucide-react';
import { AnalyticsSummaryKPI, AnalyticsDashboardData } from '@/app/(protected)/analisis/types';
import CircularGauge from './CircularGauge';

interface ExecutiveKPIBannerProps {
  summary: AnalyticsSummaryKPI;
  scopeInfo: AnalyticsDashboardData['scopeInfo'];
}

export const ExecutiveKPIBanner: React.FC<ExecutiveKPIBannerProps> = ({ summary }) => {
  const getAttendanceBadge = (rate: number, totalStudents: number) => {
    if (totalStudents === 0) return { label: 'Belum Ada Santri', bg: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (rate === 0) return { label: 'Belum Ada Sesi', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (rate >= 90) return { label: 'Optimal', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (rate >= 75) return { label: 'Cukup', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Perlu Perhatian', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const getCurriculumBadge = (rate: number, totalStudents: number) => {
    if (totalStudents === 0 || rate === 0) return { label: 'Belum Ada Materi', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (rate >= 80) return { label: 'Sesuai Target', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    if (rate >= 50) return { label: 'Sedang Berjalan', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    return { label: 'Perlu Akselerasi', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  const getCharacterBadge = (score: number, totalStudents: number) => {
    if (totalStudents === 0 || score === 0) return { label: 'Belum Dinilai', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (score >= 85) return { label: 'Teladan', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (score >= 70) return { label: 'Baik', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    return { label: 'Pembinaan Rutin', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const attBadge = getAttendanceBadge(summary.attendanceRate, summary.totalStudents);
  const curBadge = getCurriculumBadge(summary.curriculumMasteryRate, summary.totalStudents);
  const chrBadge = getCharacterBadge(summary.characterAverage, summary.totalStudents);

  // Cohort segments for circular gauge
  const total = summary.totalStudents || 1;
  const topPercent = Math.round((summary.topPerformerCount / total) * 100);
  const atRiskPercent = Math.round((summary.atRiskCount / total) * 100);
  const stablePercent = Math.max(0, 100 - topPercent - atRiskPercent);

  const cohortSegments = [
    { value: topPercent, color: 'stroke-emerald-500' },
    { value: stablePercent, color: 'stroke-indigo-400' },
    { value: atRiskPercent, color: 'stroke-rose-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Presensi Card with Circle Line */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-sm border-l-4 border-l-emerald-500 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 shadow-2xs">
                <UserCheck className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tingkat Kehadiran</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${attBadge.bg}`}>
              {attBadge.label}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{summary.attendanceRate}%</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Rasio kehadiran santri</p>
            </div>

            {/* Circle Line Gauge */}
            <CircularGauge
              value={summary.attendanceRate}
              size={64}
              strokeWidth={6}
              strokeColor="stroke-emerald-500"
              trackColor="stroke-emerald-100"
            >
              <span className="text-xs font-black text-emerald-950">{summary.attendanceRate}%</span>
            </CircularGauge>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11px]">
          <div>
            <span className="text-slate-400 block font-medium">Tepat</span>
            <span className="font-bold text-emerald-700">{summary.onTimeRate}%</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Terlambat</span>
            <span className="font-bold text-amber-700">{summary.lateRate}%</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Alpa</span>
            <span className="font-bold text-rose-700">{summary.absentRate}%</span>
          </div>
        </div>
      </div>

      {/* 2. Capaian Kurikulum Card with Circle Line */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-cyan-300 hover:shadow-sm border-l-4 border-l-cyan-600 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200/70 shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Kurikulum</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${curBadge.bg}`}>
              {curBadge.label}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{summary.curriculumMasteryRate}%</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Materi checklist tuntas</p>
            </div>

            {/* Circle Line Gauge */}
            <CircularGauge
              value={summary.curriculumMasteryRate}
              size={64}
              strokeWidth={6}
              strokeColor="stroke-cyan-600"
              trackColor="stroke-cyan-100"
            >
              <span className="text-xs font-black text-cyan-950">{summary.curriculumMasteryRate}%</span>
            </CircularGauge>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
          <span className="text-slate-500 font-medium">Verifikasi Materi</span>
          <span className="font-bold text-cyan-700 flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
            Checklist Guru
          </span>
        </div>
      </div>

      {/* 3. Indeks Karakter & Adab Card with Circle Line */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-purple-300 hover:shadow-sm border-l-4 border-l-purple-600 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200/70 shadow-2xs">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Karakter &amp; Adab</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${chrBadge.bg}`}>
              {chrBadge.label}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{summary.characterAverage}</h3>
                <span className="text-xs font-semibold text-slate-400">/100</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Rata-rata 5 dimensi</p>
            </div>

            {/* Circle Line Gauge */}
            <CircularGauge
              value={summary.characterAverage}
              size={64}
              strokeWidth={6}
              strokeColor="stroke-purple-600"
              trackColor="stroke-purple-100"
            >
              <span className="text-xs font-black text-purple-950">{summary.characterAverage}</span>
            </CircularGauge>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
          <span className="text-slate-500 font-medium">Budi Pekerti</span>
          <span className="font-bold text-purple-700 flex items-center gap-1">
            <Award className="h-3.5 w-3.5 text-purple-600" />
            Teladan Santri
          </span>
        </div>
      </div>

      {/* 4. Santri Terpantau Card with Multi-Segment Circle Line */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:border-indigo-300 hover:shadow-sm border-l-4 border-l-indigo-600 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/70 shadow-2xs">
                <Users className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Santri Terpantau</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
              <Flame className="h-3 w-3 text-indigo-600" />
              {summary.averageStreak}x Streak
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{summary.totalStudents}</h3>
                <span className="text-xs font-semibold text-slate-500">anak</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Komposisi evaluasi</p>
            </div>

            {/* Multi-Segment Circle Line */}
            <CircularGauge
              value={100}
              size={64}
              strokeWidth={6}
              segments={cohortSegments}
            >
              <span className="text-xs font-black text-slate-800">{summary.totalStudents}</span>
            </CircularGauge>
          </div>
        </div>

        {/* Sub-metrics */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
          <span className="font-bold text-emerald-700 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            {summary.topPerformerCount} Unggul
          </span>
          <span className="font-bold text-rose-700 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            {summary.atRiskCount} Butuh Bina
          </span>
        </div>
      </div>
    </div>
  );
};
export default ExecutiveKPIBanner;
