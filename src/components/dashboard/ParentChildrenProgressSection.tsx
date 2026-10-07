import React from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import ProgressCircle from '@/components/dashboard/ProgressCircle';

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
  childrenMetricsMap: Record<string, { curriculumPercentage: number; [key: string]: any }>;
}

export default function ParentChildrenProgressSection({
  childrenList,
  childrenMetricsMap,
}: ParentChildrenProgressSectionProps) {
  return (
    <section id="anak" className={COMMON_THEME.cardClassPadded}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={COMMON_THEME.sectionTitleClass}>
                Daftar Ananda dalam Binaan ({childrenList.length} Santri)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Pantau capaian rapor hafalan, kehadiran, dan kedisiplinan ananda
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {childrenList.map(({ student, relationshipType }) => {
          const childMetric = childrenMetricsMap[student.id];
          const pct = childMetric?.curriculumPercentage ?? 0;
          return (
            <div
              key={student.id}
              className="p-3.5 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-bold text-sm text-slate-900 leading-tight">
                    {student.fullName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    {student.generation?.name || 'Caberawit'}{' '}
                    <Star className="size-3 text-[#ffaf29] fill-[#ffaf29]" />
                    {student.gamification?.totalPoints || 0} Poin
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/laporan?childId=${student.id}`}
                  prefetch={true}
                  className="px-3 py-1.5 rounded-xl bg-white/0 hover:bg-slate-50 text-indigo-600 font-semibold text-xs transition-all flex items-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ml-1"
                >
                  <div className="hidden sm:flex flex-col items-end text-right">
                    <span className="text-[11px] font-semibold text-slate-700">
                      Rapor Ananda
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {pct}% Tercapai
                    </span>
                  </div>
                  <ProgressCircle percentage={pct} size={42} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner Cepat Ajukan Izin Sakit */}
      <div
        id="izin"
        className="mt-3.5 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
      >
        <div className="flex items-center gap-2.5">
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Ajukan Izin / Sakit Ananda
            </span>
            <span className="text-[11px] text-slate-600">
              Kirim surat dispensasi halangan hadir langsung ke ustadz pembina halaqah.
            </span>
          </div>
        </div>
        <Link
          href="/presensi?role=parent"
          prefetch={true}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shrink-0 self-end sm:self-center cursor-pointer inline-flex items-center"
        >
          Ajukan Izin
        </Link>
      </div>
    </section>
  );
}
