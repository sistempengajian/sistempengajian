import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import { TOUCH_TARGET } from '@/lib/design-tokens';

interface PjTerritoryMonitoringSectionProps {
  pjMetrics: {
    totalSantri: number;
    attendanceRate: number;
    pendingApprovals: number;
    [key: string]: any;
  } | null;
  pendingApprovalsCount: number;
}

export default function PjTerritoryMonitoringSection({
  pjMetrics,
  pendingApprovalsCount,
}: PjTerritoryMonitoringSectionProps) {
  return (
    <section className={COMMON_THEME.cardClassPadded}>
      <h2 className={`${COMMON_THEME.sectionTitleClass} mb-3`}>
        Metrik Tata Kelola Wilayah
      </h2>

      <div className="grid grid-cols-3 divide-x divide-slate-200/80 rounded-xl border border-slate-200/80 bg-slate-50/90 py-2 text-center">
        <Link
          href="/users"
          prefetch={true}
          className="px-2 py-1.5 rounded-l-xl hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="Lihat daftar santri binaan"
        >
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {pjMetrics?.totalSantri ?? 0}
          </div>
          <div className="text-xs text-slate-600 font-medium mt-0.5">
            Santri Binaan
          </div>
        </Link>
        <Link
          href="/analisis"
          prefetch={true}
          className="px-2 py-1.5 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Lihat analitika kehadiran wilayah"
        >
          <div className="text-lg sm:text-xl font-black text-emerald-600">
            {pjMetrics?.attendanceRate ?? 0}%
          </div>
          <div className="text-xs text-slate-600 font-medium mt-0.5">
            Rata-rata Hadir
          </div>
        </Link>
        <Link
          href="/private-remedial"
          prefetch={true}
          className="px-2 py-1.5 rounded-r-xl hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          title="Buka antrean approval private remedial"
        >
          <div className="text-lg sm:text-xl font-black text-rose-600">
            {pendingApprovalsCount}
          </div>
          <div className="text-xs text-slate-600 font-medium mt-0.5">
            Pending Approval
          </div>
        </Link>
      </div>

      {pendingApprovalsCount > 0 && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Terdapat {pendingApprovalsCount} pengajuan Private Remedial menunggu verifikasi Anda.
            </span>
          </div>
          <Link
            href="/private-remedial"
            prefetch={true}
            className={`${TOUCH_TARGET.minButton} px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-2xs inline-flex items-center justify-center`}
          >
            Tinjau
          </Link>
        </div>
      )}
    </section>
  );
}
