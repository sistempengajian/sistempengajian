'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Crown,
  Building2,
  Landmark,
  Globe,
  Calendar,
  RefreshCw,
  ChevronRight,
  Gift,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  LeaderboardDashboardData,
  LeaderboardRegionTier,
  GamifikasiPeriod,
} from '@/app/(protected)/gamifikasi/types';
import { getLeaderboardData } from '@/app/(protected)/gamifikasi/actions';
import LeaderboardPodium from '@/components/gamifikasi/LeaderboardPodium';
import LeaderboardList from '@/components/gamifikasi/LeaderboardList';
import CustomSelect from '@/components/ui/CustomSelect';

interface LeaderboardClientWrapperProps {
  initialData: LeaderboardDashboardData;
}

export default function LeaderboardClientWrapper({
  initialData,
}: LeaderboardClientWrapperProps) {
  const [data, setData] = useState<LeaderboardDashboardData>(initialData);
  const [isPending, startTransition] = useTransition();

  const [activeTier, setActiveTier] = useState<LeaderboardRegionTier>(
    initialData.currentTier
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    initialData.selectedOrgId || ''
  );
  const [selectedPeriod, setSelectedPeriod] = useState<GamifikasiPeriod>(
    initialData.selectedPeriod
  );

  // Handle Tab Switch for Regional Tier with automatic user default resolution
  const handleTierChange = (newTier: LeaderboardRegionTier) => {
    setActiveTier(newTier);

    let defaultOrgId = '';
    if (newTier === 'DAERAH') {
      defaultOrgId = data.userDefaultDaerahId || data.availableDaerah[0]?.id || '';
    } else if (newTier === 'DESA') {
      defaultOrgId = data.userDefaultDesaId || data.availableDesa[0]?.id || '';
    } else if (newTier === 'KELOMPOK') {
      defaultOrgId = data.userDefaultKelompokId || data.availableKelompok[0]?.id || '';
    }

    setSelectedOrgId(defaultOrgId);

    startTransition(async () => {
      const updated = await getLeaderboardData({
        regionTier: newTier,
        organizationId: defaultOrgId,
        period: selectedPeriod,
      });
      setData(updated);
    });
  };

  // Handle Organization or Period sub-filter update
  const handleSubFilterChange = (newOrgId: string, newPeriod: GamifikasiPeriod) => {
    setSelectedOrgId(newOrgId);
    setSelectedPeriod(newPeriod);

    startTransition(async () => {
      const updated = await getLeaderboardData({
        regionTier: activeTier,
        organizationId: newOrgId,
        period: newPeriod,
      });
      setData(updated);
    });
  };

  const handleRefresh = () => {
    handleSubFilterChange(selectedOrgId, selectedPeriod);
  };

  // Available options for current active tier
  const currentOrgOptions =
    activeTier === 'KELOMPOK'
      ? data.availableKelompok
      : activeTier === 'DESA'
      ? data.availableDesa
      : data.availableDaerah;

  return (
    <div className="space-y-3 sm:space-y-4 pb-32 sm:pb-36 relative">
      {/* 1. REGIONAL TIER TAB NAVIGATION SWITCHER (Daerah, Desa, Kelompok) */}
      <div className="p-1 sm:p-1.5 rounded-2xl bg-slate-200/80 backdrop-blur-sm border border-slate-300/60 shadow-inner flex items-center gap-1 sm:gap-1.5 max-w-xl mx-auto sm:mx-0">
        {/* Tab 1: Tingkat Daerah */}
        <button
          type="button"
          onClick={() => handleTierChange('DAERAH')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer ${
            activeTier === 'DAERAH'
              ? 'bg-white text-amber-800 shadow-md ring-1 ring-amber-500/20 scale-[1.02]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Globe
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
              activeTier === 'DAERAH' ? 'text-amber-600' : 'text-slate-400'
            }`}
          />
          <span>Daerah</span>
        </button>

        {/* Tab 2: Tingkat Desa */}
        <button
          type="button"
          onClick={() => handleTierChange('DESA')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer ${
            activeTier === 'DESA'
              ? 'bg-white text-indigo-800 shadow-md ring-1 ring-indigo-500/20 scale-[1.02]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Landmark
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
              activeTier === 'DESA' ? 'text-indigo-600' : 'text-slate-400'
            }`}
          />
          <span>Desa</span>
        </button>

        {/* Tab 3: Tingkat Kelompok */}
        <button
          type="button"
          onClick={() => handleTierChange('KELOMPOK')}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 cursor-pointer ${
            activeTier === 'KELOMPOK'
              ? 'bg-white text-emerald-800 shadow-md ring-1 ring-emerald-500/20 scale-[1.02]'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Building2
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
              activeTier === 'KELOMPOK' ? 'text-emerald-600' : 'text-slate-400'
            }`}
          />
          <span>Kelompok</span>
        </button>
      </div>

      {/* 2. Sub-Filter Row: Specific Organization & Period Selector */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/70 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Organization Dropdown */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <CustomSelect
                value={selectedOrgId}
                onChange={(val) => handleSubFilterChange(val as string, selectedPeriod)}
                disabled={isPending || currentOrgOptions.length === 0}
                options={currentOrgOptions.map((org) => ({
                  value: org.id,
                  label:
                    activeTier === 'KELOMPOK'
                      ? `Kelompok ${org.name}`
                      : activeTier === 'DESA'
                      ? `Desa ${org.name}`
                      : `Daerah ${org.name}`,
                }))}
                size="sm"
                searchable={currentOrgOptions.length > 5}
                searchPlaceholder="Cari wilayah..."
                placeholder="Pilih Wilayah"
              />
            </div>
          </div>

          {/* Period Dropdown */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-0 sm:min-w-[170px]">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <CustomSelect
                value={selectedPeriod}
                onChange={(val) => handleSubFilterChange(selectedOrgId, val as GamifikasiPeriod)}
                disabled={isPending}
                options={[
                  { value: 'THIS_MONTH', label: 'Bulan Ini' },
                  { value: 'THIS_WEEK', label: 'Pekan Ini' },
                  { value: 'THIS_SEMESTER', label: 'Semester Ini' },
                  { value: 'ALL_TIME', label: 'Sepanjang Waktu' },
                ]}
                size="sm"
                placeholder="Pilih Periode"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Leaderboard Display (Podium & List) */}
      <div className={`space-y-5 transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {/* Podium Step-up Display (Rank 1 Gold Center, Rank 2 Silver Left, Rank 3 Bronze Right) */}
        <LeaderboardPodium
          podium={data.podium}
          periodLabel={`${data.tierLabel} • ${data.periodLabel}`}
        />

        {/* List for Ranks 4 to 10 */}
        <LeaderboardList
          rankings={data.rankingsList}
          totalParticipants={data.totalParticipants}
        />
      </div>

      {/* 4. STICKY BOTTOM USER RANK POSITION BAR (Floating Above BottomNav) */}
      {data.currentUserRank && (
        <aside 
          aria-label="Posisi peringkat santri Anda"
          className="fixed bottom-[80px] xs:bottom-[82px] sm:bottom-28 inset-x-3 sm:inset-x-6 max-w-2xl mx-auto z-40 animate-in fade-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
        >
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 backdrop-blur-xl border border-amber-400/40 shadow-2xl shadow-slate-950/60 flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Rank Badge */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/90 text-yellow-900 font-black text-xs sm:text-sm flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/30">
                #{data.currentUserRank.rank}
              </div>

              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-wider block leading-tight truncate">
                  Posisi Anda di {data.tierLabel}
                </span>
                <span className="font-bold text-xs sm:text-sm text-white truncate block leading-tight mt-0.5">
                  {data.currentUserRank.fullName} • <span className="text-white">{data.currentUserRank.totalPoints.toLocaleString('id-ID')} XP</span>
                </span>
              </div>
            </div>

            {/* CTA Button */}
            <Link
              href="/gamifikasi"
              prefetch={true}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/90 hover:from-white/80 hover:to-slate-100/80 text-yellow-900 font-extrabold text-[11px] sm:text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 transition-all flex-shrink-0 whitespace-nowrap"
            >
              <span className="hidden xs:inline">Misi &amp; Trofi</span>
              <span className="xs:hidden">Misi</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-80" />
            </Link>
          </div>
        </aside>
      )}
    </div>
  );
}
