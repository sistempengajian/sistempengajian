'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  ChevronDown,
  Printer,
  Sparkles,
  Flame,
  BookOpen,
  Heart,
  Trophy,
  Filter,
  Users,
  RefreshCw,
  Presentation,
} from 'lucide-react';
import {
  ChildDevelopmentReport,
  ChildSelectorItem,
} from '@/app/(protected)/laporan/types';
import { getChildDevelopmentReport } from '@/app/(protected)/laporan/actions';
import ChildSelectorModal from './ChildSelectorModal';
import AttendanceHeatmapCard from './AttendanceHeatmapCard';
import CurriculumMasteryCard from './CurriculumMasteryCard';
import CharacterEvaluationCard from './CharacterEvaluationCard';
import GamificationShowcaseCard from './GamificationShowcaseCard';
import ExportPdfModal from './ExportPdfModal';
import ShareWhatsAppButton from './ShareWhatsAppButton';

import RoleNavTabs, { RoleTabId, RoleTabItem } from '@/components/navigation/RoleNavTabs';

interface LaporanClientWrapperProps {
  initialReport: ChildDevelopmentReport;
  availableStudents: ChildSelectorItem[];
  preloadedReportsMap: Record<string, ChildDevelopmentReport>;
  userRoleCategory: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN';
  availableRoles?: RoleTabItem[];
  activeRoleTabId?: RoleTabId;
}

const PERIOD_OPTIONS = [
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
  { id: 'LAST_3_MONTHS', label: '3 Bulan Terakhir' },
  { id: 'THIS_SEMESTER', label: 'Semester Ini' },
  { id: 'ALL', label: 'Semua Periode' },
];

