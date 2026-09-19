'use client';

import React from 'react';
import Link from 'next/link';
import { Pencil, Trash2, Link2, Phone, MapPin, Sparkles } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { UserWithRelations } from './types';

interface UserTableViewProps {
  users: UserWithRelations[];
  canEdit: boolean;
  canDelete: boolean;
  onLinkParent?: (user: UserWithRelations) => void;
  onDelete: (user: UserWithRelations) => void;
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

export default function UserTableView({
  users,
  canEdit,
  canDelete,
  onLinkParent,
  onDelete,
}: UserTableViewProps) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Pengguna</th>
              <th className="py-3.5 px-3">Peran (Roles)</th>
              <th className="py-3.5 px-3">Wilayah Binaan</th>
              <th className="py-3.5 px-3">Jenjang / Relasi</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {users.map((user) => {
              const isSantri = user.roles.some((r) => r.role === 'SANTRI');
              const isStatusActive = user.status === 'ACTIVE';
              const isSuspended = user.status === 'SUSPENDED';

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
                <tr
                  key={user.id}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  {/* Kolom 1: User Profile */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-xl border ${avatarBg} flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                          {user.fullName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                          {user.username && <span>@{user.username}</span>}
                          {user.phoneNumber && (
                            <>
                              <span>•</span>
                              <span>{user.phoneNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Kolom 2: Peran */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {user.roles.map((r) => {
                        const config =
                          ROLE_BADGE_MAP[r.role] || ROLE_BADGE_MAP.SANTRI;
                        return (
                          <span
                            key={r.id}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${config.bg} ${config.text} ${config.border}`}
                          >
                            {config.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>

                  {/* Kolom 3: Wilayah */}
                  <td className="py-3 px-3">
                    {user.organization ? (
                      <div className="text-[11px] space-y-0.5">
                        <span className="font-semibold text-slate-800 block truncate max-w-[160px]">
                          {user.organization.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                          {user.organization.parentName ||
                            user.organization.type}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">-</span>
                    )}
                  </td>

                  {/* Kolom 4: Jenjang / Relasi Ortu-Anak */}
                  <td className="py-3 px-3">
                    {user.generation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Sparkles className="w-2.5 h-2.5 text-purple-500" />
                        <span>{user.generation.name}</span>
                      </span>
                    ) : user.parents && user.parents.length > 0 ? (
                      <span className="text-[11px] font-semibold text-slate-600 block truncate max-w-[150px]">
                        Ortu: {user.parents[0].parent.fullName}
                      </span>
                    ) : user.children && user.children.length > 0 ? (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {user.children.length} Anak Santri
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </td>

                  {/* Kolom 5: Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
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
                            ? 'bg-emerald-500'
                            : isSuspended
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {isStatusActive
                          ? 'Aktif'
                          : isSuspended
                          ? 'Suspend'
                          : 'Nonaktif'}
                      </span>
                    </span>
                  </td>

                  {/* Kolom 6: Aksi */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isSantri && onLinkParent && (
                        <button
                          type="button"
                          onClick={() => onLinkParent(user)}
                          className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors cursor-pointer"
                          title="Tautkan Orang Tua"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canEdit && (
                        <Link
                          href={`/users/${user.id}/edit`}
                          className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors"
                          title="Edit Pengguna"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(user)}
                          className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Hapus / Nonaktifkan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
