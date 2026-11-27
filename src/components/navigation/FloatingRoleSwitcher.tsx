'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  GraduationCap,
  Heart,
  School,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  Check,
  Repeat2,
  type LucideIcon,
} from 'lucide-react';
import { useActiveRole } from '@/components/navigation/ActiveRoleContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { isRoleAwarePathname, type RoleTabId } from '@/lib/role-context';
import { TOUCH_TARGET } from '@/lib/design-tokens';

const ROLE_ICONS: Record<string, LucideIcon> = {
  ShieldCheck,
  GraduationCap,
  Heart,
  School,
  BookOpen,
  Calendar,
  CheckSquare,
};

const ROLE_COLOR_STYLES: Record<
  'emerald' | 'teal' | 'indigo' | 'amber' | 'sky',
  {
    pillBorder: string;
    iconBg: string;
    iconText: string;
    dotBg: string;
    itemActiveBg: string;
    itemActiveRing: string;
    badgeBg: string;
  }
> = {
  sky: {
    pillBorder: 'border-sky-200/90 hover:border-sky-300',
    iconBg: 'bg-sky-50',
    iconText: 'text-sky-700',
    dotBg: 'bg-sky-500',
    itemActiveBg: 'bg-sky-50/90 border-sky-500',
    itemActiveRing: 'ring-1 ring-sky-500/20',
    badgeBg: 'bg-sky-100 text-sky-800',
  },
  teal: {
    pillBorder: 'border-teal-200/90 hover:border-teal-300',
    iconBg: 'bg-teal-50',
    iconText: 'text-teal-700',
    dotBg: 'bg-teal-500',
    itemActiveBg: 'bg-teal-50/90 border-teal-500',
    itemActiveRing: 'ring-1 ring-teal-500/20',
    badgeBg: 'bg-teal-100 text-teal-800',
  },
  indigo: {
    pillBorder: 'border-indigo-200/90 hover:border-indigo-300',
    iconBg: 'bg-indigo-50',
    iconText: 'text-indigo-700',
    dotBg: 'bg-indigo-500',
    itemActiveBg: 'bg-indigo-50/90 border-indigo-500',
    itemActiveRing: 'ring-1 ring-indigo-500/20',
    badgeBg: 'bg-indigo-100 text-indigo-800',
  },
  emerald: {
    pillBorder: 'border-emerald-200/90 hover:border-emerald-300',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-700',
    dotBg: 'bg-emerald-500',
    itemActiveBg: 'bg-emerald-50/90 border-emerald-500',
    itemActiveRing: 'ring-1 ring-emerald-500/20',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
  amber: {
    pillBorder: 'border-amber-200/90 hover:border-amber-300',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-700',
    dotBg: 'bg-amber-500',
    itemActiveBg: 'bg-amber-50/90 border-amber-500',
    itemActiveRing: 'ring-1 ring-amber-500/20',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
};

const PEEK_DURATION_MS = 1000;

/**
 * Tombol pengalih peran melayang global (pojok kanan atas di bawah AppHeader).
 * - Tidak mengambil ruang flow halaman
 * - Muncul menampilkan label role aktif selama 1 detik setiap berpindah halaman
 * - Menciut otomatis ke ikon peran aktif saja setelah 1 detik atau saat user berinteraksi dengan isi halaman
 */
export default function FloatingRoleSwitcher() {
  const roleCtx = useActiveRole();
  const pathname = usePathname();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableRoles = roleCtx?.availableRoles ?? [];
  const shouldShow = availableRoles.length > 1 && isRoleAwarePathname(pathname);

  useFocusTrap(isMenuOpen && shouldShow, popoverRef, () => {
    setIsMenuOpen(false);
    setIsExpanded(false);
  });

  // Tampilkan label role selama 1 detik setiap kali berpindah halaman atau role baru saja diubah
  useEffect(() => {
    if (!shouldShow) {
      setIsMenuOpen(false);
      setIsExpanded(false);
      return;
    }

    setIsMenuOpen(false);
    setIsExpanded(true);

    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, PEEK_DURATION_MS);

    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, [pathname, roleCtx?.peekTrigger, shouldShow]);

  // Saat menu role terbuka, hentikan auto-collapse timer
  useEffect(() => {
    if (isMenuOpen && peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  }, [isMenuOpen]);

  // Otomatis ciutkan kembali ke ikon saja saat pengguna berinteraksi dengan isi halaman
  useEffect(() => {
    if (!shouldShow || !isExpanded || isMenuOpen) return;

    const collapseOnPageInteraction = (event: Event) => {
      if (
        event.target instanceof Node &&
        containerRef.current?.contains(event.target)
      ) {
        return;
      }
      if (peekTimerRef.current) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
      setIsExpanded(false);
    };

    window.addEventListener('scroll', collapseOnPageInteraction, {
      passive: true,
      capture: true,
    });
    window.addEventListener('wheel', collapseOnPageInteraction, {
      passive: true,
    });
    document.addEventListener('pointerdown', collapseOnPageInteraction, {
      passive: true,
    });
    document.addEventListener('focusin', collapseOnPageInteraction, {
      passive: true,
    });

    return () => {
      window.removeEventListener('scroll', collapseOnPageInteraction, true);
      window.removeEventListener('wheel', collapseOnPageInteraction);
      document.removeEventListener('pointerdown', collapseOnPageInteraction);
      document.removeEventListener('focusin', collapseOnPageInteraction);
    };
  }, [shouldShow, isExpanded, isMenuOpen]);

  // Tutup popover saat klik di luar komponen switcher
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (!shouldShow || !roleCtx) {
    return null;
  }

  const activeItem =
    availableRoles.find((r) => r.id === roleCtx.activeRole) || availableRoles[0];
  const ActiveIcon = ROLE_ICONS[activeItem.iconName] || School;
  const activeStyle =
    ROLE_COLOR_STYLES[activeItem.colorTheme] || ROLE_COLOR_STYLES.emerald;
  const showLabelPill = isExpanded || isMenuOpen;

  const handleSelectRole = (roleId: RoleTabId) => {
    setIsMenuOpen(false);
    if (roleId !== roleCtx.activeRole) {
      roleCtx.switchGlobalRole(roleId);
    } else {
      setIsExpanded(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-[4rem] sm:top-[4.5rem] right-3 sm:right-6 z-[45] flex flex-col items-end gap-2 select-none"
    >
      {/* Tombol Floating Switcher: Pill saat tampil 1 detik / menu terbuka, Ikon Peran Aktif saat menciut */}
      <button
        type="button"
        onClick={() => {
          setIsMenuOpen((prev) => !prev);
        }}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        aria-controls={isMenuOpen ? 'global-role-switcher-menu' : undefined}
        aria-label={`Peran aktif: ${activeItem.shortLabel}. Ketuk untuk mengganti peran.`}
        title={`Mode ${activeItem.shortLabel} — Ketuk untuk ganti peran`}
        className={`relative ${TOUCH_TARGET.minIcon} h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-white/90 ${activeStyle.pillBorder} shadow-[0_8px_20px_-4px_rgba(15,23,42,0.12)] flex items-center transition-all duration-300 ease-out active:scale-95 cursor-pointer ${
          showLabelPill ? 'px-3 gap-2' : 'w-11 justify-center px-0'
        } ${roleCtx.isRoleSwitching ? 'opacity-75' : 'opacity-100'}`}
      >
        <div
          className={`w-7 h-7 rounded-xl ${activeStyle.iconBg} ${activeStyle.iconText} flex items-center justify-center shrink-0 transition-transform duration-200`}
        >
          <ActiveIcon className="w-4 h-4 stroke-[2.2]" />
        </div>

        {/* Titik penanda halus saat dalam mode ikon-saja agar tetap dikenali sebagai multi-peran */}
        {!showLabelPill && (
          <span
            aria-hidden="true"
            className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${activeStyle.dotBg} ring-2 ring-white`}
          />
        )}

        {/* Label Role Aktif — tampil 1 detik saat pindah halaman atau ketika menu dibuka */}
        {showLabelPill && (
          <div className="flex items-center gap-1.5 min-w-0 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-slate-900 whitespace-nowrap max-w-[120px] truncate">
              {activeItem.shortLabel}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${
                isMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        )}
      </button>

      {/* Popover Pilihan Role Global */}
      {isMenuOpen && (
        <div
          ref={popoverRef}
          id="global-role-switcher-menu"
          role="menu"
          aria-label="Pilih Peran Aktif Global"
          className="w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/85 shadow-xl shadow-slate-900/15 p-2.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Repeat2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-bold text-slate-800 truncate">
                Ganti Peran Global
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 shrink-0">
              {availableRoles.length} Peran
            </span>
          </div>

          <div className="space-y-1">
            {availableRoles.map((roleItem) => {
              const isSelected = roleItem.id === roleCtx.activeRole;
              const ItemIcon = ROLE_ICONS[roleItem.iconName] || School;
              const itemStyle =
                ROLE_COLOR_STYLES[roleItem.colorTheme] || ROLE_COLOR_STYLES.emerald;

              return (
                <button
                  key={roleItem.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectRole(roleItem.id)}
                  className={`w-full ${TOUCH_TARGET.minButton} px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? `${itemStyle.itemActiveBg} ${itemStyle.itemActiveRing} shadow-2xs`
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl ${itemStyle.iconBg} ${itemStyle.iconText} flex items-center justify-center shrink-0`}
                    >
                      <ItemIcon className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {roleItem.label}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                            isSelected
                              ? itemStyle.badgeBg
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {roleItem.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate leading-tight mt-0.5">
                        {roleItem.subtitle}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span
                      className={`w-5 h-5 rounded-full ${itemStyle.dotBg} text-white flex items-center justify-center shrink-0`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
