'use client';

import React from 'react';
import Link from 'next/link';
import {
  School,
  Calendar,
  CheckSquare,
  Users,
  MapPin,
  Pencil,
  Trash2,
  ArrowUpRight,
  UserCheck,
  HelpCircle,
} from 'lucide-react';
import { TierLevel } from '@prisma/client';
import { ClassWithRelations } from './types';

interface ClassTableViewProps {
  classes: ClassWithRelations[];
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (cls: ClassWithRelations) => void;
}

export default function ClassTableView({
  classes,
  canEdit,
  canDelete,
  onDelete,
}: ClassTableViewProps) {
  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4 sm:px-6">Nama Kelas & Jenjang</th>
              <th className="py-3.5 px-4">Wilayah Binaan</th>
              <th className="py-3.5 px-4">Wali Kelas Pengampu</th>
              <th className="py-3.5 px-4">Tahun Ajaran</th>
              <th className="py-3.5 px-4 text-center">Aktivitas</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {classes.map((cls) => {
              const genColorClass = (() => {
                switch (cls.generation.color) {
                  case 'sky':
                    return 'bg-sky-50 text-sky-700 border-sky-200';
                  case 'purple':
                    return 'bg-purple-50 text-purple-700 border-purple-200';
                  case 'amber':
                    return 'bg-amber-50 text-amber-700 border-amber-200';
                  case 'rose':
                    return 'bg-rose-50 text-rose-700 border-rose-200';
                  default:
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                }
              })();

              const tierColorClass = (() => {
                switch (cls.tierLevel) {
                  case TierLevel.DAERAH:
                    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
                  case TierLevel.DESA:
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  default:
                    return 'bg-sky-50 text-sky-700 border-sky-200';
                }
              })();

              return (
                <tr
                  key={cls.id}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* Nama Kelas & Jenjang */}
                  <td className="py-3 px-4 sm:px-6">
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <Link
                        href={`/kelas/${cls.id}`}
                        className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate"
                      >
                        {cls.name}
                      </Link>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${genColorClass}`}
                        >
                          {cls.generation.name} ({cls.generation.minAge}-{cls.generation.maxAge} thn)
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${tierColorClass}`}
                        >
                          {cls.tierLevel}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Wilayah Binaan */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 min-w-[150px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 text-xs truncate">
                          {cls.organization.name}
                        </span>
                        {cls.organization.parent && (
                          <span className="text-[10px] text-slate-400 truncate">
                            {cls.organization.parent.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Wali Kelas Pengampu */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 min-w-[170px]">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                          cls.homeroomTeacher
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        {cls.homeroomTeacher ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {cls.homeroomTeacher
                            ? cls.homeroomTeacher.fullName
                            : 'Belum Ditugaskan'}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {cls.homeroomTeacher?.phoneNumber || 'Tidak ada kontak'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Tahun Ajaran */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                      TP {cls.academicYear}
                    </span>
                  </td>

                  {/* Aktivitas (Santri, Jadwal, Tugas) */}
                  <td className="py-3 px-4 whitespace-nowrap text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1" title="Jumlah Santri">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{cls.studentCount}</strong>
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="inline-flex items-center gap-1" title="Jadwal Pengajian">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{cls._count.schedules}</strong>
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="inline-flex items-center gap-1" title="Tugas">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{cls._count.assignments}</strong>
                      </span>
                    </div>
                  </td>

                  {/* Aksi */}
                  <td className="py-3 px-4 sm:px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/kelas/${cls.id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Detail Kelas"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>

                      {canEdit && (
                        <Link
                          href={`/kelas/${cls.id}/edit`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Ubah Kelas"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(cls)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Kelas"
                        >
                          <Trash2 className="w-4 h-4" />
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
