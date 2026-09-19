import React from 'react';

export default function UsersLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="rounded-3xl bg-white/80 border border-slate-200/60 p-6 space-y-3">
        <div className="h-7 w-64 bg-slate-200 rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-100 rounded-lg" />
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/60 p-4 space-y-3"
          >
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-7 w-28 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="h-12 bg-slate-200/60 rounded-2xl" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-3xl bg-white border border-slate-200/60 p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
              <div className="space-y-1.5 flex-1">
                <div className="h-5 w-48 bg-slate-200 rounded-lg" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="h-16 bg-slate-50 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
