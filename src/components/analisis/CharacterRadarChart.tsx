'use client';

import React from 'react';
import { CharacterDimensionScore } from '@/app/(protected)/analisis/types';
import { HeartHandshake, ShieldCheck } from 'lucide-react';

interface CharacterRadarChartProps {
  dimensions: CharacterDimensionScore[];
}

export const CharacterRadarChart: React.FC<CharacterRadarChartProps> = ({ dimensions }) => {
  const hasData = dimensions && dimensions.length > 0 && dimensions.some((d) => d.score > 0);

  if (!hasData) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-xs space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 border border-purple-200/70 shadow-2xs mx-auto">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">Belum Ada Data Evaluasi Karakter</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Belum ada sesi evaluasi adab &amp; budi pekerti yang tercatat untuk santri dalam cakupan dan periode ini.
        </p>
      </div>
    );
  }

  const averageScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length
  );

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200/70 shadow-2xs">
              <HeartHandshake className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base">Evaluasi Adab &amp; Budi Pekerti</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Penilaian dimensi akhlakul karimah dan ketertiban ibadah santri</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-1.5 border border-purple-200/80 self-start sm:self-auto shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-purple-700" />
          <span className="text-xs font-semibold text-purple-800">Indeks Adab:</span>
          <span className="text-xs font-black text-purple-950">{averageScore}/100</span>
        </div>
      </div>

      {/* Dimension Bars / Indicators */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {dimensions.map((dim, idx) => {
          const score = dim.score;
          const isAboveBenchmark = score >= dim.benchmark;

          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">{dim.dimension}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-black ${isAboveBenchmark ? 'text-purple-900' : 'text-amber-800'}`}>
                    {score}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">/ 100</span>
                </div>
              </div>

              {/* Progress Bar with Target Benchmark Marker */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/70 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isAboveBenchmark ? 'bg-purple-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] pt-0.5">
                <span className="text-slate-500 font-medium">Target Standar: {dim.benchmark}</span>
                <span className={isAboveBenchmark ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                  {isAboveBenchmark ? '✓ Memenuhi Target' : '⚠ Perlu Bimbingan'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default CharacterRadarChart;
