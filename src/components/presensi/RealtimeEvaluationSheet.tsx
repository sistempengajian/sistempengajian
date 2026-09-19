'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Award,
  Star,
  CheckCircle2,
  Send,
  UserCheck,
  Target,
  Lock,
  ChevronDown,
  BookOpen,
  Filter,
  Check,
  Clock,
  MessageSquare,
  AlertCircle,
  Search,
  X,
  UserX,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { saveComprehensiveEvaluation, TargetCapaianInput } from '@/app/(protected)/presensi/actions';
import CircularProgressBar from '@/components/kurikulum/CircularProgressBar';

export interface StudentItem {
  id: string;
  fullName: string;
  generationId?: string;
  generationName?: string;
  classId?: string;
  className?: string;
  checkInTime?: string | null;
  method?: string;
}

export interface ChecklistItemData {
  id: string;
  materialId: string;
  itemTitle: string;
  description: string | null;
  completionTierLevel: string; // 'ANY_TIER' | 'DAERAH_ONLY'
  pointsWeight: number;
  orderIndex: number;
  isOverridden?: boolean;
  overriddenBy?: 'DESA' | 'KELOMPOK';
  isNewLocal?: boolean;
  addedBy?: 'DESA' | 'KELOMPOK';
}

export interface MaterialWithChecklists {
  id: string;
  title: string;
  description: string | null;
  fileUrl?: string | null;
  targetGenerationId: string;
  targetGeneration?: {
    id: string;
    name: string;
    code: string;
  };
  isMandatoryForTarget: boolean;
  activeVersion?: 'ASLI' | 'DESA' | 'KELOMPOK';
  versionLabel?: string;
  isCustomized?: boolean;
  isScheduled?: boolean;
  slotIndex?: number;
  checklistItems: ChecklistItemData[];
}

export interface StudentProgressData {
  checklistItemId: string;
  studentId: string;
  score: number | null;
  isCompleted: boolean;
  teacherFeedback: string | null;
  evaluatedAt: string;
}

interface RealtimeEvaluationSheetProps {
  scheduleId: string;
  scheduleTierLevel?: 'KELOMPOK' | 'DESA' | 'DAERAH' | string;
  organizationName?: string;
  students: StudentItem[];
  classes?: Array<{ id: string; name: string }>;
  materials?: MaterialWithChecklists[];
  initialProgress?: StudentProgressData[];
  canCompleteDaerah?: boolean;
  canCompleteDesa?: boolean;
  totalStudentsCount?: number;
  initialTotalMaterials?: number;
  initialHasMore?: boolean;
  generations?: Array<{ id: string; name: string; code: string }>;
  onGoToAttendance?: () => void;
}

const QUICK_TAGS = [
  '✓ Makhraj Sempurna',
  '✓ Tajwid Fasih',
  '✓ Adab & Khidmat',
  '✓ Hafalan Lancar',
  'Tajwid Perlu Latihan',
  'Butuh Bimbingan Tambahan',
];

const SCORE_PILLS = [75, 80, 85, 90, 95, 100];

export type MaterialFilterMode = 'SCHEDULED' | 'GENERATION' | 'ALL';

interface PresensiMaterialsCacheEntry {
  items: MaterialWithChecklists[];
  progress: StudentProgressData[];
  total: number;
  hasMore: boolean;
  page: number;
  timestamp: number;
}

// In-memory cache antar render/sesi di sisi client (TTL 5 menit)
const globalPresensiMaterialsCache: Record<string, PresensiMaterialsCacheEntry> = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildCacheKey(
  scheduleId: string,
  mode: MaterialFilterMode,
  genId?: string | null,
  search?: string
): string {
  const cleanSearch = (search || '').trim().toLowerCase();
  if (cleanSearch) {
    return `${scheduleId}_SEARCH_${mode}_${genId || 'ALL'}_${cleanSearch}`;
  }
  return `${scheduleId}_${mode}_${genId || 'ALL'}`;
}

