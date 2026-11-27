'use client';

import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Plus,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import type { RoleTheme } from '@/lib/theme';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyModalLock } from '@/hooks/useBodyModalLock';
import ScheduleCard, { type ScheduleItem } from './ScheduleCard';
import type { CalendarAccentTokens } from './jadwalFilterUtils';

interface SessionListSheetProps {
  selectedDate: Date;
  schedules: ScheduleItem[];
  activeFilterCount: number;
  searchQuery: string;
  canManage: boolean;
  canPropose: boolean;
  currentUserId?: string | null;
  availableTeachers: { id: string; fullName: string }[];
  activeRole?: 'manage' | 'teacher' | 'parent' | 'student';
  roleKey: RoleTheme['roleKey'];
  accent: CalendarAccentTokens;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onShiftDay: (deltaDays: -1 | 1) => void;
  onOpenCreateModal: () => void;
  onOpenFilterSheet: () => void;
  onEditSchedule: (schedule: ScheduleItem) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  hasOverlayAbove?: boolean;
}

type SnapPhase = 'idle' | 'dragging' | 'expanding' | 'expanded' | 'collapsing';

const SHEET_TRANSITION = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
const ANIMATION_FALLBACK_MS = 340;

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const COMPACT_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function getLiveSheetTranslateY(el: HTMLElement | null, fallbackY: number): number {
  if (!el || typeof window === 'undefined') return fallbackY;
  const transformValue = window.getComputedStyle(el).transform;
  if (!transformValue || transformValue === 'none') return fallbackY;
  try {
    const matrix = new DOMMatrix(transformValue);
    return Number.isFinite(matrix.m42) ? matrix.m42 : fallbackY;
  } catch {
    return fallbackY;
  }
}

/**
 * Panel daftar sesi terpisah di bawah kalender yang dapat ditarik ke atas
 * maupun diketuk hingga menutup seluruh layar (portal fullscreen 100dvh).
 */
