'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  School,
  Plus,
  ArrowLeft,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  ClassesOverviewData,
  ClassWithRelations,
  ClassFilterState,
} from './types';
import ClassMetricsOverview from './ClassMetricsOverview';
import ClassFilterBar from './ClassFilterBar';
import ClassCard from './ClassCard';
import ClassTableView from './ClassTableView';
import DeleteClassModal from './DeleteClassModal';

interface ClassManagementViewProps {
  initialData: ClassesOverviewData;
}

export default function ClassManagementView({ initialData }: ClassManagementViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [classes, setClasses] = useState<ClassWithRelations[]>(initialData.classes);
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [pagination, setPagination] = useState(initialData.pagination);
  const { userPermissions, filterOptions } = initialData;

  // Sinkronisasi data saat initialData dari server diperbarui
  useEffect(() => {
    setClasses(initialData.classes);
    setMetrics(initialData.metrics);
    setPagination(initialData.pagination);
  }, [initialData]);

  // Local filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedGenerationId, setSelectedGenerationId] = useState(
    searchParams.get('generationId') || 'ALL'
  );
  const [selectedTierLevel, setSelectedTierLevel] = useState(
    searchParams.get('tierLevel') || 'ALL'
  );
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(
    searchParams.get('academicYear') || 'ALL'
  );
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Hapus State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedClassToDelete, setSelectedClassToDelete] =
    useState<ClassWithRelations | null>(null);

  // Notifikasi Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Sinkronisasi filter ke URL tanpa me-reload seluruh halaman
  const updateUrlParams = (newParams: Partial<ClassFilterState>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('role', 'manage');

    const nextSearch = newParams.search !== undefined ? newParams.search : searchQuery;
    const nextGen =
      newParams.generationId !== undefined ? newParams.generationId : selectedGenerationId;
    const nextTier =
      newParams.tierLevel !== undefined ? newParams.tierLevel : selectedTierLevel;
    const nextYear =
      newParams.academicYear !== undefined ? newParams.academicYear : selectedAcademicYear;

    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    else params.delete('search');

    if (nextGen && nextGen !== 'ALL') params.set('generationId', nextGen);
    else params.delete('generationId');

    if (nextTier && nextTier !== 'ALL') params.set('tierLevel', nextTier);
    else params.delete('tierLevel');

    if (nextYear && nextYear !== 'ALL') params.set('academicYear', nextYear);
    else params.delete('academicYear');

    const newUrl = `/kelas?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    updateUrlParams({ search: val });
  };

  const handleGenerationChange = (id: string) => {
    setSelectedGenerationId(id);
    updateUrlParams({ generationId: id });
  };

  const handleTierLevelChange = (tier: string) => {
    setSelectedTierLevel(tier);
    updateUrlParams({ tierLevel: tier });
  };

  const handleAcademicYearChange = (year: string) => {
    setSelectedAcademicYear(year);
    updateUrlParams({ academicYear: year });
  };

  // Filter client-side seketika (Instant 0ms response)
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      // 1. Filter Jenjang Generasi
      if (
        selectedGenerationId &&
        selectedGenerationId !== 'ALL' &&
        cls.generationId !== selectedGenerationId
      ) {
        return false;
      }

      // 2. Filter Tingkat Wilayah (Mencocokkan tierLevel kelas atau tipe organisasi)
      if (selectedTierLevel && selectedTierLevel !== 'ALL') {
        const matchTier =
          cls.tierLevel === selectedTierLevel ||
          cls.organization.type === selectedTierLevel;
        if (!matchTier) return false;
      }

      // 3. Filter Tahun Ajaran
      if (
        selectedAcademicYear &&
        selectedAcademicYear !== 'ALL' &&
        cls.academicYear !== selectedAcademicYear
      ) {
        return false;
      }

      // 4. Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = cls.name.toLowerCase().includes(q);
        const matchTeacher =
          cls.homeroomTeacher?.fullName.toLowerCase().includes(q) || false;
        const matchOrg = cls.organization.name.toLowerCase().includes(q);
        const matchYear = cls.academicYear.toLowerCase().includes(q);
        return matchName || matchTeacher || matchOrg || matchYear;
      }

      return true;
    });
  }, [
    classes,
    selectedGenerationId,
    selectedTierLevel,
    selectedAcademicYear,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGenerationId('ALL');
    setSelectedTierLevel('ALL');
    setSelectedAcademicYear('ALL');
    updateUrlParams({
      search: '',
      generationId: 'ALL',
      tierLevel: 'ALL',
      academicYear: 'ALL',
    });
  };

  // Handler Hapus Kelas
  const handleDeleteTrigger = (cls: ClassWithRelations) => {
    setSelectedClassToDelete(cls);
    setDeleteModalOpen(true);
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== deletedId));
    setMetrics((prev) => ({
      ...prev,
      totalClasses: Math.max(0, prev.totalClasses - 1),
    }));
    setFeedback({
      type: 'success',
      text: 'Kelas berhasil dihapus secara permanen.',
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-2">
              <span>Kelola Kelas Pengajian</span>
              {isPending && (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Manajemen ruang kelas berjenjang, penugasan wali kelas, dan tahun ajaran binaan
            </p>
          </div>
        </div>

        {/* Tombol Tambah Kelas */}
        {userPermissions.canCreate && (
          <Link
            href="/kelas/tambah"
            prefetch={true}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Kelas Baru</span>
          </Link>
        )}
      </div>

      {/* Alert Notifikasi Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. Ringkasan Metrik */}
      <ClassMetricsOverview metrics={metrics} />

      {/* 3. Bar Kontrol Pencarian & Filter */}
      <ClassFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedGenerationId={selectedGenerationId}
        onGenerationChange={handleGenerationChange}
        selectedTierLevel={selectedTierLevel}
        onTierLevelChange={handleTierLevelChange}
        selectedAcademicYear={selectedAcademicYear}
        onAcademicYearChange={handleAcademicYearChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        generations={filterOptions.generations}
        academicYears={filterOptions.academicYears}
        totalResults={classes.length}
        filteredResults={filteredClasses.length}
      />

      {/* 4. Daftar Kelas (Grid Cards atau Table) */}
      {filteredClasses.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-10 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <School className="w-7 h-7 stroke-[1.8]" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Tidak Ada Kelas yang Cocok
            </h3>
            <p className="text-xs text-slate-500">
              Tidak ada ruang kelas yang sesuai dengan kombinasi filter yang Anda pilih. Coba sesuaikan kata kunci pencarian atau reset filter.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter Pencarian</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredClasses.map((cls) => (
            <ClassCard
              key={cls.id}
              classData={cls}
              canEdit={userPermissions.canEdit}
              canDelete={userPermissions.canDelete}
              onDelete={handleDeleteTrigger}
            />
          ))}
        </div>
      ) : (
        <ClassTableView
          classes={filteredClasses}
          canEdit={userPermissions.canEdit}
          canDelete={userPermissions.canDelete}
          onDelete={handleDeleteTrigger}
        />
      )}

      {/* Modal Hapus Kelas */}
      <DeleteClassModal
        isOpen={deleteModalOpen}
        classData={selectedClassToDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedClassToDelete(null);
        }}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
