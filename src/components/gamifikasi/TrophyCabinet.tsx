'use client';

import React, { useState } from 'react';
import {
  Award,
  Sun,
  HeartHandshake,
  Home,
  Flame,
  Lock,
  CheckCircle2,
  Trophy,
  Sparkles,
  Info,
  X,
  LucideIcon,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { GamificationBadge } from '@/app/(protected)/gamifikasi/types';

interface TrophyCabinetProps {
  badges: GamificationBadge[];
}

const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  Sun,
  HeartHandshake,
  Home,
  Flame,
  Trophy,
  ShieldCheck,
  Star,
};

export default function TrophyCabinet({ badges }: TrophyCabinetProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeModalBadge, setActiveModalBadge] = useState<GamificationBadge | null>(null);

  const categories = ['ALL', ...Array.from(new Set(badges.map((b) => b.category)))];

  const filteredBadges =
    selectedCategory === 'ALL'
      ? badges
      : badges.filter((b) => b.category === selectedCategory);

  const unlockedCount = badges.filter((b) => b.isUnlocked).length;
  const totalCount = badges.length;
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-3xl bg-white/90 border border-slate-200/80 shadow-sm p-4 sm:p-6 relative">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-300 text-amber-700 flex items-center justify-center">
            <Trophy className="w-5 h-5 fill-amber-500 stroke-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
              Lemari Trofi & Lencana Kehormatan
            </h3>
            <p className="text-xs text-slate-500">
              Koleksi lencana prestasi sepanjang masa atas dedikasi dan budi pekerti
            </p>
          </div>
        </div>

        {/* Unlocked Progress Pill */}
        <div className="px-3.5 py-1.5 rounded-2xl bg-slate-100 border border-slate-200 flex items-center gap-3 self-start sm:self-auto">
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Koleksi Terbuka
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-800">
              {unlockedCount} / {totalCount} Lencana ({completionPercent}%)
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-black text-xs flex items-center justify-center border border-amber-200">
            🏆
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat === 'ALL' ? 'Semua Kategori' : cat}
          </button>
        ))}
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {filteredBadges.map((badge) => {
          const IconComp = BADGE_ICONS[badge.iconName] || Trophy;
          const isUnlocked = badge.isUnlocked;

          return (
            <div
              key={badge.id}
              onClick={() => setActiveModalBadge(badge)}
              className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left relative overflow-hidden group ${
                isUnlocked
                  ? 'bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 border-amber-200/90 shadow-xs hover:shadow-md hover:border-amber-300'
                  : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60 opacity-75'
              }`}
            >
              {/* Top Row: Icon & Status */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                    isUnlocked
                      ? 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-500/25'
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  <IconComp className="w-6 h-6" />
                </div>

                <div className="flex flex-col items-end gap-1">
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      Terbuka
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-medium">
                      <Lock className="w-3 h-3" />
                      Terkunci
                    </span>
                  )}

                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    +{badge.pointBonus} XP
                  </span>
                </div>
              </div>

              {/* Title & Category */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {badge.category}
                </span>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug truncate group-hover:text-amber-700 transition-colors">
                  {badge.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {badge.criteriaDescription}
                </p>
              </div>

              {/* Footer: Date or Progress */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                {isUnlocked ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Diraih {badge.unlockedAt || 'Baru saja'}
                  </span>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
                      <span>{badge.progressHint || 'Target'}</span>
                      <span>{badge.progressPercent || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${badge.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Badge Detail Modal */}
      {activeModalBadge && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative text-center animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setActiveModalBadge(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Badge Icon */}
            <div className="mx-auto mb-4">
              <div
                className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center ${
                  activeModalBadge.isUnlocked
                    ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-500 text-white shadow-xl shadow-amber-500/30'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {(() => {
                  const ModalIcon = BADGE_ICONS[activeModalBadge.iconName] || Trophy;
                  return <ModalIcon className="w-10 h-10" />;
                })()}
              </div>
            </div>

            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-200">
              {activeModalBadge.category}
            </span>

            <h3 className="font-bold text-base sm:text-lg text-slate-900 mt-2">
              {activeModalBadge.name}
            </h3>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed px-2">
              {activeModalBadge.criteriaDescription}
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Hadiah XP</span>
                <span className="font-bold text-amber-700">+{activeModalBadge.pointBonus} XP</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] text-slate-400 block">Status</span>
                <span className={`font-bold ${activeModalBadge.isUnlocked ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {activeModalBadge.isUnlocked ? 'Terbuka' : 'Terkunci'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModalBadge(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
