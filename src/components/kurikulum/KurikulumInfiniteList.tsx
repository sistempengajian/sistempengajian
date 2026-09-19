'use client';

import React, { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import MaterialCard, { MaterialData, ChecklistItemData } from './MaterialCard';
import MaterialFormModal from './MaterialFormModal';
import ChecklistItemModal from './ChecklistItemModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import {
  getMaterialsPaginated,
  deleteMaterial,
  deleteChecklistItem,
  deleteMaterialVersion,
} from '@/app/(protected)/kurikulum/actions';
import {
  Search,
  X,
  BookOpen,
  Plus,
  Loader2,
  Sparkles,
  CheckCircle2,
  GitFork,
  Layers,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  UserCheck,
  GraduationCap,
  Users,
} from 'lucide-react';

export interface GenerationMetadata {
  id: string;
  code: string;
  name: string;
  minAge?: number;
  maxAge?: number;
  description?: string | null;
}

export interface AvailableStudentItem {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  generationCode?: string | null;
  generationName?: string;
}

export interface HomeroomClassItem {
  id: string;
  name: string;
  academicYear: string;
  organizationId: string;
  organizationName: string;
  generationId: string;
  generationCode: string;
  generationName: string;
  students: AvailableStudentItem[];
}

export interface SubOrganizationItem {
  id: string;
  name: string;
}

interface KurikulumInfiniteListProps {
  initialMaterials: MaterialData[];
  initialTotal: number;
  initialHasMore: boolean;
  currentGenCode: string;
  generations: GenerationMetadata[];
  canManage: boolean;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  userOrganizationId?: string | null;
  userOrganizationName?: string;
  parentOrganizationName?: string;
  activeStudentId?: string | null;
  availableStudents?: AvailableStudentItem[];
  userRoleCategory?: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ';
  homeroomClasses?: HomeroomClassItem[];
  activeClassId?: string | null;
  subOrganizations?: SubOrganizationItem[];
  activeFilterOrgId?: string | null;
}

interface GenerationCacheEntry {
  items: MaterialData[];
  total: number;
  hasMore: boolean;
  page: number;
  timestamp: number;
}

// Global in-memory cache antar navigasi halaman (SPA navigation dalam sesi browser aktif)
const globalKurikulumCache: Partial<Record<string, GenerationCacheEntry>> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit masa berlaku cache sebelum revalidasi otomatis

