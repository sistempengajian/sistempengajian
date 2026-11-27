import React from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import { TOUCH_TARGET } from '@/lib/design-tokens';
import ProgressCircle from '@/components/dashboard/ProgressCircle';
import type { ChildProgressMetric } from '@/app/(protected)/dashboard/queries';

interface ChildItem {
  student: {
    id: string;
    fullName: string;
    generation?: { name: string } | null;
    gamification?: { totalPoints: number } | null;
  };
  relationshipType?: string | null;
}

interface ParentChildrenProgressSectionProps {
  childrenList: ChildItem[];
  childrenMetricsMap: Record<string, ChildProgressMetric>;
}

export default function ParentChildrenProgressSection({
  childrenList,
  childrenMetricsMap,
}: ParentChildrenProgressSectionProps) {
  return (
    <section id="anak" className={COMMON_THEME.cardClassPadded}>
      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
        <h2 className={`${COMMON_THEME.sectionTitleClass} min-w-0 truncate`}>
          Ananda dalam Binaan ({childrenList.length})
        </h2>

        <Link
          href="/presensi?role=parent"
          prefetch={true}
          className={`${TOUCH_TARGET.minButton} px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer inline-flex items-center justify-center shadow-2xs`}
        >
          Ajukan Izin
        </Link>
      </div>

      <div className="divide-y divide-slate-100">
        {childrenList.map(({ student }) => {
          const childMetric = childrenMetricsMap[student.id];
          const overallPct = childMetric?.curriculumPercentage ?? 0;
          const monthlyPct = childMetric?.monthlyPercentage ?? 0;
          const attendancePct = childMetric?.attendancePercentage ?? 0;
          const attendanceHadir = childMetric?.attendanceHadir ?? 0;
          const attendanceTotal = childMetric?.attendanceTotal ?? 0;

          return (
            <div
              key={student.id}
              className="py-3 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-bold text-sm text-slate-900 leading-tight">
                    {student.fullName}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    {student.generation?.name || 'Santri'} •{' '}
                    <Star className="size-3 text-[#ffaf29] fill-[#ffaf29]" />
                    {student.gamification?.totalPoints || 0} Poin
                  </span>
                </div>

                {/* 3 Metrik Nyata per Ananda */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                    Jenjang: {overallPct}%
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
                    Bulan Ini: {monthlyPct}%
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    Hadir:{' '}
                    {attendanceTotal > 0
                      ? `${attendancePct}% (${attendanceHadir}/${attendanceTotal})`
                      : 'Belum ada sesi'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <Link
                  href={`/laporan?childId=${encodeURIComponent(student.id)}&role=parent`}
                  prefetch={true}
                  className={`${TOUCH_TARGET.minButton} px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-indigo-700 font-semibold text-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer`}
                >
                  <span>Rapor Ananda</span>
                  <ProgressCircle percentage={overallPct} size={36} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
