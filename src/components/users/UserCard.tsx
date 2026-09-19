'use client';

import React from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Layers,
  Users as UsersIcon,
  Pencil,
  Trash2,
  Link2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Baby,
  GraduationCap,
} from 'lucide-react';
import { UserRole, Gender } from '@prisma/client';
import { UserWithRelations } from './types';

interface UserCardProps {
  user: UserWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  onLinkParent?: (user: UserWithRelations) => void;
  onDelete: (user: UserWithRelations) => void;
  onToggleStatus?: (user: UserWithRelations) => void;
}

const ROLE_BADGE_MAP: Record<
  UserRole,
  { label: string; bg: string; text: string; border: string }
> = {
  SANTRI: {
    label: 'Santri',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  ORANG_TUA: {
    label: 'Orang Tua',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  PENGAJAR: {
    label: 'Pengajar',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  WALI_KELAS: {
    label: 'Wali Kelas',
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  PJ_KELOMPOK: {
    label: 'PJ Kelompok',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
  PJ_DESA: {
    label: 'PJ Desa',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
  },
  PJ_DAERAH: {
    label: 'PJ Daerah',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  ADMIN_MASTER: {
    label: 'Admin Master',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
};

export default function UserCard({
  user,
  canEdit,
  canDelete,
  onLinkParent,
  onDelete,
  onToggleStatus,
}: UserCardProps) {
  const isSantri = user.roles.some((r) => r.role === 'SANTRI');
  const isOrangTua = user.roles.some((r) => r.role === 'ORANG_TUA');
  const isPengajar = user.roles.some(
    (r) => r.role === 'PENGAJAR' || r.role === 'WALI_KELAS'
  );

  // Status badge styling
  const isStatusActive = user.status === 'ACTIVE';
  const isSuspended = user.status === 'SUSPENDED';

  // Inisial avatar
  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'U';

  const avatarBg =
    user.gender === 'FEMALE'
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : 'bg-indigo-100 text-indigo-700 border-indigo-200';

  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100/50 via-emerald-50/20 to-transparent rounded-bl-full pointer-events-none" />

      <div className="space-y-3.5 relative">
        {/* Header: Avatar, Name, Username, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Avatar Circle */}
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border ${avatarBg} flex items-center justify-center font-black text-xs sm:text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
            >
              {initials}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                {user.fullName}
              </h3>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate flex-wrap">
                {user.username && (
                  <span className="font-semibold text-slate-600 truncate">
                    @{user.username}
                  </span>
                )}
                {user.phoneNumber && (
                  <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{user.phoneNumber}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 ${
                isStatusActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isSuspended
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isStatusActive
                    ? 'bg-emerald-500 animate-pulse'
                    : isSuspended
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                {isStatusActive
                  ? 'Aktif'
                  : isSuspended
                  ? 'Ditangguhkan'
                  : 'Nonaktif'}
              </span>
            </span>
          </div>
        </div>

        {/* Roles Badges Row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {user.roles.map((r) => {
            const config = ROLE_BADGE_MAP[r.role] || ROLE_BADGE_MAP.SANTRI;
            return (
              <span
                key={r.id}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${config.bg} ${config.text} ${config.border} shadow-2xs`}
              >
                {config.label}
              </span>
            );
          })}

          {user.generation && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1 shadow-2xs">
              <Sparkles className="w-2.5 h-2.5 text-purple-500" />
              <span>{user.generation.name}</span>
            </span>
          )}
        </div>

        {/* Wilayah & Relasi Chips */}
        <div className="space-y-2 pt-1 border-t border-slate-100 text-xs">
          {/* Wilayah Binaan */}
          {user.organization ? (
            <div className="flex items-center gap-1.5 text-slate-600 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate text-[11px] font-semibold">
                {user.organization.name}
                {user.organization.parentName
                  ? ` (${user.organization.parentName})`
                  : ` • ${user.organization.type}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] italic">
              <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span>Wilayah belum ditentukan</span>
            </div>
          )}

          {/* Relasi Santri -> Orang Tua */}
          {isSantri && (
            <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-150/70 text-[11px] space-y-1">
              <span className="font-semibold text-slate-500 block text-[10px]">
                Orang Tua / Wali:
              </span>
              {user.parents && user.parents.length > 0 ? (
                <div className="space-y-0.5">
                  {user.parents.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-slate-700 font-bold"
                    >
                      <span className="truncate">
                        {p.parent.fullName} ({p.relationshipType})
                      </span>
                      {p.parent.phoneNumber && (
                        <span className="text-[10px] font-normal text-slate-500 shrink-0">
                          {p.parent.phoneNumber}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-amber-700 italic block">
                  Belum ditautkan ke akun orang tua
                </span>
              )}
            </div>
          )}

          {/* Relasi Orang Tua -> Anak Santri */}
          {isOrangTua && (
            <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-200/70 text-[11px] space-y-1">
              <span className="font-semibold text-amber-900 block text-[10px]">
                Anak Santri Terdaftar ({user.children?.length || 0}):
              </span>
              {user.children && user.children.length > 0 ? (
                <div className="space-y-1">
                  {user.children.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-amber-950 font-bold"
                    >
                      <span className="truncate">{c.student.fullName}</span>
                      {c.student.generation && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 shrink-0">
                          {c.student.generation.name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-amber-700 italic block">
                  Belum memiliki anak santri terhubung
                </span>
              )}
            </div>
          )}

          {/* Pengajar / Wali Kelas Stats */}
          {isPengajar && user.stats.classesCount > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-teal-800 bg-teal-50/80 px-2.5 py-1 rounded-xl border border-teal-200/80">
              <GraduationCap className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="font-semibold">
                Mengampu {user.stats.classesCount} Kelas Binaan
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {/* Tombol Tautkan Ortu jika Santri */}
          {isSantri && onLinkParent && (
            <button
              type="button"
              onClick={() => onLinkParent(user)}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-emerald-200/90 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Tautkan Akun Orang Tua"
            >
              <Link2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[11px]">Tautkan Ortu</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {canEdit && (
            <Link
              href={`/users/${user.id}/edit`}
              className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Edit Profil Pengguna"
            >
              <Pencil className="w-3 h-3" />
              <span className="text-[11px]">Edit</span>
            </Link>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(user)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
              title="Hapus / Nonaktifkan Pengguna"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
