/**
 * DashboardMetricsSkeleton
 *
 * Mirrors the exact solid card geometry of StatusGridSection (3-column strip card),
 * UpcomingScheduleCard, role summary section, and QuickActionsGrid to minimize CLS during SSR streaming.
 */
export function DashboardMetricsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      {/* StatusGridSection mirror — glassmorphism slim 3-column stat bar */}
      <div className="rounded-2xl bg-white/75 backdrop-blur-md border border-white/90 p-1.5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-3 divide-x divide-slate-200/50">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-2 px-2 gap-1 min-h-[54px]">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-200/80 shrink-0" />
                <div className="h-3.5 w-10 rounded-md bg-slate-200/90" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* UpcomingScheduleCard mirror — Full-bleed Horizontal Floating Peek Card + dots */}
      <div className="space-y-1">
        <div className="flex gap-3 overflow-hidden -mx-4 px-4 sm:-mx-6 sm:px-6 pt-2 pb-5 -mt-2 -mb-3">
          <div className="w-[88%] sm:w-[90%] shrink-0 rounded-3xl bg-white/95 border border-white/90 p-4 sm:p-5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-5 w-20 rounded-full bg-sky-100/80" />
              <div className="h-4 w-16 rounded-md bg-slate-200/70" />
            </div>
            <div className="h-5 w-48 rounded-lg bg-slate-200/90" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="h-4 w-36 rounded-md bg-slate-100" />
              <div className="h-4 w-32 rounded-md bg-slate-100" />
              <div className="h-4 w-40 rounded-md bg-slate-100" />
              <div className="h-4 w-36 rounded-md bg-slate-100" />
            </div>
          </div>
          <div className="w-[88%] sm:w-[90%] shrink-0 rounded-3xl bg-white/75 border border-white/70 p-4 sm:p-5" />
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <div className="h-1.5 w-5 rounded-full bg-slate-300" />
          <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
          <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
        </div>
      </div>

      {/* Role-specific summary section mirror (clean divide-y rows) */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="h-5 w-44 rounded-lg bg-slate-200/90" />
          <div className="h-9 w-28 rounded-xl bg-slate-100" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="h-4 w-40 rounded-md bg-slate-200/80" />
                <div className="h-3 w-52 rounded-md bg-slate-100" />
              </div>
              <div className="w-11 h-11 rounded-full bg-slate-100 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* QuickActionsGrid mirror — Soft-glass symmetric 3x2 / 6-col squircle grid */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 p-4 sm:p-5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.08)] space-y-3">
        <div className="h-5 w-28 rounded-lg bg-slate-200/80" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-2.5 sm:gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col items-center py-2 gap-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-200/80" />
              <div className="h-3 w-14 rounded-md bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