export default function LaporanClientWrapper({
  initialReport,
  availableStudents,
  preloadedReportsMap,
  userRoleCategory,
  availableRoles,
  activeRoleTabId,
}: LaporanClientWrapperProps) {
  const [currentStudentId, setCurrentStudentId] = useState<string>(
    initialReport.student.id
  );
  const [currentPeriod, setCurrentPeriod] = useState<string>(
    initialReport.period || 'THIS_MONTH'
  );
  const [reportsMap, setReportsMap] =
    useState<Record<string, ChildDevelopmentReport>>(preloadedReportsMap);

  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Current active report
  const cacheKey = `${currentStudentId}_${currentPeriod}`;
  const currentReport = reportsMap[cacheKey] || initialReport;
  const { student, attendance, curriculum, character, gamification } = currentReport;

  // Pergantian Santri Instan (Zero-Delay)
  const handleSelectStudent = (studentId: string) => {
    setCurrentStudentId(studentId);
    const key = `${studentId}_${currentPeriod}`;

    // Update URL tanpa reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('studentId', studentId);
      url.searchParams.set('period', currentPeriod);
      window.history.replaceState({}, '', url.toString());
    }

    if (!reportsMap[key]) {
      startTransition(async () => {
        try {
          const freshReport = await getChildDevelopmentReport(studentId, currentPeriod);
          setReportsMap((prev) => ({
            ...prev,
            [key]: freshReport,
          }));
        } catch (err) {
          console.error('Error fetching report for student', err);
        }
      });
    }
  };

  // Pergantian Periode
  const handleSelectPeriod = (periodId: string) => {
    setCurrentPeriod(periodId);
    const key = `${currentStudentId}_${periodId}`;

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('studentId', currentStudentId);
      url.searchParams.set('period', periodId);
      window.history.replaceState({}, '', url.toString());
    }

    if (!reportsMap[key]) {
      startTransition(async () => {
        try {
          const freshReport = await getChildDevelopmentReport(
            currentStudentId,
            periodId
          );
          setReportsMap((prev) => ({
            ...prev,
            [key]: freshReport,
          }));
        } catch (err) {
          console.error('Error fetching report for period', err);
        }
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16 ml-2 mr-2">
      {/* Switcher Role jika user memiliki multi-peran (menggunakan Bottom Sheet modal) */}
      {availableRoles && availableRoles.length > 1 && (
        <RoleNavTabs
          availableRoles={availableRoles}
          activeRole={activeRoleTabId || (userRoleCategory === 'SANTRI' ? 'student' : 'parent')}
          variant="bottom-sheet"
          onRoleChange={(newRole) => {
            const roleParam =
              newRole === 'student'
                ? 'santri'
                : newRole === 'parent'
                  ? 'orang_tua'
                  : newRole === 'teacher'
                    ? 'pengajar'
                    : 'admin';
            window.location.href = `/laporan?role=${roleParam}`;
          }}
        />
      )}

      {/* 1. Header Profil Santri & Pilihan Multi-Anak */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Info Utama Santri */}
          <div className="flex flex-col items-center gap-4 min-w-0 sm:flex-row">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-sm border-2 border-white">
                {student.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                  {student.fullName}
                </h2>
                {userRoleCategory === 'SANTRI' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/80">
                    <GraduationCap className="w-3 h-3 text-emerald-700" />
                    Rapor Belajar Saya
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/70">
                    {student.generationName}
                  </span>
                )}
                {student.className && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                    {student.className}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 flex flex-col items-start gap-2 sm:flex-row sm:items-start">
                <span>Kelompok{' '}
                  <strong className="text-slate-700 font-semibold">
                    {student.organizationName}
                  </strong>
                </span>
                {student.homeroomTeacher && (
                  <>
                    <span>
                      Wali Kelas:{' '}
                      <strong className="text-slate-700 font-semibold">
                        {student.homeroomTeacher.fullName}
                      </strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Tombol Ganti Ananda / Santri jika > 1 */}
          {availableStudents.length > 1 && (
            <div className="self-start md:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsChildModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100/80 text-teal-800 text-xs font-bold border border-teal-200/80 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <Users className="w-4 h-4 text-teal-600" />
                <span>
                  {userRoleCategory === 'ORANG_TUA' ? 'Ganti' : 'Ganti Santri'} (
                  {availableStudents.length})
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-teal-600 ml-0.5" />
              </button>
            </div>
          )}
        </div>

        {/* Bar Filter Periode & Aksi Cetak/Share */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tombol Aksi Praktis: Cetak PDF & Bagikan WhatsApp */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Cetak Rapor (PDF)</span>
            </button>

            <ShareWhatsAppButton report={currentReport} userRoleCategory={userRoleCategory} />

            {(userRoleCategory === 'PENGAJAR' || userRoleCategory === 'ADMIN') && (
              <Link
                href="/analisis"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200/80 shadow-2xs transition-all active:scale-95 cursor-pointer ml-auto"
              >
                <Presentation className="w-3.5 h-3.5 text-indigo-600" />
                <span>Analitika &amp; Presentasi Eksekutif</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-3xl border border-slate-200 /80 shadow-xs p-4 sm:p-6 space-y-4'>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Periode:
          </span>
          {PERIOD_OPTIONS.map((opt) => {
            const isSelected = currentPeriod === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${isSelected
                  ? 'bg-emerald-600  text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Grid 4 Kartu Metrik Utama (Mobile-First: 2 kolom di mobile, 4 kolom di desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Metrik 1: Kehadiran */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Kehadiran
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {attendance.percentage}%
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">Hadir</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
            {attendance.currentStreak > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                {attendance.currentStreak}x streak
              </span>
            ) : (
              <span>{attendance.attended}/{attendance.totalSessions} sesi</span>
            )}
          </div>
        </div>

        {/* Metrik 2: Penguasaan Kurikulum */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Target Tuntas
            </span>
            <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {curriculum.completedItems}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / {curriculum.totalChecklistItems}
            </span>
          </div>
          <div className="text-[10px] text-teal-700 font-bold truncate">
            {curriculum.masteryPercentage}% kurikulum disahkan
          </div>
        </div>

        {/* Metrik 3: Rata-rata Adab & Karakter */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Nilai Karakter
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
              <Heart className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {character.averageAdab}
            </span>
            <span className="text-xs font-semibold text-amber-700">/ 100</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Keaktifan: <strong className="text-slate-800 font-bold">{character.averageKeaktifan}</strong>
          </div>
        </div>

        {/* Metrik 4: Gamifikasi & Poin */}
        <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Prestasi
            </span>
            <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {gamification.points}
            </span>
            <span className="text-xs font-semibold text-purple-700">Poin</span>
          </div>
          <div className="text-[10px] text-purple-800 font-bold truncate">
            Level {gamification.level} • {gamification.badges.length} Lencana
          </div>
        </div>
      </div>

      {/* 3. Modul Visualisasi Detail (Heatmap Presensi & Penguasaan Materi) */}
      <div className="space-y-4 sm:space-y-6">
        <AttendanceHeatmapCard attendance={attendance} currentPeriod={currentPeriod} />
        <CurriculumMasteryCard curriculum={curriculum} />
      </div>

      {/* 4. Modul Karakter & Gamifikasi */}
      <div className="space-y-4 sm:space-y-6">
        <CharacterEvaluationCard character={character} />
        <GamificationShowcaseCard
          gamification={gamification}
          assignments={currentReport.assignments}
        />
      </div>

      {/* Modal Pemilih Santri (Multi-Child Selector) */}
      <ChildSelectorModal
        isOpen={isChildModalOpen}
        onClose={() => setIsChildModalOpen(false)}
        students={availableStudents}
        selectedStudentId={currentStudentId}
        onSelectStudent={handleSelectStudent}
        title={
          userRoleCategory === 'ORANG_TUA'
            ? 'Pilih Ananda'
            : 'Pilih Santri Binaan'
        }
        subtitle={
          userRoleCategory === 'ORANG_TUA'
            ? 'Pilih ananda untuk melihat laporan perkembangannya'
            : 'Pilih santri untuk meninjau hasil belajar dan rekapitulasi'
        }
      />

      {/* Modal Pratinjau & Cetak PDF */}
      <ExportPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        report={currentReport}
      />
    </div >
  );
}
