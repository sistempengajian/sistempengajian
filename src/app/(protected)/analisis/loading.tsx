import React from 'react';

export default function AnalisisLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Header & Filter Bar Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-100/80 animate-pulse" />
              <div className="h-6 w-56 bg-slate-200/90 rounded-lg animate-pulse" />
            </div>
            <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-teal-100/70 rounded-xl animate-pulse" />
            <div className="h-9 w-24 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="h-9 w-36 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-9 w-40 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-9 w-32 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* 2. Executive KPI Banner Grid Skeleton (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-slate-100 rounded-md animate-pulse" />
              <div className="w-7 h-7 rounded-lg bg-teal-100/60 animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-slate-200/90 rounded-lg animate-pulse" />
            <div className="h-3 w-32 bg-slate-100 rounded-md animate-pulse" />
          </div>
        ))}
      </div>

      {/* 3. Charts Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance Chart Skeleton */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3">
          <div className="h-5 w-40 bg-slate-200/90 rounded-md animate-pulse" />
          <div className="h-56 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center animate-pulse">
            <div className="w-3/4 h-24 bg-slate-200/50 rounded-lg" />
          </div>
        </div>

        {/* Radar / Curriculum Chart Skeleton */}
        <div className="bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3">
          <div className="h-5 w-44 bg-slate-200/90 rounded-md animate-pulse" />
          <div className="h-56 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center animate-pulse">
            <div className="w-32 h-32 rounded-full bg-slate-200/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
