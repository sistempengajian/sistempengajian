'use client';

import React from 'react';
import { CurriculumCategoryMastery } from '@/app/(protected)/analisis/types';
import { BookOpen, CheckCircle, Award, Target } from 'lucide-react';
import CircularGauge from './CircularGauge';

interface CurriculumMasteryBreakdownProps {
  categories: CurriculumCategoryMastery[];
}

export const CurriculumMasteryBreakdown: React.FC<CurriculumMasteryBreakdownProps> = ({
  categories,
}) => {
  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-xs">
        Belum ada data capaian kurikulum pada unit ini.
      </div>
    );
  }

  // Calculate overall average
  const totalCompleted = categories.reduce((acc, c) => acc + c.completedItems, 0);
  const totalTarget = categories.reduce((acc, c) => acc + c.totalItems, 0);
  const averageRate = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  const targetBenchmark = 80; // Standar target 80%

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200/70 shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-base">Ketuntasan Kurikulum (Grafik Batang)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Penguasaan materi per bidang studi terhadap standar target {targetBenchmark}%</p>
          </div>

          {/* Average circle line pill */}
          <div className="flex items-center gap-2.5 rounded-2xl bg-cyan-50/70 p-2 border border-cyan-200/80 self-start sm:self-auto shadow-2xs">
            <CircularGauge
              value={averageRate}
              size={36}
              strokeWidth={4}
              strokeColor="stroke-cyan-600"
              trackColor="stroke-cyan-200/70"
            >
              <span className="text-[10px] font-black text-cyan-950">{averageRate}%</span>
            </CircularGauge>
            <div className="pr-1">
              <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider block">Rerata Capaian</span>
              <span className="text-xs font-black text-cyan-950">{totalCompleted}/{totalTarget} materi</span>
            </div>
          </div>
        </div>

        {/* Horizontal Bar Chart Scale Grid */}
        <div className="mt-5 space-y-4">
          {/* Sumbu X / Percentage Grid Header */}
          <div className="relative flex items-center justify-between text-[10px] font-bold text-slate-400 border-b border-slate-100 pb-1.5 px-0.5">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span className="text-cyan-700 font-extrabold">Target 80%</span>
            <span>100%</span>
          </div>

          {/* Category Horizontal Bars */}
          {categories.map((cat, idx) => {
            const rate = cat.masteryRate;
            const isTargetMet = rate >= targetBenchmark;
            const barGradient =
              rate >= 80
                ? 'from-emerald-500 to-teal-500'
                : rate >= 60
                ? 'from-cyan-500 to-blue-500'
                : rate >= 40
                ? 'from-amber-400 to-amber-500'
                : 'from-rose-400 to-rose-500';

            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{cat.category}</span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      ({cat.completedItems}/{cat.totalItems} tuntas)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900">{rate}%</span>
                    {isTargetMet && (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                </div>

                {/* Bar Track with 80% Benchmark Line */}
                <div className="relative h-3 w-full rounded-full bg-slate-100 shadow-inner overflow-hidden">
                  {/* Filled Horizontal Bar */}
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
                    style={{ width: `${Math.min(100, rate)}%` }}
                  />

                  {/* Benchmark Vertical Line Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-400/80 z-10"
                    style={{ left: `${targetBenchmark}%` }}
                    title={`Standar Kelulusan: ${targetBenchmark}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Benchmark Note */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-cyan-600" />
          Garis penanda vertikal menunjukkan target ketuntasan standar 80%.
        </span>
        <span className="font-bold text-emerald-700">
          {categories.filter((c) => c.masteryRate >= targetBenchmark).length} / {categories.length} Tuntas Target
        </span>
      </div>
    </div>
  );
};

export default CurriculumMasteryBreakdown;
