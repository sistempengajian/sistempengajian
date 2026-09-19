'use client';

import React from 'react';
import Link from 'next/link';
import {
  School,
  Calendar,
  CheckSquare,
  Users,
  Phone,
  Pencil,
  Trash2,
  ArrowUpRight,
  UserCheck,
  HelpCircle,
  MapPin,
  Layers,
} from 'lucide-react';
import { TierLevel } from '@prisma/client';
import { ClassWithRelations } from './types';

interface ClassCardProps {
  classData: ClassWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (classData: ClassWithRelations) => void;
}

export default function ClassCard({
  classData,
  canEdit,
  canDelete,
  onDelete,
}: ClassCardProps) {
  const {
    id,
    name,
    tierLevel,
    academicYear,
    organization,
    generation,
    homeroomTeacher,
    studentCount,
    _count,
  } = classData;

  // Penataan warna dinamis jenjang
  const genColorClass = (() => {
    switch (generation.color) {
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

  // Penataan warna tingkat wilayah
  const tierColorClass = (() => {
    switch (tierLevel) {
      case TierLevel.DAERAH:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case TierLevel.DESA:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  })();

  return (
    <div className="rounded-3xl bg-white border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group">
      {/* 1. Bagian Atas: Badges & Judul Kelas */}
      <div className="p-4 sm:p-5 pb-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {/* Badge Jenjang Generasi */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${genColorClass}`}
          >
            <span>{generation.name}</span>
            <span className="opacity-60 text-[10px]">
              ({generation.minAge}-{generation.maxAge} thn)
            </span>
          </span>

          {/* Badge Tingkat Wilayah */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${tierColorClass}`}
          >
            {tierLevel === TierLevel.KELOMPOK
              ? 'Kelompok'
              : tierLevel === TierLevel.DESA
              ? 'Desa'
              : 'Daerah'}
          </span>
        </div>

        {/* Nama Kelas */}
        <Link
          href={`/kelas/${id}`}
          className="block group-hover:text-emerald-700 transition-colors"
        >
          <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight">
            {name}
          </h3>
        </Link>

        {/* Lokasi Wilayah & Tahun Ajaran */}
        <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1 truncate max-w-[200px]" title={organization.name}>
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{organization.name}</span>
          </span>
          <span className="text-slate-300">&bull;</span>
          <span className="text-slate-600 font-semibold">TP {academicYear}</span>
        </div>
      </div>

      {/* 2. Bagian Tengah: Informasi Wali Kelas Pengampu */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/60 border-y border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              homeroomTeacher
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
          >
            {homeroomTeacher ? (
              <UserCheck className="w-4 h-4" />
            ) : (
              <HelpCircle className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 truncate">
                {homeroomTeacher ? homeroomTeacher.fullName : 'Belum Ditugaskan'}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block truncate">
              {homeroomTeacher
                ? homeroomTeacher.phoneNumber
                  ? `Wali Kelas • ${homeroomTeacher.phoneNumber}`
                  : 'Wali Kelas Pengampu'
                : 'Wali kelas belum dipilih'}
            </span>
          </div>
        </div>

        {homeroomTeacher?.phoneNumber && (
          <a
            href={`tel:${homeroomTeacher.phoneNumber}`}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shrink-0 shadow-2xs"
            title="Hubungi Wali Kelas"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* 3. Bagian Bawah: Statistik Aktivitas & Action Buttons */}
      <div className="p-4 sm:p-5 pt-3 space-y-3">
        {/* Ringkasan Jumlah Santri, Jadwal, & Tugas */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Santri
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 block mt-0.5">
              {studentCount}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Jadwal
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 block mt-0.5">
              {_count.schedules}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Tugas
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-800 block mt-0.5">
              {_count.assignments}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <Link
            href={`/kelas/${id}`}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
          >
            <span>Detail Ruang</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>

          <div className="flex items-center gap-1">
            {canEdit && (
              <Link
                href={`/kelas/${id}/edit`}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer shadow-2xs"
                title="Ubah data kelas"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(classData)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/50 transition-all cursor-pointer shadow-2xs"
                title="Hapus kelas"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
