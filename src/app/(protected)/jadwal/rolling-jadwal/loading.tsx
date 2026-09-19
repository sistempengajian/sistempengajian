import React from 'react';

export default function RollingJadwalLoading() {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in">
      {/* Header Breadcrumb Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-56 bg-slate-200 rounded-md animate-pulse" />
            <div className="h-3 w-80 bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-44 bg-blue-200/60 rounded-xl animate-pulse" />
      </div>

      {/* Search & Stats Bar Skeleton */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs">
        <div className="h-9 w-full bg-slate-100 rounded-xl animate-pulse" />
      </div>

      {/* Cards List Skeleton */}
      <div className="space-y-3.5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
                  <div className="h-4 w-20 bg-blue-100 rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-64 bg-slate-100 rounded-md animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
                <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