export default function RealtimeEvaluationSheet({
  scheduleId,
  scheduleTierLevel,
  organizationName,
  students,
  classes = [],
  materials = [],
  initialProgress = [],
  canCompleteDaerah = false,
  canCompleteDesa = false,
  totalStudentsCount,
  initialTotalMaterials,
  initialHasMore,
  generations = [],
  onGoToAttendance,
}: RealtimeEvaluationSheetProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [adabScore, setAdabScore] = useState<number>(85);
  const [keaktifanScore, setKeaktifanScore] = useState<number>(90);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasScheduledMaterials = useMemo(
    () => materials.some((m) => m.isScheduled),
    [materials]
  );

  const initialMode: MaterialFilterMode = hasScheduledMaterials ? 'SCHEDULED' : 'GENERATION';
  const [materialFilterMode, setMaterialFilterMode] = useState<MaterialFilterMode>(initialMode);

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  // Inisialisasi cache key awal
  const initialCacheKey = useMemo(() => {
    const targetGenId = !hasScheduledMaterials ? (students[0]?.generationId || null) : null;
    return buildCacheKey(scheduleId, initialMode, targetGenId);
  }, [scheduleId, initialMode, hasScheduledMaterials, students]);

  const cachedForInitial = globalPresensiMaterialsCache[initialCacheKey];
  const isInitialCachedValid = Boolean(
    cachedForInitial && Date.now() - cachedForInitial.timestamp < CACHE_TTL_MS
  );

  const [loadedMaterials, setLoadedMaterials] = useState<MaterialWithChecklists[]>(() => {
    if (isInitialCachedValid && cachedForInitial) return cachedForInitial.items;
    return materials;
  });

  const [totalCount, setTotalCount] = useState<number>(() => {
    if (isInitialCachedValid && cachedForInitial) return cachedForInitial.total;
    return initialTotalMaterials ?? materials.length;
  });

  const [hasMore, setHasMore] = useState<boolean>(() => {
    if (isInitialCachedValid && cachedForInitial) return cachedForInitial.hasMore;
    return initialHasMore ?? false;
  });

  const [page, setPage] = useState<number>(() => {
    if (isInitialCachedValid && cachedForInitial) return cachedForInitial.page;
    return 1;
  });

  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isLoadingMode, setIsLoadingMode] = useState<boolean>(false);
  const [allStudentProgress, setAllStudentProgress] = useState<StudentProgressData[]>(() => {
    if (isInitialCachedValid && cachedForInitial) return cachedForInitial.progress;
    return initialProgress;
  });

  // In-memory cache ref untuk persistensi instan dalam sesi aktif
  const cacheRef = useRef<Record<string, PresensiMaterialsCacheEntry>>({
    ...globalPresensiMaterialsCache,
    [initialCacheKey]:
      isInitialCachedValid && cachedForInitial
        ? cachedForInitial
        : {
          items: materials,
          progress: initialProgress,
          total: initialTotalMaterials ?? materials.length,
          hasMore: initialHasMore ?? false,
          page: 1,
          timestamp: Date.now(),
        },
  });

  // Buffer untuk data yang diambil secara diam-diam oleh background prefetcher
  const prefetchBufferRef = useRef<Record<string, PresensiMaterialsCacheEntry>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Simpan data awal ke global cache
  useEffect(() => {
    if (!globalPresensiMaterialsCache[initialCacheKey]) {
      const entry: PresensiMaterialsCacheEntry = {
        items: materials,
        progress: initialProgress,
        total: initialTotalMaterials ?? materials.length,
        hasMore: initialHasMore ?? false,
        page: 1,
        timestamp: Date.now(),
      };
      globalPresensiMaterialsCache[initialCacheKey] = entry;
      cacheRef.current[initialCacheKey] = entry;
    }
  }, [initialCacheKey, materials, initialProgress, initialTotalMaterials, initialHasMore]);

  const [expandedMaterialIds, setExpandedMaterialIds] = useState<string[]>([]);
  const [materialSearchQuery, setMaterialSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedGenerationFilter, setSelectedGenerationFilter] = useState<string>('ALL');
  const [isGenFilterDropdownOpen, setIsGenFilterDropdownOpen] = useState<boolean>(false);
  const genFilterDropdownRef = useRef<HTMLDivElement>(null);

  // Helper untuk menggabungkan progres capaian santri tanpa duplikasi
  const mergeProgress = useCallback((newProgress: StudentProgressData[]) => {
    if (!newProgress || newProgress.length === 0) return;
    setAllStudentProgress((prev) => {
      const map = new Map(prev.map((p) => [`${p.studentId}_${p.checklistItemId}`, p]));
      newProgress.forEach((p) => {
        map.set(`${p.studentId}_${p.checklistItemId}`, p);
      });
      return Array.from(map.values());
    });
  }, []);

  // Daftar seluruh generasi yang tersedia (diutamakan dari master generations prop)
  const availableGenerations = useMemo(() => {
    if (generations && generations.length > 0) {
      return generations.map((g) => ({ id: g.id, name: g.name }));
    }
    const map = new Map<string, { id: string; name: string }>();
    loadedMaterials.forEach((m) => {
      if (m.targetGenerationId && m.targetGeneration?.name) {
        map.set(m.targetGenerationId, {
          id: m.targetGenerationId,
          name: m.targetGeneration.name,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [generations, loadedMaterials]);

  // State Search & Debounce untuk Dropdown Santri Hadir
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState<string>('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState<boolean>(false);
  const [isSearchingStudent, setIsSearchingStudent] = useState<boolean>(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Teknik Debounce (250ms) untuk pencarian nama santri
  useEffect(() => {
    setIsSearchingStudent(true);
    const handler = setTimeout(() => {
      setDebouncedStudentSearch(studentSearch);
      setIsSearchingStudent(false);
    }, 250);

    return () => clearTimeout(handler);
  }, [studentSearch]);

  // Otomatis fokus ke input pencarian saat dropdown dibuka
  useEffect(() => {
    if (isStudentDropdownOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isStudentDropdownOpen]);

  // Event listener untuk menutup dropdown saat klik di luar area (click outside)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        studentDropdownRef.current &&
        !studentDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStudentDropdownOpen(false);
      }
    };

    if (isStudentDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStudentDropdownOpen]);

  // Event listener untuk menutup dropdown filter jenjang saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        genFilterDropdownRef.current &&
        !genFilterDropdownRef.current.contains(event.target as Node)
      ) {
        setIsGenFilterDropdownOpen(false);
      }
    };

    if (isGenFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isGenFilterDropdownOpen]);

  // Filter daftar santri berdasarkan hasil debounce pencarian
  const filteredStudents = useMemo(() => {
    const query = debouncedStudentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        (s.generationName && s.generationName.toLowerCase().includes(query))
    );
  }, [students, debouncedStudentSearch]);

  // State progres target capaian lokal per santri: { [checklistItemId]: { isCompleted, score, teacherFeedback, pointsWeight } }
  const [targetProgressMap, setTargetProgressMap] = useState<
    Record<
      string,
      {
        isCompleted: boolean;
        score: number;
        teacherFeedback: string;
        pointsWeight: number;
      }
    >
  >({});

  // Sinkronisasi santri terpilih
  useEffect(() => {
    if (students.length > 0) {
      const stillValid = students.some((s) => s.id === selectedStudentId);
      if (!stillValid) {
        setSelectedStudentId(students[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [students, selectedStudentId]);

  // Inisialisasi data progres target capaian saat santri terpilih berganti
  useEffect(() => {
    if (!selectedStudentId) {
      setTargetProgressMap({});
      return;
    }

    const studentProg = allStudentProgress.filter((p) => p.studentId === selectedStudentId);
    const newMap: Record<
      string,
      {
        isCompleted: boolean;
        score: number;
        teacherFeedback: string;
        pointsWeight: number;
      }
    > = {};

    loadedMaterials.forEach((mat) => {
      mat.checklistItems.forEach((item) => {
        const found = studentProg.find((p) => p.checklistItemId === item.id);
        newMap[item.id] = {
          isCompleted: found ? found.isCompleted : false,
          score: found && found.score ? found.score : 85,
          teacherFeedback: found?.teacherFeedback || '',
          pointsWeight: item.pointsWeight || 10,
        };
      });
    });

    setTargetProgressMap(newMap);
    setSuccessMessage(null);
  }, [selectedStudentId]);

  // Ketika loadedMaterials bertambah atau allStudentProgress bertambah, sinkronkan item baru tanpa menimpa yang sedang diedit
  useEffect(() => {
    if (!selectedStudentId || loadedMaterials.length === 0) return;

    const studentProg = allStudentProgress.filter((p) => p.studentId === selectedStudentId);

    setTargetProgressMap((prev) => {
      let changed = false;
      const updated = { ...prev };

      loadedMaterials.forEach((mat) => {
        mat.checklistItems.forEach((item) => {
          if (updated[item.id] === undefined) {
            const found = studentProg.find((p) => p.checklistItemId === item.id);
            updated[item.id] = {
              isCompleted: found ? found.isCompleted : false,
              score: found && found.score ? found.score : 85,
              teacherFeedback: found?.teacherFeedback || '',
              pointsWeight: item.pointsWeight || 10,
            };
            changed = true;
          }
        });
      });

      return changed ? updated : prev;
    });
  }, [loadedMaterials, allStudentProgress, selectedStudentId]);

  // Filter materi aktif (termasuk filter lokal saat jeda debounce)
  const filteredMaterials = useMemo(() => {
    let baseList = loadedMaterials;
    if (materialFilterMode === 'SCHEDULED') {
      const scheduled = loadedMaterials.filter((m) => m.isScheduled);
      baseList = scheduled.length > 0 ? scheduled : loadedMaterials;
    }

    const query = materialSearchQuery.trim().toLowerCase();
    if (materialFilterMode !== 'SCHEDULED' && query && !debouncedSearch) {
      const localFiltered = baseList.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query)) ||
          (m.targetGeneration?.name && m.targetGeneration.name.toLowerCase().includes(query)) ||
          m.checklistItems.some((item) => item.itemTitle.toLowerCase().includes(query))
      );
      if (localFiltered.length > 0) return localFiltered;
    }

    return baseList;
  }, [loadedMaterials, materialFilterMode, materialSearchQuery, debouncedSearch]);

  // Rotasi 3 mode materi: Sesuai Jadwal -> Sesuai Jenjang -> Semua Materi
  const cycleFilterMode = async () => {
    let nextMode: MaterialFilterMode;
    if (materialFilterMode === 'SCHEDULED') {
      nextMode = 'GENERATION';
    } else if (materialFilterMode === 'GENERATION') {
      nextMode = 'ALL';
    } else {
      nextMode = hasScheduledMaterials ? 'SCHEDULED' : 'GENERATION';
    }

    setMaterialFilterMode(nextMode);
    setMaterialSearchQuery('');
    setDebouncedSearch('');
    setSelectedGenerationFilter('ALL');
    setIsGenFilterDropdownOpen(false);

    const targetGenId =
      nextMode === 'GENERATION' ? currentStudent?.generationId : undefined;
    const cacheKey = buildCacheKey(scheduleId, nextMode, targetGenId);
    const cached = cacheRef.current[cacheKey] || globalPresensiMaterialsCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setLoadedMaterials(cached.items);
      setTotalCount(cached.total);
      setHasMore(cached.hasMore);
      setPage(cached.page);
      mergeProgress(cached.progress);
      return;
    }

    setIsLoadingMode(true);
    try {
      const params = new URLSearchParams({
        scheduleId,
        mode: nextMode,
        page: '1',
        limit: '5',
      });
      if (targetGenId) params.set('generationId', targetGenId);
      if (selectedStudentId) params.set('studentId', selectedStudentId);

      const res = await fetch(`/api/presensi/materials?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const entry: PresensiMaterialsCacheEntry = {
          items: data.items,
          progress: data.progress,
          total: data.total,
          hasMore: data.hasMore,
          page: 1,
          timestamp: Date.now(),
        };
        cacheRef.current[cacheKey] = entry;
        globalPresensiMaterialsCache[cacheKey] = entry;

        setLoadedMaterials(data.items);
        setTotalCount(data.total);
        setHasMore(data.hasMore);
        setPage(1);
        mergeProgress(data.progress);
      }
    } catch (err) {
      console.error('Gagal mengganti mode filter:', err);
    } finally {
      setIsLoadingMode(false);
    }
  };

  // Filter jenjang khusus mode ALL
  const handleSelectGenerationFilter = async (genId: string) => {
    setSelectedGenerationFilter(genId);
    setIsGenFilterDropdownOpen(false);
    setMaterialSearchQuery('');
    setDebouncedSearch('');

    const targetGenId = genId !== 'ALL' ? genId : undefined;
    const cacheKey = buildCacheKey(scheduleId, 'ALL', targetGenId);
    const cached = cacheRef.current[cacheKey] || globalPresensiMaterialsCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setLoadedMaterials(cached.items);
      setTotalCount(cached.total);
      setHasMore(cached.hasMore);
      setPage(cached.page);
      mergeProgress(cached.progress);
      return;
    }

    setIsLoadingMode(true);
    try {
      const params = new URLSearchParams({
        scheduleId,
        mode: 'ALL',
        page: '1',
        limit: '5',
      });
      if (targetGenId) params.set('generationId', targetGenId);
      if (selectedStudentId) params.set('studentId', selectedStudentId);

      const res = await fetch(`/api/presensi/materials?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const entry: PresensiMaterialsCacheEntry = {
          items: data.items,
          progress: data.progress,
          total: data.total,
          hasMore: data.hasMore,
          page: 1,
          timestamp: Date.now(),
        };
        cacheRef.current[cacheKey] = entry;
        globalPresensiMaterialsCache[cacheKey] = entry;

        setLoadedMaterials(data.items);
        setTotalCount(data.total);
        setHasMore(data.hasMore);
        setPage(1);
        mergeProgress(data.progress);
      }
    } catch (err) {
      console.error('Gagal memfilter jenjang:', err);
    } finally {
      setIsLoadingMode(false);
    }
  };

  // Memuat 5 materi berikutnya (Infinite Scroll / Tombol Tampilkan Lebih Banyak Lagi)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoadingMode || materialFilterMode === 'SCHEDULED') return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    const targetGenId =
      materialFilterMode === 'GENERATION'
        ? currentStudent?.generationId
        : selectedGenerationFilter !== 'ALL'
          ? selectedGenerationFilter
          : undefined;

    // Cek apakah batch selanjutnya sudah pernah diambil secara diam-diam oleh background prefetcher
    const prefetchKey = `${buildCacheKey(scheduleId, materialFilterMode, targetGenId, debouncedSearch)}_P${nextPage}`;
    const prefetched = prefetchBufferRef.current[prefetchKey];

    if (prefetched && Date.now() - prefetched.timestamp < CACHE_TTL_MS) {
      setLoadedMaterials((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = prefetched.items.filter((m) => !existingIds.has(m.id));
        const updated = [...prev, ...newItems];

        const baseKey = buildCacheKey(scheduleId, materialFilterMode, targetGenId, debouncedSearch);
        const entry: PresensiMaterialsCacheEntry = {
          items: updated,
          progress: [...allStudentProgress, ...prefetched.progress],
          total: prefetched.total,
          hasMore: prefetched.hasMore,
          page: nextPage,
          timestamp: Date.now(),
        };
        cacheRef.current[baseKey] = entry;
        globalPresensiMaterialsCache[baseKey] = entry;

        return updated;
      });

      setHasMore(prefetched.hasMore);
      setPage(nextPage);
      setTotalCount(prefetched.total);
      mergeProgress(prefetched.progress);
      delete prefetchBufferRef.current[prefetchKey];
      setIsLoadingMore(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        scheduleId,
        mode: materialFilterMode,
        page: String(nextPage),
        limit: '5',
      });
      if (targetGenId) params.set('generationId', targetGenId);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedStudentId) params.set('studentId', selectedStudentId);

      const res = await fetch(`/api/presensi/materials?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLoadedMaterials((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = (data.items as MaterialWithChecklists[]).filter((m) => !existingIds.has(m.id));
          const updated = [...prev, ...newItems];

          const baseKey = buildCacheKey(scheduleId, materialFilterMode, targetGenId, debouncedSearch);
          const entry: PresensiMaterialsCacheEntry = {
            items: updated,
            progress: [...allStudentProgress, ...data.progress],
            total: data.total,
            hasMore: data.hasMore,
            page: nextPage,
            timestamp: Date.now(),
          };
          cacheRef.current[baseKey] = entry;
          globalPresensiMaterialsCache[baseKey] = entry;

          return updated;
        });

        setHasMore(data.hasMore);
        setPage(nextPage);
        setTotalCount(data.total);
        mergeProgress(data.progress);
      }
    } catch (err) {
      console.error('Failed to load more materials:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    isLoadingMore,
    hasMore,
    isLoadingMode,
    materialFilterMode,
    page,
    scheduleId,
    currentStudent?.generationId,
    selectedGenerationFilter,
    debouncedSearch,
    selectedStudentId,
    allStudentProgress,
    mergeProgress,
  ]);

  // Prefetch diam-diam 5 materi berikutnya saat user scroll mendekati akhir list materi
  // Data disimpan di background buffer (prefetchBufferRef) sehingga saat user menekan 'Lihat Lebih Banyak',
  // materi baru langsung tampil seketika (0ms delay) tanpa mengganggu layout bagi yang ingin langsung simpan penilaian.
  const prefetchNextBatch = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoadingMode || materialFilterMode === 'SCHEDULED' || isSearching) return;

    const nextPage = page + 1;
    const targetGenId =
      materialFilterMode === 'GENERATION'
        ? currentStudent?.generationId
        : selectedGenerationFilter !== 'ALL'
          ? selectedGenerationFilter
          : undefined;

    const prefetchKey = `${buildCacheKey(scheduleId, materialFilterMode, targetGenId, debouncedSearch)}_P${nextPage}`;
    if (prefetchBufferRef.current[prefetchKey]) return;

    try {
      const params = new URLSearchParams({
        scheduleId,
        mode: materialFilterMode,
        page: String(nextPage),
        limit: '5',
      });
      if (targetGenId) params.set('generationId', targetGenId);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedStudentId) params.set('studentId', selectedStudentId);

      const res = await fetch(`/api/presensi/materials?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        prefetchBufferRef.current[prefetchKey] = {
          items: data.items,
          progress: data.progress,
          total: data.total,
          hasMore: data.hasMore,
          page: nextPage,
          timestamp: Date.now(),
        };
        mergeProgress(data.progress);
      }
    } catch (e) {
      // Diam abaikan error di background prefetch
    }
  }, [
    isLoadingMore,
    hasMore,
    isLoadingMode,
    materialFilterMode,
    isSearching,
    page,
    scheduleId,
    currentStudent?.generationId,
    selectedGenerationFilter,
    debouncedSearch,
    selectedStudentId,
    mergeProgress,
  ]);

  // IntersectionObserver untuk memicu prefetch otomatis di latar belakang saat user scroll mendekati akhir list materi.
  // PENTING: Observer ini TIDAK langsung menambah item ke tampilan agar user yang berencana untuk langsung
  // simpan penilaian tidak terganggu oleh layout yang terus bertambah ke bawah.
  useEffect(() => {
    if (!hasMore || isLoadingMore || isLoadingMode || materialFilterMode === 'SCHEDULED') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          prefetchNextBatch();
        }
      },
      {
        root: null,
        rootMargin: '150px',
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
  }, [hasMore, isLoadingMore, isLoadingMode, materialFilterMode, prefetchNextBatch]);

  // Debounce (300ms) untuk pencarian materi ke server
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      setDebouncedSearch(materialSearchQuery);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [materialSearchQuery]);

  // Request pencarian langsung ke server dengan teknik debounce
  useEffect(() => {
    let isCancelled = false;

    const performSearch = async () => {
      if (materialFilterMode === 'SCHEDULED') return;

      const targetGenId =
        materialFilterMode === 'GENERATION'
          ? currentStudent?.generationId
          : selectedGenerationFilter !== 'ALL'
            ? selectedGenerationFilter
            : undefined;

      const baseCacheKey = buildCacheKey(scheduleId, materialFilterMode, targetGenId);

      // Jika pencarian dibersihkan, pulihkan daftar materi default dari cache
      if (!debouncedSearch) {
        const cached = cacheRef.current[baseCacheKey] || globalPresensiMaterialsCache[baseCacheKey];
        if (cached) {
          setLoadedMaterials(cached.items);
          setTotalCount(cached.total);
          setHasMore(cached.hasMore);
          setPage(cached.page);
          mergeProgress(cached.progress);
        }
        return;
      }

      // Cek apakah hasil pencarian ini sudah ada di cache
      const searchCacheKey = buildCacheKey(scheduleId, materialFilterMode, targetGenId, debouncedSearch);
      const cachedSearch = cacheRef.current[searchCacheKey] || globalPresensiMaterialsCache[searchCacheKey];
      if (cachedSearch && Date.now() - cachedSearch.timestamp < CACHE_TTL_MS) {
        setLoadedMaterials(cachedSearch.items);
        setTotalCount(cachedSearch.total);
        setHasMore(cachedSearch.hasMore);
        setPage(cachedSearch.page);
        mergeProgress(cachedSearch.progress);
        return;
      }

      setIsLoadingMore(true);
      try {
        const params = new URLSearchParams({
          scheduleId,
          mode: materialFilterMode,
          page: '1',
          limit: '5',
          search: debouncedSearch,
        });
        if (targetGenId) params.set('generationId', targetGenId);
        if (selectedStudentId) params.set('studentId', selectedStudentId);

        const res = await fetch(`/api/presensi/materials?${params.toString()}`);
        const data = await res.json();

        if (!isCancelled && data.success) {
          const entry: PresensiMaterialsCacheEntry = {
            items: data.items,
            progress: data.progress,
            total: data.total,
            hasMore: data.hasMore,
            page: 1,
            timestamp: Date.now(),
          };
          cacheRef.current[searchCacheKey] = entry;
          globalPresensiMaterialsCache[searchCacheKey] = entry;

          setLoadedMaterials(data.items);
          setTotalCount(data.total);
          setHasMore(data.hasMore);
          setPage(1);
          mergeProgress(data.progress);
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
  }, [
    debouncedSearch,
    materialFilterMode,
    currentStudent?.generationId,
    selectedGenerationFilter,
    scheduleId,
    selectedStudentId,
    mergeProgress,
  ]);

  // Silent Background Prefetching: Diam-diam mengambil materi yang belum dimuat saat idle
  useEffect(() => {
    const idleTimer = setTimeout(async () => {
      // 1. Jika di mode SCHEDULED, diam-diam ambil mode GENERATION (5 materi pertama) ke cache
      if (materialFilterMode === 'SCHEDULED' && currentStudent?.generationId) {
        const genKey = buildCacheKey(scheduleId, 'GENERATION', currentStudent.generationId);
        if (!cacheRef.current[genKey] && !globalPresensiMaterialsCache[genKey]) {
          try {
            const params = new URLSearchParams({
              scheduleId,
              mode: 'GENERATION',
              generationId: currentStudent.generationId,
              page: '1',
              limit: '5',
            });
            if (selectedStudentId) params.set('studentId', selectedStudentId);
            const res = await fetch(`/api/presensi/materials?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
              const entry: PresensiMaterialsCacheEntry = {
                items: data.items,
                progress: data.progress,
                total: data.total,
                hasMore: data.hasMore,
                page: 1,
                timestamp: Date.now(),
              };
              cacheRef.current[genKey] = entry;
              globalPresensiMaterialsCache[genKey] = entry;
              mergeProgress(data.progress);
            }
          } catch (e) {
            // diam abaikan error di background
          }
        }
        return;
      }

      // 2. Jika di mode GENERATION atau ALL dan hasMore === true, prefetch batch halaman berikutnya
      if (hasMore && !isLoadingMore && !isLoadingMode && !materialSearchQuery) {
        const nextPage = page + 1;
        const targetGenId =
          materialFilterMode === 'GENERATION'
            ? currentStudent?.generationId
            : selectedGenerationFilter !== 'ALL'
              ? selectedGenerationFilter
              : undefined;

        const prefetchKey = `${buildCacheKey(scheduleId, materialFilterMode, targetGenId)}_P${nextPage}`;
        if (!prefetchBufferRef.current[prefetchKey]) {
          try {
            const params = new URLSearchParams({
              scheduleId,
              mode: materialFilterMode,
              page: String(nextPage),
              limit: '5',
            });
            if (targetGenId) params.set('generationId', targetGenId);
            if (selectedStudentId) params.set('studentId', selectedStudentId);

            const res = await fetch(`/api/presensi/materials?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
              prefetchBufferRef.current[prefetchKey] = {
                items: data.items,
                progress: data.progress,
                total: data.total,
                hasMore: data.hasMore,
                page: nextPage,
                timestamp: Date.now(),
              };
              mergeProgress(data.progress);
            }
          } catch (e) {
            // diam abaikan error di background
          }
        }
      }
    }, 1800);

    return () => clearTimeout(idleTimer);
  }, [
    materialFilterMode,
    hasMore,
    isLoadingMore,
    isLoadingMode,
    materialSearchQuery,
    page,
    scheduleId,
    currentStudent?.generationId,
    selectedGenerationFilter,
    selectedStudentId,
    mergeProgress,
  ]);

  // Otomatis buka materi saat hasil pencarian berubah
  useEffect(() => {
    if (materialSearchQuery.trim() && filteredMaterials.length > 0) {
      setExpandedMaterialIds(filteredMaterials.map((m) => m.id));
    }
  }, [materialSearchQuery, filteredMaterials]);

  // Otomatis buka materi pertama saat daftar materi dimuat
  useEffect(() => {
    if (filteredMaterials.length > 0) {
      setExpandedMaterialIds((prev) => {
        if (prev.length === 0) {
          return [filteredMaterials[0].id];
        }
        return prev;
      });
    }
  }, [filteredMaterials]);

  const toggleMaterialAccordion = (materialId: string) => {
    setExpandedMaterialIds((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  };

  // Hitung metrik capaian santri terpilih
  const progressStats = useMemo(() => {
    let totalItems = 0;
    let completedItems = 0;

    filteredMaterials.forEach((m) => {
      m.checklistItems.forEach((item) => {
        totalItems++;
        if (targetProgressMap[item.id]?.isCompleted) {
          completedItems++;
        }
      });
    });

    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    return { totalItems, completedItems, percentage };
  }, [filteredMaterials, targetProgressMap]);

  // Handler toggle tuntas/belum tuntas item checklist
  const handleToggleItemComplete = (itemId: string, completionTierLevel: string) => {
    if (completionTierLevel === 'DAERAH_ONLY' && !canCompleteDaerah) {
      alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Daerah.');
      return;
    }
    if (completionTierLevel === 'DESA_AND_ABOVE' && !canCompleteDesa && !canCompleteDaerah) {
      alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Desa atau Daerah.');
      return;
    }

    setTargetProgressMap((prev) => {
      const current = prev[itemId] || { isCompleted: false, score: 85, teacherFeedback: '', pointsWeight: 10 };
      return {
        ...prev,
        [itemId]: {
          ...current,
          isCompleted: !current.isCompleted,
        },
      };
    });
  };

  // Handler ubah skor capaian item checklist
  const handleScoreChange = (itemId: string, newScore: number) => {
    setTargetProgressMap((prev) => {
      const current = prev[itemId] || { isCompleted: false, score: 85, teacherFeedback: '', pointsWeight: 10 };
      return {
        ...prev,
        [itemId]: {
          ...current,
          score: newScore,
        },
      };
    });
  };

  // Handler ubah catatan umpan balik khusus item
  const handleItemFeedbackChange = (itemId: string, text: string) => {
    setTargetProgressMap((prev) => {
      const current = prev[itemId] || { isCompleted: false, score: 85, teacherFeedback: '', pointsWeight: 10 };
      return {
        ...prev,
        [itemId]: {
          ...current,
          teacherFeedback: text,
        },
      };
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    try {
      setIsSubmitting(true);
      const fullNote = selectedTags.length > 0
        ? `[Tags: ${selectedTags.join(', ')}] ${teacherNote}`
        : teacherNote;

      // Siapkan payload target capaian updates (hanya kirim yang tuntas, memiliki catatan, atau sudah tersimpan di DB)
      const existingProg = allStudentProgress.filter((p) => p.studentId === selectedStudentId);
      const targetCapaianUpdates: TargetCapaianInput[] = Object.entries(targetProgressMap)
        .filter(([checklistItemId, data]) => {
          const existedInDb = existingProg.some((p) => p.checklistItemId === checklistItemId);
          return data.isCompleted || (data.teacherFeedback && data.teacherFeedback.trim() !== '') || existedInDb;
        })
        .map(([checklistItemId, data]) => ({
          checklistItemId,
          score: data.isCompleted ? data.score : null,
          isCompleted: data.isCompleted,
          teacherFeedback: data.teacherFeedback || undefined,
          pointsWeight: data.pointsWeight,
        }));

      const res = await saveComprehensiveEvaluation({
        scheduleId,
        studentId: selectedStudentId,
        adabScore,
        keaktifanScore,
        teacherPrivateNote: fullNote || undefined,
        targetCapaianUpdates,
      });

      const pointsText = res.pointsGained > 0 ? ` (+${res.pointsGained} Poin Reward)` : '';
      setSuccessMessage(
        `Jurnal & Penilaian Target Capaian untuk ${currentStudent?.fullName || 'Santri'} berhasil disimpan!${pointsText}`
      );
      setTeacherNote('');
      setSelectedTags([]);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      alert('Gagal menyimpan evaluasi santri.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xs p-4 sm:p-6 space-y-5">
      {/* 1. Header Info Jurnal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs">
              <Award className="w-4 h-4" />
            </div>
            <span>Jurnal &amp; Penilaian Target Capaian</span>
          </h3>

        </div>


      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">Belum Ada Santri yang Hadir</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Jurnal penilaian hanya dapat diisi untuk santri yang sudah tercatat <strong>Hadir</strong> (melalui Scan QR Sesi, Absensi Manual, atau Scan Kartu).
            </p>
          </div>
          {onGoToAttendance && (
            <button
              type="button"
              onClick={onGoToAttendance}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer mt-1"
            >
              <UserCheck className="w-4 h-4" />
              <span>Buka Tab Absensi Manual</span>
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveEvaluation} className="space-y-5">
          {/* 2. Pilih Santri Hadir + Ringkasan Capaian */}
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
            <div className="space-y-1.5 pt-1">

              <div className="flex justify-between items-center ">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Santri Hadir
                </label>
                {students.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                      {students.length} Santri Hadir
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Searchable Combobox Santri dengan Debounce */}
            <div className="relative" ref={studentDropdownRef}>
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsStudentDropdownOpen((prev) => !prev)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-white border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${isStudentDropdownOpen
                  ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-teal-500/60 shadow-2xs'
                  }`}
                aria-expanded={isStudentDropdownOpen}
                aria-haspopup="listbox"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 border border-teal-200/60">
                    {currentStudent?.fullName
                      ? currentStudent.fullName.charAt(0).toUpperCase()
                      : <UserCheck className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentStudent ? currentStudent.fullName : 'Pilih Santri Hadir'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
                      <span>{currentStudent?.generationName || 'Santri'}</span>
                      <span>•</span>
                      <span className="text-teal-700 font-medium">Masuk {currentStudent?.checkInTime || 'Hadir'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${isStudentDropdownOpen ? 'rotate-180 text-teal-600' : ''
                      }`}
                  />
                </div>
              </button>

              {/* Floating Dropdown Menu dengan Search & Debounce */}
              {isStudentDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden animate-fade-in divide-y divide-slate-100">
                  {/* Search Input Bar */}
                  <div className="p-2 bg-slate-50/70">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Ketik nama santri atau generasi..."
                        className="w-full pl-8 pr-8 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                      />
                      {studentSearch && (
                        <button
                          type="button"
                          onClick={() => setStudentSearch('')}
                          className="absolute right-2.5 p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Meta Bar Info Debounce */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1.5">
                      <span>
                        {isSearchingStudent ? (
                          <span className="text-teal-600 font-medium">Menyaring nama santri...</span>
                        ) : debouncedStudentSearch.trim() ? (
                          <span>Hasil pencarian &quot;{debouncedStudentSearch}&quot;:</span>
                        ) : (
                          <span>Daftar seluruh santri hadir:</span>
                        )}
                      </span>
                      <span className="font-semibold text-slate-500">
                        {filteredStudents.length} Santri
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Suggestions List */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 py-1" role="listbox">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                        <UserX className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="font-semibold text-slate-700">Santri tidak ditemukan</p>
                        <p className="text-[11px] text-slate-400">
                          Tidak ada santri yang cocok dengan &quot;{debouncedStudentSearch}&quot;
                        </p>
                      </div>
                    ) : (
                      filteredStudents.map((s) => {
                        const isSelected = s.id === selectedStudentId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(s.id);
                              setIsStudentDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${isSelected
                              ? 'bg-teal-50/80 text-teal-900 border-l-4 border-teal-600'
                              : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div
                                className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${isSelected
                                  ? 'bg-teal-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600'
                                  }`}
                              >
                                {s.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs truncate ${isSelected ? 'font-bold text-teal-900' : 'font-semibold text-slate-800'}`}>
                                  {s.fullName}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
                                  <span>{s.generationName || 'Santri'}</span>
                                  {s.className && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold text-[9px] border border-slate-200/80">
                                      {s.className}
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span>Masuk {s.checkInTime || 'Hadir'}</span>
                                </p>
                              </div>
                            </div>

                            {isSelected && (
                              <Check className="w-4 h-4 text-teal-600 shrink-0 stroke-[2.5]" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Progress Bar Capaian Santri */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-slate-600 flex items-center gap-1.5">
                  <span> Progres Target Kurikulum:</span>
                </span>
                <span className="font-bold text-teal-800">
                  {progressStats.completedItems} / {progressStats.totalItems} Tuntas ({progressStats.percentage}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progressStats.percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. Penilaian Target Capaian Materi (Kurikulum Sesi - Accordion) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Target Capaian Pembelajaran Santri
                </h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Toggle Filter 3 Mode: Sesuai Jadwal -> Sesuai Generasi -> Semua Materi */}
                <button
                  type="button"
                  onClick={cycleFilterMode}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer bg-white hover:bg-slate-50 border-slate-200"
                  title="Klik untuk mengganti filter materi"
                >
                  <Filter className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  {materialFilterMode === 'SCHEDULED' && (
                    <span className="text-teal-800">
                      Jadwal({totalCount})
                    </span>
                  )}
                  {materialFilterMode === 'GENERATION' && (
                    <span className="text-emerald-800">
                      {currentStudent?.generationName || 'Santri'} ({totalCount})
                    </span>
                  )}
                  {materialFilterMode === 'ALL' && (
                    <span className="text-slate-700">
                      Semua({totalCount})
                    </span>
                  )}
                </button>

                {/* Buka / Tutup Semua Accordion */}
                {filteredMaterials.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedMaterialIds.length === filteredMaterials.length) {
                        setExpandedMaterialIds([]);
                      } else {
                        setExpandedMaterialIds(filteredMaterials.map((m) => m.id));
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50/70 hover:bg-teal-50 px-2 py-1 rounded-lg border border-teal-200/60 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>
                      {expandedMaterialIds.length === filteredMaterials.length
                        ? 'Tutup Semua'
                        : 'Buka Semua'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Input Pencarian Materi & Tombol Quick Filter Jenjang */}
            {(materialFilterMode === 'GENERATION' || materialFilterMode === 'ALL') && (
              <div className="flex items-center gap-2">
                {/* Kolom Pencarian */}
                <div className="relative flex-1">
                  {/* Kontainer untuk mengatur posisi absolut di tengah vertikal */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    {isLoadingMore || isSearching ? (
                      // Ikon di dalam hanya fokus berputar
                      <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={materialSearchQuery}
                    onChange={(e) => setMaterialSearchQuery(e.target.value)}
                    placeholder={
                      materialFilterMode === 'GENERATION'
                        ? `Cari materi ${currentStudent?.generationName || 'jenjang'}...`
                        : selectedGenerationFilter !== 'ALL'
                          ? `Cari materi ${availableGenerations.find((g) => g.id === selectedGenerationFilter)?.name || ''}...`
                          : 'Cari dari semua materi kurikulum...'
                    }
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-800 placeholder:text-slate-400 shadow-2xs"
                  />
                  {materialSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMaterialSearchQuery('');
                        setDebouncedSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                      title="Hapus pencarian materi"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Tombol Quick Filter Jenjang (Khusus Mode 'ALL' / Semua Jenjang) di Sebelah Kanan Search Bar */}
                {materialFilterMode === 'ALL' && (
                  <div className="relative shrink-0" ref={genFilterDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsGenFilterDropdownOpen(!isGenFilterDropdownOpen)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all cursor-pointer ${selectedGenerationFilter !== 'ALL'
                        ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold'
                        : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                        }`}
                      title="Filter jenjang materi"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="hidden sm:inline truncate max-w-[110px]">
                        {selectedGenerationFilter === 'ALL'
                          ? 'Semua Jenjang'
                          : availableGenerations.find((g) => g.id === selectedGenerationFilter)?.name || 'Jenjang'}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isGenFilterDropdownOpen ? 'rotate-180 text-teal-600' : ''
                          }`}
                      />
                    </button>

                    {/* Menu Absolute Kecil untuk Memilih Jenjang */}
                    {isGenFilterDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-0.5 flex items-center justify-between">
                          <span>Pilih Jenjang</span>
                          {selectedGenerationFilter !== 'ALL' && (
                            <button
                              type="button"
                              onClick={() => handleSelectGenerationFilter('ALL')}
                              className="text-teal-600 hover:text-teal-800 normal-case font-semibold text-[10px]"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectGenerationFilter('ALL')}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${selectedGenerationFilter === 'ALL'
                            ? 'font-bold text-teal-800 bg-teal-50/70'
                            : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span>Semua Jenjang</span>
                          {selectedGenerationFilter === 'ALL' && (
                            <Check className="w-3.5 h-3.5 text-teal-600" />
                          )}
                        </button>

                        {availableGenerations.map((gen) => {
                          const isSelected = selectedGenerationFilter === gen.id;
                          return (
                            <button
                              key={gen.id}
                              type="button"
                              onClick={() => handleSelectGenerationFilter(gen.id)}
                              className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${isSelected
                                ? 'font-bold text-teal-800 bg-teal-50/70'
                                : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                              <span className="truncate">{gen.name}</span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {filteredMaterials.length === 0 ? (
              isLoadingMode ? (
                <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">Memuat materi kurikulum...</p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-1.5">
                  <p className="text-xs font-bold text-slate-700">
                    {debouncedSearch
                      ? `Tidak ada materi yang cocok dengan "${debouncedSearch}"`
                      : selectedGenerationFilter !== 'ALL'
                        ? `Belum ada materi untuk jenjang ${availableGenerations.find((g) => g.id === selectedGenerationFilter)?.name || ''}.`
                        : 'Belum ada materi kurikulum aktif yang terdaftar.'}
                  </p>
                  {debouncedSearch || selectedGenerationFilter !== 'ALL' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMaterialSearchQuery('');
                        setDebouncedSearch('');
                        handleSelectGenerationFilter('ALL');
                      }}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                    >
                      Reset Filter & Pencarian
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Coba ganti filter materi ke "Semua" untuk melihat materi jenjang lainnya.
                    </p>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {filteredMaterials.map((mat) => {
                  const items = mat.checklistItems;
                  if (items.length === 0) return null;

                  let matCompletedCount = 0;
                  let totalScoreSum = 0;

                  items.forEach((item) => {
                    const p = targetProgressMap[item.id];
                    if (p?.isCompleted) {
                      matCompletedCount++;
                      if (typeof p.score === 'number') {
                        totalScoreSum += p.score;
                      }
                    }
                  });

                  // Rumus sama persis dengan halaman kurikulum: Rata-rata nilai setiap capaian dibagi jumlah total capaian
                  const averageScore = items.length > 0 ? Math.round(totalScoreSum / items.length) : 0;
                  const isExpanded = expandedMaterialIds.includes(mat.id);

                  return (
                    <div
                      key={mat.id}
                      className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden transition-all duration-200"
                    >
                      {/* Material Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleMaterialAccordion(mat.id)}
                        className={`w-full text-left p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 to-teal-50/30 hover:from-slate-100/80 hover:to-teal-50/60 transition-colors flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none ${isExpanded ? 'border-b border-slate-100' : ''
                          }`}
                        aria-expanded={isExpanded}
                      >
                        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-2.5 sm:gap-3">


                          <div className="min-w-0 flex-1 space-y-1">
                            {/* Judul Materi: Utuh tanpa terpotong truncate */}
                            <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                              {mat.title}
                            </h5>

                            {/* Deskripsi Materi */}
                            {
                              mat.description && (
                                <p className={`text-[11px] text-slate-500 leading-relaxed ${isExpanded ? 'line-clamp-none' : 'line-clamp-2'}`}>
                                  {mat.description}
                                </p>
                              )
                            }
                            {/* Meta Badges di bawah judul: Lega di layar HP */}
                            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                              {mat.isMandatoryForTarget && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
                                  Wajib
                                </span>
                              )}
                              {mat.targetGeneration?.name && (
                                <span className="text-[10px] sm:text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded-md shrink-0">
                                  {mat.targetGeneration.name}
                                </span>
                              )}
                              <span
                                className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border shadow-2xs transition-colors ${matCompletedCount === items.length
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-white text-slate-600 border-slate-200'
                                  }`}
                              >
                                {matCompletedCount}/{items.length} Tuntas
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sisi Kanan: Circular Progress Bar + Ikon Chevron */}
                        <div className="flex-col items-center">

                          <div className="">
                            <CircularProgressBar
                              value={averageScore}
                              size={44}
                              strokeWidth={3.5}
                            />
                          </div>
                          <div className='flex justify-end pr-1.5 pt-3'>
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-teal-600 bg-teal-50' : 'bg-slate-100/80 hover:bg-slate-200/60'
                                }`}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>

                        </div>
                      </button>

                      {/* Checklist Sub-Capaian Items (Accordion Content) */}
                      {isExpanded && (
                        <div className="p-3 sm:p-4 divide-y divide-slate-100 space-y-3 bg-white animate-fade-in">
                          {items.map((item) => {
                            const state = targetProgressMap[item.id] || {
                              isCompleted: false,
                              score: 85,
                              teacherFeedback: '',
                              pointsWeight: item.pointsWeight || 10,
                            };

                            const isLockedDaerah = item.completionTierLevel === 'DAERAH_ONLY' && !canCompleteDaerah;
                            const isLockedDesa =
                              item.completionTierLevel === 'DESA_AND_ABOVE' &&
                              !canCompleteDesa &&
                              !canCompleteDaerah;
                            const isLocked = isLockedDaerah || isLockedDesa;

                            return (
                              <div key={item.id} className="pt-3 first:pt-0 space-y-2.5">
                                {/* Item Header & Toggle */}
                                <div className="flex flex-col">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                                          {item.itemTitle}
                                        </span>
                                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/60">
                                          +{item.pointsWeight} Poin
                                        </span>
                                      </div>
                                    </div>

                                    {/* Status Switcher Button */}
                                    <div className="shrink-0">
                                      {isLocked ? (
                                        <div
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold cursor-not-allowed select-none"
                                          title={
                                            isLockedDaerah
                                              ? 'Hanya dapat disahkan oleh Tim Penguji Tingkat Daerah'
                                              : 'Hanya dapat disahkan oleh Tim Penguji Tingkat Desa atau Daerah'
                                          }
                                        >
                                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span>
                                            {isLockedDaerah ? 'Terkunci Daerah' : 'Terkunci Desa'}
                                          </span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleItemComplete(item.id, item.completionTierLevel)}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${state.isCompleted
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}
                                        >
                                          {state.isCompleted ? (
                                            <>
                                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                              <span>Tuntas</span>
                                            </>
                                          ) : (
                                            <>
                                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              <span>Belum Tuntas</span>
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    {item.description && (
                                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Penilaian Capaian & Catatan Khusus: Baru muncul saat tombol status Tuntas */}
                                {state.isCompleted && (
                                  <div className="p-3 rounded-xl bg-slate-50/90 border border-teal-200/60 space-y-2.5 animate-fade-in">
                                    {/* Baris 1: Penilaian Capaian (Skor Nilai) */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-700">
                                          Penilaian Capaian:
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {SCORE_PILLS.map((s) => (
                                          <button
                                            key={s}
                                            type="button"
                                            onClick={() => handleScoreChange(item.id, s)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${state.score === s
                                              ? 'bg-teal-600 text-white shadow-2xs font-bold ring-2 ring-teal-600/20'
                                              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                              }`}
                                          >
                                            {s}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Baris 2: Catatan Khusus Guru untuk Sub-Capaian ini */}
                                    <div className="space-y-1 pt-1.5 border-t border-slate-200/60">
                                      <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                                        <span>Catatan Khusus (Opsional):</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={state.teacherFeedback}
                                        onChange={(e) => handleItemFeedbackChange(item.id, e.target.value)}
                                        placeholder="Contoh: Makhraj sudah bersih, tinggal hukum mad thabi'i..."
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Tombol Lihat Lebih Banyak */}
                {hasMore && materialFilterMode !== 'SCHEDULED' && (
                  <div className="pt-3 pb-1 flex flex-col items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 hover:from-teal-100/80 hover:to-emerald-100/80 text-teal-800 border border-teal-200/80 shadow-2xs hover:shadow-xs text-xs font-bold transition-all cursor-pointer disabled:opacity-60 active:scale-98"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                          <span>Memuat materi...</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 text-teal-600" />
                          <span>Lihat Lebih Banyak</span>
                          <span className="text-[10px] font-semibold text-teal-700/90 bg-teal-100/80 px-2 py-0.5 rounded-full border border-teal-300/60">
                            +{Math.min(5, Math.max(0, totalCount - loadedMaterials.length))} materi
                          </span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Menampilkan {loadedMaterials.length} dari {totalCount} materi kurikulum
                    </span>
                  </div>
                )}

                {/* Sentinel Element untuk Background Auto-Prefetch saat mendekati bagian akhir materi */}
                <div ref={sentinelRef} className="h-1 w-full pointer-events-none" />

                {!hasMore && loadedMaterials.length > 0 && materialFilterMode !== 'SCHEDULED' && (
                  <div className="text-center text-[11px] text-slate-400 py-3">
                    <span>• Seluruh materi kurikulum telah dimuat ({loadedMaterials.length} materi) •</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Sliders Nilai Karakter (Adab & Keaktifan Sesi) */}
          <div className="space-y-3 pt-2 border-t border-slate-200 py-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Penilaian Karakter &amp; Keaktifan Sesi</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Nilai Adab &amp; Akhlaq</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 text-xs">
                    {adabScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={adabScore}
                  onChange={(e) => setAdabScore(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Nilai Keaktifan &amp; Tartil</span>
                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200/80 text-xs">
                    {keaktifanScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={keaktifanScore}
                  onChange={(e) => setKeaktifanScore(Number(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 5. Quick Feedback Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Quick Feedback Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${isSelected
                      ? 'bg-teal-600 text-white border-teal-700 shadow-2xs font-semibold'
                      : 'bg-white hover:bg-teal-50/60 text-slate-700 border-slate-200'
                      }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Catatan Umum Guru */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Guru / Pembina (Opsional)
            </label>
            <textarea
              rows={2}
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="Tuliskan catatan umum untuk buku penghubung dengan orang tua..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
          </div>

          {/* 7. Notifikasi Sukses */}
          {
            successMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )
          }

          {/* 8. Tombol Simpan Komprehensif */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Menyimpan Penilaian...'
                : `Simpan Penilaian & Target Capaian`}
            </span>
          </button>
        </form>
      )
      }
    </div >
  );
}

