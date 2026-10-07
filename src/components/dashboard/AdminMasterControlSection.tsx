import React from 'react';
import { COMMON_THEME } from '@/lib/theme';

interface AdminMasterControlSectionProps {
  adminMetrics: {
    totalWilayah: number;
    totalDewanGuru: number;
    totalSantri: number;
    dbHealth: string;
    [key: string]: any;
  } | null;
}

export default function AdminMasterControlSection({
  adminMetrics,
}: AdminMasterControlSectionProps) {
  return (
    <section className={COMMON_THEME.cardClassPadded}>
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={COMMON_THEME.sectionTitleClass}>
              Pusat Kendali Admin Master
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Monitoring integritas hierarki wilayah, dewan guru, dan database
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-150 rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm py-3 text-center shadow-2xs">
        <div className="py-1">
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalWilayah ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Wilayah Binaan</div>
        </div>
        <div className="py-1">
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalDewanGuru ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Dewan Guru</div>
        </div>
        <div className="py-1">
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalSantri ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Total Santri</div>
        </div>
        <div className="py-1">
          <div className="text-base sm:text-lg font-black text-emerald-600">
            {adminMetrics?.dbHealth ?? 'Normal'}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Status Database</div>
        </div>
      </div>
    </section>
  );
}
