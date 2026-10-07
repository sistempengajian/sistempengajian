'use client';

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  School,
  Plus,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import {
  ClassesOverviewData,
  ClassWithRelations,
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ─── Data state ─────────────────────────────────────────────────────────────
  // We accumulate pages: new filter/search resets; load-more appends.
  const [classes, setClasses] = useState<ClassWithRelations[]>(initialData.classes);
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [pagination, setPagination] = useState(initialData.pagination);
  const { userPermissions, filterOptions } = initialData;

  const [currentPage, setCurrentPage] = useState(initialData.pagination.page);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sync when initialData refreshes from server (after filter/search navigation)
  useEffect(() => {
    setClasses(initialData.classes);
    setMetrics(initialData.metrics);
    setPagination(initialData.pagination);
    setCurrentPage(initialData.pagination.page);
  }, [initialData]);

  // ─── Filter state ────────────────────────────────────────────────────────────
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

  // ─── Modal & feedback ────────────────────────────────────────────────────────
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedClassToDelete, setSelectedClassToDelete] = useState<ClassWithRelations | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Debounced server navigation ─────────────────────────────────────────────
  // BUGFIX: Previously used window.history.replaceState which only updated the URL
  // without triggering a Next.js server re-render. Filter/search never actually
  // hit the server — it only operated on the 12 initially loaded items.
  // Now we use router.push() so Next.js re-fetches the page with new params.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateWithFilters = useCallback(
    (overrides: {
      search?: string;
      generationId?: string;
      tierLevel?: string;
      academicYear?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams();
      params.set('role', 'manage');

      const s = overrides.search !== undefined ? overrides.search : searchQuery;
      const g = overrides.generationId !== undefined ? overrides.generationId : selectedGenerationId;
      const t = overrides.tierLevel !== undefined ? overrides.tierLevel : selectedTierLevel;
      const y = overrides.academicYear !== undefined ? overrides.academicYear : selectedAcademicYear;
      const p = overrides.page !== undefined ? overrides.page : 1;

      if (s.trim()) params.set('search', s.trim());
      if (g && g !== 'ALL') params.set('generationId', g);
      if (t && t !== 'ALL') params.set('tierLevel', t);
      if (y && y !== 'ALL') params.set('academicYear', y);
      if (p > 1) params.set('page', String(p));

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchQuery, selectedGenerationId, selectedTierLevel, selectedAcademicYear, startTransition]
  );

  // Search: 400ms debounce to avoid re-fetching on every keystroke
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigateWithFilters({ search: val, page: 1 });
    }, 400);
  };

  // Filter dropdowns: navigate immediately
  const handleGenerationChange = (id: string) => {
    setSelectedGenerationId(id);
    navigateWithFilters({ generationId: id, page: 1 });
  };

  const handleTierLevelChange = (tier: string) => {
    setSelectedTierLevel(tier);
    navigateWithFilters({ tierLevel: tier, page: 1 });
  };

  const handleAcademicYearChange = (year: string) => {
    setSelectedAcademicYear(year);
    navigateWithFilters({ academicYear: year, page: 1 });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGenerationId('ALL');
    setSelectedTierLevel('ALL');
    setSelectedAcademicYear('ALL');
    navigateWithFilters({ search: '', generationId: 'ALL', tierLevel: 'ALL', academicYear: 'ALL', page: 1 });
  };

  // ─── Load More (fetch next server page, append to existing list) ─────────────
  const hasMore = pagination.page < pagination.totalPages;

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const nextPage = currentPage + 1;
    const params = new URLSearchParams();
    params.set('role', 'manage');
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (selectedGenerationId && selectedGenerationId !== 'ALL') params.set('generationId', selectedGenerationId);
    if (selectedTierLevel && selectedTierLevel !== 'ALL') params.set('tierLevel', selectedTierLevel);
    if (selectedAcademicYear && selectedAcademicYear !== 'ALL') params.set('academicYear', selectedAcademicYear);
    params.set('page', String(nextPage));

    try {
      const res = await fetch(`/api/kelas/classes?${params.toString()}`);
      if (res.ok) {
        const data: ClassesOverviewData = await res.json();
        setClasses((prev) => [...prev, ...data.classes]);
        setPagination(data.pagination);
        setCurrentPage(nextPage);
      } else {
        setFeedback({ type: 'error', text: 'Gagal memuat data kelas berikutnya. Coba lagi.' });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Terjadi kesalahan jaringan. Coba lagi.' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────
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
    setPagination((prev) => ({
      ...prev,
      total: Math.max(0, prev.total - 1),
      totalPages: Math.max(1, Math.ceil((prev.total - 1) / prev.limit)),
    }));
    setFeedback({ type: 'success', text: 'Kelas berhasil dihapus secara permanen.' });
    setTimeout(() => setFeedback(null), 4000);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(selectedGenerationId && selectedGenerationId !== 'ALL') ||
    Boolean(selectedTierLevel && selectedTierLevel !== 'ALL') ||
    Boolean(selectedAcademicYear && selectedAcademicYear !== 'ALL');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. Header */}
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

      {/* Feedback */}
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

      {/* 2. Metrik */}
      <ClassMetricsOverview metrics={metrics} />

      {/* 3. Filter Bar */}
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
        totalResults={pagination.total}
        filteredResults={classes.length}
      />

      {/* 4. Daftar Kelas */}
      {isPending ? (
        // Skeleton saat filter/search sedang di-fetch dari server
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {[...Array(Math.min(6, pagination.limit))].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-10 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
            <School className="w-7 h-7 stroke-[1.8]" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {hasActiveFilters ? 'Tidak Ada Kelas yang Cocok' : 'Belum Ada Kelas'}
            </h3>
            <p className="text-xs text-slate-500">
              {hasActiveFilters
                ? 'Tidak ada ruang kelas yang sesuai dengan filter yang dipilih. Coba sesuaikan kata kunci atau reset filter.'
                : 'Belum ada kelas yang terdaftar di wilayah binaan Anda.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {classes.map((cls) => (
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
          classes={classes}
          canEdit={userPermissions.canEdit}
          canDelete={userPermissions.canDelete}
          onDelete={handleDeleteTrigger}
        />
      )}

      {/* 5. Pagination Info + Load More */}
      {!isPending && classes.length > 0 && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="text-xs text-slate-400 font-medium">
            Menampilkan{' '}
            <span className="text-slate-600 font-bold">{classes.length}</span>{' '}
            dari{' '}
            <span className="text-slate-600 font-bold">{pagination.total}</span>{' '}
            kelas
          </p>

          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memuat...</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>
                    Muat {Math.min(pagination.limit, pagination.total - classes.length)} Kelas Lagi
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Modal Hapus */}
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
