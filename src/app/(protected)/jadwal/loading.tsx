import React from 'react';

export default function JadwalLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* Top Header Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-3 w-80 max-w-full bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
      </div>

      {/* Calendar Controls Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-8 w-8 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-8 w-8 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-8 w-36 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Calendar Grid Skeleton */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
        <div className="grid grid-cols-7 gap-2 pb-2 border-b border-slate-100">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-4 bg-slate-100 rounded animate-pulse mx-auto w-10" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(28)].map((_, i) => (
            <div
              key={i}
              className="h-20 sm:h-24 bg-slate-50/70 rounded-xl border border-slate-100 p-2 flex flex-col justify-between"
            >
              <div className="w-5 h-5 rounded-full bg-slate-200/80 animate-pulse" />
              {i % 3 === 0 && (
                <div className="h-4 bg-blue-100/70 rounded-md animate-pulse w-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
