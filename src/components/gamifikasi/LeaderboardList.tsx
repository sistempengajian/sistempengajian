'use client';

import React from 'react';
import { Flame, Star, Award, CheckCircle2, User, Sparkles } from 'lucide-react';
import { LeaderboardEntry } from '@/app/(protected)/gamifikasi/types';

interface LeaderboardListProps {
  rankings: LeaderboardEntry[];
  totalParticipants?: number;
}

export default function LeaderboardList({
  rankings,
  totalParticipants,
}: LeaderboardListProps) {
  if (!rankings || rankings.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-white/60 border border-slate-200/70 text-center">
        <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
          <Award className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-700">Daftar Peringkat Belum Tersedia</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Belum ada data santri tambahan pada peringkat berikutnya untuk filter dan periode yang dipilih.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1 mb-1">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Peringkat 4 – {3 + rankings.length}
        </h4>
        {totalParticipants && (
          <span className="text-xs text-slate-400 font-medium">
            Total {totalParticipants} Santri Berpartisipasi
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rankings.map((entry) => {
          const initials = entry.fullName
            .split(' ')
            .slice(0, 2)
            .map((n) => n[0])
            .join('')
            .toUpperCase();

          const isCurrentUser = entry.isCurrentUser;

          return (
            <div
              key={entry.studentId}
              className={`group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
                isCurrentUser
                  ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/40 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'bg-white/80 hover:bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Left: Rank Number & Avatar & Names */}
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                {/* Rank Number Badge */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCurrentUser
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 group-hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  #{entry.rank}
                </div>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-xs text-slate-600">{initials}</span>
                    )}
                  </div>
                  {isCurrentUser && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-1 ring-white">
                      <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  )}
                </div>

                {/* Name & Generation / Class */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-bold text-xs sm:text-sm truncate ${
                        isCurrentUser ? 'text-emerald-950' : 'text-slate-900'
                      }`}
                      title={entry.fullName}
                    >
                      {entry.fullName}
                    </span>
                    {isCurrentUser && (
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Kamu
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                    <span className="truncate">
                      {entry.className || entry.generationName || 'Santri'}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="font-medium text-slate-600">
                      Lv. {entry.level}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Metrics (Streak, Badges, XP Points) */}
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 text-right">
                {/* Streak Badge */}
                {entry.currentStreakDays > 0 && (
                  <div
                    className="hidden xs:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200/70 text-orange-700 text-xs font-semibold"
                    title={`Streak Kehadiran: ${entry.currentStreakDays} Hari`}
                  >
                    <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
                    <span>{entry.currentStreakDays}d</span>
                  </div>
                )}

                {/* Badges count */}
                {entry.badgesCount > 0 && (
                  <div
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-xs font-semibold"
                    title={`Lencana Terbuka: ${entry.badgesCount}`}
                  >
                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{entry.badgesCount}</span>
                  </div>
                )}

                {/* XP Points Pill */}
                <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-600 flex-shrink-0" />
                  <span className="font-extrabold text-xs sm:text-sm tracking-tight">
                    {entry.totalPoints.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 hidden xs:inline">XP</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
