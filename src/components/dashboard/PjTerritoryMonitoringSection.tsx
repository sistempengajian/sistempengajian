import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';

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
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={COMMON_THEME.sectionTitleClass}>
              Metrik Tata Kelola Wilayah
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Pemantauan keaktifan santri &amp; approval sesi private remedial
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-150 rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm py-3 text-center shadow-2xs">
        <div>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            {pjMetrics?.totalSantri ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Santri Binaan
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-black text-emerald-600">
            {pjMetrics?.attendanceRate ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Rata-rata Hadir
          </div>
        </div>
        <div>
          <div className="text-lg sm:text-xl font-black text-rose-600">
            {pendingApprovalsCount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Pending Approval
          </div>
        </div>
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
            className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-2xs"
          >
            Tinjau
          </Link>
        </div>
      )}
    </section>
  );
}