export default function SessionListSheet({
  selectedDate,
  schedules,
  activeFilterCount,
  searchQuery,
  canManage,
  canPropose,
  currentUserId = null,
  availableTeachers,
  activeRole,
  roleKey,
  accent,
  isExpanded,
  onExpandedChange,
  onShiftDay,
  onOpenCreateModal,
  onOpenFilterSheet,
  onEditSchedule,
  onDeleteSchedule,
  hasOverlayAbove = false,
}: SessionListSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [isPortalMounted, setIsPortalMounted] = useState(false);
  const [isFocusTrapReady, setIsFocusTrapReady] = useState(false);

  const peekCardRef = useRef<HTMLDivElement>(null);
  const portalSheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionCleanupRef = useRef<(() => void) | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const snapPhaseRef = useRef<SnapPhase>('idle');
  const currentYRef = useRef<number>(0);
  const initialTranslateYRef = useRef<number>(0);
  const collapseTargetYRef = useRef<number>(0);

  const dragCtxRef = useRef<{
    mode: 'idle' | 'pending-up' | 'up' | 'down';
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    startTop: number;
    currentTranslateY: number;
  }>({
    mode: 'idle',
    startY: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    startTop: 0,
    currentTranslateY: 0,
  });

  const cancelPendingRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearAnimListeners = useCallback(() => {
    if (animTimerRef.current !== null) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    if (transitionCleanupRef.current) {
      transitionCleanupRef.current();
      transitionCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => {
      cancelPendingRaf();
      clearAnimListeners();
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, [cancelPendingRaf, clearAnimListeners]);

  const applySheetVisuals = useCallback(
    (translateY: number, transitionValue: string) => {
      currentYRef.current = translateY;
      const sheet = portalSheetRef.current;
      const backdrop = backdropRef.current;

      if (sheet) {
        sheet.style.transition = transitionValue;
        sheet.style.transform = `translate3d(0, ${translateY}px, 0)`;
        const radius = translateY > 2 ? '1.5rem' : '0px';
        sheet.style.borderTopLeftRadius = radius;
        sheet.style.borderTopRightRadius = radius;
      }

      if (backdrop) {
        backdrop.style.transition =
          transitionValue === 'none' ? 'none' : 'opacity 280ms ease-out';
        if (snapPhaseRef.current === 'collapsing' && transitionValue !== 'none') {
          backdrop.style.opacity = '0';
        } else {
          const viewportH =
            typeof window !== 'undefined' && window.innerHeight > 0
              ? window.innerHeight
              : 700;
          const progress = Math.max(0, Math.min(1, 1 - translateY / viewportH));
          backdrop.style.opacity = String(progress);
        }
      }
    },
    []
  );

  const animateSheetTo = useCallback(
    (
      targetY: number,
      targetPhase: 'expanding' | 'collapsing',
      onComplete: () => void
    ) => {
      cancelPendingRaf();
      clearAnimListeners();
      snapPhaseRef.current = targetPhase;

      const sheet = portalSheetRef.current;
      if (!sheet) {
        onComplete();
        return;
      }

      const liveY = getLiveSheetTranslateY(sheet, currentYRef.current);
      if (Math.abs(targetY - liveY) < 1) {
        applySheetVisuals(targetY, 'none');
        onComplete();
        return;
      }

      // Kunci posisi saat ini dulu lalu flush layout satu kali agar transisi dimulai dari titik tepat
      applySheetVisuals(liveY, 'none');
      sheet.getBoundingClientRect();

      let finished = false;
      const finalize = () => {
        if (finished) return;
        finished = true;
        clearAnimListeners();
        onComplete();
      };

      const onTransitionEnd = (ev: TransitionEvent) => {
        if (ev.target === sheet && ev.propertyName === 'transform') {
          finalize();
        }
      };

      sheet.addEventListener('transitionend', onTransitionEnd);
      transitionCleanupRef.current = () => {
        sheet.removeEventListener('transitionend', onTransitionEnd);
      };
      animTimerRef.current = setTimeout(finalize, ANIMATION_FALLBACK_MS);

      applySheetVisuals(targetY, SHEET_TRANSITION);
    },
    [applySheetVisuals, cancelPendingRaf, clearAnimListeners]
  );

  const finishExpand = useCallback(() => {
    setIsFocusTrapReady(false);
    if (!portalSheetRef.current) {
      snapPhaseRef.current = 'expanding';
      initialTranslateYRef.current = currentYRef.current;
      return;
    }

    animateSheetTo(0, 'expanding', () => {
      snapPhaseRef.current = 'expanded';
      setIsFocusTrapReady(true);
      onExpandedChange(true);
    });
  }, [animateSheetTo, onExpandedChange]);

  const finishCollapse = useCallback(
    (customTargetY?: number) => {
      setIsFocusTrapReady(false);
      const targetY =
        customTargetY ??
        (typeof window !== 'undefined' ? Math.max(window.innerHeight, 600) : 800);
      collapseTargetYRef.current = targetY;

      if (!portalSheetRef.current) {
        snapPhaseRef.current = 'idle';
        setIsPortalMounted(false);
        onExpandedChange(false);
        return;
      }

      animateSheetTo(targetY, 'collapsing', () => {
        snapPhaseRef.current = 'idle';
        currentYRef.current = 0;
        setIsPortalMounted(false);
        onExpandedChange(false);
      });
    },
    [animateSheetTo, onExpandedChange]
  );

  // Tempatkan posisi awal sebelum frame pertama di-paint saat portal baru mounted
  useLayoutEffect(() => {
    if (!isPortalMounted) return;
    const sheet = portalSheetRef.current;
    if (!sheet) return;

    if (snapPhaseRef.current === 'dragging') {
      applySheetVisuals(currentYRef.current, 'none');
      return;
    }

    if (snapPhaseRef.current === 'expanding' || snapPhaseRef.current === 'collapsing') {
      applySheetVisuals(initialTranslateYRef.current, 'none');
    }
  }, [isPortalMounted, applySheetVisuals]);

  // Mulai animasi slide satu frame setelah posisi awal di-paint oleh browser
  useEffect(() => {
    if (!isPortalMounted) return;

    if (snapPhaseRef.current === 'expanding') {
      cancelPendingRaf();
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (snapPhaseRef.current === 'expanding') {
          finishExpand();
        }
      });
    } else if (snapPhaseRef.current === 'collapsing') {
      cancelPendingRaf();
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (snapPhaseRef.current === 'collapsing') {
          finishCollapse(collapseTargetYRef.current);
        }
      });
    }
  }, [isPortalMounted, cancelPendingRaf, finishExpand, finishCollapse]);

  const handleOpenFullscreen = useCallback(() => {
    cancelPendingRaf();
    clearAnimListeners();
    setIsFocusTrapReady(false);

    if (isPortalMounted && portalSheetRef.current) {
      finishExpand();
      return;
    }

    const rectTop =
      peekCardRef.current?.getBoundingClientRect().top ??
      (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.45) : 360);
    const startOffset = Math.max(0, rectTop);
    initialTranslateYRef.current = startOffset;
    currentYRef.current = startOffset;
    snapPhaseRef.current = 'expanding';
    setIsPortalMounted(true);
  }, [cancelPendingRaf, clearAnimListeners, finishExpand, isPortalMounted]);

  const handleCloseFullscreen = useCallback(() => {
    if (typeof document !== 'undefined') {
      const openDialogs = document.querySelectorAll('[aria-modal="true"]');
      const topmostDialog = openDialogs[openDialogs.length - 1];
      if (topmostDialog && portalSheetRef.current && topmostDialog !== portalSheetRef.current) {
        return;
      }
    }
    finishCollapse();
  }, [finishCollapse]);

  useBodyModalLock(isPortalMounted || isExpanded);
  useFocusTrap(
    isPortalMounted && isFocusTrapReady && !hasOverlayAbove,
    portalSheetRef,
    handleCloseFullscreen
  );

  // Gestur tarik ke atas dari Handle Peek Card
  const handlePeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    cancelPendingRaf();
    clearAnimListeners();

    const startTop =
      peekCardRef.current?.getBoundingClientRect().top ??
      Math.round(window.innerHeight * 0.45);

    const ctx = dragCtxRef.current;
    ctx.mode = 'pending-up';
    ctx.startY = e.clientY;
    ctx.lastY = e.clientY;
    ctx.lastTime = performance.now();
    ctx.velocityY = 0;
    ctx.startTop = Math.max(0, startTop);
    ctx.currentTranslateY = ctx.startTop;

    const onMove = (moveEvent: PointerEvent) => {
      const c = dragCtxRef.current;
      const now = performance.now();
      const dt = Math.max(1, now - c.lastTime);
      c.velocityY = (moveEvent.clientY - c.lastY) / dt;
      c.lastY = moveEvent.clientY;
      c.lastTime = now;

      const dy = moveEvent.clientY - c.startY;

      if (c.mode === 'pending-up') {
        if (dy < -8) {
          c.mode = 'up';
          const nextY = Math.max(0, Math.min(window.innerHeight, c.startTop + dy));
          c.currentTranslateY = nextY;
          initialTranslateYRef.current = nextY;
          currentYRef.current = nextY;
          snapPhaseRef.current = 'dragging';
          setIsFocusTrapReady(false);
          setIsPortalMounted(true);
        }
        return;
      }

      if (c.mode === 'up') {
        const nextY = Math.max(0, Math.min(window.innerHeight, c.startTop + dy));
        c.currentTranslateY = nextY;
        cancelPendingRaf();
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (snapPhaseRef.current === 'dragging') {
            applySheetVisuals(nextY, 'none');
          }
        });
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      dragCleanupRef.current = null;
    };

    const onEnd = () => {
      cleanup();
      cancelPendingRaf();

      const c = dragCtxRef.current;
      const wasDraggingUp = c.mode === 'up';
      const movedDistance = c.currentTranslateY - c.startTop;
      const lastPos = c.currentTranslateY;
      const velY = c.velocityY;
      const startTopPos = c.startTop;
      c.mode = 'idle';

      if (!wasDraggingUp) return;

      initialTranslateYRef.current = lastPos;
      currentYRef.current = lastPos;

      const shouldExpand =
        movedDistance < -55 ||
        velY < -0.35 ||
        lastPos < startTopPos * 0.65;

      if (shouldExpand) {
        finishExpand();
      } else {
        finishCollapse(startTopPos);
      }
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  // Gestur tarik ke bawah dari Handle Fullscreen Header
  const handleFullscreenHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    cancelPendingRaf();
    clearAnimListeners();

    const startOffset = Math.max(0, getLiveSheetTranslateY(portalSheetRef.current, currentYRef.current));
    snapPhaseRef.current = 'dragging';
    setIsFocusTrapReady(false);

    const ctx = dragCtxRef.current;
    ctx.mode = 'down';
    ctx.startY = e.clientY;
    ctx.lastY = e.clientY;
    ctx.lastTime = performance.now();
    ctx.velocityY = 0;
    ctx.startTop = startOffset;
    ctx.currentTranslateY = startOffset;

    const onMove = (moveEvent: PointerEvent) => {
      const c = dragCtxRef.current;
      if (c.mode !== 'down') return;
      const now = performance.now();
      const dt = Math.max(1, now - c.lastTime);
      c.velocityY = (moveEvent.clientY - c.lastY) / dt;
      c.lastY = moveEvent.clientY;
      c.lastTime = now;

      const dy = Math.max(0, c.startTop + (moveEvent.clientY - c.startY));
      c.currentTranslateY = dy;
      cancelPendingRaf();
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (snapPhaseRef.current === 'dragging') {
          applySheetVisuals(dy, 'none');
        }
      });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      dragCleanupRef.current = null;
    };

    const onEnd = () => {
      cleanup();
      cancelPendingRaf();

      const c = dragCtxRef.current;
      const dy = c.currentTranslateY;
      const velocityY = c.velocityY;
      c.mode = 'idle';

      currentYRef.current = dy;
      if (dy > 95 || velocityY > 0.4) {
        finishCollapse();
      } else {
        finishExpand();
      }
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  // Tarik turun dari puncak daftar sesi (hanya saat scrollTop <= 0)
  const listOverscrollRef = useRef<{
    tracking: boolean;
    engaged: boolean;
    startY: number;
    startX: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
    currentY: number;
  }>({
    tracking: false,
    engaged: false,
    startY: 0,
    startX: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
    currentY: 0,
  });

  const handleListTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const scrollEl = scrollListRef.current;
    if (!scrollEl || scrollEl.scrollTop > 0 || e.touches.length !== 1) {
      listOverscrollRef.current.tracking = false;
      return;
    }
    const touch = e.touches[0];
    listOverscrollRef.current = {
      tracking: true,
      engaged: false,
      startY: touch.clientY,
      startX: touch.clientX,
      lastY: touch.clientY,
      lastTime: performance.now(),
      velocityY: 0,
      currentY: 0,
    };
  };

  const handleListTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = listOverscrollRef.current;
    if (!state.tracking || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const dy = touch.clientY - state.startY;
    const dx = touch.clientX - state.startX;

    if (!state.engaged) {
      if (dy < -4 || Math.abs(dx) > Math.abs(dy)) {
        state.tracking = false;
        return;
      }
      if (dy > 12 && (scrollListRef.current?.scrollTop ?? 0) <= 0) {
        state.engaged = true;
        cancelPendingRaf();
        clearAnimListeners();
        snapPhaseRef.current = 'dragging';
        setIsFocusTrapReady(false);
      } else {
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - state.lastTime);
    state.velocityY = (touch.clientY - state.lastY) / dt;
    state.lastY = touch.clientY;
    state.lastTime = now;

    const dragY = Math.max(0, dy);
    state.currentY = dragY;
    cancelPendingRaf();
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (snapPhaseRef.current === 'dragging') {
        applySheetVisuals(dragY, 'none');
      }
    });
  };

  const handleListTouchEnd = () => {
    const state = listOverscrollRef.current;
    if (!state.tracking || !state.engaged) {
      state.tracking = false;
      return;
    }
    state.tracking = false;
    state.engaged = false;
    cancelPendingRaf();

    currentYRef.current = state.currentY;
    if (state.currentY > 95 || state.velocityY > 0.4) {
      finishCollapse();
    } else {
      finishExpand();
    }
  };

  const fullDateLabel = FULL_DATE_FORMATTER.format(selectedDate);
  const compactDateLabel = COMPACT_DATE_FORMATTER.format(selectedDate);

  const today = new Date();
  const isToday =
    today.getFullYear() === selectedDate.getFullYear() &&
    today.getMonth() === selectedDate.getMonth() &&
    today.getDate() === selectedDate.getDate();

  const renderCardsOrEmpty = () => (
    <>
      {schedules.map((sch) => (
        <ScheduleCard
          key={sch.id}
          schedule={sch}
          canManage={canManage}
          canPropose={canPropose}
          currentUserId={currentUserId}
          availableTeachers={availableTeachers}
          activeRole={activeRole}
          roleKey={roleKey}
          onEdit={onEditSchedule}
          onDelete={onDeleteSchedule}
        />
      ))}

      {schedules.length === 0 && (
        <div className="text-center py-7 px-4 text-xs text-slate-500 bg-slate-50/75 rounded-2xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center gap-2">
          <CalendarCheck className="w-6 h-6 text-slate-300" />
          <span className="font-semibold text-slate-700">
            Tidak ada jadwal sesi pengajian pada tanggal ini
          </span>
          <span className="text-xs text-slate-500 max-w-sm">
            {activeFilterCount > 0 || searchQuery.trim()
              ? 'Coba ubah filter atau kata kunci pencarian untuk melihat sesi lain pada tanggal ini.'
              : `Pilih tanggal lain di kalender atau ${
                  canManage ? 'buat sesi pengajian baru' : 'ajukan sesi pengajian baru'
                } untuk tanggal ini.`}
          </span>
          {(canManage || canPropose) && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className={`mt-1 min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 ${accent.buttonPrimary} text-white rounded-xl text-xs font-bold border shadow-xs transition-all cursor-pointer active:scale-95`}
            >
              <Plus className="w-4 h-4" />
              <span>{canManage ? 'Buat Jadwal Sesi' : 'Ajukan Jadwal Sesi'}</span>
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* PANEL TERPISAH DI BAWAH KALENDER (MODE NORMAL / PEEK) */}
      <section
        ref={peekCardRef}
        aria-label="Daftar Sesi Tanggal Terpilih"
        className="rounded-3xl bg-white/95 border border-white/95 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)]"
      >
        {/* Drag Handle Zone & Date Header */}
        <div
          onPointerDown={handlePeekPointerDown}
          className={`touch-none select-none cursor-grab active:cursor-grabbing rounded-t-3xl bg-gradient-to-b ${accent.sheetHeaderTint} border-b border-slate-200/60 px-4 sm:px-5 pt-2.5 pb-3`}
        >
          <div className="flex flex-col items-center justify-center pb-2">
            <div className="w-10 h-1 rounded-full bg-slate-300/90" />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className={`w-4 h-4 shrink-0 ${accent.iconText}`} />
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  <span className="sm:hidden">{compactDateLabel}</span>
                  <span className="hidden sm:inline">{fullDateLabel}</span>
                </h4>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-lg border border-slate-200/70 shrink-0">
                {schedules.length} Sesi
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(canManage || canPropose) && (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  aria-label={canManage ? 'Tambah' : 'Ajukan'}
                  className={`min-h-[38px] inline-flex items-center justify-center gap-1 text-xs font-bold border px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 ${accent.softPill}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {canManage ? 'Tambah' : 'Ajukan'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenFullscreen}
                aria-label="Perluas daftar sesi layar penuh"
                title="Buka layar penuh"
                className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* List Sesi Tanggal Terpilih */}
        <div className="p-3.5 sm:p-5 space-y-3">{renderCardsOrEmpty()}</div>
      </section>

      {/* OVERLAY LAYAR PENUH (100% VIEWPORT PORTAL) */}
      {mounted &&
        isPortalMounted &&
        createPortal(
          <div className="fixed inset-0 z-[55]">
            {/* Backdrop solid translusen ringan tanpa blur per-frame agar transisi 60fps */}
            <div
              ref={backdropRef}
              className="absolute inset-0 bg-slate-900/40 opacity-0"
              aria-hidden="true"
            />

            {/* Fullscreen Sheet Overlay */}
            <div
              ref={portalSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Daftar Sesi ${fullDateLabel}`}
              className="absolute inset-0 h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden shadow-2xl will-change-transform"
            >
              {/* Sticky Header dengan Drag Handle, Tombol Kembali, < > Tanggal, & + Tambah */}
              <div
                onPointerDown={handleFullscreenHeaderPointerDown}
                className="shrink-0 bg-white/[0.97] border-b border-slate-200/80 shadow-2xs touch-none select-none cursor-grab active:cursor-grabbing pt-[max(0.5rem,env(safe-area-inset-top))]"
              >
                {/* Handle Tarik Turun */}
                <div className="flex justify-center pt-1 pb-2">
                  <div className="w-11 h-1.5 rounded-full bg-slate-300" />
                </div>

                <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-6 pb-3 flex items-center justify-between gap-2">
                  {/* Kiri: Tutup + Tanggal + Jumlah */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => finishCollapse()}
                      aria-label="Tutup layar penuh dan kembali ke kalender"
                      title="Kembali ke kalender"
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          <span className="sm:hidden">{compactDateLabel}</span>
                          <span className="hidden sm:inline">{fullDateLabel}</span>
                        </h4>
                        {isToday && (
                          <span
                            className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${accent.softPill}`}
                          >
                            Hari Ini
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-semibold text-slate-700">
                          {schedules.length} Sesi
                        </span>
                        {activeFilterCount > 0 && (
                          <button
                            type="button"
                            onClick={onOpenFilterSheet}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer ${accent.softPill}`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>{activeFilterCount} filter</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kanan: Panah < > Ganti Hari + Tombol Tambah */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => onShiftDay(-1)}
                        aria-label="Tanggal sebelumnya"
                        title="Hari sebelumnya"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onShiftDay(1)}
                        aria-label="Tanggal berikutnya"
                        title="Hari berikutnya"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-700 hover:bg-white transition-all active:scale-95 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {(canManage || canPropose) && (
                      <button
                        type="button"
                        onClick={onOpenCreateModal}
                        aria-label={canManage ? 'Tambah jadwal' : 'Ajukan jadwal'}
                        className={`min-h-[38px] min-w-[38px] sm:px-3 inline-flex items-center justify-center gap-1 text-xs font-bold border rounded-xl transition-all cursor-pointer active:scale-95 text-white shadow-xs ${accent.buttonPrimary}`}
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="hidden sm:inline">
                          {canManage ? 'Tambah' : 'Ajukan'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Card List Sesi Saja */}
              <div
                ref={scrollListRef}
                onTouchStart={handleListTouchStart}
                onTouchMove={handleListTouchMove}
                onTouchEnd={handleListTouchEnd}
                onTouchCancel={handleListTouchEnd}
                className="flex-1 overflow-y-auto overscroll-contain"
              >
                <div className="max-w-3xl mx-auto w-full px-3.5 sm:px-6 py-4 space-y-3 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                  {renderCardsOrEmpty()}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
