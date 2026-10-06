import React from 'react';

export default function PresensiLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Top Header Presensi Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-100/80 animate-pulse" />
            <div className="h-6 w-48 bg-slate-200/90 rounded-lg animate-pulse" />
          </div>
          <div className="h-6 w-24 bg-emerald-100/70 rounded-full animate-pulse" />
        </div>
        <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 2. QR Scanner / Session Card Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 shadow-2xs flex flex-col items-center justify-center space-y-4 py-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center animate-pulse">
          <div className="w-20 h-20 rounded-xl bg-slate-200/70" />
        </div>
        <div className="h-4 w-44 bg-slate-200/80 rounded-md animate-pulse" />
        <div className="h-3 w-60 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 3. Session Info & Participant List Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="h-5 w-36 bg-slate-200/90 rounded-md animate-pulse" />
          <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200/80 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-slate-200/80 rounded-md animate-pulse" />
                  <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 bg-slate-200/70 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
