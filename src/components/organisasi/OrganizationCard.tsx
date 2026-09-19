'use client';

import React from 'react';
import Link from 'next/link';
import {
  Map,
  Landmark,
  Users,
  GraduationCap,
  Pencil,
  Trash2,
  GitBranch,
  Layers,
} from 'lucide-react';
import { OrganizationWithStats } from './types';

interface OrganizationCardProps {
  org: OrganizationWithStats;
  canEdit: boolean;
  canDelete?: boolean;
  onDelete: (org: OrganizationWithStats) => void;
}

const TYPE_CONFIG = {
  DAERAH: {
    label: 'Daerah',
    fullName: 'Tingkat Daerah',
    icon: Map,
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    border: 'border-indigo-200/80 hover:border-indigo-400',
    cardGradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  DESA: {
    label: 'Desa',
    fullName: 'Tingkat Desa',
    icon: Landmark,
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    border: 'border-emerald-200/80 hover:border-emerald-400',
    cardGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  KELOMPOK: {
    label: 'Kelompok',
    fullName: 'Tingkat Kelompok',
    icon: Users,
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
    border: 'border-sky-200/80 hover:border-sky-400',
    cardGradient: 'from-sky-500/10 via-sky-500/5 to-transparent',
    btnColor: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
};

export default function OrganizationCard({
  org,
  canEdit,
  canDelete = true,
  onDelete,
}: OrganizationCardProps) {
  const config = TYPE_CONFIG[org.type] || TYPE_CONFIG.KELOMPOK;
  const IconComponent = config.icon;

  return (
    <div
      className={`rounded-3xl bg-white border ${config.border} p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between space-y-3.5 group`}
    >
      {/* Decorative gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${config.cardGradient} opacity-50 pointer-events-none group-hover:opacity-80 transition-opacity`}
      />

      <div className="space-y-3 relative">
        {/* Top Header: Badge, Parent Path, and Icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${config.badgeBg}`}>
                {config.fullName}
              </span>

              {org.parentName && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/70 truncate max-w-[200px]">
                  <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{org.parentName}</span>
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate pt-0.5">
              {org.name}
            </h3>
          </div>

          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border ${config.iconBg} flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform`}
          >
            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Statistik Terkait */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-150/70">
            <span className="text-xs sm:text-sm font-black text-slate-800 block">
              {org.studentCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              Santri
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-150/70">
            <span className="text-xs sm:text-sm font-black text-slate-800 block">
              {org.teacherCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              Pengajar
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-150/70">
            <span className="text-xs sm:text-sm font-black text-slate-800 block">
              {org.type === 'DAERAH'
                ? `${org.childrenCount} Desa`
                : org.type === 'DESA'
                ? `${org.childrenCount} Klp`
                : `${org.classCount} Kelas`}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 block truncate">
              {org.type === 'KELOMPOK' ? 'Kelas' : 'Binaan'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action Buttons */}
      {(canEdit || canDelete) && (
        <div className="pt-2 flex items-center justify-end gap-2 relative">
          {canEdit && (
            <Link
              href={`/organisasi/${org.id}/edit`}
              className={`h-8 sm:h-9 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${config.btnColor}`}
              title="Edit Tingkatan Wilayah"
            >
              <Pencil className="w-3 h-3" />
              <span>Edit</span>
            </Link>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(org)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              title="Hapus Tingkatan Wilayah"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
