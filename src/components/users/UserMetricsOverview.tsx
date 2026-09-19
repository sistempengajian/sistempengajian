'use client';

import React from 'react';
import { Users, GraduationCap, BookOpen, Landmark } from 'lucide-react';
import { UserMetrics } from './types';

interface UserMetricsOverviewProps {
  metrics: UserMetrics;
}

export default function UserMetricsOverview({ metrics }: UserMetricsOverviewProps) {
  const cards = [
    {
      label: 'Total Pengguna',
      value: `${metrics.totalUsers}`,
      subtext: `${metrics.activeUsers} Akun Aktif`,
      icon: Users,
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200/80',
      valColor: 'text-purple-950',
    },
    {
      label: 'Santri Binaan',
      value: `${metrics.totalSantri}`,
      subtext: 'Peserta Pengajian',
      icon: GraduationCap,
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
      valColor: 'text-emerald-950',
    },
    {
      label: 'Dewan Pengajar',
      value: `${metrics.totalPengajar}`,
      subtext: 'Ustadz & Wali Kelas',
      icon: BookOpen,
      iconBg: 'bg-teal-50 text-teal-600 border-teal-200/80',
      valColor: 'text-teal-950',
    },
    {
      label: 'Pengurus Wilayah',
      value: `${metrics.totalPj}`,
      subtext: 'PJ Daerah, Desa & Klp',
      icon: Landmark,
      iconBg: 'bg-sky-50 text-sky-600 border-sky-200/80',
      valColor: 'text-sky-950',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((item, idx) => {
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
              <span
                className={`text-lg sm:text-2xl font-black ${item.valColor} block tracking-tight`}
              >
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
