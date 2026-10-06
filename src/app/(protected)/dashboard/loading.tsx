import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Hero Greeting Skeleton */}
      <div className="rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200/70 p-5 sm:p-6 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-200/80 rounded-xl animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-slate-200/70 rounded-full animate-pulse" />
              <div className="h-5 w-32 bg-slate-200/70 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
        <div className="h-4 w-3/4 bg-slate-100 rounded-md animate-pulse pt-1" />
      </div>

      {/* 2. Status Grid Section Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-200/80 animate-pulse" />
            <div className="h-6 w-16 bg-slate-200/90 rounded-lg animate-pulse" />
            <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse" />
          </div>
        ))}
      </div>

      {/* 3. Sesi Pengajian Terdekat Card Skeleton */}
      <div className="bg-white/70 backdrop-blur-md border border-slate-200/70 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-36 bg-emerald-100/80 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-slate-100 rounded-md animate-pulse" />
        </div>
        <div className="h-6 w-72 bg-slate-200/90 rounded-xl animate-pulse" />
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="h-8 w-44 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-8 w-40 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* 4. Menu Utama Grid Skeleton */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="h-5 w-48 bg-slate-200/80 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-200/80 animate-pulse" />
              <div className="h-3 w-12 bg-slate-100 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
