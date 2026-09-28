'use client';

import React from 'react';
import {
  Trophy,
  Flame,
  Award,
  Zap,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Star,
  CheckCircle2,
} from 'lucide-react';
import { GamificationUserProfile } from '@/app/(protected)/gamifikasi/types';

interface UserProfileSummaryProps {
  userProfile?: GamificationUserProfile;
  onNavigateToMissions?: () => void;
}

export default function UserProfileSummary({
  userProfile,
  onNavigateToMissions,
}: UserProfileSummaryProps) {
  if (!userProfile) return null;

  const initials = userProfile.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-6 shadow-xl border border-slate-700/50">
      {/* Decorative ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left: Avatar & Identity & Rank */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-amber-400 via-emerald-400 to-teal-300 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-900 flex items-center justify-center">
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-extrabold text-xl sm:text-2xl text-emerald-400">
                    {initials}
                  </span>
                )}
              </div>
            </div>

            {/* Level Pill floating on Avatar */}
            <div className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md">
              Lv. {userProfile.currentLevel}
            </div>
          </div>

          {/* User Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-bold tracking-tight text-white truncate" title={userProfile.fullName}>
                {userProfile.fullName}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold border border-white/10">
                {userProfile.generationName || 'Santri'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-0.5 truncate">
              {userProfile.levelTitle} &bull; {userProfile.className || 'Generasi Qur\'ani'}
            </p>

            {/* Rank Position Pill */}
            <div className="flex items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Peringkat #{userProfile.rank}</span>
                <span className="text-amber-200/60 font-normal">
                  dari {userProfile.totalStudents} Santri
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats & Claimable Quest CTA */}
        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          {/* Total Points */}
          <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Total Poin
              </span>
              <span className="text-base sm:text-lg font-black text-amber-300">
                {userProfile.totalPoints.toLocaleString('id-ID')} <span className="text-xs font-bold text-amber-400/80">XP</span>
              </span>
            </div>
          </div>

          {/* Current Streak */}
          <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 fill-orange-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Streak Harian
              </span>
              <span className="text-base sm:text-lg font-black text-orange-300">
                {userProfile.currentStreakDays} <span className="text-xs font-bold text-orange-400/80">Hari</span>
              </span>
            </div>
          </div>

          {/* Badges Unlocked */}
          <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Lencana
              </span>
              <span className="text-base sm:text-lg font-black text-indigo-300">
                {userProfile.totalBadgesUnlocked}/{userProfile.totalBadgesAvailable}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar to Next Level */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Progress Menuju Level {userProfile.currentLevel + 1}
          </span>
          <span className="text-amber-300 font-bold">
            {userProfile.currentLevelPoints} / {userProfile.nextLevelPoints} XP ({userProfile.levelProgressPercent}%)
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-400 to-teal-300 transition-all duration-500 shadow-sm shadow-emerald-500/50"
            style={{ width: `${userProfile.levelProgressPercent}%` }}
          />
        </div>
      </div>

      {/* Claimable Missions Callout Banner */}
      {userProfile.availableClaimableMissions > 0 && onNavigateToMissions && (
        <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-amber-500/20 border border-emerald-400/40 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center flex-shrink-0 font-bold text-xs">
              <Sparkles className="w-4 h-4 fill-slate-950" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-emerald-200 truncate">
              {userProfile.availableClaimableMissions} Hadiah Misi Siap Diklaim!
            </span>
          </div>

          <button
            type="button"
            onClick={onNavigateToMissions}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-md flex-shrink-0"
          >
            <span>Klaim Sekarang</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
