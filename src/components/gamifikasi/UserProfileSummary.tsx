'use client';

import React from 'react';
import {
  Trophy,
  Flame,
  Award,
  Zap,
  Sparkles,
  ChevronRight,
  Star,
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/95 via-slate-50/80 to-slate-100/90 border border-slate-200/80 shadow-sm p-4 sm:p-6 text-slate-900">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-100/30 via-amber-50/15 to-transparent pointer-events-none" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-300/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
        {/* Left: Avatar & Identity & Rank */}
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-emerald-400 p-0.5 shadow-md shadow-amber-500/20">
              <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-100 flex items-center justify-center">
                {userProfile.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-black text-lg sm:text-xl text-amber-700">
                    {initials}
                  </span>
                )}
              </div>
            </div>

            {/* Level Pill floating on Avatar */}
            <div className="absolute -bottom-2 -right-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm">
              Lv. {userProfile.currentLevel}
            </div>
          </div>

          {/* User Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate" title={userProfile.fullName}>
                {userProfile.fullName}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/70">
                {userProfile.generationName || 'Santri'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {userProfile.levelTitle} • {userProfile.className || 'Generasi Qur\'ani'}
            </p>

            {/* Rank Position Pill */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] sm:text-xs font-bold shadow-2xs">
                <Trophy className="w-3.5 h-3.5 fill-amber-400 text-amber-600 flex-shrink-0" />
                <span>Peringkat #{userProfile.rank}</span>
                <span className="text-slate-400 font-normal">
                  dari {userProfile.totalStudents} Santri
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Stats */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 md:justify-end">
          {/* Total Points */}
          <div className="flex-1 sm:flex-initial px-3 py-2 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                Total Poin
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {userProfile.totalPoints.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-amber-600">XP</span>
              </span>
            </div>
          </div>

          {/* Current Streak */}
          <div className="flex-1 sm:flex-initial px-3 py-2 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 text-orange-600 flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4 fill-orange-400" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                Streak Harian
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {userProfile.currentStreakDays} <span className="text-[10px] font-bold text-orange-600">Hari</span>
              </span>
            </div>
          </div>

          {/* Badges Unlocked */}
          <div className="flex-1 sm:flex-initial px-3 py-2 rounded-2xl bg-white/80 border border-slate-200/80 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
                Lencana
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {userProfile.totalBadgesUnlocked}/{userProfile.totalBadgesAvailable}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar to Next Level */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/70">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-slate-600 font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            Progress Menuju Level {userProfile.currentLevel + 1}
          </span>
          <span className="text-amber-800 font-bold text-xs">
            {userProfile.currentLevelPoints} / {userProfile.nextLevelPoints} XP ({userProfile.levelProgressPercent}%)
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/80 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500 transition-all duration-500 shadow-xs shadow-amber-500/30"
            style={{ width: `${userProfile.levelProgressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
