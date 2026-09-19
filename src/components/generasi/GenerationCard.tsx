'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  Box,
  Feather,
  GraduationCap,
  Sparkles,
  Pencil,
  Trash2,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { GenerationWithStats } from './types';

interface GenerationCardProps {
  generation: GenerationWithStats;
  canEdit: boolean;
  onDelete: (gen: GenerationWithStats) => void;
}

interface ThemeConfig {
  icon: any;
  cardBg: string;
  cardBorder: string;
  iconBg: string;
  badgeAge: string;
  badgeCode: string;
  statChipBg: string;
  accentButton: string;
}

const THEME_MAP: Record<string, ThemeConfig> = {
  emerald: {
    icon: Feather,
    cardBg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    cardBorder: 'border-emerald-200/80 hover:border-emerald-400',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    badgeAge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeCode: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    statChipBg: 'bg-emerald-50/50 border-emerald-100/70',
    accentButton: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  sky: {
    icon: Compass,
    cardBg: 'from-sky-500/10 via-sky-500/5 to-transparent',
    cardBorder: 'border-sky-200/80 hover:border-sky-400',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
    badgeAge: 'bg-sky-100 text-sky-800 border-sky-200',
    badgeCode: 'bg-sky-50 text-sky-700 border-sky-200',
    statChipBg: 'bg-sky-50/50 border-sky-100/70',
    accentButton: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  purple: {
    icon: Sparkles,
    cardBg: 'from-purple-500/10 via-purple-500/5 to-transparent',
    cardBorder: 'border-purple-200/80 hover:border-purple-400',
    iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
    badgeAge: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeCode: 'bg-purple-50 text-purple-700 border-purple-200',
    statChipBg: 'bg-purple-50/50 border-purple-100/70',
    accentButton: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  amber: {
    icon: Box,
    cardBg: 'from-amber-500/10 via-amber-500/5 to-transparent',
    cardBorder: 'border-amber-200/80 hover:border-amber-400',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
    badgeAge: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeCode: 'bg-amber-50 text-amber-700 border-amber-200',
    statChipBg: 'bg-amber-50/50 border-amber-100/70',
    accentButton: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  rose: {
    icon: GraduationCap,
    cardBg: 'from-rose-500/10 via-rose-500/5 to-transparent',
    cardBorder: 'border-rose-200/80 hover:border-rose-400',
    iconBg: 'bg-rose-50 text-rose-600 border-rose-200',
    badgeAge: 'bg-rose-100 text-rose-800 border-rose-200',
    badgeCode: 'bg-rose-50 text-rose-700 border-rose-200',
    statChipBg: 'bg-rose-50/50 border-rose-100/70',
    accentButton: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  teal: {
    icon: Layers,
    cardBg: 'from-teal-500/10 via-teal-500/5 to-transparent',
    cardBorder: 'border-teal-200/80 hover:border-teal-400',
    iconBg: 'bg-teal-50 text-teal-600 border-teal-200',
    badgeAge: 'bg-teal-100 text-teal-800 border-teal-200',
    badgeCode: 'bg-teal-50 text-teal-700 border-teal-200',
    statChipBg: 'bg-teal-50/50 border-teal-100/70',
    accentButton: 'bg-teal-600 hover:bg-teal-700 text-white',
  },
  orange: {
    icon: Compass,
    cardBg: 'from-orange-500/10 via-orange-500/5 to-transparent',
    cardBorder: 'border-orange-200/80 hover:border-orange-400',
    iconBg: 'bg-orange-50 text-orange-600 border-orange-200',
    badgeAge: 'bg-orange-100 text-orange-800 border-orange-200',
    badgeCode: 'bg-orange-50 text-orange-700 border-orange-200',
    statChipBg: 'bg-orange-50/50 border-orange-100/70',
    accentButton: 'bg-orange-600 hover:bg-orange-700 text-white',
  },
};

export default function GenerationCard({
  generation,
  canEdit,
  onDelete,
}: GenerationCardProps) {
  const theme = THEME_MAP[generation.color || 'emerald'] || THEME_MAP.emerald;
  const IconComponent = theme.icon;

  return (
    <div
      className={`rounded-3xl bg-white border ${theme.cardBorder} p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between space-y-4 group`}
    >
      {/* Decorative gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.cardBg} opacity-50 pointer-events-none group-hover:opacity-80 transition-opacity`}
      />

      <div className="space-y-3.5 relative">
        {/* Top Header Card: Title, Code & Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {generation.name}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider border ${theme.badgeCode}`}
              >
                {generation.code}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${theme.badgeAge}`}
              >
                {generation.minAge} - {generation.maxAge} Tahun
              </span>
            </div>
          </div>

          <div
            className={`w-10 h-10 rounded-2xl border ${theme.iconBg} flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform`}
          >
            <IconComponent className="w-5 h-5" />
          </div>
        </div>

        {/* Deskripsi Fokus Pembinaan */}
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 min-h-[32px]">
          {generation.description ||
            'Fokus pembinaan terstruktur diselaraskan dengan tahapan usia santri dan kurikulum target capaian.'}
        </p>

        {/* Statistik Terkait */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
          <div
            className={`p-2 rounded-2xl border text-center ${theme.statChipBg}`}
          >
            <span className="text-sm sm:text-base font-black text-slate-800 block">
              {generation.studentCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              Santri
            </span>
          </div>

          <div
            className={`p-2 rounded-2xl border text-center ${theme.statChipBg}`}
          >
            <span className="text-sm sm:text-base font-black text-slate-800 block">
              {generation.classCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              Kelas
            </span>
          </div>

          <div
            className={`p-2 rounded-2xl border text-center ${theme.statChipBg}`}
          >
            <span className="text-sm sm:text-base font-black text-slate-800 block">
              {generation.materialCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              Materi
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-2 flex items-center gap-2 relative">
        <Link
          href={`/kurikulum?gen=${generation.code}`}
          prefetch={true}
          className="flex-1 h-9 rounded-xl border border-slate-200/80 bg-white/90 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs"
        >
          <span>Kurikulum</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Link
              href={`/generasi/${generation.id}/edit`}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${theme.accentButton}`}
              title="Edit Jenjang"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </Link>

            <button
              type="button"
              onClick={() => onDelete(generation)}
              className="w-9 h-9 rounded-xl border border-rose-200/80 bg-rose-50/60 hover:bg-rose-100/80 text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              title="Hapus Jenjang"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
