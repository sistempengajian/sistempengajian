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
      <div className="flex-1 flex flex-col items-center justify-end opacity-40">
        <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center mb-3">
          <UserIcon className="w-6 h-6 text-slate-300" />
        </div>
        <div className="w-full bg-slate-100 rounded-t-2xl border border-slate-200/80 p-3 text-center h-28 sm:h-36 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-300">#{rank}</span>
          <span className="text-[10px] text-slate-400">Belum ada</span>
        </div>
      </div>
    );
  }

  const isGold = rank === 1;
  const isSilver = rank === 2;
  const isBronze = rank === 3;

  // Custom configurations for podium heights, borders, rings, and badges
  const config = {
    1: {
      height: 'h-36 sm:h-48',
      avatarSize: 'w-18 h-18 sm:w-22 sm:h-22',
      ringColor: 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-lg shadow-amber-500/25',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md shadow-amber-500/30',
      podiumBg: 'bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600 text-white shadow-xl shadow-amber-500/20 border-t border-amber-300',
      titleColor: 'text-amber-900',
      rankLabel: 'Juara 1',
      icon: Crown,
      order: 'order-2', // Center
      zIndex: 'z-20',
      stepScale: 'scale-105 sm:scale-110 -translate-y-2',
    },
    2: {
      height: 'h-28 sm:h-36',
      avatarSize: 'w-14 h-14 sm:w-18 sm:h-18',
      ringColor: 'ring-3 ring-slate-300 ring-offset-2 ring-offset-white shadow-md shadow-slate-400/20',
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
      height: 'h-24 sm:h-30',
      avatarSize: 'w-14 h-14 sm:w-18 sm:h-18',
      ringColor: 'ring-3 ring-amber-600/70 ring-offset-2 ring-offset-white shadow-md shadow-amber-700/20',
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
    <div className={`flex-1 flex flex-col items-center justify-end ${config.order} ${config.zIndex} ${config.stepScale} transition-all duration-300`}>
      {/* Crown / Top Badge */}
      <div className="relative mb-2 flex flex-col items-center">
        {isGold && (
          <div className="animate-bounce mb-1">
            <div className="p-1.5 rounded-full bg-amber-100 text-amber-600 shadow-md border border-amber-300/80">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-500 stroke-amber-700" />
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
              <span className={`font-bold ${isGold ? 'text-lg sm:text-2xl text-amber-700' : 'text-sm sm:text-lg text-slate-700'}`}>
                {initials}
              </span>
            )}
          </div>

          {/* Rank Badge Indicator on Avatar */}
          <div
            className={`absolute -bottom-2 -right-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black flex items-center gap-0.5 ${config.badgeBg}`}
          >
            <span>#{rank}</span>
          </div>
        </div>
      </div>

      {/* Student Details */}
      <div className="text-center px-1 sm:px-2 mb-2 w-full max-w-[120px] sm:max-w-[160px]">
        <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={entry.fullName}>
          {entry.fullName}
        </h4>
        <p className="text-[10px] sm:text-xs text-slate-500 truncate">
          {entry.className || entry.generationName || 'Santri'}
        </p>

        {/* Score & Streak Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] sm:text-[11px] font-bold">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-600" />
            {entry.totalPoints.toLocaleString('id-ID')} XP
          </span>
          {entry.currentStreakDays > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[9px] sm:text-[10px] font-semibold">
              <Flame className="w-2.5 h-2.5 fill-orange-500 text-orange-500" />
              {entry.currentStreakDays}d
            </span>
          )}
        </div>
      </div>

      {/* Stepped Podium Block */}
      <div
        className={`w-full ${config.height} ${config.podiumBg} rounded-t-2xl sm:rounded-t-3xl flex flex-col items-center justify-between p-2 sm:p-4 text-center transition-all duration-300 relative overflow-hidden`}
      >
        {/* Subtle background glow pattern for Gold */}
        {isGold && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/30 via-transparent to-transparent pointer-events-none" />
        )}

        <div className="flex items-center gap-1 font-extrabold text-[11px] sm:text-xs uppercase tracking-wider opacity-90">
          <IconComponent className="w-3.5 h-3.5" />
          <span>{config.rankLabel}</span>
        </div>

        <div className="my-auto">
          <span className="text-3xl sm:text-5xl font-black tracking-tight drop-shadow-sm opacity-95">
            {rank}
          </span>
        </div>

        <div className="text-[10px] sm:text-xs font-semibold opacity-90 truncate max-w-full">
          Lv. {entry.level}
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPodium({ podium, periodLabel }: LeaderboardPodiumProps) {
  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-white/90 via-slate-50/80 to-slate-100/90 border border-slate-200/80 shadow-sm p-4 sm:p-6 overflow-hidden">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-100/40 via-amber-50/20 to-transparent pointer-events-none" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-300/15 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-300 text-amber-700 flex items-center justify-center">
            <Crown className="w-5 h-5 fill-amber-500 stroke-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
              Podium Bintang Generasi
            </h3>
            <p className="text-xs text-slate-500">
              3 Peringkat Tertinggi &bull; <span className="font-medium text-amber-700">{periodLabel}</span>
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Hall of Fame</span>
        </div>
      </div>

      {/* Podium Steps (2 - 1 - 3) */}
      <div className="flex items-end justify-center gap-2 sm:gap-4 pt-4 sm:pt-6 relative z-10 min-h-[260px] sm:min-h-[320px]">
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
