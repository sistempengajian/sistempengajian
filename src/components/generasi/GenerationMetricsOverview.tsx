'use client';

import React from 'react';
import { Layers, Users, GraduationCap, BookOpen } from 'lucide-react';

interface GenerationMetricsOverviewProps {
  totalGenerations: number;
  totalStudents: number;
  totalClasses: number;
  totalMaterials: number;
}

export default function GenerationMetricsOverview({
  totalGenerations,
  totalStudents,
  totalClasses,
  totalMaterials,
}: GenerationMetricsOverviewProps) {
  const metrics = [
    {
      label: 'Total Jenjang',
      value: `${totalGenerations} Jenjang`,
      icon: Layers,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
    },
    {
      label: 'Total Santri Terdaftar',
      value: `${totalStudents} Santri`,
      icon: Users,
      iconBg: 'bg-sky-50 text-sky-600 border-sky-200/80',
    },
    {
      label: 'Kelas Aktif',
      value: `${totalClasses} Kelas`,
      icon: GraduationCap,
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200/80',
    },
    {
      label: 'Materi Kurikulum',
      value: `${totalMaterials} Modul`,
      icon: BookOpen,
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200/80',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div
            key={idx}
            className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/60 p-4 sm:p-4.5 shadow-2xs flex items-center gap-3.5 transition-all hover:shadow-xs hover:border-slate-300/80"
          >
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${m.iconBg}`}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">

              <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight block truncate">
                {m.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