export default function KurikulumInfiniteList({
  initialMaterials,
  initialTotal,
  initialHasMore,
  currentGenCode,
  generations,
  canManage,
  userTierLevel,
  userOrganizationId,
  userOrganizationName = '',
  parentOrganizationName = '',
  activeStudentId = null,
  availableStudents = [],
  userRoleCategory = 'PJ',
  homeroomClasses = [],
  activeClassId = null,
  subOrganizations = [],
  activeFilterOrgId = null,
}: KurikulumInfiniteListProps) {
  // Cek apakah ada data cache global dari kunjungan halaman sebelumnya yang masih valid
  const cachedForCurrent = globalKurikulumCache[currentGenCode];
  const isCachedValid = Boolean(cachedForCurrent && Date.now() - cachedForCurrent.timestamp < CACHE_TTL_MS);

  const [activeGenCode, setActiveGenCode] = useState<string>(currentGenCode);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(activeStudentId || null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    activeClassId || (homeroomClasses && homeroomClasses[0]?.id) || null
  );
  const [selectedFilterOrgId, setSelectedFilterOrgId] = useState<string | null>(
    activeFilterOrgId || null
  );
  const [currentClassStudents, setCurrentClassStudents] = useState<AvailableStudentItem[]>(() => {
    if (homeroomClasses && homeroomClasses.length > 0) {
      const cls = (activeClassId && homeroomClasses.find((c) => c.id === activeClassId)) || homeroomClasses[0];
      return cls ? cls.students : availableStudents;
    }
    return availableStudents;
  });
  const [materials, setMaterials] = useState<MaterialData[]>(() => {
    return isCachedValid && cachedForCurrent ? cachedForCurrent.items : initialMaterials;
  });
  const [totalCount, setTotalCount] = useState<number>(() => {
    return isCachedValid && cachedForCurrent ? cachedForCurrent.total : initialTotal;
  });
  const [hasMore, setHasMore] = useState<boolean>(() => {
    return isCachedValid && cachedForCurrent ? cachedForCurrent.hasMore : initialHasMore;
  });
  const [page, setPage] = useState<number>(() => {
    return isCachedValid && cachedForCurrent ? cachedForCurrent.page : 1;
  });
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isLoadingTab, setIsLoadingTab] = useState<boolean>(false);

  // In-Memory Cache data materi per jenjang (menghilangkan delay server roundtrip saat ganti tab)
  const cacheRef = useRef<Record<string, GenerationCacheEntry>>({
    ...(globalKurikulumCache as Record<string, GenerationCacheEntry>),
    [currentGenCode]: isCachedValid && cachedForCurrent ? cachedForCurrent : {
      items: initialMaterials,
      total: initialTotal,
      hasMore: initialHasMore,
      page: 1,
      timestamp: Date.now(),
    },
  });

  // Search & Debounce state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'DAERAH' | 'DESA' | 'KELOMPOK'>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [materialToEdit, setMaterialToEdit] = useState<MaterialData | null>(null);

  const [itemModalState, setItemModalState] = useState<{
    isOpen: boolean;
    materialId: string;
    itemToEdit?: ChecklistItemData | null;
    isLocalTarget?: boolean;
    isOwnerOfMaterial?: boolean;
  }>({
    isOpen: false,
    materialId: '',
    itemToEdit: null,
    isLocalTarget: false,
    isOwnerOfMaterial: true,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'MATERIAL' | 'ITEM' | 'VERSION';
    id: string;
    materialId?: string;
    title: string;
  } | null>(null);

  const [isDeleting, startDeleteTransition] = useTransition();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);

  // Tutup dropdown filter saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFilterDropdownOpen(false);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterDropdownOpen]);

  // Berpindah tab jenjang materi secara instan (0ms) dengan memori cache
  const handleSwitchGeneration = async (newGenCode: string) => {
    if (newGenCode === activeGenCode) return;

    setActiveGenCode(newGenCode);
    setSearchQuery('');
    setDebouncedSearch('');
    setScopeFilter('ALL');

    // Update URL query string di browser tanpa trigger reload Server Component
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('gen', newGenCode);
      window.history.replaceState(null, '', url.toString());
    }

    // 1. Cek Caching: jika data jenjang ini sudah ada di memori dan belum kadaluarsa, tampilkan instan (0ms delay!)
    const cached = cacheRef.current[newGenCode] || globalKurikulumCache[newGenCode];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setMaterials(cached.items);
      setTotalCount(cached.total);
      setHasMore(cached.hasMore);
      setPage(cached.page);
      return;
    }

    // 2. Jika belum ada di cache atau sudah melewati TTL, lakukan lazy load data pertama (5 materi) via Server Action
    setIsLoadingTab(true);
    try {
      const res = await getMaterialsPaginated({
        genCode: newGenCode,
        page: 1,
        limit: 5,
        scope: 'ALL',
        studentId: selectedStudentId || undefined,
        classId: selectedClassId || undefined,
        filterOrgId: selectedFilterOrgId || undefined,
      });

      const newItems = res.items as MaterialData[];
      const entry: GenerationCacheEntry = {
        items: newItems,
        total: res.total,
        hasMore: res.hasMore,
        page: 1,
        timestamp: Date.now(),
      };
      cacheRef.current[newGenCode] = entry;
      globalKurikulumCache[newGenCode] = entry;

      setMaterials(newItems);
      setTotalCount(res.total);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (err) {
      console.error('Failed to load materials for generation tab:', err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  // Berpindah kelas binaan (khusus Wali Kelas yang memiliki >1 kelas binaan)
  const handleSwitchClass = async (newClassId: string) => {
    if (newClassId === selectedClassId) return;

    const targetClass = homeroomClasses?.find((c) => c.id === newClassId);
    setSelectedClassId(newClassId);
    setSelectedStudentId(null); // Reset ke progres kolektif kelas binaan
    setSearchQuery('');
    setDebouncedSearch('');
    setScopeFilter('ALL');

    if (targetClass) {
      setCurrentClassStudents(targetClass.students);
    }

    const targetGen = targetClass?.generationCode || activeGenCode;
    if (targetGen !== activeGenCode) {
      setActiveGenCode(targetGen);
    }

    // Invalidate in-memory cache karena konteks kelas berubah
    (Object.keys(globalKurikulumCache) as string[]).forEach((code) => {
      delete globalKurikulumCache[code];
      delete cacheRef.current[code];
    });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('classId', newClassId);
      url.searchParams.set('gen', targetGen);
      url.searchParams.delete('studentId');
      window.history.replaceState(null, '', url.toString());
    }

    setIsLoadingTab(true);
    try {
      const res = await getMaterialsPaginated({
        genCode: targetGen,
        page: 1,
        limit: 5,
        scope: 'ALL',
        classId: newClassId,
        studentId: undefined,
      });

      const newItems = res.items as MaterialData[];
      const entry: GenerationCacheEntry = {
        items: newItems,
        total: res.total,
        hasMore: res.hasMore,
        page: 1,
        timestamp: Date.now(),
      };
      cacheRef.current[targetGen] = entry;
      globalKurikulumCache[targetGen] = entry;

      setMaterials(newItems);
      setTotalCount(res.total);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (err) {
      console.error('Failed to switch class context:', err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  // Berpindah santri yang ditinjau (untuk Orang Tua atau Pengajar / Wali Kelas)
  const handleSwitchStudent = async (newStudentId: string | null, newGenCode?: string | null) => {
    setSelectedStudentId(newStudentId);
    setSearchQuery('');
    setDebouncedSearch('');
    setScopeFilter('ALL');

    const targetGen = (newGenCode || activeGenCode) as string;
    if (newGenCode && newGenCode !== activeGenCode) {
      setActiveGenCode(targetGen);
    }

    // Invalidate in-memory cache karena konteks santri berubah
    (Object.keys(globalKurikulumCache) as string[]).forEach((code) => {
      delete globalKurikulumCache[code];
      delete cacheRef.current[code];
    });

    // Update URL params
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newStudentId) {
        url.searchParams.set('studentId', newStudentId);
      } else {
        url.searchParams.delete('studentId');
      }
      url.searchParams.set('gen', targetGen);
      window.history.replaceState(null, '', url.toString());
    }

    setIsLoadingTab(true);
    try {
      const res = await getMaterialsPaginated({
        genCode: targetGen,
        page: 1,
        limit: 5,
        scope: 'ALL',
        studentId: newStudentId || undefined,
        classId: selectedClassId || undefined,
        filterOrgId: selectedFilterOrgId || undefined,
      });

      const newItems = res.items as MaterialData[];
      const entry: GenerationCacheEntry = {
        items: newItems,
        total: res.total,
        hasMore: res.hasMore,
        page: 1,
        timestamp: Date.now(),
      };
      cacheRef.current[targetGen] = entry;
      globalKurikulumCache[targetGen] = entry;

      setMaterials(newItems);
      setTotalCount(res.total);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (err) {
      console.error('Failed to switch student context:', err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  // Berpindah filter kelompok untuk PJ Desa
  const handleSwitchSubOrg = async (newOrgId: string | null) => {
    setSelectedFilterOrgId(newOrgId);
    setSearchQuery('');
    setDebouncedSearch('');
    setScopeFilter('ALL');

    // Invalidate in-memory cache
    (Object.keys(globalKurikulumCache) as string[]).forEach((code) => {
      delete globalKurikulumCache[code];
      delete cacheRef.current[code];
    });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newOrgId) {
        url.searchParams.set('filterOrgId', newOrgId);
      } else {
        url.searchParams.delete('filterOrgId');
      }
      window.history.replaceState(null, '', url.toString());
    }

    setIsLoadingTab(true);
    try {
      const res = await getMaterialsPaginated({
        genCode: activeGenCode,
        page: 1,
        limit: 5,
        scope: 'ALL',
        filterOrgId: newOrgId || undefined,
      });

      const newItems = res.items as MaterialData[];
      const entry: GenerationCacheEntry = {
        items: newItems,
        total: res.total,
        hasMore: res.hasMore,
        page: 1,
        timestamp: Date.now(),
      };
      cacheRef.current[activeGenCode] = entry;
      globalKurikulumCache[activeGenCode] = entry;

      setMaterials(newItems);
      setTotalCount(res.total);
      setHasMore(res.hasMore);
      setPage(1);
    } catch (err) {
      console.error('Failed to switch sub-org context:', err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  // Debounce (300ms) untuk pencarian materi
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Muat ulang daftar saat debouncedSearch atau scopeFilter berubah
  useEffect(() => {
    let isCancelled = false;

    const performSearch = async () => {
      // Jika kembali ke kondisi bersih tanpa search & filter 'ALL', pulihkan dari cache jika ada
      if (debouncedSearch === '' && scopeFilter === 'ALL') {
        const cached = cacheRef.current[activeGenCode];
        if (cached && materials !== cached.items) {
          setMaterials(cached.items);
          setTotalCount(cached.total);
          setHasMore(cached.hasMore);
          setPage(cached.page);
          return;
        }
        if (cached && materials === cached.items) {
          return;
        }
      }

      setIsLoadingMore(true);
      try {
        const res = await getMaterialsPaginated({
          genCode: activeGenCode,
          page: 1,
          limit: 5,
          search: debouncedSearch,
          scope: scopeFilter,
          studentId: selectedStudentId || undefined,
          classId: selectedClassId || undefined,
          filterOrgId: selectedFilterOrgId || undefined,
        });

        if (!isCancelled) {
          setMaterials(res.items as MaterialData[]);
          setTotalCount(res.total);
          setHasMore(res.hasMore);
          setPage(1);
        }
      } catch (err) {
        console.error('Failed to search materials:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingMore(false);
        }
      }
    };

    performSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearch, activeGenCode, scopeFilter, selectedStudentId, selectedClassId, selectedFilterOrgId]);

  // Fungsi memuat batch data selanjutnya (Infinite Scroll / Lazy Loading)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoadingTab) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await getMaterialsPaginated({
        genCode: activeGenCode,
        page: nextPage,
        limit: 5,
        search: debouncedSearch,
        scope: scopeFilter,
        studentId: selectedStudentId || undefined,
        classId: selectedClassId || undefined,
        filterOrgId: selectedFilterOrgId || undefined,
      });

      setMaterials((prev) => {
        // Hindari duplikasi ID
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = (res.items as MaterialData[]).filter((m) => !existingIds.has(m.id));
        const updated = [...prev, ...newItems];

        // Update cache jika tidak sedang search atau filter kustom
        if (!debouncedSearch && scopeFilter === 'ALL') {
          const entry: GenerationCacheEntry = {
            items: updated,
            total: res.total,
            hasMore: res.hasMore,
            page: nextPage,
            timestamp: Date.now(),
          };
          cacheRef.current[activeGenCode] = entry;
          globalKurikulumCache[activeGenCode] = entry;
        }

        return updated;
      });

      setHasMore(res.hasMore);
      setPage(nextPage);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Failed to load more materials:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, isLoadingTab, page, activeGenCode, debouncedSearch, scopeFilter, selectedStudentId, selectedClassId, selectedFilterOrgId]);

  // IntersectionObserver untuk mendeteksi scroll mencapai sentinel bawah
  useEffect(() => {
    if (!hasMore || isLoadingMore || isLoadingTab) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '120px',
        threshold: 0.1,
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, isLoadingTab, loadMore]);

  // Refresh data penuh setelah CRUD sukses (tambah, edit, upgrade, hapus)
  const refreshList = async () => {
    try {
      const res = await getMaterialsPaginated({
        genCode: activeGenCode,
        page: 1,
        limit: Math.max(page * 5, 5),
        search: debouncedSearch,
        scope: scopeFilter,
        studentId: selectedStudentId || undefined,
        classId: selectedClassId || undefined,
        filterOrgId: selectedFilterOrgId || undefined,
      });

      const updated = res.items as MaterialData[];
      setMaterials(updated);
      setTotalCount(res.total);
      setHasMore(res.hasMore);

      // Simpan ke cache agar data cache tetap segar
      if (!debouncedSearch && scopeFilter === 'ALL') {
        const entry: GenerationCacheEntry = {
          items: updated,
          total: res.total,
          hasMore: res.hasMore,
          page,
          timestamp: Date.now(),
        };
        cacheRef.current[activeGenCode] = entry;
        globalKurikulumCache[activeGenCode] = entry;

        // Invalidate tab lain agar jika ada materi baru/upgrade yang mempengaruhi tab lain, datanya dimuat ulang segar
        (Object.keys(globalKurikulumCache) as string[]).forEach((code) => {
          if (code !== activeGenCode) {
            delete globalKurikulumCache[code];
            delete cacheRef.current[code];
          }
        });
      }
    } catch (err) {
      console.error('Failed to refresh materials list:', err);
    }
  };

  // Handler Hapus dengan sinkronisasi otomatis ke memori cache
  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    startDeleteTransition(async () => {
      if (deleteConfirm.type === 'MATERIAL') {
        const res = await deleteMaterial(deleteConfirm.id);
        if (res.error) {
          alert(res.error);
        } else {
          setDeleteConfirm(null);
          await refreshList();
        }
      } else if (deleteConfirm.type === 'VERSION') {
        const res = await deleteMaterialVersion(deleteConfirm.id);
        if (res.error) {
          alert(res.error);
        } else {
          setDeleteConfirm(null);
          await refreshList();
        }
      } else if (deleteConfirm.type === 'ITEM') {
        const res = await deleteChecklistItem(deleteConfirm.id);
        if (res.error) {
          alert(res.error);
        } else {
          setDeleteConfirm(null);
          await refreshList();
        }
      }
    });
  };

  const selectedGen = generations.find((g) => g.code === activeGenCode) || generations[0];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Selektor Anak Khusus Orang Tua */}
      {userRoleCategory === 'ORANG_TUA' && availableStudents.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-teal-200/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Tinjau Capaian Anak</h3>
              <p className="text-[11px] text-slate-500">Pilih anak untuk melihat nilai evaluasi dan pesan catatan ustadz</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {availableStudents.map((child) => {
              const isSelected = child.id === selectedStudentId;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => handleSwitchStudent(child.id, child.generationCode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{child.fullName}</span>
                  {child.generationName && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                        isSelected ? 'bg-teal-700/70 text-teal-100' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {child.generationName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode Tinjau & Monitoring Capaian untuk Wali Kelas & Pengajar */}
      {userRoleCategory === 'TEACHER' && (
        <div className="bg-white/85 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-indigo-200/70 shadow-2xs space-y-3.5 animate-fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60 shadow-2xs shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {homeroomClasses && homeroomClasses.length > 0
                      ? 'Kelas Binaan Anda'
                      : 'Jurnal Nilai & Capaian Santri'}
                  </span>
                  {homeroomClasses && homeroomClasses.length > 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200/60">
                      {homeroomClasses.length} Kelas Binaan
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {homeroomClasses && homeroomClasses.length > 0
                    ? 'Pantau capaian kolektif kelas binaan atau beralih ke rincian evaluasi per santri'
                    : 'Pantau capaian kolektif seluruh santri di kelompok atau pilih santri spesifik'}
                </p>
              </div>
            </div>

            {/* Jika Wali Kelas Memiliki > 1 Kelas Binaan: Tampilkan Multi-Class Switcher */}
            {homeroomClasses && homeroomClasses.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {homeroomClasses.map((cls) => {
                  const isSelected = cls.id === selectedClassId;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => handleSwitchClass(cls.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-indigo-200 ring-2 ring-indigo-500/30'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50/50 hover:border-indigo-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{cls.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                          isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {cls.students.length} Santri
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-Bar: Switcher Mode Progres Kolektif vs Santri Individu */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="font-medium">Sudut Pandang:</span>
              <span className="font-bold text-slate-800">
                {selectedStudentId
                  ? currentClassStudents.find((s) => s.id === selectedStudentId)?.fullName || 'Santri Terpilih'
                  : homeroomClasses && homeroomClasses.length > 0
                    ? `✨ Seluruh Santri (${homeroomClasses.find((c) => c.id === selectedClassId)?.name || 'Kelas'})`
                    : '✨ Seluruh Santri Kelompok (Kolektif)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedStudentId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  const found = currentClassStudents.find((s) => s.id === val);
                  handleSwitchStudent(val, found?.generationCode);
                }}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-indigo-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="">
                  ✨ Seluruh Santri {homeroomClasses && homeroomClasses.length > 0 ? `Kelas (${currentClassStudents.length} Santri)` : `(${currentClassStudents.length} Santri)`} - Capaian Kolektif
                </option>
                {currentClassStudents.length > 0 && (
                  <optgroup label="── Santri Perorangan (Individu) ──">
                    {currentClassStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        👤 {s.fullName} {s.generationName ? `(${s.generationName})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Banner Capaian Kolektif Wilayah untuk PJ / Admin */}
      {userRoleCategory === 'PJ' && (
        <div className="bg-white/80 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-teal-200/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>Monitoring Capaian Wilayah</span>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800">
                  {userTierLevel || 'Wilayah'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Card materi dan checklist capaian menampilkan progres akumulasi santri binaan di wilayah Anda
              </p>
            </div>
          </div>

          {/* Jika PJ Desa: Filter drill-down per kelompok */}
          {subOrganizations && subOrganizations.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter Kelompok:</span>
              <select
                value={selectedFilterOrgId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  handleSwitchSubOrg(val);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer shadow-2xs"
              >
                <option value="">✨ Seluruh Kelompok Desa ({subOrganizations.length} Kelompok)</option>
                {subOrganizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    Kelompok {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Banner Motivasi Santri */}
      {userRoleCategory === 'SANTRI' && (
        <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/5 p-3 sm:p-4 rounded-2xl border border-teal-200/80 shadow-2xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-teal-950">Buku Kendali Capaian Kurikulum</h3>
              <p className="text-[11px] text-teal-800/80">Pantau progres lingkaran materi, nilai yang diperoleh, serta catatan evaluasi ustadzmu.</p>
            </div>
          </div>
        </div>
      )}

      {/* 1. Generation Tabs (Segmented Control dengan 0ms Instant Client-Side Switching) */}
      <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/70 flex overflow-x-auto gap-1.5 no-scrollbar shadow-2xs">
        {generations.map((gen) => {
          const isActive = gen.code === activeGenCode;
          return (
            <button
              key={gen.id}
              type="button"
              onClick={() => handleSwitchGeneration(gen.code)}
              className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 text-center cursor-pointer ${
                isActive
                  ? 'bg-white text-teal-800 shadow-xs border border-teal-200/70 ring-1 ring-teal-500/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>{gen.name}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Selected Generation Focus Banner (Updates Instantly dari State Lokal) */}
      {selectedGen && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/70 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <span className="font-bold text-slate-900 block text-sm">
              Fokus Jenjang: {selectedGen.name}
              {selectedGen.minAge !== undefined && selectedGen.maxAge !== undefined && (
                <span> ({selectedGen.minAge}–{selectedGen.maxAge} Tahun)</span>
              )}
            </span>
            {selectedGen.description && (
              <p className="text-slate-600 mt-0.5 leading-relaxed">{selectedGen.description}</p>
            )}
          </div>
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/60 shrink-0 self-start sm:self-auto flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>{totalCount} Modul Terdaftar</span>
          </span>
        </div>
      )}

      {/* 3. Control Bar: Pencarian & Tombol Tambah */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-center gap-2.5">
          {/* Kolom Pencarian dengan Debounce */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul materi, topik silabus, atau tajwid..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">

          {isSearching || (isLoadingMore && page === 1) ? (
            <span className="text-teal-600 font-medium flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Memuat materi...</span>
            </span>
          ) : (
            <span>
              Menampilkan <strong className="text-slate-800">{materials.length}</strong> dari{' '}
              <strong className="text-slate-800">{totalCount}</strong> Materi

            </span>
          )}
          {/* Tombol Tambah Materi (Hanya PJ/Admin) */}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setMaterialToEdit(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Tambah Materi</span>
            </button>
          )}

        </div>

      </div>

      {/* Sub-bar: 1 Tombol Switch Filter Tingkatan Materi di Sisi Kanan (Di Antara Pencarian & Daftar Materi) */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Sisi Kiri: Label Seksi */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>Daftar Materi</span>
        </div>

        {/* Sisi Kanan: Reset Filter (Saat Aktif) & 1 Tombol Switch Filter Tingkatan */}
        <div className="flex items-center gap-1.5 ml-auto">
          {scopeFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/70 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 animate-fade-in"
              title="Reset filter ke Semua"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500 transition-colors" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all cursor-pointer ${scopeFilter === 'ALL'
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  : scopeFilter === 'DAERAH'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100/70'
                    : scopeFilter === 'DESA'
                      ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100/70'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70'
                }`}
              title="Filter tingkatan materi"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span className="text-slate-400 font-normal"></span>
              <span className="flex items-center gap-1.5 font-bold">
                {scopeFilter === 'DAERAH' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                {scopeFilter === 'DESA' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                {scopeFilter === 'KELOMPOK' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                <span>
                  {scopeFilter === 'ALL'
                    ? 'Semua'
                    : scopeFilter === 'DAERAH'
                      ? 'Daerah'
                      : scopeFilter === 'DESA'
                        ? 'Desa'
                        : 'Kelompok'}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180 text-teal-600' : ''
                  }`}
              />
            </button>

          {/* Menu Dropdown 1 Tombol Switch */}
          {isFilterDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0.5">
                Filter Tingkatan
              </div>
              {[
                { key: 'ALL' as const, label: 'Semua Tingkatan' },
                { key: 'DAERAH' as const, label: 'Tingkat Daerah', dotColor: 'bg-blue-500' },
                { key: 'DESA' as const, label: 'Tingkat Desa', dotColor: 'bg-purple-500' },
                { key: 'KELOMPOK' as const, label: 'Tingkat Kelompok', dotColor: 'bg-emerald-500' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setScopeFilter(opt.key);
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors cursor-pointer ${scopeFilter === opt.key
                      ? opt.key === 'DAERAH'
                        ? 'font-bold text-blue-700 bg-blue-50/70'
                        : opt.key === 'DESA'
                          ? 'font-bold text-purple-700 bg-purple-50/70'
                          : opt.key === 'KELOMPOK'
                            ? 'font-bold text-emerald-700 bg-emerald-50/70'
                            : 'font-bold text-slate-900 bg-slate-100/70'
                      : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    {opt.dotColor ? (
                      <span className={`w-2 h-2 rounded-full ${opt.dotColor}`} />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                    <span>{opt.label}</span>
                  </span>
                  {scopeFilter === opt.key && (
                    <span className="text-[11px] font-bold text-teal-600">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Daftar Materi (Cards) */}
      <div className="space-y-3.5">
        {isLoadingTab ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Memuat materi kurikulum...</p>
          </div>
        ) : (
          materials.map((mat) => (
            <MaterialCard
              key={mat.id}
              material={mat}
              canManage={canManage}
              userTierLevel={userTierLevel}
              userOrganizationId={userOrganizationId}
              userOrganizationName={userOrganizationName}
              parentOrganizationName={parentOrganizationName}
              onEditMaterial={(m) => {
                setMaterialToEdit(m);
                setIsCreateModalOpen(true);
              }}
              onDeleteMaterial={(id, title) => {
                setDeleteConfirm({
                  isOpen: true,
                  type: 'MATERIAL',
                  id,
                  title: `Hapus Materi "${title}"?`,
                });
              }}
              onDeleteVersion={(id, title) => {
                setDeleteConfirm({
                  isOpen: true,
                  type: 'VERSION',
                  id,
                  title: `Hapus Seluruh Versi Wilayah "${title}"?`,
                });
              }}
              onAddChecklistItem={(materialId, isLocal, isOwner) => {
                setItemModalState({
                  isOpen: true,
                  materialId,
                  itemToEdit: null,
                  isLocalTarget: isLocal,
                  isOwnerOfMaterial: isOwner,
                });
              }}
              onEditChecklistItem={(materialId, item, isOwner) => {
                setItemModalState({
                  isOpen: true,
                  materialId,
                  itemToEdit: item,
                  isLocalTarget: false,
                  isOwnerOfMaterial: isOwner,
                });
              }}
              onDeleteChecklistItem={(itemId, title) => {
                setDeleteConfirm({
                  isOpen: true,
                  type: 'ITEM',
                  id: itemId,
                  materialId: mat.id,
                  title: `Hapus Target Capaian "${title}"?`,
                });
              }}
              onRefresh={refreshList}
            />
          ))
        )}

        {/* Empty State jika tidak ada data */}
        {!isLoadingTab && materials.length === 0 && !isLoadingMore && (
          <div className="p-8 sm:p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto border border-teal-200/60 shadow-2xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">
                {debouncedSearch
                  ? `Tidak ada materi yang cocok dengan "${debouncedSearch}"`
                  : scopeFilter !== 'ALL'
                    ? `Tidak ada materi untuk Tingkat ${scopeFilter === 'DAERAH' ? 'Daerah' : scopeFilter === 'DESA' ? 'Desa' : 'Kelompok'}`
                    : 'Belum Ada Materi untuk Jenjang Ini'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {debouncedSearch || scopeFilter !== 'ALL'
                  ? 'Coba gunakan kata kunci lain atau ubah filter tingkatan materi.'
                  : canManage
                    ? 'Mulai susun silabus kurikulum dengan mengklik tombol "Tambah Materi Baru".'
                    : 'Silabus kurikulum resmi untuk jenjang ini sedang disiapkan oleh Pembina Kurikulum Daerah.'}
              </p>
            </div>

            {canManage && !debouncedSearch && scopeFilter === 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setMaterialToEdit(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer mt-1"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Tambah Materi Pertama</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sentinel Element untuk Infinite Scroll */}
      <div ref={sentinelRef} className="py-2 flex flex-col items-center justify-center">
        {isLoadingMore && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-semibold shadow-2xs animate-fade-in">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            <span>Memuat materi berikutnya...</span>
          </div>
        )}

        {!hasMore && materials.length > 0 && (
          <div className="text-center text-[11px] text-slate-400 py-3">
            <span>• Seluruh materi kurikulum telah dimuat ({materials.length} modul) •</span>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Materi */}
      <MaterialFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setMaterialToEdit(null);
        }}
        materialToEdit={materialToEdit}
        defaultGenCode={currentGenCode}
        generations={generations}
        userTierLevel={userTierLevel}
        onSuccess={refreshList}
      />

      {/* Modal Tambah / Edit Sub-Capaian */}
      <ChecklistItemModal
        isOpen={itemModalState.isOpen}
        onClose={() =>
          setItemModalState({
            isOpen: false,
            materialId: '',
            itemToEdit: null,
            isLocalTarget: false,
            isOwnerOfMaterial: true,
          })
        }
        materialId={itemModalState.materialId}
        itemToEdit={itemModalState.itemToEdit}
        userTierLevel={userTierLevel}
        isLocalTarget={itemModalState.isLocalTarget}
        isOwnerOfMaterial={itemModalState.isOwnerOfMaterial}
        onSuccess={refreshList}
      />

      {/* Modal Konfirmasi Hapus */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteConfirm?.isOpen)}
        title={deleteConfirm?.title || 'Konfirmasi Hapus'}
        description={
          deleteConfirm?.type === 'MATERIAL'
            ? 'Materi ini beserta seluruh target capaian di dalamnya akan dihapus secara permanen dari silabus.'
            : deleteConfirm?.type === 'VERSION'
              ? 'Seluruh penyesuaian judul, deskripsi khusus, serta capaian tambahan lokal untuk materi ini akan dihapus secara permanen dan dikembalikan ke materi baku asli.'
              : 'Target capaian ini akan dihapus dari materi kurikulum.'
        }
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm(null)}
      />
    </div >
  );
}
