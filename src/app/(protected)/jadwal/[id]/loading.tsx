import React from 'react';

export default function ScheduleDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-pulse">
      {/* Top Nav Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-36 bg-slate-200 rounded-xl" />
        <div className="h-4 w-48 bg-slate-200 rounded-md" />
      </div>

      {/* Hero Banner Skeleton */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-slate-200 rounded-full" />
          <div className="h-6 w-28 bg-slate-200 rounded-full" />
        </div>
        <div className="h-8 w-3/4 bg-slate-200 rounded-xl" />
        <div className="h-4 w-1/2 bg-slate-200 rounded-md" />
      </div>

      {/* 4 Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-5 w-32 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Detail Section Skeleton */}
      <div className="h-48 bg-white rounded-2xl border border-slate-200/80 p-5" />
    </div>
  );
}
