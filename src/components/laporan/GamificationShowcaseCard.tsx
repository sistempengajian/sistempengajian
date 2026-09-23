'use client';

import React from 'react';
import {
  Trophy,
  Medal,
  Star,
  Sparkles,
  CheckSquare,
  ShieldCheck,
} from 'lucide-react';
import { GamificationSummary, AssignmentAnalytics } from '@/app/(protected)/laporan/types';

interface GamificationShowcaseCardProps {
  gamification: GamificationSummary;
  assignments: AssignmentAnalytics;
}

export default function GamificationShowcaseCard({
  gamification,
  assignments,
}: GamificationShowcaseCardProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60 shadow-2xs shrink-0">
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Prestasi, Lencana &amp; Portofolio Tugas
            </h3>
            <p className="text-xs text-slate-500">
              Apresiasi pencapaian santri dan keterlibatan murojaah di rumah
            </p>
          </div>
        </div>

        {/* Level Santri */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-900 text-xs font-extrabold self-start sm:self-auto shadow-2xs">
          <Star className="w-4 h-4 text-purple-600 fill-purple-500" />
          <span>Level {gamification.level} • {gamification.points} Poin</span>
        </div>
      </div>

      {/* Grid Portofolio Tugas Mandiri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Tugas Mandiri / Murojaah
              </span>
              <span className="text-[11px] text-slate-500">
                {assignments.completedAssignments} dari {assignments.totalAssignments} tugas selesai
              </span>
            </div>
          </div>
          <span className="text-sm font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200/60">
            {assignments.percentage}%
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Paraf Digital Orang Tua
              </span>
              <span className="text-[11px] text-slate-500">
                {assignments.verifiedByParentCount} tugas disahkan orang tua
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">
            Terverifikasi
          </span>
        </div>
      </div>

      {/* Galeri Lencana Prestasi */}
      <div className="space-y-3 pt-1">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Medal className="w-3.5 h-3.5 text-purple-600" />
          <span>Koleksi Lencana Prestasi ({gamification.badges.length})</span>
        </h4>

        {gamification.badges.length === 0 ? (
          <div className="p-5 text-center rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-400">
            Belum ada lencana yang terbuka. Terus semangat menuntaskan materi dan hadir tepat waktu!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {gamification.badges.map((badge) => (
              <div
                key={badge.id}
                className="p-3 rounded-2xl bg-purple-50/40 border border-purple-200/60 flex items-start gap-3 hover:bg-purple-50/70 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Medal className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {badge.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                    {badge.description}
                  </p>
                  <span className="text-[9px] font-semibold text-purple-700 mt-1 block">
                    Diraih: {badge.earnedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
