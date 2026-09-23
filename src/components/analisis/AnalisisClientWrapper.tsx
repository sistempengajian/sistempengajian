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
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16 ml-2 mr-2">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <GraduationCap className="h-4 w-4 text-teal-600" />
              <span className="hidden sm:inline">Rapor Santri</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="h-4 w-4 text-slate-600" />
              <span>Cetak / Ekspor</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPresentationOpen(true)}
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
        onOpenPresentation={() => setIsPresentationOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        isPending={isPending}
      />

      {/* 3. Executive KPI Summary Cards */}
      <ExecutiveKPIBanner summary={data.summary} scopeInfo={data.scopeInfo} />

      {/* 4. Visual Charts Section: Trends & Kurikulum */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <AttendanceTrendChart trends={data.attendanceTrends} />
        <CurriculumMasteryBreakdown categories={data.curriculumCategories} />
      </div>

      {/* 5. Character Radar & Benchmark Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <CharacterRadarChart dimensions={data.characterRadar} />
        {data.benchmarkComparison && data.benchmarkComparison.length > 0 ? (
          <BenchmarkComparisonTable
            benchmarks={data.benchmarkComparison}
            onSelectUnit={(unitId) => {
              const foundClass = filterOptions.classes.find((c) => c.id === unitId);
              if (foundClass) {
                handleScopeChange('CLASS', unitId);
                return;
              }
              const foundKelompok = filterOptions.kelompoks.find((k) => k.id === unitId);
              if (foundKelompok) {
                handleScopeChange('KELOMPOK', unitId);
                return;
              }
            }}
          />
        ) : (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col justify-center items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-3 border border-teal-200/70 shadow-2xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Benchmark Perbandingan Unit</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Pilih skop tingkat Kelompok, Desa, atau Daerah pada bilah filter di atas untuk melihat tabel komparasi performa presensi dan kurikulum antar sub-unit.
            </p>
          </div>
        )}
      </div>

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
      />
    </div>
  );
};
export default AnalisisClientWrapper;
