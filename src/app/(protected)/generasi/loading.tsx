import React from 'react';

export default function GenerasiLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="rounded-3xl bg-white/80 border border-slate-200/60 p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-6 w-48 bg-slate-200 rounded-lg" />
              <div className="h-3.5 w-72 bg-slate-150 rounded-md" />
            </div>
          </div>
          <div className="h-7 w-32 bg-slate-200 rounded-full" />
        </div>
        <div className="pt-3 border-t border-slate-150 h-8 w-full bg-slate-100 rounded-lg" />
      </div>

      {/* Metrics Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/80 border border-slate-200/60 p-4 flex items-center gap-3.5 shadow-2xs"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-20 bg-slate-150 rounded-md" />
              <div className="h-5 w-24 bg-slate-200 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Grid Cards Skeleton */}
      <div className="space-y-3.5">
        <div className="h-4 w-44 bg-slate-200 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-3xl bg-white/80 border border-slate-200/60 p-6 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-2xl bg-slate-200" />
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-36 bg-slate-200 rounded-lg" />
                <div className="h-4 w-full bg-slate-150 rounded-md" />
                <div className="h-4 w-3/4 bg-slate-150 rounded-md" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-12 bg-slate-100 rounded-2xl" />
                <div className="h-12 bg-slate-100 rounded-2xl" />
                <div className="h-12 bg-slate-100 rounded-2xl" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="flex-1 h-9 bg-slate-150 rounded-xl" />
                <div className="w-20 h-9 bg-slate-200 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
