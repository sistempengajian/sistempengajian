'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X, Check, RotateCcw } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyModalLock } from '@/hooks/useBodyModalLock';
import type { ScheduleItem } from './ScheduleCard';
import {
  JadwalFilterState,
  EMPTY_JADWAL_FILTERS,
  TIER_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  ROLE_SCOPE_FILTER_OPTIONS,
  CalendarAccentTokens,
  FilterChipOption,
  cloneFilterState,
  toggleFilterChip,
  countActiveFilters,
  applyScheduleFilters,
} from './jadwalFilterUtils';

interface JadwalFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: ScheduleItem[];
  searchQuery: string;
  appliedFilters: JadwalFilterState;
  onApplyFilters: (filters: JadwalFilterState) => void;
  hasHomeroomSchedules: boolean;
  currentUserId?: string | null;
  accent: CalendarAccentTokens;
}

interface FilterGroupSectionProps<T extends string> {
  title: string;
  subtitle?: string;
  options: readonly FilterChipOption<T>[];
  selectedValues: readonly T[];
  onToggle: (value: T) => void;
  onClearGroup: () => void;
  accent: CalendarAccentTokens;
}

function FilterGroupSection<T extends string>({
  title,
  subtitle,
  options,
  selectedValues,
  onToggle,
  onClearGroup,
  accent,
}: FilterGroupSectionProps<T>) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">{title}</h4>
            {selectedValues.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${accent.countBadge}`}
              >
                {selectedValues.length}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={onClearGroup}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            Hapus
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              aria-pressed={isSelected}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer active:scale-95 inline-flex items-center gap-2 ${
                isSelected
                  ? accent.selectedChip
                  : 'bg-slate-50/90 hover:bg-slate-100 text-slate-700 border-slate-200/80'
              }`}
            >
              <span>{opt.label}</span>
              {isSelected && (
                <span
                  aria-hidden="true"
                  className={`w-4 h-4 rounded-md inline-flex items-center justify-center shrink-0 ${accent.chipCheckBg}`}
                >
                  <Check className="w-3 h-3 stroke-[2.6]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Bottom Sheet Modal Filter Multi-Select gaya Shopee:
 * - Mendukung banyak pilihan di dalam 1 kategori (OR)
 * - Menggabungkan antar kategori secara kumulatif (AND)
 * - Memakai draft state dengan tombol Reset & Terapkan (beserta pratinjau jumlah sesi)
 */
export default function JadwalFilterSheet({
  isOpen,
  onClose,
  schedules,
  searchQuery,
  appliedFilters,
  onApplyFilters,
  hasHomeroomSchedules,
  currentUserId = null,
  accent,
}: JadwalFilterSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState<JadwalFilterState>(() =>
    cloneFilterState(appliedFilters)
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);
  const dragStateRef = useRef<{
    active: boolean;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    deltaY: number;
  }>({
    active: false,
    startY: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    deltaY: 0,
  });

  useEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setDraftFilters(cloneFilterState(appliedFilters));
      setIsRendered(true);
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
        sheetRef.current.style.transition = '';
      }
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }

    if (wasOpen && !isOpen) {
      setIsVisible(false);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        setIsRendered(false);
      }, 240);
    }
  }, [isOpen, appliedFilters]);

  const handleRequestClose = useCallback(() => {
    setIsVisible(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, 220);
  }, [onClose]);

  useBodyModalLock(isRendered);
  useFocusTrap(isRendered && isOpen, sheetRef, handleRequestClose);

  const draftSelectedCount = useMemo(
    () => countActiveFilters(draftFilters, hasHomeroomSchedules),
    [draftFilters, hasHomeroomSchedules]
  );

  const draftPreviewCount = useMemo(
    () =>
      applyScheduleFilters(
        schedules,
        searchQuery,
        draftFilters,
        currentUserId,
        hasHomeroomSchedules
      ).length,
    [schedules, searchQuery, draftFilters, currentUserId, hasHomeroomSchedules]
  );

  const handleResetDraft = () => {
    setDraftFilters(cloneFilterState(EMPTY_JADWAL_FILTERS));
  };

  const handleApply = () => {
    onApplyFilters(cloneFilterState(draftFilters));
    handleRequestClose();
  };

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const state = dragStateRef.current;
    state.active = true;
    state.startY = e.clientY;
    state.lastY = e.clientY;
    state.lastTime = performance.now();
    state.velocityY = 0;
    state.deltaY = 0;

    sheet.style.transition = 'none';

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStateRef.current.active || !sheetRef.current) return;
      const now = performance.now();
      const dt = Math.max(1, now - dragStateRef.current.lastTime);
      dragStateRef.current.velocityY =
        (moveEvent.clientY - dragStateRef.current.lastY) / dt;
      dragStateRef.current.lastY = moveEvent.clientY;
      dragStateRef.current.lastTime = now;

      const deltaY = Math.max(0, moveEvent.clientY - dragStateRef.current.startY);
      dragStateRef.current.deltaY = deltaY;
      sheetRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
    };

    const handleEnd = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);

      const { deltaY, velocityY } = dragStateRef.current;
      if (sheetRef.current) {
        sheetRef.current.style.transition = '';
        sheetRef.current.style.transform = '';
      }

      if (deltaY > 75 || velocityY > 0.35) {
        handleRequestClose();
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  };

  if (!mounted || !isRendered) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Filter Jadwal Pengajian"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-250 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleRequestClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Panel */}
      <div
        ref={sheetRef}
        className={`relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-modal border border-slate-200/80 max-h-[85dvh] flex flex-col overflow-hidden transition-transform duration-250 ease-out will-change-transform ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag Handle & Sticky Header */}
        <div
          onPointerDown={handleHandlePointerDown}
          className="touch-none select-none shrink-0 bg-white border-b border-slate-100"
        >
          <div className="flex justify-center pt-2.5 pb-1.5">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>

          <div className="px-4 sm:px-5 pb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${accent.softPill}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Filter Jadwal
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Pilih satu atau lebih kriteria dari tiap kategori
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestClose}
              aria-label="Tutup filter"
              className="min-w-[40px] min-h-[40px] -mr-1.5 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Multi-Category Filter Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4 space-y-5">
          <FilterGroupSection
            title="Tingkat Pelaksanaan"
            subtitle="Bisa pilih lebih dari satu tingkat sekaligus"
            options={TIER_FILTER_OPTIONS}
            selectedValues={draftFilters.tiers}
            onToggle={(val) =>
              setDraftFilters((prev) => ({
                ...prev,
                tiers: toggleFilterChip(prev.tiers, val),
              }))
            }
            onClearGroup={() =>
              setDraftFilters((prev) => ({ ...prev, tiers: [] }))
            }
            accent={accent}
          />

          <div className="border-t border-slate-100" />

          <FilterGroupSection
            title="Status Sesi"
            subtitle="Kombinasikan dengan pilihan tingkat di atas"
            options={STATUS_FILTER_OPTIONS}
            selectedValues={draftFilters.statuses}
            onToggle={(val) =>
              setDraftFilters((prev) => ({
                ...prev,
                statuses: toggleFilterChip(prev.statuses, val),
              }))
            }
            onClearGroup={() =>
              setDraftFilters((prev) => ({ ...prev, statuses: [] }))
            }
            accent={accent}
          />

          {hasHomeroomSchedules && (
            <>
              <div className="border-t border-slate-100" />
              <FilterGroupSection
                title="Peran Sesi"
                subtitle="Saring sesi mengajar atau kelas binaan Anda"
                options={ROLE_SCOPE_FILTER_OPTIONS}
                selectedValues={draftFilters.roleScopes}
                onToggle={(val) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    roleScopes: toggleFilterChip(prev.roleScopes, val),
                  }))
                }
                onClearGroup={() =>
                  setDraftFilters((prev) => ({ ...prev, roleScopes: [] }))
                }
                accent={accent}
              />
            </>
          )}
        </div>

        {/* Sticky Footer Action Bar */}
        <div className="shrink-0 px-4 sm:px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleResetDraft}
            disabled={draftSelectedCount === 0}
            className="min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            className={`flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${accent.buttonPrimary}`}
          >
            <span>Terapkan ({draftPreviewCount} Sesi)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
