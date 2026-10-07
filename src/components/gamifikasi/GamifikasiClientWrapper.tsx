'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Gift,
  Trophy,
  Crown,
  ChevronRight,
  Sparkles,
  Zap,
  Star,
  RefreshCw,
} from 'lucide-react';
import {
  StudentGamificationDashboardData,
  GamificationMission,
  calculateLevelInfo,
} from '@/app/(protected)/gamifikasi/types';
import UserProfileSummary from './UserProfileSummary';
import MissionTrackerCard from './MissionTrackerCard';
import TrophyCabinet from './TrophyCabinet';

interface GamifikasiClientWrapperProps {
  initialData: StudentGamificationDashboardData;
}

type GamifikasiTab = 'MISSIONS' | 'TROPHIES';

export default function GamifikasiClientWrapper({
  initialData,
}: GamifikasiClientWrapperProps) {
  const [data, setData] = useState<StudentGamificationDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<GamifikasiTab>('MISSIONS');

  const handleMissionClaimed = (missionId: string, rewardXp: number, newTotalPoints?: number) => {
    setData((prev) => {
      const updateList = (missions: GamificationMission[]) =>
        missions.map((m) => (m.id === missionId ? { ...m, isClaimed: true } : m));

      const newDaily = updateList(prev.dailyMissions);
      const newWeekly = updateList(prev.weeklyMissions);
      const newMilestone = updateList(prev.milestoneMissions);

      let claimableCount = 0;
      [...newDaily, ...newWeekly, ...newMilestone].forEach((m) => {
        if (m.isCompleted && !m.isClaimed) {
          claimableCount++;
        }
      });

      const updatedPoints = newTotalPoints ?? (prev.userProfile.totalPoints + rewardXp);
      const newLevelInfo = calculateLevelInfo(updatedPoints);

      return {
        ...prev,
        dailyMissions: newDaily,
        weeklyMissions: newWeekly,
        milestoneMissions: newMilestone,
        userProfile: {
          ...prev.userProfile,
          totalPoints: updatedPoints,
          currentLevel: newLevelInfo.level,
          levelTitle: newLevelInfo.levelTitle,
          currentLevelPoints: newLevelInfo.currentLevelPoints,
          nextLevelPoints: newLevelInfo.nextLevelPoints,
          levelProgressPercent: newLevelInfo.levelProgressPercent,
          availableClaimableMissions: claimableCount,
        },
      };
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Navigation to Leaderboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        

        {/* CTA to Leaderboard / Papan Juara */}
        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            prefetch={true}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white/90 text-xs font-extrabold flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Trophy className="w-4 h-4 fill-amber text-amber-900" />
            <span>Papan Juara (Leaderboard)</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-80" />
          </Link>
        </div>
      </div>

      {/* 2. Card Utama Capaian Santri (UserProfileSummary) */}
      <UserProfileSummary
        userProfile={data.userProfile}
        onNavigateToMissions={() => setActiveTab('MISSIONS')}
      />

      {/* 3. Tab Switcher between Misi & Lemari Trofi */}
      <div className="flex items-center justify-center sm:justify-start gap-1 p-1 rounded-2xl bg-slate-200/80 backdrop-blur-sm border border-slate-300/60 max-w-md mx-auto sm:mx-0 shadow-inner">
        {/* Tab: Misi & Tantangan */}
        <button
          type="button"
          onClick={() => setActiveTab('MISSIONS')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer relative ${
            activeTab === 'MISSIONS'
              ? 'bg-white text-indigo-800 shadow-md ring-1 ring-indigo-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Gift className={`w-4 h-4 ${activeTab === 'MISSIONS' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span>Misi &amp; Tantangan</span>
          {data.userProfile.availableClaimableMissions > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2" />
          )}
        </button>

        {/* Tab: Lemari Trofi & Lencana */}
        <button
          type="button"
          onClick={() => setActiveTab('TROPHIES')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === 'TROPHIES'
              ? 'bg-white text-amber-800 shadow-md ring-1 ring-amber-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          <Trophy className={`w-4 h-4 ${activeTab === 'TROPHIES' ? 'text-amber-600' : 'text-slate-400'}`} />
          <span>Lemari Trofi</span>
        </button>
      </div>

      {/* 4. Tab Content (Misi Tracker vs Trophy Cabinet) */}
      <div>
        <div className={activeTab === 'MISSIONS' ? 'block' : 'hidden'}>
          <MissionTrackerCard
            studentId={data.userProfile.studentId}
            dailyMissions={data.dailyMissions}
            weeklyMissions={data.weeklyMissions}
            milestoneMissions={data.milestoneMissions}
            onMissionClaimed={handleMissionClaimed}
          />
        </div>

        <div className={activeTab === 'TROPHIES' ? 'block' : 'hidden'}>
          <TrophyCabinet badges={data.badges} />
        </div>
      </div>
    </div>
  );
}
