import React from 'react';
import Link from 'next/link';
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
  const isDbNormal = (adminMetrics?.dbHealth ?? 'Normal') === 'Normal';

  return (
    <section className={COMMON_THEME.cardClassPadded}>
      <h2 className={`${COMMON_THEME.sectionTitleClass} mb-3`}>
        Pusat Kendali Admin Master
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-200/80 rounded-xl border border-slate-200/80 bg-slate-50/90 py-2 text-center">
        <Link
          href="/organisasi"
          prefetch={true}
          className="py-2 px-2 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          title="Kelola tingkatan wilayah"
        >
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalWilayah ?? 0}
          </div>
          <div className="text-xs text-slate-600 font-medium">Wilayah Binaan</div>
        </Link>
        <Link
          href="/users"
          prefetch={true}
          className="py-2 px-2 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          title="Kelola data dewan guru"
        >
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalDewanGuru ?? 0}
          </div>
          <div className="text-xs text-slate-600 font-medium">Dewan Guru</div>
        </Link>
        <Link
          href="/users"
          prefetch={true}
          className="py-2 px-2 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          title="Kelola data santri"
        >
          <div className="text-base sm:text-lg font-black text-slate-900">
            {adminMetrics?.totalSantri ?? 0}
          </div>
          <div className="text-xs text-slate-600 font-medium">Total Santri</div>
        </Link>
        <Link
          href="/analisis"
          prefetch={true}
          className="py-2 px-2 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Buka analitika eksekutif sistem"
        >
          <div
            className={`text-base sm:text-lg font-black ${
              isDbNormal ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {adminMetrics?.dbHealth ?? 'Normal'}
          </div>
          <div className="text-xs text-slate-600 font-medium">Status Database</div>
        </Link>
      </div>
    </section>
  );
}
