'use client';

import React, { useState, useTransition } from 'react';
import {
  Trophy,
  Crown,
  Gift,
  Award,
  Filter,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  GamificationDashboardData,
  GamifikasiFilterOptions,
  GamifikasiPeriod,
  GamifikasiScopeType,
} from '@/app/(protected)/gamifikasi/types';
import { getGamificationDashboardData } from '@/app/(protected)/gamifikasi/actions';
import LeaderboardPodium from './LeaderboardPodium';
import LeaderboardList from './LeaderboardList';
import UserProfileSummary from './UserProfileSummary';
import MissionTrackerCard from './MissionTrackerCard';
import TrophyCabinet from './TrophyCabinet';

interface GamifikasiClientWrapperProps {
  initialData: GamificationDashboardData;
}

type ActiveViewTab = 'LEADERBOARD' | 'MISSIONS' | 'TROPHIES';

export default function GamifikasiClientWrapper({ initialData }: GamifikasiClientWrapperProps) {
  const [data, setData] = useState<GamificationDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('LEADERBOARD');
  const [isPending, startTransition] = useTransition();

  // Local filter states
  const [selectedScope, setSelectedScope] = useState<string>(
    initialData.currentFilter.scopeId || 'ALL'
  );
  const [selectedPeriod, setSelectedPeriod] = useState<GamifikasiPeriod>(
    initialData.currentFilter.period || 'THIS_MONTH'
  );

  // Apply filter update
  const handleFilterChange = (newScopeId: string, newPeriod: GamifikasiPeriod) => {
    setSelectedScope(newScopeId);
    setSelectedPeriod(newPeriod);

    startTransition(async () => {
      let scopeType: GamifikasiScopeType = 'ALL';
      let scopeId: string | undefined = undefined;

      if (newScopeId !== 'ALL') {
        const option = data.scopeOptions.find((o) => o.id === newScopeId);
        if (option) {
          scopeType = option.type;
          scopeId = option.id;
        }
      }

      const updated = await getGamificationDashboardData({
        scopeType,
        scopeId,
        period: newPeriod,
        studentId: data.userProfile?.studentId,
      });

      setData(updated);
    });
  };

  const handleRefresh = () => {
    handleFilterChange(selectedScope, selectedPeriod);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 inline-flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
              Gamifikasi Qur&apos;ani
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Musabaqah Fastabiqul Khoirot</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Papan Peringkat & Prestasi Santri
          </h1>
        </div>

        {/* Action / Refresh Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className="px-3 py-2 rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* 2. User Profile Summary (Sticky / Top Card) */}
      <UserProfileSummary
        userProfile={data.userProfile}
        onNavigateToMissions={() => setActiveTab('MISSIONS')}
      />

      {/* 3. Filter Bar (Scope & Periode) */}
      <div className="p-3.5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/70 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Scope Selection */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div className="relative flex-1 min-w-0">
            <select
              value={selectedScope}
              onChange={(e) => handleFilterChange(e.target.value, selectedPeriod)}
              disabled={isPending}
              className="w-full appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 pr-8 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="ALL">Semua Santri (Gabungan Seluruh Kelas)</option>
              {data.scopeOptions
                .filter((o) => o.type !== 'ALL')
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Right: Period Selection */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => handleFilterChange(selectedScope, e.target.value as GamifikasiPeriod)}
              disabled={isPending}
              className="appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 pr-8 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="THIS_MONTH">Bulan Ini (Default)</option>
              <option value="THIS_WEEK">Pekan Ini</option>
              <option value="THIS_SEMESTER">Semester Ini</option>
              <option value="ALL_TIME">Sepanjang Waktu (Hall of Fame)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Switcher */}
      <div className="flex items-center justify-center sm:justify-start gap-1 p-1 rounded-2xl bg-slate-200/70 max-w-md mx-auto sm:mx-0">
        <button
          type="button"
          onClick={() => setActiveTab('LEADERBOARD')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'LEADERBOARD'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Crown className={`w-4 h-4 ${activeTab === 'LEADERBOARD' ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
          <span>Papan Juara</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MISSIONS')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'MISSIONS'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className={`w-4 h-4 ${activeTab === 'MISSIONS' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Misi & Tantangan</span>
          {(data.userProfile?.availableClaimableMissions || 0) > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute top-2 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TROPHIES')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'TROPHIES'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className={`w-4 h-4 ${activeTab === 'TROPHIES' ? 'text-amber-600' : 'text-slate-400'}`} />
          <span>Lemari Trofi</span>
        </button>
      </div>

      {/* 5. Main Content Area */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        {activeTab === 'LEADERBOARD' && (
          <div className="space-y-6">
            {/* Podium (Ranks 1, 2, 3) */}
            <LeaderboardPodium
              podium={data.podium}
              periodLabel={data.periodLabel}
            />

            {/* List (Ranks 4 - 10) */}
            <LeaderboardList
              rankings={data.rankingsList}
              totalParticipants={data.totalParticipants}
            />
          </div>
        )}

        {activeTab === 'MISSIONS' && (
          <MissionTrackerCard
            studentId={data.userProfile?.studentId || ''}
            dailyMissions={data.dailyMissions}
            weeklyMissions={data.weeklyMissions}
            milestoneMissions={data.milestoneMissions}
            onMissionClaimed={(rewardXp) => {
              // Optimistically update points
              if (data.userProfile) {
                const newPts = data.userProfile.totalPoints + rewardXp;
                setData({
                  ...data,
                  userProfile: {
                    ...data.userProfile,
                    totalPoints: newPts,
                    availableClaimableMissions: Math.max(0, data.userProfile.availableClaimableMissions - 1),
                  },
                });
              }
            }}
          />
        )}

        {activeTab === 'TROPHIES' && (
          <TrophyCabinet badges={data.badges} />
        )}
      </div>
    </div>
  );
}
