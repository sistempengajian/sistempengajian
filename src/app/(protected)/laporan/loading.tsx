import React from 'react';

export default function LaporanLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Multi-role switcher skeleton */}
      <div className="bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100/70 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-slate-200/80 rounded-md animate-pulse" />
            <div className="h-3 w-48 bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-24 bg-slate-200/70 rounded-xl animate-pulse" />
      </div>

      {/* 2. Top Banner Rapor Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100/80 animate-pulse" />
            <div className="h-6 w-48 bg-slate-200/90 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-24 bg-indigo-100/70 rounded-xl animate-pulse" />
        </div>
        <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 3. Selector Tabs Santri / Periode Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-10 w-32 bg-white/80 border border-slate-200/70 rounded-xl shrink-0 animate-pulse"
          />
        ))}
      </div>

      {/* 4. KPI Summary Cards Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2"
          >
            <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse" />
            <div className="h-6 w-16 bg-slate-200/90 rounded-lg animate-pulse" />
            <div className="h-3 w-24 bg-slate-100 rounded-md animate-pulse" />
          </div>
        ))}
      </div>

      {/* 5. Detailed Competency Breakdown Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3">
        <div className="h-5 w-40 bg-slate-200/90 rounded-md animate-pulse" />
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-36 bg-slate-200/80 rounded-md animate-pulse" />
                <div className="h-4 w-12 bg-slate-200/70 rounded-md animate-pulse" />
              </div>
              <div className="h-2 w-full bg-slate-200/60 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
