import React from 'react';
import PageContainer from '@/components/ui/PageContainer';

export default function JadwalLoading() {
  return (
    <PageContainer variant="standard" className="space-y-3.5 sm:space-y-4 animate-fade-in">
      {/* Boxless Header Skeleton */}
      <div className="pt-1 pb-0.5 pr-12 sm:pr-0 pl-2 space-y-2">
        <div className="h-7 w-52 bg-emerald-900/10 rounded-xl animate-pulse" />
        <div className="h-4 w-72 max-w-full bg-slate-400/15 rounded-lg animate-pulse" />
      </div>

      {/* Top Control Row Skeleton: Detached Icon Toggle + Search/Filter Pill */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="h-11 w-[84px] sm:w-48 bg-white/85 rounded-2xl border border-white/90 shadow-xs animate-pulse shrink-0" />
          <div className="h-11 flex-1 bg-white/85 rounded-2xl border border-white/90 shadow-xs animate-pulse" />
        </div>
        <div className="hidden md:flex gap-2 shrink-0">
          <div className="h-10 w-24 bg-slate-200/80 rounded-xl animate-pulse" />
          <div className="h-10 w-28 bg-slate-200/90 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Standalone Calendar Card Skeleton Matching Actual h-11 sm:h-12 Cells */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-white/90 p-4 sm:p-5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.09)] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="h-6 w-36 bg-slate-200/90 rounded-lg animate-pulse" />
          <div className="flex gap-1.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
            <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 pb-1 border-b border-slate-200/60">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-3.5 bg-slate-100 rounded animate-pulse mx-auto w-7" />
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {[...Array(35)].map((_, i) => (
            <div
              key={i}
              className="h-11 sm:h-12 rounded-xl bg-slate-100/70 animate-pulse"
            />
          ))}
        </div>

        <div className="flex justify-center gap-4 pt-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 w-14 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Separated Session List Sheet Skeleton */}
      <div className="rounded-3xl bg-white/95 backdrop-blur-md border border-white/95 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)] overflow-hidden">
        <div className="px-4 sm:px-5 pt-2.5 pb-3 border-b border-slate-200/60 space-y-2.5">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-10 h-1 rounded-full bg-slate-200 animate-pulse" />
            <div className="h-2.5 w-36 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-44 bg-slate-200/80 rounded-lg animate-pulse" />
            <div className="flex items-center gap-1.5">
              <div className="h-9 w-20 bg-slate-100 rounded-xl animate-pulse" />
              <div className="w-9 h-9 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
        <div className="p-3.5 sm:p-5">
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-white/95 space-y-2.5">
            <div className="flex gap-1.5">
              <div className="h-5 w-16 rounded-full bg-sky-100/80 animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-amber-100/80 animate-pulse" />
            </div>
            <div className="h-5 w-48 rounded-lg bg-slate-200/85 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-36 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-28 rounded bg-slate-100 animate-pulse" />
              <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
