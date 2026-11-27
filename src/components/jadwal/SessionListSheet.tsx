'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Plus,
  CalendarCheck,
  ChevronUp,
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

const SHEET_TRANSITION = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';

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
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  const peekCardRef = useRef<HTMLDivElement>(null);
  const portalSheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTranslateYRef = useRef<number>(0);
  const isClosingRef = useRef<boolean>(false);

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

  useEffect(() => {
    setMounted(true);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const clearAnimTimer = () => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  };

  const applySheetTransform = useCallback((translateY: number, withTransition: boolean) => {
    const sheet = portalSheetRef.current;
    const backdrop = backdropRef.current;
    if (sheet) {
      sheet.style.transition = withTransition ? SHEET_TRANSITION : 'none';
      sheet.style.transform = `translate3d(0, ${translateY}px, 0)`;
    }
    if (backdrop) {
      backdrop.style.transition = withTransition ? 'opacity 250ms ease' : 'none';
      const viewportH = typeof window !== 'undefined' ? window.innerHeight || 700 : 700;
      const ratio = Math.max(0, Math.min(1, 1 - translateY / viewportH));
      backdrop.style.opacity = String(ratio);
    }
  }, []);

  // Sinkronisasi awal saat portal sheet baru terpasang dari mode drag atau tap
  useEffect(() => {
    if (!isPortalMounted) return;
    const sheet = portalSheetRef.current;
    if (!sheet) return;

    if (dragCtxRef.current.mode === 'up') {
      applySheetTransform(dragCtxRef.current.currentTranslateY, false);
    } else if (!isClosingRef.current) {
      applySheetTransform(initialTranslateYRef.current, false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applySheetTransform(0, true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isPortalMounted, applySheetTransform]);

  const finishExpand = useCallback(() => {
    clearAnimTimer();
    isClosingRef.current = false;
    setIsDraggingSheet(false);
    applySheetTransform(0, true);
    onExpandedChange(true);
  }, [applySheetTransform, onExpandedChange]);

  const finishCollapse = useCallback(() => {
    clearAnimTimer();
    isClosingRef.current = true;
    setIsDraggingSheet(false);
    const targetY =
      typeof window !== 'undefined'
        ? Math.max(window.innerHeight, 600)
        : 800;
    applySheetTransform(targetY, true);
    onExpandedChange(false);

    animTimerRef.current = setTimeout(() => {
      isClosingRef.current = false;
      setIsPortalMounted(false);
    }, 260);
  }, [applySheetTransform, onExpandedChange]);

  const handleOpenFullscreen = useCallback(() => {
    clearAnimTimer();
    isClosingRef.current = false;
    const rectTop =
      peekCardRef.current?.getBoundingClientRect().top ??
      (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.45) : 360);
    initialTranslateYRef.current = Math.max(0, rectTop);
    setIsPortalMounted(true);
    onExpandedChange(true);
  }, [onExpandedChange]);

  const handleCloseFullscreen = useCallback(() => {
    // Abaikan jika ada modal lain yang berada paling atas di DOM
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
    isPortalMounted && isExpanded && !hasOverlayAbove,
    portalSheetRef,
    handleCloseFullscreen
  );

  // Gestur tarik ke atas dari Handle Peek Card
  const handlePeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    clearAnimTimer();
    isClosingRef.current = false;

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
          c.currentTranslateY = Math.max(0, c.startTop + dy);
          initialTranslateYRef.current = c.currentTranslateY;
          setIsDraggingSheet(true);
          setIsPortalMounted(true);
        }
        return;
      }

      if (c.mode === 'up') {
        const nextY = Math.max(0, Math.min(window.innerHeight, c.startTop + dy));
        c.currentTranslateY = nextY;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applySheetTransform(nextY, false);
        });
      }
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);

      const c = dragCtxRef.current;
      const totalDy = c.lastY - c.startY;
      const wasDraggingUp = c.mode === 'up';
      c.mode = 'idle';

      if (!wasDraggingUp) return;

      const shouldExpand =
        totalDy < -55 ||
        c.velocityY < -0.35 ||
        c.currentTranslateY < c.startTop * 0.65;

      if (shouldExpand) {
        finishExpand();
      } else {
        setIsDraggingSheet(false);
        isClosingRef.current = true;
        applySheetTransform(c.startTop, true);
        animTimerRef.current = setTimeout(() => {
          isClosingRef.current = false;
          setIsPortalMounted(false);
          onExpandedChange(false);
        }, 260);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  };

  // Gestur tarik ke bawah dari Handle Fullscreen Header
  const handleFullscreenHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    clearAnimTimer();
    isClosingRef.current = false;

    const ctx = dragCtxRef.current;
    ctx.mode = 'down';
    ctx.startY = e.clientY;
    ctx.lastY = e.clientY;
    ctx.lastTime = performance.now();
    ctx.velocityY = 0;
    ctx.currentTranslateY = 0;
    setIsDraggingSheet(true);

    const onMove = (moveEvent: PointerEvent) => {
      const c = dragCtxRef.current;
      if (c.mode !== 'down') return;
      const now = performance.now();
      const dt = Math.max(1, now - c.lastTime);
      c.velocityY = (moveEvent.clientY - c.lastY) / dt;
      c.lastY = moveEvent.clientY;
      c.lastTime = now;

      const dy = Math.max(0, moveEvent.clientY - c.startY);
      c.currentTranslateY = dy;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        applySheetTransform(dy, false);
      });
    };

    const onEnd = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);

      const c = dragCtxRef.current;
      const dy = c.currentTranslateY;
      const velocityY = c.velocityY;
      c.mode = 'idle';

      if (dy > 95 || velocityY > 0.4) {
        finishCollapse();
      } else {
        setIsDraggingSheet(false);
        applySheetTransform(0, true);
      }
    };

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
      // Abaikan jika user menggeser naik (scroll daftar) atau scroll horizontal
      if (dy < -4 || Math.abs(dx) > Math.abs(dy)) {
        state.tracking = false;
        return;
      }
      if (dy > 12 && (scrollListRef.current?.scrollTop ?? 0) <= 0) {
        state.engaged = true;
        setIsDraggingSheet(true);
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
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      applySheetTransform(dragY, false);
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

    if (state.currentY > 95 || state.velocityY > 0.4) {
      finishCollapse();
    } else {
      setIsDraggingSheet(false);
      applySheetTransform(0, true);
    }
  };

  const fullDateLabel = selectedDate.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const compactDateLabel = selectedDate.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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
        className="rounded-3xl bg-white/95 backdrop-blur-md border border-white/95 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)]"
      >
        {/* Drag Handle Zone & Date Header */}
        <div
          onPointerDown={handlePeekPointerDown}
          className={`touch-none select-none cursor-grab active:cursor-grabbing rounded-t-3xl bg-gradient-to-b ${accent.sheetHeaderTint} border-b border-slate-200/60 px-4 sm:px-5 pt-2.5 pb-3`}
        >
          {/* Centered Pill Handle + Pull Hint */}
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
            {/* Backdrop lembut di belakang sheet yang sedang meluncur */}
            <div
              ref={backdropRef}
              className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs opacity-0"
              aria-hidden="true"
            />

            {/* Fullscreen Sheet Overlay */}
            <div
              ref={portalSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Daftar Sesi ${fullDateLabel}`}
              className={`absolute inset-0 h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden shadow-2xl will-change-transform ${
                isDraggingSheet ? 'rounded-t-3xl' : 'rounded-none'
              }`}
            >
              {/* Sticky Header dengan Drag Handle, Tombol Kembali, < > Tanggal, & + Tambah */}
              <div
                onPointerDown={handleFullscreenHeaderPointerDown}
                className="shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs touch-none select-none cursor-grab active:cursor-grabbing pt-[max(0.5rem,env(safe-area-inset-top))]"
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
                      onClick={finishCollapse}
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
