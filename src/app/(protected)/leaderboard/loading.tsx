import React from 'react';

export default function LeaderboardLoading() {
  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* 1. Header Banner Skeleton */}
      <div className="bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100/80 animate-pulse" />
          <div className="h-6 w-52 bg-slate-200/90 rounded-lg animate-pulse" />
        </div>
        <div className="h-4 w-72 bg-slate-100 rounded-md animate-pulse" />
      </div>

      {/* 2. Top 3 Podium Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/70 shadow-2xs flex items-end justify-center gap-4 sm:gap-8 pt-10 pb-6">
        {/* Rank 2 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-slate-200/80 animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded-md animate-pulse" />
          <div className="w-20 sm:w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200/60 animate-pulse" />
        </div>
        {/* Rank 1 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-amber-200/80 animate-pulse" />
          <div className="h-4 w-24 bg-slate-200 rounded-md animate-pulse" />
          <div className="w-24 sm:w-28 h-32 rounded-2xl bg-amber-50 border border-amber-200/70 animate-pulse" />
        </div>
        {/* Rank 3 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-slate-200/80 animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded-md animate-pulse" />
          <div className="w-20 sm:w-24 h-20 rounded-2xl bg-slate-100 border border-slate-200/60 animate-pulse" />
        </div>
      </div>

      {/* 3. Leaderboard List Skeleton */}
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs space-y-2.5">
        {[4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 text-center font-bold text-slate-300">#{i}</div>
              <div className="w-9 h-9 rounded-xl bg-slate-200/80 animate-pulse" />
              <div className="space-y-1">
                <div className="h-4 w-32 bg-slate-200/80 rounded-md animate-pulse" />
                <div className="h-3 w-20 bg-slate-100 rounded-md animate-pulse" />
              </div>
            </div>
            <div className="h-6 w-16 bg-amber-100/70 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
