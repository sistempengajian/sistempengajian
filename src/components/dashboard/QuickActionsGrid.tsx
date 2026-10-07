import React from 'react';
import Link from 'next/link';
import {
  School,
  BookOpen,
  CheckSquare,
  CalendarDays,
  Users,
  QrCode,
  GraduationCap,
  UserCheck,
  Presentation,
  Sparkles,
  Shield,
  Layers,
  Landmark,
  Activity,
} from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';

interface QuickActionsGridProps {
  generationName?: string | null;
  theme: {
    menuIconClass: string;
    [key: string]: any;
  };
  isSantri: boolean;
  isOrangTua: boolean;
  isPengajar: boolean;
  isWaliKelas: boolean;
  isPj: boolean;
  isAdmin: boolean;
  pendingApprovalsCount: number;
}

export default function QuickActionsGrid({
  generationName,
  theme,
  isSantri,
  isOrangTua,
  isPengajar,
  isWaliKelas,
  isPj,
  isAdmin,
  pendingApprovalsCount,
}: QuickActionsGridProps) {
  return (
    <section className={COMMON_THEME.cardClassPadded}>
      <div className="flex items-center justify-between px-0.5 mb-3">
        <h3 className={COMMON_THEME.sectionTitleClass}>
          Menu Utama Sistem {generationName || ''}
        </h3>
      </div>

      {/* A. MENU UTAMA KHUSUS SANTRI */}
      {isSantri && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
          <Link
            href="/kelas?role=student"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelas Saya
            </span>
          </Link>

          <Link
            href="/kurikulum?role=student"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kurikulum
            </span>
          </Link>

          <Link
            href="/tugas?role=student"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Tugas Saya
            </span>
          </Link>

          <Link
            href="/jadwal?role=student"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jadwal Saya
            </span>
          </Link>

          <Link
            href="/private-remedial"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Halaqah Khusus
            </span>
          </Link>

          <Link
            href="/presensi?role=student"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Scan Presensi
            </span>
          </Link>

          <Link
            href="/laporan"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Rapor Belajar
            </span>
          </Link>
        </div>
      )}

      {/* B. MENU UTAMA KHUSUS ORANG TUA */}
      {isOrangTua && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
          <Link
            href="/kelas?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelas Ananda
            </span>
          </Link>

          <Link
            href="/laporan"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Rapor Anak
            </span>
          </Link>

          <Link
            href="/tugas?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Tugas Anak
            </span>
          </Link>

          <Link
            href="/jadwal?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jadwal Anak
            </span>
          </Link>

          <Link
            href="/presensi?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Presensi Anak
            </span>
          </Link>

          <Link
            href="/kurikulum?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Target Materi
            </span>
          </Link>

          <Link
            href="/jadwal?role=parent"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kontak Guru
            </span>
          </Link>
        </div>
      )}

      {/* C. MENU UTAMA KHUSUS PENGAJAR / WALI KELAS */}
      {(isPengajar || isWaliKelas) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
          <Link
            href="/kelas?role=teacher"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelas Binaan
            </span>
          </Link>

          <Link
            href="/laporan"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Rapor Belajar
            </span>
          </Link>

          <Link
            href="/analisis"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Analitika &amp; Presentasi
            </span>
          </Link>

          <Link
            href="/presensi"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <QrCode className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Buka Presensi
            </span>
          </Link>

          <Link
            href="/kurikulum?role=teacher"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kurikulum
            </span>
          </Link>

          <Link
            href="/jadwal?role=teacher"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jadwal Mengajar
            </span>
          </Link>

          <Link
            href="/tugas?role=teacher"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Tugas Santri
            </span>
          </Link>

          <Link
            href="/private-remedial"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Private / Remedial
            </span>
          </Link>

          <Link
            href="/jadwal?role=teacher"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Delegasi Badal
            </span>
          </Link>
        </div>
      )}

      {/* D. MENU UTAMA KHUSUS PENGURUS WILAYAH (PJ KELOMPOK, DESA, DAERAH) */}
      {isPj && !isAdmin && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
          <Link
            href="/kelas?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola Kelas
            </span>
          </Link>

          <Link
            href="/analisis"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Analitika Eksekutif
            </span>
          </Link>

          <Link
            href="/kurikulum?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kurikulum
            </span>
          </Link>

          <Link
            href="/jadwal?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola Jadwal
            </span>
          </Link>

          <Link
            href="/tugas?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Monitoring Tugas
            </span>
          </Link>

          <Link
            href="/private-remedial"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0 relative`}
            >
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Approval
            </span>
          </Link>

          <Link
            href="/users"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola User
            </span>
          </Link>

          <Link
            href="/generasi"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jenjang Generasi
            </span>
          </Link>

          <Link
            href="/organisasi"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Landmark className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Tingkatan Wilayah
            </span>
          </Link>
        </div>
      )}

      {/* E. MENU UTAMA KHUSUS ADMIN MASTER */}
      {isAdmin && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
          <Link
            href="/kelas?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola Kelas
            </span>
          </Link>

          <Link
            href="/analisis"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Analitika Eksekutif
            </span>
          </Link>

          <Link
            href="/kurikulum?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kurikulum
            </span>
          </Link>

          <Link
            href="/jadwal?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jadwal Global
            </span>
          </Link>

          <Link
            href="/tugas?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Monitoring Tugas
            </span>
          </Link>

          <Link
            href="/private-remedial"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0 relative`}
            >
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
              )}
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Approval
            </span>
          </Link>

          <Link
            href="/users"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola User
            </span>
          </Link>

          <Link
            href="/generasi"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Jenjang Generasi
            </span>
          </Link>

          <Link
            href="/organisasi"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Landmark className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Tingkatan Wilayah
            </span>
          </Link>

          <Link
            href="/kelas?role=manage"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Kelola Kelas
            </span>
          </Link>

          <Link
            href="/analisis"
            prefetch={true}
            className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
          >
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
            >
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
              Audit Log
            </span>
          </Link>
        </div>
      )}
    </section>
  );
}
