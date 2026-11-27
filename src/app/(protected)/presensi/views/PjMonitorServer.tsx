import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import type { UserRole } from '@prisma/client';
import PageContainer from '@/components/ui/PageContainer';
import type { RoleTabItem } from '@/components/navigation/RoleNavTabs';
import { loadPjTerritorySessions } from '../lib/presensi-queries';

interface PjMonitorServerProps {
  roleCodes: UserRole[];
  organizationId: string | null | undefined;
  availablePresensiRoles: RoleTabItem[];
}

export default async function PjMonitorServer({
  roleCodes,
  organizationId,
  availablePresensiRoles: _availablePresensiRoles,
}: PjMonitorServerProps) {
  const activeSessions = await loadPjTerritorySessions(
    roleCodes,
    organizationId
  );

  return (
    <PageContainer variant="standard" className="space-y-5">
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Pusat Kendali Presensi Teritorial</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Monitoring aktivitas sesi pengajian dan tingkat kehadiran santri di seluruh kelompok binaan.
          </p>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-xs rounded-2xl bg-slate-50 border border-slate-200">
            Tidak ada sesi pengajian yang sedang aktif saat ini di wilayah Anda.
          </div>
        ) : (
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    LIVE AKTIF
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-1">
                    {s.schedule.title}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {s.schedule.venuePlaceName || 'Masjid'}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">
                    {s.records.length} Santri Tercatat
                  </span>
                  <Link
                    href={`/presensi?scheduleId=${s.schedule.id}`}
                    className="min-h-[44px] sm:min-h-[38px] inline-flex items-center px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                  >
                    Buka Cockpit
                  </Link>
                  <Link
                    href={`/jadwal/${s.schedule.id}`}
                    className="min-h-[44px] sm:min-h-[38px] inline-flex items-center px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Rincian
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
