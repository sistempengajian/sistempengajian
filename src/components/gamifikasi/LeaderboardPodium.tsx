'use client';

import React from 'react';
import { Crown, Medal, Award, Flame, Star, Sparkles, User as UserIcon } from 'lucide-react';
import { GamificationPodium, LeaderboardEntry } from '@/app/(protected)/gamifikasi/types';

interface LeaderboardPodiumProps {
  podium: GamificationPodium;
  periodLabel: string;
}

interface PodiumStepProps {
  entry?: LeaderboardEntry;
  rank: 1 | 2 | 3;
}

function PodiumStep({ entry, rank }: PodiumStepProps) {
  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-end opacity-40 min-w-0">
        <div className="w-11 h-11 xs:w-13 xs:h-13 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center mb-2">
          <UserIcon className="w-5 h-5 text-slate-300" />
        </div>
        <div className="w-full bg-slate-100 rounded-t-xl sm:rounded-t-2xl border border-slate-200/80 p-2 text-center h-22 sm:h-34 flex flex-col items-center justify-center">
          <span className="text-lg sm:text-xl font-bold text-slate-300">#{rank}</span>
          <span className="text-[9px] sm:text-[10px] text-slate-400">Belum ada</span>
        </div>
      </div>
    );
  }

  const isGold = rank === 1;

  // Custom configurations for podium heights, borders, rings, and badges
  const config = {
    1: {
      height: 'h-32 xs:h-38 sm:h-48',
      avatarSize: 'w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20',
      ringColor: 'ring-3 sm:ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-lg shadow-amber-500/25',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/30',
      podiumBg: 'bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600 text-white shadow-xl shadow-amber-500/20 border-t border-amber-300',
      titleColor: 'text-amber-900',
      rankLabel: 'Juara 1',
      icon: Crown,
      order: 'order-2', // Center
      zIndex: 'z-20',
      stepScale: 'scale-[1.02] sm:scale-105 -translate-y-1 sm:-translate-y-2',
    },
    2: {
      height: 'h-24 xs:h-28 sm:h-36',
      avatarSize: 'w-11 h-11 xs:w-13 xs:h-13 sm:w-16 sm:h-16',
      ringColor: 'ring-2 sm:ring-3 ring-slate-300 ring-offset-2 ring-offset-white shadow-md shadow-slate-400/20',
      badgeBg: 'bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-sm',
      podiumBg: 'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 text-slate-800 shadow-md border-t border-white/60',
      titleColor: 'text-slate-800',
      rankLabel: 'Juara 2',
      icon: Medal,
      order: 'order-1', // Left
      zIndex: 'z-10',
      stepScale: '',
    },
    3: {
      height: 'h-26 xs:h-24 sm:h-30',
      avatarSize: 'w-11 h-11 xs:w-13 xs:h-13 sm:w-16 sm:h-16',
      ringColor: 'ring-2 sm:ring-3 ring-amber-600/70 ring-offset-2 ring-offset-white shadow-md shadow-amber-700/20',
      badgeBg: 'bg-gradient-to-r from-amber-700 to-orange-800 text-white shadow-sm',
      podiumBg: 'bg-gradient-to-b from-amber-600/80 via-amber-700 to-orange-800 text-white shadow-md border-t border-amber-500/50',
      titleColor: 'text-slate-800',
      rankLabel: 'Juara 3',
      icon: Award,
      order: 'order-3', // Right
      zIndex: 'z-10',
      stepScale: '',
    },
  }[rank];

  const IconComponent = config.icon;
  const initials = entry.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`flex-1 flex flex-col items-center justify-end ${config.order} ${config.zIndex} ${config.stepScale} transition-all duration-300 min-w-0`}>
      {/* Crown / Top Badge */}
      <div className="relative mb-1.5 sm:mb-2 flex flex-col items-center">
        {isGold && (
          <div className="animate-bounce mb-0.5">
            <div className="p-1 sm:p-1.5 rounded-full bg-amber-100 text-amber-600 shadow-md border border-amber-300/80">
              <Crown className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-amber-500 stroke-amber-700" />
            </div>
          </div>
        )}

        {/* Student Avatar */}
        <div className="relative">
          <div
            className={`${config.avatarSize} rounded-full overflow-hidden bg-gradient-to-br from-white to-slate-100 flex items-center justify-center ${config.ringColor} transition-transform hover:scale-105`}
          >
            {entry.avatarUrl ? (
              <img
                src={entry.avatarUrl}
                alt={entry.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={`font-bold ${isGold ? 'text-sm xs:text-base sm:text-xl text-amber-700' : 'text-xs xs:text-sm sm:text-base text-slate-700'}`}>
                {initials}
              </span>
            )}
          </div>

          {/* Rank Badge Indicator on Avatar */}
          <div
            className={`absolute -bottom-1.5 -right-1 px-1 sm:px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black flex items-center gap-0.5 ${config.badgeBg}`}
          >
            <span>#{rank}</span>
          </div>
        </div>
      </div>

      {/* Student Details */}
      <div className="text-center px-0.5 sm:px-2 mb-1.5 sm:mb-2 w-full max-w-[95px] xs:max-w-[120px] sm:max-w-[160px]">
        <h4 className="font-bold text-[11px] xs:text-xs sm:text-sm text-slate-900 truncate" title={entry.fullName}>
          {entry.fullName}
        </h4>
        <p className="text-[9px] xs:text-[10px] sm:text-xs text-slate-500 truncate">
          {entry.className || entry.generationName || 'Santri'}
        </p>

        {/* Score & Streak Badges */}
        <div className="flex flex-wrap items-center justify-center gap-0.5 xs:gap-1 mt-0.5 sm:mt-1">
          <span className="inline-flex items-center gap-0.5 px-1 xs:px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[9px] xs:text-[10px] sm:text-[11px] font-bold">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-600 flex-shrink-0" />
            <span className="truncate">{entry.totalPoints.toLocaleString('id-ID')}</span>
          </span>
          {entry.currentStreakDays > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1 xs:px-1.5 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[8px] xs:text-[9px] sm:text-[10px] font-semibold">
              <Flame className="w-2.5 h-2.5 fill-orange-500 text-orange-500 flex-shrink-0" />
              <span>{entry.currentStreakDays}d</span>
            </span>
          )}
        </div>
      </div>

      {/* Stepped Podium Block */}
      <div
        className={`w-full ${config.height} ${config.podiumBg} rounded-t-xl sm:rounded-t-3xl flex flex-col items-center justify-between p-1.5 xs:p-2 sm:p-3.5 text-center transition-all duration-300 relative overflow-hidden`}
      >
        {/* Subtle background glow pattern for Gold */}
        {isGold && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent pointer-events-none" />
        )}

        <div className="flex items-center gap-1 font-extrabold text-[9px] xs:text-[10px] sm:text-xs uppercase tracking-wider opacity-90">
          <IconComponent className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
          <span className="truncate">{config.rankLabel}</span>
        </div>

        <div className="my-auto py-0.5">
          <span className="text-2xl xs:text-3xl sm:text-5xl font-black tracking-tight drop-shadow-sm opacity-95">
            {rank}
          </span>
        </div>

        <div className="text-[9px] xs:text-[10px] sm:text-xs font-semibold opacity-90 truncate max-w-full">
          Lv. {entry.level}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPodium({ podium, periodLabel }: LeaderboardPodiumProps) {
  return (
    <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/90 border border-slate-200/80 shadow-sm p-3 xs:p-4 sm:p-6 pb-0 sm:pb-0 overflow-hidden">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-100/40 via-amber-50/20 to-transparent pointer-events-none" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-300/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-4 relative z-10">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-amber-500/15 border border-amber-300 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-500 stroke-amber-700" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate">
              Podium Bintang Generasi
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              3 Peringkat Tertinggi 
            </p>
            <p className="text-[11px] sm:text-xs truncate font-medium text-amber-700">
              {periodLabel}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-semibold flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Hall of Fame</span>
        </div>
      </div>

      {/* Podium Steps (2 - 1 - 3) */}
      <div className="flex items-end justify-center gap-1.5 xs:gap-2 sm:gap-4 pt-2 sm:pt-4 relative z-10 min-h-[220px] sm:min-h-[300px]">
        {/* Left: Rank 2 (Silver) */}
        <PodiumStep entry={podium.rank2} rank={2} />

        {/* Center: Rank 1 (Gold) */}
        <PodiumStep entry={podium.rank1} rank={1} />

        {/* Right: Rank 3 (Bronze) */}
        <PodiumStep entry={podium.rank3} rank={3} />
      </div>
    </div>
  );
}
