import React from 'react';

export default function ProtectedLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-pulse">
      {/* Top Card Skeleton */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2.5 flex-1">
          <div className="flex items-center gap-2">
            <div className="h-6 w-28 bg-slate-200/80 rounded-full" />
            <div className="h-6 w-24 bg-slate-200/80 rounded-full" />
          </div>
          <div className="h-8 w-48 bg-slate-200/90 rounded-xl" />
          <div className="h-4 w-64 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-200/80 rounded-2xl hidden sm:block" />
      </div>

      {/* Main Grid / Section Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm h-40 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100/60" />
          <div className="h-5 w-32 bg-slate-200/80 rounded-lg" />
          <div className="h-4 w-20 bg-slate-100 rounded-lg" />
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm h-40 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100/60" />
          <div className="h-5 w-28 bg-slate-200/80 rounded-lg" />
          <div className="h-4 w-24 bg-slate-100 rounded-lg" />
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm h-40 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100/60" />
          <div className="h-5 w-36 bg-slate-200/80 rounded-lg" />
          <div className="h-4 w-16 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Content List Skeleton */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="h-6 w-36 bg-slate-200/80 rounded-lg" />
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-200/80 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-1/3 bg-slate-200/90 rounded-md" />
                  <div className="h-3 w-1/2 bg-slate-200/60 rounded-md" />
                </div>
              </div>
              <div className="h-8 w-20 bg-slate-200/70 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
