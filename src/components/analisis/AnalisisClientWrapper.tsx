'use client';

import React, { useState, useTransition } from 'react';
import {
  AnalyticsFilterOptions,
  AnalyticsDashboardData,
  AnalyticsPeriod,
  AnalyticsScopeType,
} from '@/app/(protected)/analisis/types';
import { getAnalyticsDashboardData } from '@/app/(protected)/analisis/actions';
import { AnalyticsFilterBar } from './AnalyticsFilterBar';
import { ExecutiveKPIBanner } from './ExecutiveKPIBanner';
import { AttendanceTrendChart } from './AttendanceTrendChart';
import { CurriculumMasteryBreakdown } from './CurriculumMasteryBreakdown';
import { CharacterRadarChart } from './CharacterRadarChart';
import { BenchmarkComparisonTable } from './BenchmarkComparisonTable';
import { TopAndAtRiskPerformers } from './TopAndAtRiskPerformers';
import { StudentCohortTable } from './StudentCohortTable';
import { ParentEngagementCard } from './ParentEngagementCard';
import { PresentationModeModal } from './PresentationModeModal';
import { ExportReportModal } from './ExportReportModal';
import {
  Sparkles,
  Presentation,
  Printer,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface AnalisisClientWrapperProps {
  userId: string;
  filterOptions: AnalyticsFilterOptions;
  initialData: AnalyticsDashboardData;
}

export const AnalisisClientWrapper: React.FC<AnalisisClientWrapperProps> = ({
  userId,
  filterOptions,
  initialData,
}) => {
  const [data, setData] = useState<AnalyticsDashboardData>(initialData);
  const [scopeType, setScopeType] = useState<AnalyticsScopeType>(initialData.scopeInfo.type);
  const [scopeId, setScopeId] = useState<string | undefined>(
    initialData.scopeInfo.type !== 'CUSTOM' ? initialData.scopeInfo.id : undefined
  );
  const [period, setPeriod] = useState<AnalyticsPeriod>('THIS_MONTH');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    initialData.scopeInfo.type === 'CUSTOM' ? initialData.allStudents.map((s) => s.studentId) : []
  );

  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);
  const [isPresentationOpen, setIsPresentationOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const [isPending, startTransition] = useTransition();

  // In-memory cache key
  const getCacheKey = (
    sScopeType: AnalyticsScopeType,
    sScopeId?: string,
    sPeriod?: AnalyticsPeriod,
    sStudents?: string[]
  ) => {
    return `${sScopeType}-${sScopeId || 'none'}-${sPeriod || 'THIS_MONTH'}-${(sStudents || []).sort().join(',')}`;
  };

  const [cacheMap, setCacheMap] = useState<Record<string, AnalyticsDashboardData>>({
    [getCacheKey(initialData.scopeInfo.type, initialData.scopeInfo.id, 'THIS_MONTH')]: initialData,
  });

  const loadData = (
    newScopeType: AnalyticsScopeType,
    newScopeId?: string,
    newPeriod: AnalyticsPeriod = period,
    newStudentIds: string[] = selectedStudentIds
  ) => {
    const key = getCacheKey(newScopeType, newScopeId, newPeriod, newStudentIds);
    if (cacheMap[key]) {
      setData(cacheMap[key]);
      return;
    }

    startTransition(async () => {
      try {
        const result = await getAnalyticsDashboardData(userId, {
          scopeType: newScopeType,
          scopeId: newScopeId,
          period: newPeriod,
          customStudentIds: newStudentIds,
        });

        setData(result);
        setCacheMap((prev) => ({ ...prev, [key]: result }));
      } catch (err) {
        console.error('Failed to load analytics dashboard data:', err);
      }
    });
  };

  const handleScopeChange = (
    newType: AnalyticsScopeType,
    newId?: string,
    newStudentIds?: string[]
  ) => {
    setScopeType(newType);
    setScopeId(newId);
    if (newStudentIds) {
      setSelectedStudentIds(newStudentIds);
    }
    loadData(newType, newId, period, newStudentIds || selectedStudentIds);
  };

  const handlePeriodChange = (newPeriod: AnalyticsPeriod) => {
    setPeriod(newPeriod);
    loadData(scopeType, scopeId, newPeriod, selectedStudentIds);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-16">
      {/* 1. Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white font-black flex items-center justify-center shadow-xs border-2 border-white shrink-0">
              <Presentation className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  Analitika &amp; Presentasi Eksekutif
                </h1>
                {isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Pemantauan multi-skop data santri, agregasi tren presensi, kurikulum, karakter, dan proyeksi rapat musyawarah
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
            <Link
              href="/laporan"
              aria-label="Buka Halaman Rapor Santri"
              title="Buka Halaman Rapor Santri"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <GraduationCap className="h-4 w-4 text-teal-600" />
              <span className="sm:hidden text-xs">Rapor</span>
              <span className="hidden sm:inline">Rapor Santri</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              aria-label="Cetak dan Ekspor Laporan"
              title="Cetak dan Ekspor Laporan"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Cetak / Ekspor</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPresentationOpen(true)}
              aria-label="Buka Mode Rapat Musyawarah 16:9"
              title="Buka Mode Rapat Musyawarah 16:9"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Presentation className="h-4 w-4" />
              <span>Mode Rapat (16:9)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter Navigation Bar */}
      <AnalyticsFilterBar
        filterOptions={filterOptions}
        currentScopeType={scopeType}
        currentScopeId={scopeId}
        currentPeriod={period}
        selectedStudentIds={selectedStudentIds}
        isPrivacyMode={isPrivacyMode}
        onScopeChange={handleScopeChange}
        onPeriodChange={handlePeriodChange}
        onTogglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)}
        isPending={isPending}
      />

      {/* 2b. Quick-Switch Homeroom Tabs (Khusus Pengajar / Wali Kelas Multi-Kelas) */}
      {filterOptions.homeroomClasses && filterOptions.homeroomClasses.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 sm:p-2.5 shadow-2xs">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar snap-x py-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-1 hidden sm:inline-flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
              Pintas Kelas:
            </span>

            {/* Tab 1: Semua Kelas Binaan (Aktifkan HOMEROOM_ALL) */}
            <button
              type="button"
              onClick={() => handleScopeChange('HOMEROOM_ALL', 'homeroom_all')}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 snap-start cursor-pointer active:scale-95 ${
                scopeType === 'HOMEROOM_ALL'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-2xs ring-2 ring-teal-500/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${scopeType === 'HOMEROOM_ALL' ? 'text-amber-300' : 'text-teal-600'}`} />
              <span>Semua Kelas Binaan</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  scopeType === 'HOMEROOM_ALL' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                }`}
              >
                {filterOptions.homeroomClasses.reduce((acc, c) => acc + c.studentCount, 0)}
              </span>
            </button>

            {/* Tab 2..N: Tiap Kelas Binaan (Hanya yang studentCount > 0) */}
            {filterOptions.homeroomClasses.map((cls) => {
              const isSelected = scopeType === 'CLASS' && scopeId === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => handleScopeChange('CLASS', cls.id)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 snap-start cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-2xs ring-2 ring-teal-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <span>{cls.name}</span>
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {cls.studentCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Executive KPI Summary Cards */}
      <ExecutiveKPIBanner summary={data.summary} scopeInfo={data.scopeInfo} />

      {/* 4. Visual Charts Section: Trends & Kurikulum */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <AttendanceTrendChart
          trends={data.attendanceTrends}
          completedSessionsCount={data.summary.completedSessionsCount}
        />
        <CurriculumMasteryBreakdown
          categories={data.curriculumCategories}
          period={period}
          periodLabel={data.scopeInfo.periodLabel}
        />
      </div>

      {/* 5. Character Radar & Benchmark Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <CharacterRadarChart dimensions={data.characterRadar} />
        {data.benchmarkComparison && data.benchmarkComparison.length > 0 ? (
          <BenchmarkComparisonTable
            benchmarks={data.benchmarkComparison}
            scopeType={scopeType}
            scopeName={data.scopeInfo.name}
            onSelectUnit={(unitId) => {
              const foundClass =
                filterOptions.classes.find((c) => c.id === unitId) ||
                filterOptions.homeroomClasses?.find((c) => c.id === unitId);
              if (foundClass) {
                handleScopeChange('CLASS', unitId);
                return;
              }
              const foundKelompok = filterOptions.kelompoks.find((k) => k.id === unitId);
              if (foundKelompok) {
                handleScopeChange('KELOMPOK', unitId);
                return;
              }
              const foundDesa = filterOptions.desas.find((d) => d.id === unitId);
              if (foundDesa) {
                handleScopeChange('DESA', unitId);
                return;
              }
              const foundGen = filterOptions.generations.find((g) => g.id === unitId);
              if (foundGen) {
                handleScopeChange('GENERATION', unitId);
                return;
              }
            }}
          />
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-center items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 border border-indigo-200/70 shadow-2xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Benchmark Perbandingan Unit</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              {scopeType === 'HOMEROOM_ALL'
                ? 'Belum ada data rekaman presensi kelas binaan untuk diperbandingkan pada periode ini.'
                : ['KELOMPOK', 'DESA', 'DAERAH'].includes(scopeType)
                ? `Belum ada data rekaman presensi kelas/sub-unit pada ${data.scopeInfo.name || 'unit'} ini untuk diperbandingkan pada periode terpilih.`
                : 'Pilih skop Semua Kelas Binaan, Kelompok, Desa, atau Daerah pada bilah filter di atas untuk melihat tabel komparasi performa presensi dan kurikulum antar sub-unit.'}
            </p>
          </div>
        )}
      </div>

      {/* 5.5 Keaktifan Paraf Tugas Orang Tua (Kondisional jika ada tugas yang perlu paraf) */}
      {data.parentEngagement && data.parentEngagement.hasVerificationTasks && (
        <ParentEngagementCard engagement={data.parentEngagement} />
      )}

      {/* 6. Top & At-Risk Performers 2-Sided Comparison */}
      <TopAndAtRiskPerformers
        topPerformers={data.topPerformers}
        atRiskStudents={data.atRiskStudents}
      />

      {/* 7. Comprehensive Interactive Student Cohort Table */}
      <StudentCohortTable
        students={data.allStudents}
        isPrivacyMode={isPrivacyMode}
      />

      {/* Presentation Fullscreen Modal */}
      <PresentationModeModal
        isOpen={isPresentationOpen}
        onClose={() => setIsPresentationOpen(false)}
        data={data}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacyMode={() => setIsPrivacyMode(!isPrivacyMode)}
      />

      {/* Export / Print Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={data}
        isPrivacyMode={isPrivacyMode}
      />
    </div>
  );
};
export default AnalisisClientWrapper;
