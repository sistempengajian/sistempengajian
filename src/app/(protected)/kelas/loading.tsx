import React from 'react';

export default function KelasLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Role switcher bar skeleton */}
      <div className="bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200/80 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-slate-200/80 rounded-md animate-pulse" />
            <div className="h-3 w-44 bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-24 bg-slate-200/70 rounded-xl animate-pulse" />
      </div>

      {/* 2. Header Kelas Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-100/80 animate-pulse" />
            <div className="h-6 w-48 bg-slate-200/90 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-28 bg-teal-100/70 rounded-xl animate-pulse" />
        </div>
        <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 3. Class Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-slate-200/90 rounded-lg animate-pulse" />
              <div className="h-5 w-20 bg-slate-100 rounded-full animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-slate-100 rounded-md animate-pulse" />
              <div className="h-4 w-48 bg-slate-100 rounded-md animate-pulse" />
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-100 rounded-md animate-pulse" />
              <div className="h-8 w-20 bg-slate-200/70 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
