'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Book,
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
  Users,
  CheckCheck,
  List,
  MessageSquareQuote,
  NotebookPen,
  User,
  Calendar,
  GraduationCap,
  Circle,
  RotateCcw,
} from 'lucide-react';
import {
  saveComprehensiveEvaluation,
  saveBulkComprehensiveEvaluation,
  updateTeachingSummaryNotes,
  TargetCapaianInput,
} from '@/app/(protected)/presensi/actions';
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
  isMonthlyTarget?: boolean;
  slotIndex?: number;
  monthlyTargets?: Array<{ month: number; year: number; generationId?: string }>;
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
  sessionMonth?: number;
  sessionYear?: number;
  initialScopeCounts?: Record<MaterialFilterScope, number>;
  students: StudentItem[];
  classes?: Array<{ id: string; name: string }>;
  materials?: MaterialWithChecklists[];
  initialProgress?: StudentProgressData[];
  initialEvaluatedStudentIds?: string[];
  canCompleteDaerah?: boolean;
  canCompleteDesa?: boolean;
  totalStudentsCount?: number;
  initialTotalMaterials?: number;
  initialHasMore?: boolean;
  generations?: Array<{ id: string; name: string; code: string }>;
  currentTeachingSummaryNotes?: string | null;
  plannedChecklistItemIds?: string[];
  previousSessionNotes?: {
    scheduleTitle: string;
    date: string;
    notes: string;
  } | null;
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

export type MaterialFilterScope = 'SCHEDULED' | 'MONTHLY' | 'ADDITIONAL' | 'GENERATION' | 'ALL';
export type MaterialFilterMode = MaterialFilterScope;
export type StudentEvaluationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_CODES = [
  { code: 'JAN', month: 1 },
  { code: 'FEB', month: 2 },
  { code: 'MAR', month: 3 },
  { code: 'APR', month: 4 },
  { code: 'MEI', month: 5 },
  { code: 'JUN', month: 6 },
  { code: 'JUL', month: 7 },
  { code: 'AGS', month: 8 },
  { code: 'SEP', month: 9 },
  { code: 'OKT', month: 10 },
  { code: 'NOV', month: 11 },
  { code: 'DES', month: 12 },
];

export function getMaterialMonths(mat: MaterialWithChecklists): number[] {
  const months = new Set<number>();
  if (mat.monthlyTargets && mat.monthlyTargets.length > 0) {
    mat.monthlyTargets.forEach((t) => {
      if (t.month >= 1 && t.month <= 12) months.add(t.month);
    });
  }
  const upper = mat.title.toUpperCase();
  MONTH_CODES.forEach(({ code, month }) => {
    if (upper.includes(code)) months.add(month);
  });
  return Array.from(months);
}

