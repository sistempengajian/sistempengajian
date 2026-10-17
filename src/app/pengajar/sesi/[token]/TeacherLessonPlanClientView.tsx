'use client';

import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  Loader2,
  Check,
  Award,
  ArrowRight,
  Info,
  ExternalLink,
  Target,
  FileText,
  BadgeCheck,
  X,
  Layers,
} from 'lucide-react';
import {
  togglePlannedChecklistItem,
  saveTeacherBroadcastNote,
  GenerationTabPlan,
  MaterialMetric,
  ChecklistItemMetric,
} from '@/app/pengajar/actions';

interface TeacherLessonPlanClientViewProps {
  token: string;
  schedule: {
    id: string;
    title: string;
    dayDate: string;
    startTime: string;
    endTime: string;
    venuePlaceName: string;
    organizationName: string;
    status: string;
    isCompletedSession: boolean;
    plannedChecklistItemIds: string[];
    teacherBroadcastNote: string;
  };
  teacher: {
    id: string;
    fullName: string;
    isSubstitute: boolean;
    isPrimary: boolean;
  };
  initialTabs: GenerationTabPlan[];
}

export default function TeacherLessonPlanClientView({
  token,
  schedule,
  teacher,
  initialTabs,
}: TeacherLessonPlanClientViewProps) {
  const [tabs, setTabs] = useState<GenerationTabPlan[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(
    initialTabs[0]?.generationId || ''
  );

  // 1. Single Accordion Open State: Hanya satu materi yang terbuka dalam satu waktu
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(
    initialTabs[0]?.materials[0]?.id || null
  );

  const [plannedIds, setPlannedIds] = useState<Set<string>>(
    new Set(schedule.plannedChecklistItemIds || [])
  );

  // 2. Snapshot Urutan Item per Materi saat Accordion Dibuka
  // Item yang direncanakan diposisikan paling atas saat accordion terbuka,
  // dan urutan tetap stabil selama accordion aktif agar tidak membingungkan pengguna.
  const [materialSnapshotOrders, setMaterialSnapshotOrders] = useState<Record<string, string[]>>(() => {
    const initialMap: Record<string, string[]> = {};
    const firstMat = initialTabs[0]?.materials[0];
    if (firstMat) {
      const initialPlannedSet = new Set(schedule.plannedChecklistItemIds || []);
      const sortedIds = [...firstMat.checklistItems]
        .sort((a, b) => {
          const aPlanned = initialPlannedSet.has(a.id) ? 1 : 0;
          const bPlanned = initialPlannedSet.has(b.id) ? 1 : 0;
          if (aPlanned !== bPlanned) return bPlanned - aPlanned;
          return a.orderIndex - b.orderIndex;
        })
        .map((it) => it.id);
      initialMap[firstMat.id] = sortedIds;
    }
    return initialMap;
  });

  // 3. State Tooltip / Popover Rincian Capaian Terpilih
  const [isPlannedSummaryOpen, setIsPlannedSummaryOpen] = useState<boolean>(false);
  const summaryDropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside listener untuk menutup popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        summaryDropdownRef.current &&
        !summaryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsPlannedSummaryOpen(false);
      }
    };
    if (isPlannedSummaryOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlannedSummaryOpen]);

  // Data rincian capaian yang dipilih per materi & jenjang
  const plannedSummaryList = useMemo(() => {
    const list: Array<{
      tabId: string;
      generationName: string;
      materialId: string;
      materialTitle: string;
      selectedCount: number;
      selectedItems: Array<{ id: string; itemTitle: string }>;
    }> = [];

    for (const tab of tabs) {
      for (const mat of tab.materials) {
        const selected = mat.checklistItems.filter((item) => plannedIds.has(item.id));
        if (selected.length > 0) {
          list.push({
            tabId: tab.generationId,
            generationName: tab.generationName,
            materialId: mat.id,
            materialTitle: mat.title,
            selectedCount: selected.length,
            selectedItems: selected.map((it) => ({ id: it.id, itemTitle: it.itemTitle })),
          });
        }
      }
    }

    return list;
  }, [tabs, plannedIds]);

  const [broadcastNote, setBroadcastNote] = useState<string>(
    schedule.teacherBroadcastNote || ''
  );
  const [savedNoteSuccess, setSavedNoteSuccess] = useState<boolean>(false);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Tab yang aktif
  const currentTab = tabs.find((t) => t.generationId === activeTabId) || tabs[0];

  // Toggle Accordion Materi (Single-Open: menutup materi lain saat materi baru dibuka)
  const handleToggleAccordion = (materialId: string) => {
    if (expandedMaterialId === materialId) {
      // Klik pada materi yang sedang terbuka -> tutup accordion
      setExpandedMaterialId(null);
    } else {
      // Buka materi baru -> snapshot urutan capaian dengan item yang dipilih saat ini di paling atas!
      let targetMat: MaterialMetric | undefined;
      for (const tab of tabs) {
        const found = tab.materials.find((m) => m.id === materialId);
        if (found) {
          targetMat = found;
          break;
        }
      }

      if (targetMat) {
        const sortedIds = [...targetMat.checklistItems]
          .sort((a, b) => {
            const aPlanned = plannedIds.has(a.id) ? 1 : 0;
            const bPlanned = plannedIds.has(b.id) ? 1 : 0;
            if (aPlanned !== bPlanned) return bPlanned - aPlanned;
            return a.orderIndex - b.orderIndex;
          })
          .map((it) => it.id);

        setMaterialSnapshotOrders((prev) => ({
          ...prev,
          [materialId]: sortedIds,
        }));
      }

      setExpandedMaterialId(materialId);
    }
  };

  // Pindah Tab Jenjang
  const handleSelectTab = (tabId: string) => {
    setActiveTabId(tabId);
    const targetTab = tabs.find((t) => t.generationId === tabId);
    const firstMat = targetTab?.materials[0];
    if (firstMat) {
      const sortedIds = [...firstMat.checklistItems]
        .sort((a, b) => {
          const aPlanned = plannedIds.has(a.id) ? 1 : 0;
          const bPlanned = plannedIds.has(b.id) ? 1 : 0;
          if (aPlanned !== bPlanned) return bPlanned - aPlanned;
          return a.orderIndex - b.orderIndex;
        })
        .map((it) => it.id);

      setMaterialSnapshotOrders((prev) => ({
        ...prev,
        [firstMat.id]: sortedIds,
      }));
      setExpandedMaterialId(firstMat.id);
    } else {
      setExpandedMaterialId(null);
    }
  };

  // Toggle Capaian Sesi Ini (Pilihan diupdate seketika tanpa mengubah urutan item saat ini)
  const handleToggleChecklist = (checklistItemId: string) => {
    if (schedule.isCompletedSession) return;
    setActionError(null);

    // Optimistic Update
    setPlannedIds((prev) => {
      const next = new Set(prev);
      if (next.has(checklistItemId)) {
        next.delete(checklistItemId);
      } else {
        next.add(checklistItemId);
      }
      return next;
    });

    startTransition(async () => {
      const res = await togglePlannedChecklistItem(token, checklistItemId);
      if (!res.success) {
        // Revert jika gagal
        setPlannedIds(new Set(schedule.plannedChecklistItemIds || []));
        setActionError(res.error || 'Gagal menyimpan pilihan capaian.');
      } else if (res.plannedChecklistItemIds) {
        setPlannedIds(new Set(res.plannedChecklistItemIds));
      }
    });
  };

  // Simpan Catatan Tambahan Pengajar
  const handleSaveBroadcastNote = () => {
    if (schedule.isCompletedSession) return;
    setActionError(null);

    startTransition(async () => {
      const res = await saveTeacherBroadcastNote(token, broadcastNote);
      if (!res.success) {
        setActionError(res.error || 'Gagal menyimpan catatan pesan.');
      } else {
        setSavedNoteSuccess(true);
        setTimeout(() => setSavedNoteSuccess(false), 3000);
      }
    });
  };

  const totalPlannedCount = plannedIds.size;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 font-sans antialiased text-slate-800">
      {/* Top Header Banner */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase block">
                Portal Persiapan Ajar Sesi
              </span>
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {schedule.title}
              </h1>
            </div>
          </div>

          {/* Quick Cockpit Link */}
          <Link
            href={`/auth/direct?target=persiapan_mengajar&scheduleId=${schedule.id}&token=${token}&tab=evaluation`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all shrink-0 active:scale-95 shadow-2xs"
            title="Buka langsung lembar penilaian santri sesi ini"
          >
            <span>Jurnal Penilaian</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Error Alert Banner */}
        {actionError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-2xs animate-in fade-in">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 font-bold hover:underline shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Schedule & Teacher Info Card */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Pengajar Bertugas:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-bold text-slate-900 text-sm">
                  {teacher.fullName}
                </span>
                {teacher.isSubstitute ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                    Guru Badal
                  </span>
                ) : teacher.isPrimary ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Pengajar Utama
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlannedSummaryOpen((prev) => !prev)}
                  title="Klik untuk melihat rincian capaian yang direncanakan"
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                >
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{totalPlannedCount} Capaian Dipilih</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-indigo-500 transition-transform duration-200 ${
                      isPlannedSummaryOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Tooltip / Popover Dropdown Rincian Capaian Terpilih */}
                {isPlannedSummaryOpen && (
                  <>
                    {/* Backdrop on mobile to prevent clipping and handle taps outside */}
                    <div
                      className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-40 sm:hidden animate-in fade-in duration-150"
                      onClick={() => setIsPlannedSummaryOpen(false)}
                      aria-hidden="true"
                    />

                    <div
                      ref={summaryDropdownRef}
                      className="fixed left-3 right-3 top-20 max-w-sm mx-auto sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-none bg-white rounded-2xl shadow-2xl sm:shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in-50 zoom-in-95 duration-150 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">
                              Capaian Sesi Terpilih
                            </h4>
                            <span className="text-[10px] text-slate-400 block -mt-0.5">
                              Total {totalPlannedCount} capaian dari {plannedSummaryList.length} materi
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsPlannedSummaryOpen(false)}
                          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {plannedSummaryList.length === 0 ? (
                        <div className="text-center py-5 px-3 space-y-1.5 bg-slate-50/70 rounded-xl border border-slate-100">
                          <Target className="w-6 h-6 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-700">
                            Belum Ada Capaian Dipilih
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Buka materi di bawah lalu klik tombol <b>"+ Pilih untuk Diajarkan"</b> untuk menyusun rencana materi sesi ini.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[50vh] sm:max-h-72 overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
                          {plannedSummaryList.map((entry) => (
                            <div
                              key={`${entry.tabId}-${entry.materialId}`}
                              className="pt-2.5 first:pt-0 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                  {entry.generationName}
                                </span>
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                  {entry.selectedCount} Capaian
                                </span>
                              </div>
                              <h5 className="font-bold text-slate-900 text-xs">
                                {entry.materialTitle}
                              </h5>
                              <ul className="space-y-1 pl-3.5 list-disc text-[11px] text-slate-600">
                                {entry.selectedItems.map((item) => (
                                  <li key={item.id} className="leading-snug">
                                    {item.itemTitle}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {schedule.isCompletedSession && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Sesi Selesai (Arsip)
                </span>
              )}
            </div>
          </div>

          {/* Schedule Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block">Hari / Tanggal</span>
                <span className="font-semibold text-slate-800">{schedule.dayDate}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block">Waktu Sesi</span>
                <span className="font-semibold text-slate-800">
                  {schedule.startTime} - {schedule.endTime} WIB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 block">Tempat</span>
                <span className="font-semibold text-slate-800">{schedule.venuePlaceName}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-Jenjang Navigation Tabs */}
        {tabs.length > 1 && (
          <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = tab.generationId === activeTabId;
              return (
                <button
                  key={tab.generationId}
                  onClick={() => handleSelectTab(tab.generationId)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  <span>{tab.generationName}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive
                        ? 'bg-indigo-500/80 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.totalMaterialsCount} Materi
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Active Tab Content Section */}
        {currentTab && (
          <section className="space-y-4">
            {/* Tab Header: Total Santri Binaan */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-sky-50/60 to-white border border-indigo-100/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    Jenjang: {currentTab.generationName}
                  </h2>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {currentTab.totalStudentsCount > 0 ? (
                      <>
                        <strong className="text-indigo-700">
                          {currentTab.totalStudentsCount} Santri Binaan
                        </strong>{' '}
                        terdaftar pada sesi ini
                      </>
                    ) : (
                      'Belum ada data santri aktif terdaftar pada jenjang ini'
                    )}
                  </span>
                </div>
              </div>

              {currentTab.materials.some((m) => m.isFallback) && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                  Target bulan ini belum diset PJ, menampilkan kurikulum aktif
                </span>
              )}
            </div>

            {/* List Materi Cards (Accordion Style - Single Open) */}
            {currentTab.materials.length === 0 ? (
              <div className="p-8 text-center rounded-3xl bg-white border border-slate-200/80 text-xs text-slate-500 space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-semibold text-slate-700">
                  Belum ada materi terdaftar untuk jenjang ini.
                </p>
                <p className="text-[11px]">
                  Materi akan muncul setelah kurikulum bulanan ditetapkan atau materi umum ditambahkan.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {currentTab.materials.map((mat) => {
                  const isExpanded = expandedMaterialId === mat.id;

                  // Ambil urutan snapshot agar saat klik toggle item tidak melompat posisi
                  const itemOrder = materialSnapshotOrders[mat.id];
                  let displayItems = mat.checklistItems;
                  if (itemOrder && itemOrder.length === mat.checklistItems.length) {
                    const itemMap = new Map(mat.checklistItems.map((it) => [it.id, it]));
                    const mapped = itemOrder
                      .map((id) => itemMap.get(id))
                      .filter(Boolean) as typeof mat.checklistItems;
                    if (mapped.length === mat.checklistItems.length) {
                      displayItems = mapped;
                    }
                  } else {
                    // Fallback default: urutkan capaian yang direncanakan ke paling atas
                    displayItems = [...mat.checklistItems].sort((a, b) => {
                      const aPlanned = plannedIds.has(a.id) ? 1 : 0;
                      const bPlanned = plannedIds.has(b.id) ? 1 : 0;
                      if (aPlanned !== bPlanned) return bPlanned - aPlanned;
                      return a.orderIndex - b.orderIndex;
                    });
                  }

                  // SVG Circle Bar calculations
                  const radius = 18;
                  const circumference = 2 * Math.PI * radius; // ~113.1
                  const strokeOffset =
                    circumference - (mat.circlePercentage / 100) * circumference;

                  const circleColor =
                    mat.circlePercentage >= 75
                      ? 'stroke-emerald-500'
                      : mat.circlePercentage >= 40
                      ? 'stroke-amber-500'
                      : 'stroke-indigo-500';

                  const badgeColor =
                    mat.circlePercentage >= 75
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : mat.circlePercentage >= 40
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-indigo-50 text-indigo-800 border-indigo-200';

                  const hasPlannedItems = mat.checklistItems.some((item) =>
                    plannedIds.has(item.id)
                  );
                  const plannedItemsCount = mat.checklistItems.filter((item) =>
                    plannedIds.has(item.id)
                  ).length;

                  return (
                    <div
                      key={mat.id}
                      className={`rounded-3xl border shadow-2xs hover:shadow-xs transition-all overflow-hidden ${
                        hasPlannedItems
                          ? 'bg-indigo-50/40 border-indigo-200/90 shadow-indigo-100/30'
                          : 'bg-white border-slate-200/80'
                      }`}
                    >
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => handleToggleAccordion(mat.id)}
                        className={`w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 cursor-pointer transition-colors ${
                          hasPlannedItems
                            ? 'hover:bg-indigo-50/60'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Left: Material Title & Truncated Description */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                              {mat.title}
                            </h3>
                            {mat.isMandatory && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Wajib
                              </span>
                            )}
                            {hasPlannedItems && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100/90 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1 shadow-2xs">
                                <Target className="w-3 h-3 text-indigo-600" />
                                <span>{plannedItemsCount} Capaian Dipilih</span>
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-xs text-slate-500 leading-relaxed ${
                              isExpanded ? '' : 'line-clamp-2'
                            }`}
                          >
                            {mat.description || 'Tidak ada deskripsi materi.'}
                          </p>
                        </div>

                        {/* Right: Circle Progress Bar + Mastery Ratio Badge + Chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Circle Progress Bar */}
                          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 44 44">
                              <circle
                                cx="22"
                                cy="22"
                                r={radius}
                                className="stroke-slate-200 fill-none"
                                strokeWidth="3.5"
                              />
                              <circle
                                cx="22"
                                cy="22"
                                r={radius}
                                className={`${circleColor} fill-none transition-all duration-500 ease-out`}
                                strokeWidth="3.5"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeOffset}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-[10px] font-black text-slate-800">
                              {mat.circlePercentage}%
                            </span>
                          </div>

                          {/* Mastery Ratio Badge */}
                          <div className="hidden min-[450px]:flex flex-col items-end text-right">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badgeColor}`}
                            >
                              {mat.completedStudentsCount}/{mat.totalStudentsInGen} Santri Tuntas
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5">
                              {mat.checklistItems.length} Sub-Capaian
                            </span>
                          </div>

                          {/* Chevron Icon */}
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Mobile Badge if hidden on narrow screen */}
                      <div className="min-[450px]:hidden px-4 pb-2 -mt-1 flex items-center justify-between text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded-lg font-bold border ${badgeColor}`}
                        >
                          {mat.completedStudentsCount}/{mat.totalStudentsInGen} Santri Tuntas
                        </span>
                        <span className="text-slate-400">
                          {mat.checklistItems.length} Sub-Capaian
                        </span>
                      </div>

                      {/* Accordion Body: List Capaian Items */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50 space-y-3 animate-in fade-in-50 duration-200">
                          <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                            <span className="font-bold text-slate-700">
                              Daftar Sub-Capaian ({mat.checklistItems.length}):
                            </span>
                          </div>

                          {displayItems.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                              Belum ada rincian sub-capaian checklist pada materi ini.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {displayItems.map((item) => {
                                const isPlanned = plannedIds.has(item.id);
                                const isLowMastery =
                                  item.totalStudentsInGen > 0 &&
                                  item.masteryPercentage < 50;

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-3.5 rounded-2xl border transition-all ${
                                      isPlanned
                                        ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      {/* Info Capaian */}
                                      <div className="min-w-0 space-y-1 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h4 className="text-xs font-bold text-slate-900">
                                            {item.itemTitle}
                                          </h4>
                                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            +{item.pointsWeight} Poin
                                          </span>
                                          
                                          {isLowMastery && !isPlanned && (
                                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                              Ketuntasan Rendah
                                            </span>
                                          )}
                                        </div>

                                        {item.description && (
                                          <p className="text-[11px] text-slate-500 leading-relaxed">
                                            {item.description}
                                          </p>
                                        )}

                                        <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-500">
                                          <span className="font-bold text-indigo-700">
                                            {item.completedStudentsCount}/
                                            {item.totalStudentsInGen} Santri Tuntas
                                          </span>
                                          <span>•</span>
                                          <span>{item.masteryPercentage}% Progres</span>
                                        </div>
                                      </div>

                                      {/* Button: Pilih Capaian Sesi Ini */}
                                      <div className="shrink-0 self-start sm:self-center">
                                        <button
                                          type="button"
                                          disabled={isPending || schedule.isCompletedSession}
                                          onClick={() => handleToggleChecklist(item.id)}
                                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 ${
                                            isPlanned
                                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                              : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300'
                                          }`}
                                        >
                                          {isPlanned ? (
                                            <>
                                              <BadgeCheck className="w-3.5 h-3.5 text-white" />
                                              <span>Direncanakan Sesi Ini</span>
                                            </>
                                          ) : (
                                            <>
                                              <span>+ Pilih Diajarkan</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Optional Teacher Broadcast Note Section */}
        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pesan untuk Santri / Wali Santri (Opsional)
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Catatan ini akan otomatis disematkan pada pesan pengingat WhatsApp santri & orang tua.
          </p>

          <div className="space-y-2">
            <textarea
              rows={3}
              disabled={isPending || schedule.isCompletedSession}
              value={broadcastNote}
              onChange={(e) => setBroadcastNote(e.target.value)}
              placeholder="Contoh: Harap santri membawa kitab hadits bab akhlak dan alat tulis..."
              className="w-full text-xs p-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                {savedNoteSuccess ? (
                  <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Catatan berhasil tersimpan di sistem!
                  </span>
                ) : (
                  'Tekan simpan setelah memperbarui catatan'
                )}
              </span>

              <button
                type="button"
                disabled={isPending || schedule.isCompletedSession}
                onClick={handleSaveBroadcastNote}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Simpan Catatan</span>
              </button>
            </div>
          </div>
        </section>

        {/* Footer Guidance Card */}
        <footer className="p-4 rounded-3xl bg-slate-200/40 text-slate-600 text-xs text-center leading-relaxed space-y-1">
          <p>
            Capaian yang Anda pilih di halaman ini akan otomatis diprioritaskan di posisi paling atas pada lembar penilaian santri (<span className="font-bold text-slate-800">Cockpit Jurnal Evaluasi</span>) saat sesi pengajian berlangsung.
          </p>
        </footer>
      </main>
    </div>
  );
}
