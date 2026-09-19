'use client';

import React from 'react';
import { School, Users, Landmark, UserCheck } from 'lucide-react';
import { ClassMetrics } from './types';

interface ClassMetricsOverviewProps {
  metrics: ClassMetrics;
}

export default function ClassMetricsOverview({ metrics }: ClassMetricsOverviewProps) {
  const items = [
    {
      label: 'Total Kelas',
      value: `${metrics.totalClasses} Kelas`,
      subtext: 'Seluruh Ruang Binaan',
      icon: School,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
      valColor: 'text-emerald-950',
    },
    {
      label: 'Tingkat Kelompok',
      value: `${metrics.totalKelompokClasses} Kelas`,
      subtext: 'Binaan Tingkat Dasar',
      icon: Users,
      iconBg: 'bg-sky-50 text-sky-600 border-sky-200/80',
      valColor: 'text-sky-950',
    },
    {
      label: 'Tingkat Desa/Daerah',
      value: `${metrics.totalDesaDaerahClasses} Kelas`,
      subtext: 'Binaan Wilayah Gabungan',
      icon: Landmark,
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
      valColor: 'text-indigo-950',
    },
    {
      label: 'Wali Kelas Aktif',
      value: `${metrics.totalHomeroomAssigned} Pengampu`,
      subtext: 'Ustadz / Ustadzah Terpilih',
      icon: UserCheck,
      iconBg: 'bg-teal-50 text-teal-600 border-teal-200/80',
      valColor: 'text-teal-950',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="rounded-2xl sm:rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/70 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-2 group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
                {item.label}
              </span>
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border ${item.iconBg} flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
              >
                <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>

            <div>
              <span className={`text-base sm:text-xl font-black ${item.valColor} block tracking-tight`}>
                {item.value}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
                {item.subtext}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