export function getMaterialStudentStatus(
  mat: MaterialWithChecklists,
  progressMap: Record<string, { isCompleted: boolean; score?: number | null; teacherFeedback?: string | null; isModifiedSession?: boolean }>
): StudentEvaluationStatus {
  const items = mat.checklistItems;
  if (!items || items.length === 0) return 'NOT_STARTED';

  let completedCount = 0;
  let hasTouched = false;

  items.forEach((it) => {
    const p = progressMap[it.id];
    if (p?.isCompleted) {
      completedCount++;
      hasTouched = true;
    } else if ((p?.teacherFeedback && p.teacherFeedback.trim() !== '') || p?.isModifiedSession) {
      hasTouched = true;
    }
  });

  if (completedCount === items.length) return 'COMPLETED';
  if (completedCount > 0 || hasTouched) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

interface PresensiMaterialsCacheEntry {
  items: MaterialWithChecklists[];
  progress: StudentProgressData[];
  total: number;
  hasMore: boolean;
  page: number;
  timestamp: number;
  counts?: Record<MaterialFilterScope, number>;
}

// In-memory cache antar render/sesi di sisi client (TTL 5 menit)
const globalPresensiMaterialsCache: Record<string, PresensiMaterialsCacheEntry> = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

function buildCacheKey(
  scheduleId: string,
  mode: MaterialFilterScope | string,
  genId?: string | null,
  studentId?: string | null,
  search?: string
): string {
  const cleanSearch = (search || '').trim().toLowerCase();
  const base = `${scheduleId}_${mode}_${genId || 'ALL'}_${studentId || 'ALL_STU'}`;
  if (cleanSearch) {
    return `${base}_SEARCH_${cleanSearch}`;
  }
  return base;
}

export default function RealtimeEvaluationSheet({
  scheduleId,
  scheduleTierLevel,
  organizationName,
  sessionMonth,
  sessionYear,
  initialScopeCounts,
  students,
  classes = [],
  materials = [],
  initialProgress = [],
  initialEvaluatedStudentIds = [],
  canCompleteDaerah = false,
  canCompleteDesa = false,
  totalStudentsCount,
  initialTotalMaterials,
  initialHasMore,
  generations = [],
  currentTeachingSummaryNotes,
  plannedChecklistItemIds = [],
  previousSessionNotes,
  onGoToAttendance,
}: RealtimeEvaluationSheetProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [adabScore, setAdabScore] = useState<number>(85);
  const [keaktifanScore, setKeaktifanScore] = useState<number>(90);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [teachingSummaryNotes, setTeachingSummaryNotes] = useState<string>(
    currentTeachingSummaryNotes || ''
  );
  const [isSavingHandover, setIsSavingHandover] = useState<boolean>(false);
  const [handoverSuccessMessage, setHandoverSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State Santri yang Sudah Dinilai pada Sesi Ini
  const [evaluatedStudentIds, setEvaluatedStudentIds] = useState<string[]>(
    initialEvaluatedStudentIds || []
  );

  useEffect(() => {
    if (initialEvaluatedStudentIds && initialEvaluatedStudentIds.length > 0) {
      setEvaluatedStudentIds((prev) => Array.from(new Set([...prev, ...initialEvaluatedStudentIds])));
    }
  }, [initialEvaluatedStudentIds]);

  // State Toggle Tampilan Catatan Guru & Handover
  const [showTeacherNote, setShowTeacherNote] = useState<boolean>(false);
  const [showHandoverNote, setShowHandoverNote] = useState<boolean>(false);

  // State Toggle Simpan Nilai Semua Jenjang (Lintas Jenjang)
  const [applyToAllGenerations, setApplyToAllGenerations] = useState<boolean>(false);

  // State Mode Penilaian Massal
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkSelectedStudentIds, setBulkSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState<boolean>(false);
  const [isBulkStudentModalOpen, setIsBulkStudentModalOpen] = useState<boolean>(false);
  const [modalSelectedStudentIds, setModalSelectedStudentIds] = useState<string[]>([]);
  const [modalStudentSearch, setModalStudentSearch] = useState<string>('');
  const [modalGenFilter, setModalGenFilter] = useState<string>('ALL');
  const [mounted, setMounted] = useState<boolean>(false);
  const bulkDropdownRef = useRef<HTMLDivElement>(null);

  // State Tooltip Cakupan Materi & Detail Capaian Santri
  const [openAudienceTooltipMatId, setOpenAudienceTooltipMatId] = useState<string | null>(null);
  const [openItemDetailTooltipId, setOpenItemDetailTooltipId] = useState<string | null>(null);

  // State Toast Notifikasi Aksi Massal
  const [bulkActionToast, setBulkActionToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    const id = Date.now();
    setBulkActionToast({ id, message, type });
    setTimeout(() => {
      setBulkActionToast((prev) => (prev?.id === id ? null : prev));
    }, 3000);
  }, []);

  // Click outside untuk menutup tooltip audiens materi & detail santri
  useEffect(() => {
    if (!openAudienceTooltipMatId && !openItemDetailTooltipId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-tooltip-container="true"]')) return;
      setOpenAudienceTooltipMatId(null);
      setOpenItemDetailTooltipId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openAudienceTooltipMatId, openItemDetailTooltipId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Click outside untuk dropdown menu mode massal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bulkDropdownRef.current &&
        !bulkDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBulkDropdownOpen(false);
      }
    };

    if (isBulkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBulkDropdownOpen]);

  // Lock scroll & ESC key untuk modal pilih beberapa santri
  useEffect(() => {
    if (isBulkStudentModalOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsBulkStudentModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isBulkStudentModalOpen]);

  // Daftar seluruh jenjang yang tersedia dari santri sesi ini
  const modalAvailableGenerations = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.generationId && s.generationName) {
        map.set(s.generationId, s.generationName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  // Filter santri di dalam modal pencarian (menggabungkan pencarian teks & filter jenjang)
  const modalFilteredStudents = useMemo(() => {
    let list = students;
    if (modalGenFilter !== 'ALL') {
      list = list.filter((s) => s.generationId === modalGenFilter);
    }
    const query = modalStudentSearch.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (s) =>
        s.fullName.toLowerCase().includes(query) ||
        (s.generationName && s.generationName.toLowerCase().includes(query)) ||
        (s.className && s.className.toLowerCase().includes(query))
    );
  }, [students, modalGenFilter, modalStudentSearch]);

  const handleRemoveStudentFromBulk = (id: string) => {
    setBulkSelectedStudentIds((prev) => {
      const next = prev.filter((sId) => sId !== id);
      if (next.length === 0) {
        setIsBulkMode(false);
      }
      return next;
    });
  };

  const hasScheduledMaterials = useMemo(
    () => materials.some((m) => m.isScheduled),
    [materials]
  );

  const [materialFilterScope, setMaterialFilterScope] = useState<MaterialFilterScope>('SCHEDULED');
  const materialFilterMode = materialFilterScope;
  const setMaterialFilterMode = (mode: MaterialFilterScope) => setMaterialFilterScope(mode);
  const [isFilterScopeDropdownOpen, setIsFilterScopeDropdownOpen] = useState<boolean>(false);
  const filterScopeDropdownRef = useRef<HTMLDivElement>(null);

  // State Filter Lanjutan (Modal Besar: Jenjang, Bulan, Status)
  const [isAdvancedFilterModalOpen, setIsAdvancedFilterModalOpen] = useState<boolean>(false);
  const [advancedFilterActiveTab, setAdvancedFilterActiveTab] = useState<'JENJANG' | 'BULAN' | 'STATUS'>('JENJANG');

  // Filter yang sedang aktif diterapkan
  const [activeGenFilterIds, setActiveGenFilterIds] = useState<string[]>([]);
  const [activeMonthFilters, setActiveMonthFilters] = useState<number[]>([]);
  const [activeStatusFilters, setActiveStatusFilters] = useState<StudentEvaluationStatus[]>([]);

  // Filter sementara (Draft) di dalam modal sebelum tombol "Terapkan" diklik
  const [draftGenFilterIds, setDraftGenFilterIds] = useState<string[]>([]);
  const [draftMonthFilters, setDraftMonthFilters] = useState<number[]>([]);
  const [draftStatusFilters, setDraftStatusFilters] = useState<StudentEvaluationStatus[]>([]);

  const currentStudent = students.find((s) => s.id === selectedStudentId);

  // Inisialisasi cache key awal
  const initialCacheKey = useMemo(() => {
    const targetGenId = students[0]?.generationId || null;
    const initialStuId = students[0]?.id || null;
    return buildCacheKey(scheduleId, 'SCHEDULED', targetGenId, initialStuId);
  }, [scheduleId, students]);

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
          counts: initialScopeCounts,
        },
  });

  // Buffer untuk data yang diambil secara diam-diam oleh background prefetcher
  const prefetchBufferRef = useRef<Record<string, PresensiMaterialsCacheEntry>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevSearchRef = useRef<string>('');

  // Simpan data awal ke cache memori (optimasi instan render)
  useEffect(() => {
    if (!globalPresensiMaterialsCache[initialCacheKey]) {
      const entry: PresensiMaterialsCacheEntry = {
        items: materials,
        progress: initialProgress,
        total: initialTotalMaterials ?? materials.length,
        hasMore: initialHasMore ?? false,
        page: 1,
        timestamp: Date.now(),
        counts: initialScopeCounts,
      };
      globalPresensiMaterialsCache[initialCacheKey] = entry;
      cacheRef.current[initialCacheKey] = entry;
    }
  }, [initialCacheKey, materials, initialProgress, initialTotalMaterials, initialHasMore, initialScopeCounts]);

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

  // Grup Jenjang Santri Hadir untuk Akses Cepat pada Tooltip Mode Massal (hanya jenjang dengan santri aktif > 1)
  const bulkGenerationQuickOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; studentIds: string[] }>();
    for (const s of students) {
      if (!s.generationId) continue;
      const genName = s.generationName || availableGenerations.find((g) => g.id === s.generationId)?.name || 'Jenjang';
      const entry = map.get(s.generationId) || { id: s.generationId, name: genName, studentIds: [] };
      entry.studentIds.push(s.id);
      map.set(s.generationId, entry);
    }
    // Hanya jenjang yang ada santri aktif dan lebih dari 1 (> 1)
    return Array.from(map.values())
      .filter((g) => g.studentIds.length > 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, availableGenerations]);

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

  // Click outside untuk dropdown menu cakupan materi (Filter Popover)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterScopeDropdownRef.current &&
        !filterScopeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFilterScopeDropdownOpen(false);
      }
    };

    if (isFilterScopeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterScopeDropdownOpen]);

  // Lock scroll & ESC key untuk Modal Besar Filter Lanjutan
  useEffect(() => {
    if (isAdvancedFilterModalOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsAdvancedFilterModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isAdvancedFilterModalOpen]);

  // Handlers untuk Modal Filter Lanjutan
  const openAdvancedFilterModal = useCallback(() => {
    setDraftGenFilterIds([...activeGenFilterIds]);
    setDraftMonthFilters([...activeMonthFilters]);
    setDraftStatusFilters([...activeStatusFilters]);
    setIsAdvancedFilterModalOpen(true);
  }, [activeGenFilterIds, activeMonthFilters, activeStatusFilters]);

  const handleResetDraftFilters = useCallback(() => {
    setDraftGenFilterIds([]);
    setDraftMonthFilters([]);
    setDraftStatusFilters([]);
  }, []);

  const totalActiveAdvancedFilters =
    activeGenFilterIds.length + activeMonthFilters.length + activeStatusFilters.length;
  const totalDraftAdvancedFilters =
    draftGenFilterIds.length + draftMonthFilters.length + draftStatusFilters.length;

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

  // State progres target capaian lokal per santri: { [checklistItemId]: { isCompleted, score, teacherFeedback, pointsWeight, status, isModifiedSession } }
  const [targetProgressMap, setTargetProgressMap] = useState<
    Record<
      string,
      {
        isCompleted: boolean;
        score: number;
        teacherFeedback: string;
        pointsWeight: number;
        status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
        isModifiedSession?: boolean;
      }
    >
  >({});

  // Memo data materi sasaran audiens yang sedang dibuka modal/tooltipnya
  const activeAudienceMat = useMemo(() => {
    if (!openAudienceTooltipMatId) return null;
    return loadedMaterials.find((m) => m.id === openAudienceTooltipMatId) || null;
  }, [openAudienceTooltipMatId, loadedMaterials]);

  // Memo data item checklist detail status santri yang sedang dibuka modal/tooltipnya
  const activeItemDetail = useMemo(() => {
    if (!openItemDetailTooltipId) return null;
    for (const m of loadedMaterials) {
      const it = m.checklistItems.find((c) => c.id === openItemDetailTooltipId);
      if (it) return { mat: m, item: it };
    }
    return null;
  }, [openItemDetailTooltipId, loadedMaterials]);

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

  const prevStudentGenIdRef = useRef<string | null>(students[0]?.generationId || null);
  const prevSelectedStudentIdRef = useRef<string>(students[0]?.id || '');

  // Sinkronisasi otomatis materi kurikulum ketika santri berganti (khususnya beda jenjang di jadwal gabungan)
  useEffect(() => {
    if (isBulkMode || !selectedStudentId) return;

    const newGenId = currentStudent?.generationId || null;
    const isDifferentGen = prevStudentGenIdRef.current !== newGenId;
    const isDifferentStudent = prevSelectedStudentIdRef.current !== selectedStudentId;

    if (!isDifferentStudent) return;

    prevStudentGenIdRef.current = newGenId;
    prevSelectedStudentIdRef.current = selectedStudentId;

    // Jika filter lanjutan sedang aktif, ambil ulang materi dan progres khusus santri terpilih
    if (activeGenFilterIds.length > 0 || activeMonthFilters.length > 0) {
      let isCancelled = false;
      setIsLoadingMode(true);
      const fetchFilteredForStudent = async () => {
        try {
          const params = new URLSearchParams({
            scheduleId,
            scope: 'ALL',
            page: '1',
            limit: '100',
            studentId: selectedStudentId,
          });
          if (activeGenFilterIds.length > 0) params.set('generationIds', activeGenFilterIds.join(','));
          if (activeMonthFilters.length > 0) params.set('months', activeMonthFilters.join(','));

          const res = await fetch(`/api/presensi/materials?${params.toString()}`);
          const data = await res.json();
          if (!isCancelled && data.success) {
            setLoadedMaterials(data.items);
            setTotalCount(data.total);
            setHasMore(data.hasMore);
            setPage(1);
            mergeProgress(data.progress);
            if (data.counts) setScopeCounts(data.counts);
          }
        } catch (err) {
          console.error('Gagal memperbarui filter lanjutan untuk santri:', err);
        } finally {
          if (!isCancelled) setIsLoadingMode(false);
        }
      };
      fetchFilteredForStudent();
      return () => { isCancelled = true; };
    }

    // Cek cache dulu
    const targetGenId = newGenId;
    const cacheKey = buildCacheKey(scheduleId, materialFilterScope, targetGenId, selectedStudentId);
    const cached = cacheRef.current[cacheKey] || globalPresensiMaterialsCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setLoadedMaterials(cached.items);
      setTotalCount(cached.total);
      setHasMore(cached.hasMore);
      setPage(cached.page);
      mergeProgress(cached.progress);
      if (cached.counts) setScopeCounts(cached.counts);
      return;
    }

    let isCancelled = false;
    setIsLoadingMode(true);

    const fetchStudentMaterials = async () => {
      try {
        const params = new URLSearchParams({
          scheduleId,
          scope: materialFilterScope,
          page: '1',
          limit: materialFilterScope === 'ALL' ? '20' : '100',
          studentId: selectedStudentId,
        });
        if (targetGenId) params.set('generationId', targetGenId);

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
            counts: data.counts,
          };
          cacheRef.current[cacheKey] = entry;
          globalPresensiMaterialsCache[cacheKey] = entry;

          setLoadedMaterials(data.items);
          setTotalCount(data.total);
          setHasMore(data.hasMore);
          setPage(1);
          mergeProgress(data.progress);
          if (data.counts) setScopeCounts(data.counts);
        }
      } catch (err) {
        console.error('Gagal memuat materi santri terpilih:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingMode(false);
        }
      }
    };

    fetchStudentMaterials();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedStudentId,
    currentStudent?.generationId,
    materialFilterScope,
    isBulkMode,
    scheduleId,
    activeGenFilterIds,
    activeMonthFilters,
    mergeProgress,
  ]);

  // Inisialisasi data progres target capaian saat santri terpilih berganti atau materi dimuat ulang
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
        status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
        isModifiedSession?: boolean;
      }
    > = {};

    loadedMaterials.forEach((mat) => {
      mat.checklistItems.forEach((item) => {
        const found = studentProg.find((p) => p.checklistItemId === item.id);
        const isComp = found ? found.isCompleted : false;
        const hasFeedback = Boolean(found?.teacherFeedback && found.teacherFeedback.trim() !== '');
        const itemStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = isComp
          ? 'COMPLETED'
          : hasFeedback
          ? 'IN_PROGRESS'
          : 'NOT_STARTED';

        newMap[item.id] = {
          isCompleted: isComp,
          score: found && found.score ? found.score : 85,
          teacherFeedback: found?.teacherFeedback || '',
          pointsWeight: item.pointsWeight || 10,
          status: itemStatus,
          isModifiedSession: false,
        };
      });
    });

    setTargetProgressMap(newMap);
    setSuccessMessage(null);
  }, [selectedStudentId, loadedMaterials, isBulkMode]);

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
            const isComp = found ? found.isCompleted : false;
            const hasFeedback = Boolean(found?.teacherFeedback && found.teacherFeedback.trim() !== '');
            const itemStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = isComp
              ? 'COMPLETED'
              : hasFeedback
              ? 'IN_PROGRESS'
              : 'NOT_STARTED';

            updated[item.id] = {
              isCompleted: isComp,
              score: found && found.score ? found.score : 85,
              teacherFeedback: found?.teacherFeedback || '',
              pointsWeight: item.pointsWeight || 10,
              status: itemStatus,
              isModifiedSession: false,
            };
            changed = true;
          }
        });
      });

      return changed ? updated : prev;
    });
  }, [loadedMaterials, allStudentProgress, selectedStudentId]);

  const currentMonth = useMemo(() => sessionMonth || (new Date().getMonth() + 1), [sessionMonth]);

  // State hitungan akurat untuk 5 cakupan materi: Semua, Jenjang, Bulanan, Jadwal, Tambahan
  const [scopeCounts, setScopeCounts] = useState<Record<MaterialFilterScope, number>>(() => ({
    ALL: initialScopeCounts?.ALL ?? 0,
    GENERATION: initialScopeCounts?.GENERATION ?? 0,
    MONTHLY: initialScopeCounts?.MONTHLY ?? 0,
    SCHEDULED: initialScopeCounts?.SCHEDULED ?? 0,
    ADDITIONAL: initialScopeCounts?.ADDITIONAL ?? 0,
  }));

  // Handler memilih salah satu dari 5 opsi cakupan materi dari popover/tooltip
  const handleSelectScope = useCallback(
    async (scope: MaterialFilterScope) => {
      setMaterialFilterScope(scope);
      setIsFilterScopeDropdownOpen(false);

      const targetGenId = isBulkMode ? undefined : currentStudent?.generationId;
      const stuId = isBulkMode ? undefined : selectedStudentId;
      const cacheKey = buildCacheKey(scheduleId, scope, targetGenId, stuId);
      const cached = cacheRef.current[cacheKey] || globalPresensiMaterialsCache[cacheKey];

      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setLoadedMaterials(cached.items);
        setTotalCount(cached.total);
        setHasMore(cached.hasMore);
        setPage(cached.page);
        mergeProgress(cached.progress);
        if (cached.counts) setScopeCounts(cached.counts);
        return;
      }

      setIsLoadingMode(true);
      try {
        const params = new URLSearchParams({
          scheduleId,
          scope,
          page: '1',
          limit: scope === 'ALL' ? '20' : '100',
        });
        if (targetGenId) params.set('generationId', targetGenId);
        if (stuId) params.set('studentId', stuId);

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
            counts: data.counts,
          };
          cacheRef.current[cacheKey] = entry;
          globalPresensiMaterialsCache[cacheKey] = entry;

          setLoadedMaterials(data.items);
          setTotalCount(data.total);
          setHasMore(data.hasMore);
          setPage(1);
          mergeProgress(data.progress);
          if (data.counts) setScopeCounts(data.counts);
        }
      } catch (err) {
        console.error('Gagal memuat materi cakupan:', err);
      } finally {
        setIsLoadingMode(false);
      }
    },
    [scheduleId, currentStudent?.generationId, selectedStudentId, isBulkMode, mergeProgress]
  );

  const handleApplyAdvancedFilters = useCallback(async () => {
    setActiveGenFilterIds(draftGenFilterIds);
    setActiveMonthFilters(draftMonthFilters);
    setActiveStatusFilters(draftStatusFilters);
    setIsAdvancedFilterModalOpen(false);

    if (draftGenFilterIds.length > 0 || draftMonthFilters.length > 0) {
      setIsLoadingMode(true);
      try {
        const params = new URLSearchParams({
          scheduleId,
          scope: 'ALL',
          page: '1',
          limit: '100',
        });
        if (draftGenFilterIds.length > 0) {
          params.set('generationIds', draftGenFilterIds.join(','));
        }
        if (draftMonthFilters.length > 0) {
          params.set('months', draftMonthFilters.join(','));
        }
        if (!isBulkMode && selectedStudentId) {
          params.set('studentId', selectedStudentId);
        }

        const res = await fetch(`/api/presensi/materials?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setLoadedMaterials(data.items);
          setTotalCount(data.total);
          setHasMore(data.hasMore);
          setPage(1);
          mergeProgress(data.progress);
          if (data.counts) setScopeCounts(data.counts);
        }
      } catch (err) {
        console.error('Gagal menerapkan filter lanjutan:', err);
      } finally {
        setIsLoadingMode(false);
      }
    } else {
      // Jika kedua filter dibersihkan di modal, pulihkan materi sesuai cakupan aktif
      handleSelectScope(materialFilterScope);
    }
  }, [
    draftGenFilterIds,
    draftMonthFilters,
    draftStatusFilters,
    scheduleId,
    isBulkMode,
    selectedStudentId,
    mergeProgress,
    handleSelectScope,
    materialFilterScope,
  ]);

  const handleClearAllActiveFilters = useCallback(() => {
    setActiveGenFilterIds([]);
    setActiveMonthFilters([]);
    setActiveStatusFilters([]);
    handleSelectScope(materialFilterScope);
  }, [handleSelectScope, materialFilterScope]);

  // Filter materi aktif yang menggabungkan Cakupan + Filter Lanjutan (Jenjang, Bulan, Status) + Pencarian
  const filteredMaterials = useMemo(() => {
    let list = loadedMaterials;

    // Cek apakah filter lanjutan kustom (Jenjang atau Bulan) sedang aktif
    const isCustomGenOrMonthActive = activeGenFilterIds.length > 0 || activeMonthFilters.length > 0;

    // 1. Cakupan (Scope Filter) - hanya memfilter lokal jika filter lanjutan jenjang/bulan TIDAK aktif
    if (!isCustomGenOrMonthActive) {
      if (isBulkMode) {
        const selectedGenIds = new Set<string>();
        students.forEach((s) => {
          if (bulkSelectedStudentIds.includes(s.id) && s.generationId) {
            selectedGenIds.add(s.generationId);
          }
        });

        list = list.filter((m) => {
          if (!m.targetGenerationId) return true;
          return selectedGenIds.size === 0 || selectedGenIds.has(m.targetGenerationId);
        });

        if (materialFilterScope === 'MONTHLY') {
          list = list.filter((m) => m.isMonthlyTarget || getMaterialMonths(m).includes(currentMonth));
        } else if (materialFilterScope === 'ADDITIONAL') {
          list = list.filter(
            (m) =>
              !m.targetGenerationId ||
              (m.isScheduled && !m.isMonthlyTarget && !getMaterialMonths(m).includes(currentMonth))
          );
        }
      } else {
        // Mode Mandiri (Per Santri)
        if (materialFilterScope === 'SCHEDULED') {
          const scheduled = list.filter((m) => m.isScheduled);
          const baseScheduled = scheduled.length > 0 ? scheduled : list;
          if (currentStudent?.generationId) {
            list = baseScheduled.filter(
              (m) => !m.targetGenerationId || m.targetGenerationId === currentStudent.generationId
            );
          } else {
            list = baseScheduled;
          }
        } else if (materialFilterScope === 'MONTHLY') {
          if (currentStudent?.generationId) {
            list = list.filter(
              (m) =>
                (!m.targetGenerationId || m.targetGenerationId === currentStudent.generationId) &&
                (m.isMonthlyTarget || getMaterialMonths(m).includes(currentMonth))
            );
          } else {
            list = list.filter((m) => m.isMonthlyTarget || getMaterialMonths(m).includes(currentMonth));
          }
        } else if (materialFilterScope === 'ADDITIONAL') {
          list = list.filter(
            (m) =>
              !m.targetGenerationId ||
              (m.isScheduled && !m.isMonthlyTarget && !getMaterialMonths(m).includes(currentMonth))
          );
        } else if (materialFilterScope === 'GENERATION') {
          if (currentStudent?.generationId) {
            list = list.filter(
              (m) => !m.targetGenerationId || m.targetGenerationId === currentStudent.generationId
            );
          }
        }
      }
    }

    // 2. Filter Lanjutan: Jenjang
    if (activeGenFilterIds.length > 0) {
      list = list.filter((m) => {
        if (!m.targetGenerationId) return true;
        return activeGenFilterIds.includes(m.targetGenerationId);
      });
    }

    // 3. Filter Lanjutan: Bulan
    if (activeMonthFilters.length > 0) {
      list = list.filter((m) => {
        const matMonths = getMaterialMonths(m);
        if (matMonths.length === 0) {
          if (m.isMonthlyTarget && activeMonthFilters.includes(currentMonth)) return true;
          return false;
        }
        return matMonths.some((month) => activeMonthFilters.includes(month));
      });
    }

    // 4. Filter Lanjutan: Status Penilaian
    if (activeStatusFilters.length > 0) {
      list = list.filter((m) => {
        const status = getMaterialStudentStatus(m, targetProgressMap);
        return activeStatusFilters.includes(status);
      });
    }

    // 5. Pencarian Teks - Selalu aktif dan responsif di semua mode
    const query = materialSearchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          (m.description && m.description.toLowerCase().includes(query)) ||
          (m.targetGeneration?.name && m.targetGeneration.name.toLowerCase().includes(query)) ||
          m.checklistItems.some((item) => item.itemTitle.toLowerCase().includes(query))
      );
    }

    // Urutkan materi: Materi umum sesi di atas, kemudian materi kurikulum jenjang
    return [...list].sort((a, b) => {
      const aIsGeneral = !a.targetGenerationId;
      const bIsGeneral = !b.targetGenerationId;
      if (aIsGeneral && !bIsGeneral) return -1;
      if (!aIsGeneral && bIsGeneral) return 1;

      if (aIsGeneral && bIsGeneral) {
        return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
      }

      const aGenName = a.targetGeneration?.name || '';
      const bGenName = b.targetGeneration?.name || '';
      if (aGenName !== bGenName) {
        return aGenName.localeCompare(bGenName);
      }

      return a.isMandatoryForTarget ? -1 : 1;
    });
  }, [
    loadedMaterials,
    materialFilterScope,
    activeGenFilterIds,
    activeMonthFilters,
    activeStatusFilters,
    materialSearchQuery,
    currentStudent?.generationId,
    isBulkMode,
    bulkSelectedStudentIds,
    students,
    currentMonth,
    targetProgressMap,
  ]);

  // Rotasi mode cepat (kompatibilitas cadangan)
  const cycleFilterMode = async () => {
    let nextScope: MaterialFilterScope;
    if (materialFilterScope === 'SCHEDULED') {
      nextScope = 'MONTHLY';
    } else if (materialFilterScope === 'MONTHLY') {
      nextScope = 'GENERATION';
    } else if (materialFilterScope === 'GENERATION') {
      nextScope = 'ALL';
    } else {
      nextScope = 'SCHEDULED';
    }
    await handleSelectScope(nextScope);
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

    if (materialFilterScope !== 'ALL') return;

    try {
      const params = new URLSearchParams({
        scheduleId,
        scope: 'ALL',
        page: String(nextPage),
        limit: '20',
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

          const baseKey = buildCacheKey(scheduleId, 'ALL', targetGenId, selectedStudentId, debouncedSearch);
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
    materialFilterScope,
    page,
    scheduleId,
    currentStudent?.generationId,
    selectedGenerationFilter,
    debouncedSearch,
    selectedStudentId,
    allStudentProgress,
    mergeProgress,
  ]);

  // Prefetch diam-diam materi berikutnya saat user scroll mendekati akhir list materi
  const prefetchNextBatch = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoadingMode || materialFilterScope !== 'ALL' || isSearching) return;

    const nextPage = page + 1;
    const targetGenId = selectedGenerationFilter !== 'ALL' ? selectedGenerationFilter : undefined;

    const prefetchKey = `${buildCacheKey(scheduleId, 'ALL', targetGenId, selectedStudentId, debouncedSearch)}_P${nextPage}`;
    if (prefetchBufferRef.current[prefetchKey]) return;

    try {
      const params = new URLSearchParams({
        scheduleId,
        scope: 'ALL',
        page: String(nextPage),
        limit: '20',
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
        if (prevSearchRef.current) {
          prevSearchRef.current = '';
          const cached = cacheRef.current[baseCacheKey] || globalPresensiMaterialsCache[baseCacheKey];
          if (cached) {
            setLoadedMaterials(cached.items);
            setTotalCount(cached.total);
            setHasMore(cached.hasMore);
            setPage(cached.page);
            mergeProgress(cached.progress);
          }
        }
        return;
      }
      prevSearchRef.current = debouncedSearch;

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
          scope: materialFilterScope,
          page: '1',
          limit: '20',
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
            counts: data.counts,
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
    materialFilterScope,
    currentStudent?.generationId,
    selectedGenerationFilter,
    scheduleId,
    selectedStudentId,
    mergeProgress,
  ]);

  // Silent Background Prefetching: Diam-diam mengambil materi yang belum dimuat saat idle
  useEffect(() => {
    const idleTimer = setTimeout(async () => {
      // 1. Jika di mode SCHEDULED, diam-diam ambil kurikulum penuh mode GENERATION ke cache
      if (materialFilterScope === 'SCHEDULED' && currentStudent?.generationId) {
        const genKey = buildCacheKey(scheduleId, 'GENERATION', currentStudent.generationId, selectedStudentId);
        if (!cacheRef.current[genKey] && !globalPresensiMaterialsCache[genKey]) {
          try {
            const params = new URLSearchParams({
              scheduleId,
              scope: 'GENERATION',
              generationId: currentStudent.generationId,
              page: '1',
              limit: '100',
            });
            if (selectedStudentId) params.set('studentId', selectedStudentId);
            const res = await fetch(`/api/presensi/materials?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
              const entry: PresensiMaterialsCacheEntry = {
                items: data.items,
                progress: data.progress,
                total: data.total,
                hasMore: false,
                page: 1,
                timestamp: Date.now(),
                counts: data.counts,
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

      // 2. Jika di mode ALL dan hasMore === true, prefetch batch halaman berikutnya
      if (materialFilterScope === 'ALL' && hasMore && !isLoadingMore && !isLoadingMode && !materialSearchQuery) {
        const nextPage = page + 1;
        const targetGenId =
          selectedGenerationFilter !== 'ALL'
            ? selectedGenerationFilter
            : undefined;

        const prefetchKey = `${buildCacheKey(scheduleId, 'ALL', targetGenId, selectedStudentId)}_P${nextPage}`;
        if (!prefetchBufferRef.current[prefetchKey]) {
          try {
            const params = new URLSearchParams({
              scheduleId,
              scope: 'ALL',
              page: String(nextPage),
              limit: '20',
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
    materialFilterScope,
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
      setExpandedMaterialIds([filteredMaterials[0].id]);
    }
  }, [materialSearchQuery, filteredMaterials]);



  // Single-Active Accordion: membuka satu materi akan otomatis menutup materi lainnya
  const toggleMaterialAccordion = (materialId: string) => {
    setExpandedMaterialIds((prev) =>
      prev.includes(materialId) ? [] : [materialId]
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

  // Helper mendapatkan status kemajuan item saat ini: NOT_STARTED | IN_PROGRESS | COMPLETED | MIXED
  const getItemStatus = useCallback(
    (itemId: string): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'MIXED' => {
      const local = targetProgressMap[itemId];

      if (isBulkMode) {
        const mat = loadedMaterials.find((m) => m.checklistItems.some((it) => it.id === itemId));
        const targetStudentObjs = students.filter((s) => bulkSelectedStudentIds.includes(s.id));
        const relevantStudents = targetStudentObjs.filter((s) => {
          if (applyToAllGenerations) return true;
          if (!mat || !mat.targetGenerationId) return true;
          return s.generationId === mat.targetGenerationId;
        });

        if (relevantStudents.length === 0) return 'NOT_STARTED';

        // Jika pengajar secara aktif memodifikasi status capaian untuk santri yang dinilai di sesi massal ini
        if (local?.isModifiedSession && local.status) {
          return local.status;
        }

        let completedCount = 0;
        let inProgressCount = 0;
        let notStartedCount = 0;

        for (const s of relevantStudents) {
          const prog = allStudentProgress.find((p) => p.studentId === s.id && p.checklistItemId === itemId);
          const isPreviouslyCompleted = !!prog?.isCompleted;

          if (isPreviouslyCompleted) {
            // Santri yang sudah tuntas sebelumnya selalu berstatus COMPLETED (tidak terpengaruh aksi massal)
            completedCount++;
          } else if (prog?.teacherFeedback && prog.teacherFeedback.trim() !== '') {
            inProgressCount++;
          } else {
            notStartedCount++;
          }
        }

        if (completedCount === relevantStudents.length) return 'COMPLETED';
        if (inProgressCount === relevantStudents.length) return 'IN_PROGRESS';
        if (notStartedCount === relevantStudents.length) return 'NOT_STARTED';
        return 'MIXED';
      }

      if (local?.status) return local.status;
      if (local?.isCompleted) return 'COMPLETED';
      if (local?.teacherFeedback && local.teacherFeedback.trim() !== '') return 'IN_PROGRESS';
      return 'NOT_STARTED';
    },
    [targetProgressMap, isBulkMode, loadedMaterials, students, bulkSelectedStudentIds, allStudentProgress, applyToAllGenerations]
  );

  // Helper untuk mendapatkan data rincian santri per item
  const getItemStudentStatusDetails = useCallback(
    (mat: MaterialWithChecklists, itemId: string) => {
      const targetStudentObjs = students.filter((s) =>
        isBulkMode ? bulkSelectedStudentIds.includes(s.id) : s.id === selectedStudentId
      );

      const isGeneral = !mat.targetGenerationId || applyToAllGenerations;
      const relevantStudents = targetStudentObjs.filter((s) => {
        if (isGeneral) return true;
        return s.generationId === mat.targetGenerationId;
      });

      const completed: Array<{
        student: StudentItem;
        score: number | null;
        feedback: string | null;
        isJustModified?: boolean;
      }> = [];
      const inProgress: Array<{
        student: StudentItem;
        feedback: string | null;
        isJustModified?: boolean;
      }> = [];
      const notStarted: Array<{ student: StudentItem }> = [];

      const localState = targetProgressMap[itemId];

      for (const s of relevantStudents) {
        const existingProg = allStudentProgress.find(
          (p) => p.studentId === s.id && p.checklistItemId === itemId
        );

        const isPreviouslyCompleted = !!existingProg?.isCompleted;

        // ATURAN RANCANGAN UTAMA:
        // Jika dalam suatu capaian ada santri sudah tuntas dan diberi nilai sebelumnya,
        // maka perbarui nilai/status TIDAK BERLAKU untuk santri tersebut!
        if (isPreviouslyCompleted) {
          completed.push({
            student: s,
            score: existingProg.score ?? 85,
            feedback: existingProg.teacherFeedback ?? null,
            isJustModified: false,
          });
          continue;
        }

        // Santri yang belum dinilai dan masih dalam proses:
        if (localState?.isModifiedSession) {
          if (localState.status === 'COMPLETED') {
            completed.push({
              student: s,
              score: localState.score ?? 85,
              feedback: localState.teacherFeedback || existingProg?.teacherFeedback || null,
              isJustModified: true,
            });
            continue;
          } else if (localState.status === 'IN_PROGRESS') {
            inProgress.push({
              student: s,
              feedback: localState.teacherFeedback || existingProg?.teacherFeedback || null,
              isJustModified: true,
            });
            continue;
          } else if (localState.status === 'NOT_STARTED') {
            notStarted.push({ student: s });
            continue;
          }
        }

        // Status awal jika belum dimodifikasi sesi ini:
        if (existingProg?.teacherFeedback && existingProg.teacherFeedback.trim() !== '') {
          inProgress.push({
            student: s,
            feedback: existingProg.teacherFeedback,
            isJustModified: false,
          });
        } else {
          notStarted.push({ student: s });
        }
      }

      return { relevantStudents, completed, inProgress, notStarted };
    },
    [students, isBulkMode, bulkSelectedStudentIds, selectedStudentId, targetProgressMap, allStudentProgress, applyToAllGenerations]
  );

  // Helper mengecek apakah suatu capaian pada mode massal memiliki status awal bervariasi (MIXED)
  const isItemInitiallyMixed = useCallback(
    (itemId: string): boolean => {
      if (!isBulkMode) return false;
      const mat = loadedMaterials.find((m) => m.checklistItems.some((it) => it.id === itemId));
      const targetStudentObjs = students.filter((s) => bulkSelectedStudentIds.includes(s.id));
      const relevantStudents = targetStudentObjs.filter((s) => {
        if (applyToAllGenerations) return true;
        if (!mat || !mat.targetGenerationId) return true;
        return s.generationId === mat.targetGenerationId;
      });

      if (relevantStudents.length <= 1) return false;

      let completedCount = 0;
      let inProgressCount = 0;
      let notStartedCount = 0;

      for (const s of relevantStudents) {
        const prog = allStudentProgress.find((p) => p.studentId === s.id && p.checklistItemId === itemId);
        if (prog?.isCompleted) {
          completedCount++;
        } else if (prog?.teacherFeedback && prog.teacherFeedback.trim() !== '') {
          inProgressCount++;
        } else {
          notStartedCount++;
        }
      }

      const allCompleted = completedCount === relevantStudents.length;
      const allInProgress = inProgressCount === relevantStudents.length;
      const allNotStarted = notStartedCount === relevantStudents.length;

      return !allCompleted && !allInProgress && !allNotStarted;
    },
    [isBulkMode, loadedMaterials, students, bulkSelectedStudentIds, allStudentProgress, applyToAllGenerations]
  );

  // Handler untuk membatalkan modifikasi massal dan mengembalikan capaian ke kondisi awal bervariasi (Perbarui)
  const handleResetItemToMixed = (itemId: string) => {
    showToast('Perubahan dibatalkan, kembali ke kondisi awal bervariasi', 'info');
    setTargetProgressMap((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          status: undefined,
          isCompleted: false,
          teacherFeedback: '',
          isModifiedSession: false,
        },
      };
    });
  };

  // Handler untuk mengeset status capaian secara langsung (misal dari banner opsi: Set Proses / Tuntaskan / Belum Dinilai)
  const handleSetItemStatusDirect = (
    itemId: string,
    targetStatus: 'IN_PROGRESS' | 'COMPLETED' | 'NOT_STARTED',
    mat: MaterialWithChecklists,
    completionTierLevel?: string
  ) => {
    if (targetStatus === 'COMPLETED') {
      if (completionTierLevel === 'DAERAH_ONLY' && !canCompleteDaerah) {
        alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Daerah.');
        return;
      }
      if (completionTierLevel === 'DESA_AND_ABOVE' && !canCompleteDesa && !canCompleteDaerah) {
        alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Desa atau Daerah.');
        return;
      }
    }

    const details = getItemStudentStatusDetails(mat, itemId);
    const affectedCount = isBulkMode
      ? details.notStarted.length + details.inProgress.length
      : 1;

    if (targetStatus === 'IN_PROGRESS') {
      showToast(
        isBulkMode
          ? `${affectedCount} Santri diperbarui ke status Dalam Proses`
          : 'Capaian diset ke status Dalam Proses',
        'info'
      );
    } else if (targetStatus === 'COMPLETED') {
      showToast(
        isBulkMode
          ? `${affectedCount} Santri dituntaskan & siap dinilai`
          : 'Capaian Tuntas dinilai',
        'success'
      );
    } else {
      showToast(
        isBulkMode
          ? `${affectedCount} Santri diset ke status Belum Dinilai`
          : 'Capaian dikembalikan ke Belum Dinilai',
        'info'
      );
    }

    setTargetProgressMap((prev) => {
      const current = prev[itemId] || { isCompleted: false, score: 85, teacherFeedback: '', pointsWeight: 10 };

      // Pre-fill catatan jika kosong
      let feedback = current.teacherFeedback;
      if (!feedback) {
        const existingWithNote = allStudentProgress.find(
          (p) => p.checklistItemId === itemId && p.teacherFeedback && p.teacherFeedback.trim() !== ''
        );
        if (existingWithNote && existingWithNote.teacherFeedback) {
          feedback = existingWithNote.teacherFeedback;
        }
      }

      return {
        ...prev,
        [itemId]: {
          ...current,
          status: targetStatus,
          isCompleted: targetStatus === 'COMPLETED',
          score: current.score || 85,
          teacherFeedback: targetStatus === 'NOT_STARTED' ? '' : (feedback || ''),
          isModifiedSession: true,
        },
      };
    });
  };

  // Handler siklus status capaian:
  // - Mode massal saat kondisi awal bervariasi:
  //   Perbarui (MIXED) -> Proses (IN_PROGRESS) -> Tuntas (COMPLETED) -> Belum Dinilai (NOT_STARTED) -> Perbarui (RESET)
  // - Mode standar atau kondisi awal seragam:
  //   Belum Dinilai (NOT_STARTED) -> Proses (IN_PROGRESS) -> Tuntas (COMPLETED) -> Belum Dinilai
  const handleCycleItemStatus = (
    itemId: string,
    mat: MaterialWithChecklists,
    completionTierLevel?: string
  ) => {
    if (completionTierLevel === 'DAERAH_ONLY' && !canCompleteDaerah) {
      alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Daerah.');
      return;
    }
    if (completionTierLevel === 'DESA_AND_ABOVE' && !canCompleteDesa && !canCompleteDaerah) {
      alert('Sub-capaian ini terkunci. Hanya dapat disahkan oleh Tim Penguji Tingkat Desa atau Daerah.');
      return;
    }

    const currentStatus = getItemStatus(itemId);
    const initiallyMixed = isItemInitiallyMixed(itemId);

    // KONDISI KHUSUS: Mode Massal dengan kondisi awal bervariasi
    if (isBulkMode && initiallyMixed) {
      if (currentStatus === 'MIXED') {
        // Klik 1: Perbarui -> Proses
        handleSetItemStatusDirect(itemId, 'IN_PROGRESS', mat, completionTierLevel);
        return;
      }
      if (currentStatus === 'IN_PROGRESS') {
        // Klik 2: Proses -> Tuntas
        handleSetItemStatusDirect(itemId, 'COMPLETED', mat, completionTierLevel);
        return;
      }
      if (currentStatus === 'COMPLETED') {
        // Klik 3: Tuntas -> Belum Dinilai
        handleSetItemStatusDirect(itemId, 'NOT_STARTED', mat, completionTierLevel);
        return;
      }
      // Klik 4: Belum Dinilai -> Membatalkan & mengembalikan ke kondisi awal bervariasi (Perbarui)
      handleResetItemToMixed(itemId);
      return;
    }

    // SIKLUS STANDAR (Single mode atau kondisi awal seragam)
    let nextStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    if (currentStatus === 'NOT_STARTED' || currentStatus === 'MIXED') {
      nextStatus = 'IN_PROGRESS';
    } else if (currentStatus === 'IN_PROGRESS') {
      nextStatus = 'COMPLETED';
    } else {
      nextStatus = 'NOT_STARTED';
    }

    handleSetItemStatusDirect(itemId, nextStatus, mat, completionTierLevel);
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
          isModifiedSession: true,
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
          isModifiedSession: true,
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

    // Mode Penilaian Massal: Simpan ke seluruh santri terpilih sekaligus
    if (isBulkMode) {
      if (bulkSelectedStudentIds.length === 0) {
        alert('Silakan pilih minimal 1 santri untuk penilaian massal.');
        return;
      }

      try {
        setIsSubmitting(true);
        const fullNote = selectedTags.length > 0
          ? `[Tags: ${selectedTags.join(', ')}] ${teacherNote}`
          : teacherNote;

        // Siapkan payload target capaian updates untuk penilaian massal
        const targetCapaianUpdates: TargetCapaianInput[] = Object.entries(targetProgressMap)
          .filter(
            ([, data]) =>
              data.isCompleted ||
              data.status === 'COMPLETED' ||
              data.status === 'IN_PROGRESS' ||
              (data.teacherFeedback && data.teacherFeedback.trim() !== '')
          )
          .map(([checklistItemId, data]) => ({
            checklistItemId,
            score: data.isCompleted || data.status === 'COMPLETED' ? data.score : null,
            isCompleted: data.isCompleted || data.status === 'COMPLETED',
            status:
              data.status ||
              (data.isCompleted ? 'COMPLETED' : data.teacherFeedback ? 'IN_PROGRESS' : 'NOT_STARTED'),
            teacherFeedback: data.teacherFeedback || undefined,
            pointsWeight: data.pointsWeight,
          }));

        const res = await saveBulkComprehensiveEvaluation({
          scheduleId,
          studentIds: bulkSelectedStudentIds,
          adabScore,
          keaktifanScore,
          teacherPrivateNote: fullNote || undefined,
          targetCapaianUpdates,
          applyToAllGenerations,
        });

        // Sinkronkan state progres lokal allStudentProgress untuk seluruh santri terpilih secara aman
        if (targetCapaianUpdates.length > 0) {
          const newEntries: StudentProgressData[] = [];
          for (const sId of bulkSelectedStudentIds) {
            const studentObj = students.find((s) => s.id === sId);

            for (const upd of targetCapaianUpdates) {
              const mat = loadedMaterials.find((m) =>
                m.checklistItems.some((it) => it.id === upd.checklistItemId)
              );
              // Partisi jenjang: Lewati jika materi khusus jenjang yang berbeda dengan jenjang santri (kecuali applyToAllGenerations aktif)
              if (!applyToAllGenerations && mat?.targetGenerationId && mat.targetGenerationId !== studentObj?.generationId) {
                continue;
              }

              // Proteksi non-destruktif: Jangan timpa santri yang sudah tuntas sebelumnya
              const existingProg = allStudentProgress.find(
                (p) => p.studentId === sId && p.checklistItemId === upd.checklistItemId
              );
              if (existingProg?.isCompleted) {
                continue;
              }

              newEntries.push({
                studentId: sId,
                checklistItemId: upd.checklistItemId,
                isCompleted: upd.isCompleted,
                score: upd.score ?? null,
                teacherFeedback: upd.teacherFeedback ?? null,
                evaluatedAt: new Date().toISOString(),
              });
            }
          }
          mergeProgress(newEntries);
        }

        const pointsText = res.totalPointsDistributed > 0 ? ` (Total +${res.totalPointsDistributed} Poin Terdistribusi)` : '';
        setEvaluatedStudentIds((prev) => Array.from(new Set([...prev, ...bulkSelectedStudentIds])));
        setSuccessMessage(
          `Penilaian massal berhasil disimpan untuk ${res.count} santri hadir!${pointsText}`
        );
        setTeacherNote('');
        setSelectedTags([]);

        setTimeout(() => setSuccessMessage(null), 6000);
      } catch (err) {
        console.error('Failed to save bulk evaluation:', err);
        alert('Gagal menyimpan evaluasi massal santri.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
      setEvaluatedStudentIds((prev) => Array.from(new Set([...prev, selectedStudentId])));
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

  const handleSaveHandoverNotes = async () => {
    try {
      setIsSavingHandover(true);
      await updateTeachingSummaryNotes({
        scheduleId,
        teachingSummaryNotes,
      });
      setHandoverSuccessMessage('Catatan serah-terima sesi berhasil disimpan!');
      setTimeout(() => setHandoverSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Gagal menyimpan catatan serah-terima:', err);
      alert('Gagal menyimpan catatan serah-terima.');
    } finally {
      setIsSavingHandover(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border shadow-xs p-4 sm:p-6 space-y-5 transition-all duration-300 ${isBulkMode
        ? 'bg-teal-50/50 border-teal-300/80 ring-2 ring-teal-500/20'
        : 'bg-white/75 backdrop-blur-md border-slate-200/60'
        }`}
    >
      {/* 1. Header Info Jurnal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs">
              <Award className="w-4 h-4" />
            </div>
            <span>Jurnal &amp; Penilaian Target Capaian</span>
          </h3>
        </div>
      </div>

      {/* Catatan Serah-Terima dari Sesi Sebelumnya (Handover Antar Pengajar) */}
      {previousSessionNotes && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 rounded-2xl border border-amber-200/80 text-xs text-amber-950 flex items-start gap-3 shadow-2xs">
          <MessageSquareQuote className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[11px] text-amber-900 uppercase tracking-wider bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300/60">
                Serah-Terima Sesi Sebelumnya: {previousSessionNotes.scheduleTitle} ({previousSessionNotes.date})
              </span>
            </div>
            <p className="italic text-slate-700 leading-relaxed whitespace-pre-line text-xs font-medium">
              &ldquo;{previousSessionNotes.notes}&rdquo;
            </p>
          </div>
        </div>
      )}

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
          {/* 2. Pilih Santri Hadir / Mode Penilaian Massal */}
          {isBulkMode ? (

            <div className="p-4 rounded-2xl bg-teal-50/90 border border-teal-200/90 shadow-2xs space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-teal-200/60">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-teal-950">
                        Mode Penilaian Massal Aktif
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-200/80 text-teal-900 border border-teal-300/70">
                        {bulkSelectedStudentIds.length} dari {students.length} Santri
                      </span>
                    </div>

                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setModalSelectedStudentIds([...bulkSelectedStudentIds]);
                      setIsBulkStudentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ubah Santri</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkMode(false);
                      setBulkSelectedStudentIds([]);
                      setApplyToAllGenerations(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-[11px] font-bold border border-slate-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="Keluar dari mode penilaian massal"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Keluar Mode Massal</span>
                  </button>
                </div>
              </div>

              {/* Daftar Chips Santri Terpilih */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-teal-900">
                  <span>Daftar Santri yang Menerima Penilaian:</span>
                  {bulkSelectedStudentIds.length < students.length && (
                    <button
                      type="button"
                      onClick={() => setBulkSelectedStudentIds(students.map((s) => s.id))}
                      className="text-teal-700 hover:text-teal-900 underline text-[10px] cursor-pointer"
                    >
                      Pilih Semua Santri Hadir ({students.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {students
                    .filter((s) => bulkSelectedStudentIds.includes(s.id))
                    .map((s) => (
                      <div
                        key={s.id}
                        className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-xl bg-white border border-teal-200/80 text-teal-950 text-xs shadow-2xs"
                      >
                        <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center">
                          {s.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold truncate max-w-[140px] sm:max-w-[180px]">
                          {s.fullName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStudentFromBulk(s.id)}
                          className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title={`Hapus ${s.fullName} dari penilaian massal`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              {/* Ringkasan Target Ditandai */}
              <div className="space-y-1.5 pt-1 border-t border-teal-200/60">
                <div className="flex justify-between pt-2 items-center text-xs">
                  <span className="font-medium text-teal-900 flex items-center gap-1.5">
                    <span>Target Capaian</span>
                  </span>
                  <span className="font-bold text-teal-900 bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-200">
                    {progressStats.completedItems} Sub-Capaian Terpilih
                  </span>
                </div>
              </div>

              {/* Toggle Simpan Nilai Semua Jenjang (Lintas Jenjang) */}
              <div className="pt-2.5 border-t border-teal-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-950">
                      Simpan Nilai Semua Jenjang
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-200/80 text-teal-900 border border-teal-300/80">
                      Lintas Jenjang
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-900/80 leading-relaxed">
                    Aktifkan agar capaian materi dapat disimpan ke seluruh santri terpilih, meskipun materi berasal dari jenjang berbeda.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={applyToAllGenerations}
                  onClick={() => setApplyToAllGenerations((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 self-start sm:self-auto ${
                    applyToAllGenerations ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                  title={applyToAllGenerations ? 'Mode Lintas Jenjang Aktif' : 'Aktifkan Mode Lintas Jenjang'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      applyToAllGenerations ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : (
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
                    <div
                      className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 border transition-all ${
                        currentStudent && evaluatedStudentIds.includes(currentStudent.id)
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                          : 'bg-teal-50 text-teal-700 border-teal-200/60'
                      }`}
                    >
                      {currentStudent && evaluatedStudentIds.includes(currentStudent.id) ? (
                        <Check className="w-4 h-4 stroke-[2.5] text-emerald-700" />
                      ) : currentStudent?.fullName ? (
                        currentStudent.fullName.charAt(0).toUpperCase()
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
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
                          const isEvaluated = evaluatedStudentIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setIsStudentDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer group ${isSelected
                                ? 'bg-teal-50/80 text-teal-900 border-l-4 border-teal-600'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div
                                  className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition-all ${
                                    isEvaluated
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 shadow-2xs'
                                      : isSelected
                                      ? 'bg-teal-600 text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 group-hover:border-slate-300'
                                    }`}
                                  title={isEvaluated ? 'Santri sudah dinilai pada sesi ini' : undefined}
                                >
                                  {isEvaluated ? (
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                  ) : (
                                    s.fullName.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className={`text-xs truncate ${isSelected ? 'font-bold text-teal-900' : 'font-semibold text-slate-800'}`}>
                                      {s.fullName}
                                    </p>
                                    {isEvaluated && (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                        Dinilai
                                      </span>
                                    )}
                                  </div>
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
          )}

          {/* 3. Penilaian Target Capaian Materi (Kurikulum Sesi - Accordion) */}
          <div className="space-y-3">
            <div className="flex flex-col min-[720px]:flex-row min-[720px]:items-center justify-between gap-2 border-t border-slate-200 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Target Capaian Pembelajaran Santri
                </h4>
              </div>
              <div className='flex flex-row gap-2 justify-between'>
                <div className="flex items-center gap-2">
                  {/* Menu Popover Cakupan Materi (5 Opsi) */}
                  <div className="relative" ref={filterScopeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFilterScopeDropdownOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer bg-white hover:bg-slate-50 border-slate-200"
                      title="Klik untuk memilih cakupan materi"
                    >
                      <Filter className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="text-teal-800">
                        {materialFilterScope === 'ALL' && `Semua(${scopeCounts.ALL})`}
                        {materialFilterScope === 'GENERATION' && `Jenjang(${scopeCounts.GENERATION})`}
                        {materialFilterScope === 'MONTHLY' && `Bulanan(${scopeCounts.MONTHLY})`}
                        {materialFilterScope === 'SCHEDULED' && `Jadwal(${scopeCounts.SCHEDULED})`}
                        {materialFilterScope === 'ADDITIONAL' && `Tambahan(${scopeCounts.ADDITIONAL})`}
                      </span>
                      <ChevronDown
                        className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                          isFilterScopeDropdownOpen ? 'rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </button>

                    {/* Popover / Tooltip Menu Cakupan Materi */}
                    {isFilterScopeDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-40 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900">
                              Cakupan Materi
                            </span>
                            <p className="text-[10px] text-slate-500">
                              Pilih materi yang ingin ditampilkan di lembar kerja
                            </p>
                          </div>
                        </div>
                        <div className="pt-1 space-y-1">
                          {/* 1. Semua */}
                          <button
                            type="button"
                            onClick={() => handleSelectScope('ALL')}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                              materialFilterScope === 'ALL'
                                ? 'bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${materialFilterScope === 'ALL' ? 'text-teal-900' : 'text-slate-900'}`}>
                                  Semua
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  materialFilterScope === 'ALL' ? 'bg-teal-200/70 text-teal-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {scopeCounts.ALL}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Semua materi semua jenjang
                              </p>
                            </div>
                            {materialFilterScope === 'ALL' && (
                              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* 2. Jenjang */}
                          <button
                            type="button"
                            onClick={() => handleSelectScope('GENERATION')}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                              materialFilterScope === 'GENERATION'
                                ? 'bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${materialFilterScope === 'GENERATION' ? 'text-teal-900' : 'text-slate-900'}`}>
                                  Jenjang
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  materialFilterScope === 'GENERATION' ? 'bg-teal-200/70 text-teal-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {scopeCounts.GENERATION}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Semua materi sesuai jenjang santri yang dipilih ({currentStudent?.generationName || 'Santri'})
                              </p>
                            </div>
                            {materialFilterScope === 'GENERATION' && (
                              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* 3. Bulanan */}
                          <button
                            type="button"
                            onClick={() => handleSelectScope('MONTHLY')}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                              materialFilterScope === 'MONTHLY'
                                ? 'bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${materialFilterScope === 'MONTHLY' ? 'text-teal-900' : 'text-slate-900'}`}>
                                  Bulanan
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  materialFilterScope === 'MONTHLY' ? 'bg-teal-200/70 text-teal-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {scopeCounts.MONTHLY}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Semua materi yang terdaftar dalam bulan ini sesuai jenjang santri yang dipilih
                              </p>
                            </div>
                            {materialFilterScope === 'MONTHLY' && (
                              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* 4. Jadwal */}
                          <button
                            type="button"
                            onClick={() => handleSelectScope('SCHEDULED')}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                              materialFilterScope === 'SCHEDULED'
                                ? 'bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${materialFilterScope === 'SCHEDULED' ? 'text-teal-900' : 'text-slate-900'}`}>
                                  Jadwal
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  materialFilterScope === 'SCHEDULED' ? 'bg-teal-200/70 text-teal-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {scopeCounts.SCHEDULED}
                                </span>
                                <span className="text-[9px] font-bold text-teal-700 bg-teal-100 px-1 rounded">
                                  Default
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Semua materi yang terdaftar dalam bulan ini + materi tambahan/umum dalam sesi tersebut
                              </p>
                            </div>
                            {materialFilterScope === 'SCHEDULED' && (
                              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* 5. Tambahan */}
                          <button
                            type="button"
                            onClick={() => handleSelectScope('ADDITIONAL')}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2.5 cursor-pointer ${
                              materialFilterScope === 'ADDITIONAL'
                                ? 'bg-teal-50 border border-teal-200 text-teal-950 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold ${materialFilterScope === 'ADDITIONAL' ? 'text-teal-900' : 'text-slate-900'}`}>
                                  Tambahan
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                  materialFilterScope === 'ADDITIONAL' ? 'bg-teal-200/70 text-teal-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {scopeCounts.ADDITIONAL}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                                Semua materi tambahan/umum dalam sesi tersebut
                              </p>
                            </div>
                            {materialFilterScope === 'ADDITIONAL' && (
                              <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buka / Tutup Accordion */}
                  {filteredMaterials.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedMaterialIds.length > 0) {
                          setExpandedMaterialIds([]);
                        } else if (filteredMaterials.length > 0) {
                          setExpandedMaterialIds([filteredMaterials[0].id]);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50/70 hover:bg-teal-50 px-2 min-[400px]:px-3 py-1.5 rounded-lg border border-teal-200/60 shadow-2xs transition-colors cursor-pointer"
                      title={expandedMaterialIds.length > 0 ? 'Tutup Materi' : 'Buka Materi'}
                      aria-label={expandedMaterialIds.length > 0 ? 'Tutup Materi' : 'Buka Materi'}
                    >
                      {expandedMaterialIds.length > 0 ? (
                        <Book className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="hidden min-[400px]:inline">
                        {expandedMaterialIds.length > 0
                          ? 'Tutup Materi'
                          : 'Buka Materi'}
                      </span>
                    </button>
                  )}
                </div>
                <div>
                  {/* Tombol Mode Penilaian Massal (SlidersHorizontal) */}
                  <div className="relative" ref={bulkDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsBulkDropdownOpen((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border shadow-2xs transition-all cursor-pointer select-none ${isBulkMode
                        ? 'bg-teal-600 text-white border-teal-700 ring-2 ring-teal-500/20 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      title={
                        isBulkMode
                          ? `Mode Massal Aktif (${bulkSelectedStudentIds.length} santri). Klik untuk opsi.`
                          : 'Mode Penilaian Massal (Beri nilai ke beberapa/semua santri)'
                      }
                    >
                      <List className={`w-3.5 h-3.5 ${isBulkMode ? 'text-white' : 'text-teal-600'} shrink-0`} />
                      <span className="hidden sm:inline">
                        {isBulkMode ? `Massal (${bulkSelectedStudentIds.length})` : 'Mode Massal'}
                      </span>
                      {isBulkMode && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse sm:hidden" />
                      )}
                    </button>

                    {/* Tooltip dengan 2 Pilihan */}
                    {isBulkDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 p-2 space-y-1 animate-fade-in divide-y divide-slate-100">
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                              <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
                              Penilaian Massal
                            </span>
                            {isBulkMode && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-teal-100 text-teal-800">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Tentukan santri yang akan dinilai bersamaan dalam satu submit
                          </p>
                        </div>

                        <div className="pt-1.5 space-y-1">
                          {/* Pilihan 1: Pilih Semua */}
                          <button
                            type="button"
                            onClick={() => {
                              setBulkSelectedStudentIds(students.map((s) => s.id));
                              setIsBulkMode(true);
                              setIsBulkDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${isBulkMode && bulkSelectedStudentIds.length === students.length && students.length > 0
                              ? 'bg-teal-50 border border-teal-200/80 text-teal-950'
                              : 'hover:bg-slate-50 text-slate-800'
                              }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                              <CheckCheck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">Pilih Semua</span>
                                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                  {students.length} Santri
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                Nilai sekaligus untuk semua santri yang hadir dalam 1x submit
                              </p>
                            </div>
                          </button>

                          {/* Pilihan 2: Pilih Beberapa */}
                          <button
                            type="button"
                            onClick={() => {
                              setModalSelectedStudentIds(
                                isBulkMode && bulkSelectedStudentIds.length > 0
                                  ? [...bulkSelectedStudentIds]
                                  : students.map((s) => s.id)
                              );
                              setIsBulkDropdownOpen(false);
                              setIsBulkStudentModalOpen(true);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${isBulkMode && bulkSelectedStudentIds.length < students.length && bulkSelectedStudentIds.length > 0
                              ? 'bg-teal-50 border border-teal-200/80 text-teal-950'
                              : 'hover:bg-slate-50 text-slate-800'
                              }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">Pilih Beberapa</span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  Custom
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                Pilih daftar santri yang hadir untuk dinilai bersamaan
                              </p>
                            </div>
                          </button>
                        </div>

                        {/* Akses Cepat Pilih Semua Santri Per Jenjang (Khusus Jenjang dengan Santri Aktif > 1) */}
                        {bulkGenerationQuickOptions.length > 0 && (
                          <div className="pt-1.5 space-y-1">
                            <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                              <span>Pilih Per Jenjang</span>
                              <span className="text-[9px] font-medium text-slate-400 lowercase">&gt; 1 santri</span>
                            </div>
                            <div className="space-y-0.5 max-h-36 overflow-y-auto">
                              {bulkGenerationQuickOptions.map((gen) => {
                                const isSelected =
                                  isBulkMode &&
                                  gen.studentIds.length === bulkSelectedStudentIds.length &&
                                  gen.studentIds.every((id) => bulkSelectedStudentIds.includes(id));

                                return (
                                  <button
                                    key={gen.id}
                                    type="button"
                                    onClick={() => {
                                      setBulkSelectedStudentIds(gen.studentIds);
                                      setIsBulkMode(true);
                                      setIsBulkDropdownOpen(false);
                                    }}
                                    className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-teal-50 border border-teal-200/80 text-teal-950 font-bold'
                                        : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <GraduationCap className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                      <span className="text-xs truncate">{gen.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50/80 px-1.5 py-0.2 rounded border border-teal-200 shrink-0">
                                      {gen.studentIds.length} Santri
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tombol Matikan Mode Massal jika sedang aktif */}
                        {isBulkMode && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsBulkMode(false);
                                setBulkSelectedStudentIds([]);
                                setApplyToAllGenerations(false);
                                setIsBulkDropdownOpen(false);
                              }}
                              className="w-full text-center py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Matikan Mode Massal (Nilai Per Santri)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Input Pencarian Materi (Aktif di Semua Mode) & Tombol Filter Lanjutan */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {/* Kolom Pencarian */}
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                    {isLoadingMore || isSearching ? (
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
                      materialFilterScope === 'SCHEDULED'
                        ? 'Cari materi jadwal sesi...'
                        : materialFilterScope === 'MONTHLY'
                        ? 'Cari materi bulanan...'
                        : materialFilterScope === 'ADDITIONAL'
                        ? 'Cari materi tambahan...'
                        : materialFilterScope === 'GENERATION'
                        ? `Cari materi ${currentStudent?.generationName || 'jenjang'}...`
                        : 'Cari semua materi kurikulum...'
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

                {/* Tombol Filter Lanjutan (Modal Besar: Jenjang, Bulan, Status) */}
                <button
                  type="button"
                  onClick={openAdvancedFilterModal}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
                    totalActiveAdvancedFilters > 0
                      ? 'bg-teal-50 border-teal-300 text-teal-800 font-bold'
                      : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  }`}
                  title="Filter materi berdasarkan jenjang, bulan, dan status penilaian"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="hidden sm:inline">Filter</span>
                  {totalActiveAdvancedFilters > 0 && (
                    <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-extrabold bg-teal-600 text-white">
                      {totalActiveAdvancedFilters}
                    </span>
                  )}
                </button>
              </div>

              {/* Tag / Chip Filter Lanjutan Aktif */}
              {totalActiveAdvancedFilters > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Filter:
                  </span>
                  {activeGenFilterIds.map((genId) => {
                    const genName = availableGenerations.find((g) => g.id === genId)?.name || 'Jenjang';
                    return (
                      <span
                        key={genId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                      >
                        <span>{genName}</span>
                        <button
                          type="button"
                          onClick={() => setActiveGenFilterIds((prev) => prev.filter((id) => id !== genId))}
                          className="hover:text-teal-950 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}

                  {activeMonthFilters.map((mNum) => (
                    <span
                      key={mNum}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200"
                    >
                      <span>{MONTH_NAMES[mNum - 1]}</span>
                      <button
                        type="button"
                        onClick={() => setActiveMonthFilters((prev) => prev.filter((m) => m !== mNum))}
                        className="hover:text-blue-950 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {activeStatusFilters.map((st) => {
                    const label =
                      st === 'NOT_STARTED'
                        ? 'Belum Dinilai'
                        : st === 'IN_PROGRESS'
                        ? 'Proses'
                        : 'Tuntas';
                    return (
                      <span
                        key={st}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => setActiveStatusFilters((prev) => prev.filter((s) => s !== st))}
                          className="hover:text-amber-950 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleClearAllActiveFilters}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer ml-1"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>

            {filteredMaterials.length === 0 ? (
              isLoadingMode ? (
                <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">Memuat materi kurikulum...</p>
                </div>
              ) : (
                <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/80 border border-dashed border-slate-200 text-center space-y-2">
                  {materialFilterMode === 'SCHEDULED' && currentStudent?.generationName && !debouncedSearch ? (
                    <div className="space-y-2 py-1">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto border border-teal-200/60">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Belum ada materi terjadwal khusus jenjang {currentStudent.generationName} pada sesi ini
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                        Jadwal ini merupakan jadwal gabungan. Anda dapat membuka target kurikulum jenjang {currentStudent.generationName} untuk mengisi capaian santri ini.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setMaterialFilterMode('GENERATION');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Buka Kurikulum {currentStudent.generationName}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMaterialFilterMode('ALL');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          Lihat Semua Materi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-bold text-slate-700">
                        {materialSearchQuery
                          ? `Tidak ada materi yang cocok dengan "${materialSearchQuery}"`
                          : totalActiveAdvancedFilters > 0
                          ? 'Tidak ada materi yang cocok dengan kombinasi filter yang dipilih.'
                          : 'Belum ada materi kurikulum aktif yang terdaftar.'}
                      </p>
                      {materialSearchQuery || totalActiveAdvancedFilters > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMaterialSearchQuery('');
                            setDebouncedSearch('');
                            handleClearAllActiveFilters();
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
                    </>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3">
                {filteredMaterials.map((mat) => {
                  const items = [...mat.checklistItems].sort((a, b) => {
                    const aPlanned = plannedChecklistItemIds.includes(a.id) ? 1 : 0;
                    const bPlanned = plannedChecklistItemIds.includes(b.id) ? 1 : 0;
                    if (aPlanned !== bPlanned) return bPlanned - aPlanned;
                    return a.orderIndex - b.orderIndex;
                  });
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

                  const hasPlannedItems = mat.checklistItems.some((item) =>
                    plannedChecklistItemIds.includes(item.id)
                  );
                  const plannedItemsCount = mat.checklistItems.filter((item) =>
                    plannedChecklistItemIds.includes(item.id)
                  ).length;

                  return (
                    <div
                      key={mat.id}
                      className={`rounded-2xl border shadow-2xs overflow-hidden transition-all duration-200 ${
                        hasPlannedItems
                          ? 'border-indigo-200/90 bg-indigo-50/20'
                          : 'border-slate-200/80 bg-white'
                      }`}
                    >
                      {/* Material Accordion Header */}
                      <div
                        onClick={() => toggleMaterialAccordion(mat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleMaterialAccordion(mat.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        className={`w-full text-left p-3.5 sm:p-4 transition-colors flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none ${
                          hasPlannedItems
                            ? 'bg-gradient-to-r from-indigo-50/70 via-slate-50 to-teal-50/30 hover:from-indigo-100/70 hover:to-teal-50/50'
                            : 'bg-gradient-to-r from-slate-50 to-teal-50/30 hover:from-slate-100/80 hover:to-teal-50/60'
                        } ${isExpanded ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-2.5 sm:gap-3">


                          <div className="min-w-0 flex-1 space-y-1">
                            {/* Judul Materi & Sasaran Audience */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                                {mat.title}
                              </h5>
                              {isBulkMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAudienceTooltipMatId(
                                      openAudienceTooltipMatId === mat.id ? null : mat.id
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded-lg border text-[10px] sm:text-[11px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 ${
                                    openAudienceTooltipMatId === mat.id
                                      ? 'bg-teal-700 text-white border-teal-800 ring-2 ring-teal-500/20'
                                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                  title="Info Sasaran Santri Materi Ini"
                                >
                                  <Users className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span>Sasaran</span>
                                </button>
                              )}
                            </div>

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
                              {hasPlannedItems && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 px-2 py-0.5 rounded-md shadow-2xs inline-flex items-center gap-1">
                                  {plannedItemsCount} Prioritas
                                </span>
                              )}
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
                      </div>

                      {/* Checklist Sub-Capaian Items (Accordion Content - Bounded Scroll Container) */}
                      {isExpanded && (
                        <div className="p-3 sm:p-4 divide-y divide-slate-100 space-y-3 bg-white animate-fade-in max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1.5 sm:pr-2 overscroll-contain">
                          {items.map((item) => {
                            const itemStatus = getItemStatus(item.id);
                            const state = targetProgressMap[item.id] || {
                              isCompleted: itemStatus === 'COMPLETED',
                              score: 85,
                              teacherFeedback: '',
                              pointsWeight: item.pointsWeight || 10,
                            };
                            const studentDetails = getItemStudentStatusDetails(mat, item.id);

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
                                        {plannedChecklistItemIds.includes(item.id) && (
                                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1 shadow-2xs">
                                            Prioritas
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Status Switcher Button & Detail Popover */}
                                    <div className="shrink-0 flex items-center gap-1.5">
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
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleCycleItemStatus(item.id, mat, item.completionTierLevel)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                              itemStatus === 'COMPLETED'
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                                                : itemStatus === 'IN_PROGRESS'
                                                ? 'bg-amber-500 text-white hover:bg-amber-600 border border-amber-600'
                                                : itemStatus === 'MIXED'
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700'
                                                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}
                                          >
                                            {itemStatus === 'COMPLETED' ? (
                                              <>
                                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Tuntas</span>
                                              </>
                                            ) : itemStatus === 'IN_PROGRESS' ? (
                                              <>
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>Proses</span>
                                              </>
                                            ) : itemStatus === 'MIXED' ? (
                                              <>
                                                <Sparkles className="w-3.5 h-3.5" />
                                                <span>Perbarui</span>
                                              </>
                                            ) : (
                                              <>
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{isBulkMode ? 'Belum Dinilai' : 'Belum Tuntas'}</span>
                                              </>
                                            )}
                                          </button>

                                          {/* Tombol Pembatalan: Icon ↺ saja di kanan tombol switch status capaian */}
                                          {isBulkMode && isItemInitiallyMixed(item.id) && targetProgressMap[item.id]?.isModifiedSession && (
                                            <button
                                              type="button"
                                              onClick={() => handleResetItemToMixed(item.id)}
                                              className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center shrink-0"
                                              title="Kembalikan ke kondisi awal bervariasi (Perbarui)"
                                              aria-label="Kembalikan ke kondisi awal bervariasi (Perbarui)"
                                            >
                                              <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                          )}

                                          {/* Mode Massal: Ikon Profil Santri untuk Modal/Tooltip Status Tiap Santri */}
                                          {isBulkMode && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenItemDetailTooltipId(
                                                  openItemDetailTooltipId === item.id ? null : item.id
                                                );
                                              }}
                                              className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center ${
                                                openItemDetailTooltipId === item.id
                                                  ? 'bg-teal-700 text-white border-teal-800 ring-2 ring-teal-500/20'
                                                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                              }`}
                                              title="Lihat status santri pada capaian ini"
                                            >
                                              <User className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </>
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

                                {/* Badge Informatif Status Mode Massal - Tepat di Bawah Deskripsi Capaian & Di Atas Form */}
                                {isBulkMode && (() => {
                                  const prevCompletedCount = studentDetails.completed.filter((c) => !c.isJustModified).length;
                                  const justCompletedCount = studentDetails.completed.filter((c) => c.isJustModified).length;
                                  const pendingCount = studentDetails.notStarted.length + studentDetails.inProgress.length;

                                  if (itemStatus === 'MIXED') {
                                    const completedCount = studentDetails.completed.length;
                                    return (
                                      <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-[11px] text-indigo-950 flex items-center gap-2 animate-fade-in mt-1">
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        <span className="leading-snug">
                                          Kondisi bervariasi: <strong>{completedCount} santri sudah tuntas (nilai tetap)</strong> • <strong>{pendingCount} santri belum tuntas</strong>
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (itemStatus === 'COMPLETED') {
                                    const targetUpdatingCount = justCompletedCount > 0 ? justCompletedCount : studentDetails.completed.length;
                                    return (
                                      <div className="p-2 rounded-xl bg-teal-50/80 border border-teal-200/80 text-[11px] text-teal-900 flex items-center gap-2 animate-fade-in mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                                        <span className="leading-snug">
                                          Berlaku untuk <strong>{targetUpdatingCount} santri (Tuntas)</strong>
                                          {prevCompletedCount > 0 && (
                                            <>
                                              {' • '}
                                              <strong>{prevCompletedCount} santri sudah tuntas sebelumnya tidak diubah</strong>
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (itemStatus === 'IN_PROGRESS') {
                                    const targetUpdatingCount = studentDetails.inProgress.length;
                                    return (
                                      <div className="p-2 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2 animate-fade-in mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                                        <span className="leading-snug">
                                          Berlaku untuk <strong>{targetUpdatingCount} santri (Proses)</strong>
                                          {prevCompletedCount > 0 && (
                                            <>
                                              {' • '}
                                              <strong>{prevCompletedCount} santri sudah tuntas sebelumnya tidak diubah</strong>
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (itemStatus === 'NOT_STARTED' && (prevCompletedCount > 0 || targetProgressMap[item.id]?.isModifiedSession)) {
                                    const targetUpdatingCount = studentDetails.notStarted.length;
                                    return (
                                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-center gap-2 animate-fade-in mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                                        <span className="leading-snug">
                                          Berlaku untuk <strong>{targetUpdatingCount} santri (Belum Dinilai)</strong>
                                          {prevCompletedCount > 0 && (
                                            <>
                                              {' • '}
                                              <strong>{prevCompletedCount} santri sudah tuntas sebelumnya tidak diubah</strong>
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    );
                                  }

                                  return null;
                                })()}

                                {/* Penilaian Capaian & Catatan Khusus Sesuai Status */}
                                {itemStatus === 'COMPLETED' && (
                                  <div className="p-3 rounded-xl bg-slate-50/90 border border-teal-200/60 space-y-2.5 animate-fade-in">
                                    {/* Baris 1: Penilaian Capaian (Skor Nilai) */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
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
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                                state.score === s
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

                                {itemStatus === 'IN_PROGRESS' && (
                                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-2 animate-fade-in">
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Catatan Kemajuan / Estafet Sesi Berikutnya:</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={state.teacherFeedback}
                                        onChange={(e) => handleItemFeedbackChange(item.id, e.target.value)}
                                        placeholder="Contoh: Sudah membaca sampai ayat 15, makhraj 'ain perlu diperhatikan..."
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
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

          {/* 6. Catatan Umum Guru dengan Toggle Switch */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tambahkan Catatan Untuk Orang Tua
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={showTeacherNote || !!teacherNote}
                onClick={() => setShowTeacherNote((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${
                  showTeacherNote || !!teacherNote ? 'bg-teal-600' : 'bg-slate-300'
                }`}
                title={showTeacherNote || !!teacherNote ? 'Sembunyikan Catatan' : 'Tulis Catatan'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showTeacherNote || !!teacherNote ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {(showTeacherNote || !!teacherNote) && (
              <textarea
                rows={2}
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="Tuliskan catatan umum untuk buku penghubung dengan orang tua..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors animate-fade-in"
              />
            )}
          </div>

          {/* 6.b Catatan Serah-Terima Sesi Ini (Handover Ustadz Berikutnya) dengan Toggle Switch */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Tambahkan Catatan Untuk Pengajar Berikutnya
                </label>
              </div>
              <div className="flex items-center gap-2">
                {(showHandoverNote || !!teachingSummaryNotes) && (
                  <button
                    type="button"
                    onClick={handleSaveHandoverNotes}
                    disabled={isSavingHandover}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-white hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    {isSavingHandover ? 'Menyimpan...' : 'Simpan Handover'}
                  </button>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={showHandoverNote || !!teachingSummaryNotes}
                  onClick={() => setShowHandoverNote((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 ${
                    showHandoverNote || !!teachingSummaryNotes ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                  title={showHandoverNote || !!teachingSummaryNotes ? 'Sembunyikan Catatan Handover' : 'Tulis Catatan Handover'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      showHandoverNote || !!teachingSummaryNotes ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {(showHandoverNote || !!teachingSummaryNotes) && (
              <div className="space-y-2 animate-fade-in pt-1">
                <textarea
                  rows={2}
                  value={teachingSummaryNotes}
                  onChange={(e) => setTeachingSummaryNotes(e.target.value)}
                  placeholder="Tuliskan materi/halaman terakhir yang diajarkan, catatan pemahaman santri, atau arahan untuk pengajar sesi berikutnya..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-teal-200/80 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                />
                {handoverSuccessMessage && (
                  <p className="text-[11px] font-semibold text-emerald-700 animate-fade-in">
                    ✓ {handoverSuccessMessage}
                  </p>
                )}
              </div>
            )}
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
            disabled={isSubmitting || (isBulkMode && bulkSelectedStudentIds.length === 0)}
            className={`w-full py-3 rounded-xl text-white text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${isBulkMode
              ? 'bg-teal-700 hover:bg-teal-800 shadow-teal-700/20'
              : 'bg-teal-600 hover:bg-teal-700'
              }`}
          >
            <Send className="w-4 h-4" />
            <span>
              {isSubmitting
                ? isBulkMode
                  ? `Menyimpan Penilaian ${bulkSelectedStudentIds.length} Santri...`
                  : 'Menyimpan Penilaian...'
                : isBulkMode
                  ? `Simpan Penilaian Massal (${bulkSelectedStudentIds.length} Santri)`
                  : `Simpan Penilaian & Target Capaian`}
            </span>
          </button>

          {/* Floating Toast Notification for Status Updates */}
          {bulkActionToast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div
                className={`px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 border ${
                  bulkActionToast.type === 'success'
                    ? 'bg-emerald-900/95 text-white border-emerald-700/80'
                    : 'bg-slate-900/95 text-white border-slate-700/80'
                }`}
              >
                <span>{bulkActionToast.message}</span>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Modal Bawah / Dialog Pilih Santri Hadir (Mode Penilaian Massal) */}
      {mounted && isBulkStudentModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkStudentModalOpen(false);
          }}
        >
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
            {/* Drag handle (Mobile) */}
            <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Header Modal */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs border border-teal-200/60">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Pilih Santri yang Hadir
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Centang santri yang akan dinilai bersamaan dengan nilai yang sama
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkStudentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Toolbar Search & Filter Jenjang & Select All */}
            <div className="flex-shrink-0 p-3.5 bg-slate-50 border-b border-slate-100 space-y-2.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={modalStudentSearch}
                  onChange={(e) => setModalStudentSearch(e.target.value)}
                  placeholder="Cari nama santri, generasi, kelas..."
                  className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
                />
                {modalStudentSearch && (
                  <button
                    type="button"
                    onClick={() => setModalStudentSearch('')}
                    className="absolute right-2.5 p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Pills Jenjang / Kelas */}
              {modalAvailableGenerations.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setModalGenFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      modalGenFilter === 'ALL'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Semua Jenjang ({students.length})
                  </button>
                  {modalAvailableGenerations.map((gen) => {
                    const count = students.filter((s) => (s.generationId || 'NO_GEN') === gen.id).length;
                    return (
                      <button
                        key={gen.id}
                        type="button"
                        onClick={() => setModalGenFilter(gen.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          modalGenFilter === gen.id
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {gen.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = modalFilteredStudents.map((s) => s.id);
                      setModalSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
                    }}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                  >
                    Pilih Semua di Tampilan ({modalFilteredStudents.length})
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = new Set(modalFilteredStudents.map((s) => s.id));
                      setModalSelectedStudentIds((prev) => prev.filter((id) => !visibleIds.has(id)));
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Hapus Pilihan di Tampilan
                  </button>
                </div>
                <span className="text-[11px] font-extrabold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-lg shrink-0">
                  {modalSelectedStudentIds.length} Dipilih
                </span>
              </div>
            </div>

            {/* List Santri (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-slate-100">
              {modalFilteredStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 space-y-1">
                  <UserX className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700">Santri tidak ditemukan</p>
                  <p className="text-[11px] text-slate-400">
                    Tidak ada santri yang cocok dengan kata kunci pencarian
                  </p>
                </div>
              ) : (
                modalFilteredStudents.map((s) => {
                  const isChecked = modalSelectedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setModalSelectedStudentIds((prev) =>
                          isChecked
                            ? prev.filter((id) => id !== s.id)
                            : [...prev, s.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${isChecked
                        ? 'bg-teal-50/70 hover:bg-teal-50'
                        : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors border shrink-0 ${isChecked
                            ? 'bg-teal-600 border-teal-600 text-white shadow-2xs'
                            : 'border-slate-300 bg-white'
                            }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200/60">
                          {s.fullName.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isChecked ? 'text-teal-950' : 'text-slate-900'}`}>
                            {s.fullName}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            <span>{s.generationName || 'Santri'}</span>
                            {s.className && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold text-[9px] border border-slate-200/80">
                                {s.className}
                              </span>
                            )}
                            <span>•</span>
                            <span className="text-teal-700 font-medium">Masuk {s.checkInTime || 'Hadir'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Modal Actions */}
            <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setIsBulkStudentModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={modalSelectedStudentIds.length === 0}
                onClick={() => {
                  if (modalSelectedStudentIds.length === 0) return;
                  setBulkSelectedStudentIds([...modalSelectedStudentIds]);
                  setIsBulkMode(true);
                  setIsBulkStudentModalOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Terapkan ({modalSelectedStudentIds.length} Santri)</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Besar Filter Lanjutan (Jenjang, Bulan, Status) */}
      {mounted && isAdvancedFilterModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAdvancedFilterModalOpen(false);
          }}
        >
          <div className="bg-white w-full sm:max-w-xl md:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] sm:max-h-[82vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 overflow-hidden">
            {/* Drag handle for mobile */}
            <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Header Modal */}
            <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center font-bold text-sm border border-teal-200/60">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Filter Materi Pembelajaran
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Saring materi berdasarkan jenjang, bulan, dan status penilaian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedFilterModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs di Bagian Atas */}
            <div className="flex-shrink-0 px-4 pt-2 border-b border-slate-200 bg-slate-50/80 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setAdvancedFilterActiveTab('JENJANG')}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  advancedFilterActiveTab === 'JENJANG'
                    ? 'border-teal-600 text-teal-900 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-teal-600" />
                <span>Jenjang ({draftGenFilterIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setAdvancedFilterActiveTab('BULAN')}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  advancedFilterActiveTab === 'BULAN'
                    ? 'border-teal-600 text-teal-900 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <Calendar className="w-4 h-4 text-teal-600" />
                <span>Bulan ({draftMonthFilters.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setAdvancedFilterActiveTab('STATUS')}
                className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  advancedFilterActiveTab === 'STATUS'
                    ? 'border-teal-600 text-teal-900 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Status ({draftStatusFilters.length})</span>
              </button>
            </div>

            {/* Modal Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Tab 1: JENJANG */}
              {advancedFilterActiveTab === 'JENJANG' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-800">
                      Pilih Jenjang / Generasi Santri:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftGenFilterIds(availableGenerations.map((g) => g.id))}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setDraftGenFilterIds([])}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableGenerations.map((gen) => {
                      const isChecked = draftGenFilterIds.includes(gen.id);
                      const isCurrentStudentGen = currentStudent?.generationId === gen.id;
                      return (
                        <div
                          key={gen.id}
                          onClick={() => {
                            setDraftGenFilterIds((prev) =>
                              prev.includes(gen.id)
                                ? prev.filter((id) => id !== gen.id)
                                : [...prev, gen.id]
                            );
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-teal-50/80 border-teal-300 ring-1 ring-teal-500/20 text-teal-950 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold">{gen.name}</span>
                              {isCurrentStudentGen && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                                  Jenjang Santri
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isChecked
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: BULAN */}
              {advancedFilterActiveTab === 'BULAN' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Pilih Target Bulan Pembelajaran:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftMonthFilters([currentMonth])}
                        className="text-[11px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200 transition-colors cursor-pointer"
                      >
                        Bulan Ini ({MONTH_NAMES[currentMonth - 1]})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftMonthFilters([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                      >
                        Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setDraftMonthFilters([])}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {MONTH_NAMES.map((name, index) => {
                      const monthNum = index + 1;
                      const isChecked = draftMonthFilters.includes(monthNum);
                      const isNow = monthNum === currentMonth;

                      return (
                        <div
                          key={monthNum}
                          onClick={() => {
                            setDraftMonthFilters((prev) =>
                              prev.includes(monthNum)
                                ? prev.filter((m) => m !== monthNum)
                                : [...prev, monthNum]
                            );
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isChecked
                              ? 'bg-teal-50/90 border-teal-300 ring-1 ring-teal-500/20 text-teal-950 font-bold shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs">{name}</span>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isChecked
                                  ? 'bg-teal-600 border-teal-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                          {isNow && (
                            <div className="mt-1">
                              <span className="text-[9px] font-bold text-teal-700 bg-teal-100/70 px-1.5 py-0.2 rounded">
                                Bulan Ini
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: STATUS */}
              {advancedFilterActiveTab === 'STATUS' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-800">
                      Pilih Status Penilaian Santri:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftStatusFilters(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setDraftStatusFilters([])}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Status 1: Belum Dinilai */}
                    {(() => {
                      const isChecked = draftStatusFilters.includes('NOT_STARTED');
                      return (
                        <div
                          onClick={() => {
                            setDraftStatusFilters((prev) =>
                              prev.includes('NOT_STARTED')
                                ? prev.filter((s) => s !== 'NOT_STARTED')
                                : [...prev, 'NOT_STARTED']
                            );
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-slate-100/80 border-slate-400 text-slate-900 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Circle className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">Belum Dinilai</span>
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                                  Belum Dimulai
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Materi belum ada catatan penilaian santri atau checklist belum tersentuh
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isChecked
                                ? 'bg-slate-800 border-slate-800 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Status 2: Proses */}
                    {(() => {
                      const isChecked = draftStatusFilters.includes('IN_PROGRESS');
                      return (
                        <div
                          onClick={() => {
                            setDraftStatusFilters((prev) =>
                              prev.includes('IN_PROGRESS')
                                ? prev.filter((s) => s !== 'IN_PROGRESS')
                                : [...prev, 'IN_PROGRESS']
                            );
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 text-blue-950 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                              <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">Proses</span>
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  Berjalan
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Materi sebagian tuntas atau ada catatan guru tapi belum tuntas 100%
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Status 3: Tuntas */}
                    {(() => {
                      const isChecked = draftStatusFilters.includes('COMPLETED');
                      return (
                        <div
                          onClick={() => {
                            setDraftStatusFilters((prev) =>
                              prev.includes('COMPLETED')
                                ? prev.filter((s) => s !== 'COMPLETED')
                                : [...prev, 'COMPLETED']
                            );
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">Tuntas</span>
                                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Selesai 100%
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Seluruh checklist capaian materi telah berhasil dituntaskan oleh santri
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isChecked
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal: Batal & Terapkan('jumlah opsi filter') */}
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetDraftFilters}
                disabled={totalDraftAdvancedFilters === 0}
                className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  totalDraftAdvancedFilters > 0
                    ? 'text-rose-600 hover:text-rose-700'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pilihan</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdvancedFilterModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleApplyAdvancedFilters}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>
                    {totalDraftAdvancedFilters > 0
                      ? `Terapkan (${totalDraftAdvancedFilters})`
                      : 'Terapkan'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal / Dialog Sasaran Santri Materi (Portal di luar card) */}
      {mounted && activeAudienceMat && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
          onClick={() => setOpenAudienceTooltipMatId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
          >
            {/* Drag handle for mobile */}
            <div className="flex justify-center sm:hidden pb-1 -mt-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            <div className="flex items-start justify-between pb-2.5 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                    {activeAudienceMat.title}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-1 ${
                      !activeAudienceMat.targetGenerationId
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                    }`}
                  >
                    {!activeAudienceMat.targetGenerationId
                      ? 'Materi Tambahan / Umum'
                      : `Jenjang: ${activeAudienceMat.targetGeneration?.name || 'Khusus'}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenAudienceTooltipMatId(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {!activeAudienceMat.targetGenerationId ? (
              <div className="space-y-2.5 text-xs text-slate-600 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/70">
                <p className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  🌐 Berlaku untuk Semua Santri Sesi
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Penilaian materi ini akan diberikan kepada seluruh{' '}
                  <strong className="text-emerald-950 font-bold">{bulkSelectedStudentIds.length} santri terpilih</strong> tanpa
                  memandang jenjang kelas.
                </p>
                <div className="flex flex-wrap gap-1 pt-1 max-h-36 overflow-y-auto">
                  {students
                    .filter((s) => bulkSelectedStudentIds.includes(s.id))
                    .map((s) => (
                      <span
                        key={s.id}
                        className="text-[10px] font-semibold bg-white text-emerald-900 border border-emerald-200/80 px-2 py-0.5 rounded-md shadow-2xs"
                      >
                        {s.fullName}
                      </span>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Sasaran Langsung */}
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/70 space-y-2">
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Sasaran Langsung ({
                      students.filter(
                        (s) =>
                          bulkSelectedStudentIds.includes(s.id) &&
                          s.generationId === activeAudienceMat.targetGenerationId
                      ).length
                    } Santri):
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-0.5">
                    {students
                      .filter(
                        (s) =>
                          bulkSelectedStudentIds.includes(s.id) &&
                          s.generationId === activeAudienceMat.targetGenerationId
                      )
                      .map((s) => (
                        <span
                          key={s.id}
                          className="text-[10px] font-semibold bg-white text-emerald-900 border border-emerald-200/80 px-2 py-0.5 rounded-md shadow-2xs"
                        >
                          {s.fullName}
                        </span>
                      ))}
                    {students.filter(
                      (s) =>
                        bulkSelectedStudentIds.includes(s.id) &&
                        s.generationId === activeAudienceMat.targetGenerationId
                    ).length === 0 && (
                      <span className="text-[11px] text-slate-400 italic">
                        Tidak ada santri terpilih di jenjang ini.
                      </span>
                    )}
                  </div>
                </div>

                {/* Dilewati Otomatis */}
                {students.filter(
                  (s) =>
                    bulkSelectedStudentIds.includes(s.id) &&
                    s.generationId !== activeAudienceMat.targetGenerationId
                ).length > 0 && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                    <p className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Dilewati Otomatis ({
                        students.filter(
                          (s) =>
                            bulkSelectedStudentIds.includes(s.id) &&
                            s.generationId !== activeAudienceMat.targetGenerationId
                        ).length
                      } Santri Jenjang Lain):
                    </p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Santri dari jenjang berbeda tidak akan dinilai atau terpengaruh pada materi ini saat disimpan.
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
                      {students
                        .filter(
                          (s) =>
                            bulkSelectedStudentIds.includes(s.id) &&
                            s.generationId !== activeAudienceMat.targetGenerationId
                        )
                        .map((s) => (
                          <span
                            key={s.id}
                            className="text-[10px] font-medium bg-white text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded"
                          >
                            {s.fullName}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal / Dialog Rincian Status Santri Per Capaian (Portal di luar card) */}
      {mounted && activeItemDetail && (() => {
        const details = getItemStudentStatusDetails(activeItemDetail.mat, activeItemDetail.item.id);
        return createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
            onClick={() => setOpenItemDetailTooltipId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-5 space-y-3 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto"
            >
              {/* Drag handle for mobile */}
              <div className="flex justify-center sm:hidden pb-1 -mt-1">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              <div className="flex items-start justify-between pb-2.5 border-b border-slate-100 gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                    Status Santri: {activeItemDetail.item.itemTitle}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {details.relevantStudents.length} santri dalam cakupan penilaian
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenItemDetailTooltipId(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition-colors cursor-pointer shrink-0 mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Kelompok 1: Tuntas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Tuntas ({details.completed.length})
                  </span>
                </div>
                {details.completed.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic pl-3.5">Belum ada santri tuntas</p>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {details.completed.map(({ student, score, feedback, isJustModified }) => (
                      <div
                        key={student.id}
                        className={`p-2 rounded-xl border text-xs space-y-0.5 ${
                          isJustModified
                            ? 'bg-teal-50/90 border-teal-200 text-teal-950'
                            : 'bg-emerald-50/60 border-emerald-200/70 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-[11px] truncate">{student.fullName}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {isJustModified ? (
                              <span className="text-[9px] font-extrabold bg-teal-600 text-white px-1.5 py-0.2 rounded-full">
                                Baru Diperbarui
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                Sudah Tuntas (Nilai Tetap)
                              </span>
                            )}
                            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                              {score || 85}
                            </span>
                          </div>
                        </div>
                        {feedback && (
                          <p className="text-[10px] text-slate-600 flex items-start gap-1 pl-0.5 italic mt-0.5">
                            <MessageSquare className="w-2.5 h-2.5 text-teal-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{feedback}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kelompok 2: Dalam Proses */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-amber-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Dalam Proses ({details.inProgress.length})
                  </span>
                </div>
                {details.inProgress.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic pl-3.5">Tidak ada santri dalam proses</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {details.inProgress.map(({ student, feedback, isJustModified }) => (
                      <div
                        key={student.id}
                        className={`p-2 rounded-xl border text-xs space-y-0.5 ${
                          isJustModified
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-amber-50/50 border-amber-200/60 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-[11px] truncate">{student.fullName}</span>
                          {isJustModified && (
                            <span className="text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-0.2 rounded-full">
                              Baru Diperbarui
                            </span>
                          )}
                        </div>
                        {feedback && (
                          <p className="text-[10px] text-amber-900 flex items-start gap-1 pl-0.5 italic mt-0.5">
                            <MessageSquare className="w-2.5 h-2.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{feedback}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kelompok 3: Belum Tuntas */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    Belum Tuntas ({details.notStarted.length})
                  </span>
                </div>
                {details.notStarted.length > 0 ? (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {details.notStarted.map(({ student }) => (
                      <span
                        key={student.id}
                        className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                      >
                        {student.fullName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic pl-3.5">Semua santri telah dimulai</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

