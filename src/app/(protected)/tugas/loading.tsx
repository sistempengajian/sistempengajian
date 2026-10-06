import React from 'react';

export default function TugasLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Multi-role switcher skeleton */}
      <div className="bg-white/70 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100/70 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-slate-200/80 rounded-md animate-pulse" />
            <div className="h-3 w-48 bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-24 bg-slate-200/70 rounded-xl animate-pulse" />
      </div>

      {/* 2. Top Banner Tugas Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100/80 animate-pulse" />
            <div className="h-6 w-44 bg-slate-200/90 rounded-lg animate-pulse" />
          </div>
          <div className="h-8 w-28 bg-amber-100/70 rounded-xl animate-pulse" />
        </div>
        <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 3. Filter Status Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 w-24 bg-white/80 border border-slate-200/70 rounded-xl shrink-0 animate-pulse"
          />
        ))}
      </div>

      {/* 4. Task Cards Skeleton List */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-48 bg-slate-200/90 rounded-md animate-pulse" />
                  <div className="h-4 w-16 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="h-3 w-72 bg-slate-100 rounded-md animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-slate-200/70 rounded-lg animate-pulse shrink-0" />
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div className="h-4 w-32 bg-slate-100 rounded-md animate-pulse" />
              <div className="h-8 w-24 bg-slate-200/80 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
