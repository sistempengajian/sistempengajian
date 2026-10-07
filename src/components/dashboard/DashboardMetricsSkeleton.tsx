/**
 * DashboardMetricsSkeleton
 *
 * Shown while the heavy async DashboardMetrics component streams in.
 * Mirrors the visual layout of StatusGridSection + UpcomingScheduleCard
 * so there's no layout shift when real data arrives.
 */
export function DashboardMetricsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      {/* Status grid — 4 cards */}
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-slate-200/70 backdrop-blur-sm"
          />
        ))}
      </div>

      {/* Upcoming schedule card */}
      <div className="h-40 rounded-2xl bg-slate-200/70" />

      {/* Role-specific section */}
      <div className="h-32 rounded-2xl bg-slate-200/70" />
    </div>
  );
}
