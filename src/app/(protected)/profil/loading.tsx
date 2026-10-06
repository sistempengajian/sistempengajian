import React from 'react';

export default function ProfilLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Profile Header Card Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/70 shadow-2xs flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 animate-pulse shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 bg-slate-200/90 rounded-xl animate-pulse mx-auto sm:mx-0" />
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="h-5 w-24 bg-emerald-100/70 rounded-full animate-pulse" />
            <div className="h-5 w-32 bg-slate-100 rounded-full animate-pulse" />
          </div>
          <div className="h-3.5 w-60 bg-slate-100 rounded-md animate-pulse mx-auto sm:mx-0" />
        </div>
      </div>

      {/* 2. Form Section Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-4">
        <div className="h-5 w-40 bg-slate-200/90 rounded-md animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-24 bg-slate-100 rounded-md animate-pulse" />
              <div className="h-10 w-full bg-slate-50 border border-slate-200/60 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
