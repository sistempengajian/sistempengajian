import React from 'react';

export default function TambahKelasLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-slate-200/80 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-56 bg-slate-200/80 rounded-xl" />
          <div className="h-3.5 w-80 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Card 1 Skeleton */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-emerald-100/60 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-36 bg-slate-200/80 rounded-md" />
            <div className="h-3 w-48 bg-slate-100 rounded-md" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-full bg-slate-100 rounded-2xl" />
          <div className="h-10 w-full bg-slate-100 rounded-2xl" />
        </div>
      </div>

      {/* Card 2 Skeleton */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-sky-100/60 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-44 bg-slate-200/80 rounded-md" />
            <div className="h-3 w-56 bg-slate-100 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-14 bg-slate-100 rounded-2xl" />
          <div className="h-14 bg-slate-100 rounded-2xl" />
          <div className="h-14 bg-slate-100 rounded-2xl" />
          <div className="h-14 bg-slate-100 rounded-2xl" />
        </div>
        <div className="h-12 w-full bg-slate-100 rounded-2xl mt-2" />
      </div>

      {/* Card 3 Skeleton */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-teal-100/60 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-40 bg-slate-200/80 rounded-md" />
            <div className="h-3 w-52 bg-slate-100 rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-10 w-full bg-slate-100 rounded-xl" />
          <div className="h-12 w-full bg-slate-50 rounded-2xl" />
          <div className="h-12 w-full bg-slate-50 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
