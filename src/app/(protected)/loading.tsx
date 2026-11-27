import React from 'react';

export default function ProtectedLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-pulse">
      {/* Top Hero Card Skeleton */}
      <div className="bg-white/80 p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-xs space-y-2.5">
        <div className="h-7 w-52 bg-slate-200/90 rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 bg-slate-200/80 rounded-full" />
          <div className="h-5 w-20 bg-slate-200/70 rounded-full" />
        </div>
        <div className="pt-2 border-t border-slate-200/50">
          <div className="h-4 w-3/4 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Unified 3-Column Strip Skeleton (Anti-CLS mirror) */}
      <div className="bg-white/80 p-2 sm:p-2.5 rounded-2xl border border-slate-200/70 shadow-xs">
        <div className="grid grid-cols-3 divide-x divide-slate-200/70">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center justify-center py-2 px-2 gap-1.5 min-h-[68px]">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-200/80" />
              <div className="h-3.5 w-14 bg-slate-200/90 rounded-md" />
              <div className="h-3 w-16 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Card Skeleton */}
      <div className="bg-white/80 p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="h-5 w-36 bg-slate-200/80 rounded-lg" />
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-200/80 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-1/3 bg-slate-200/90 rounded-md" />
                  <div className="h-3 w-1/2 bg-slate-200/60 rounded-md" />
                </div>
              </div>
              <div className="h-10 w-20 bg-slate-200/70 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
