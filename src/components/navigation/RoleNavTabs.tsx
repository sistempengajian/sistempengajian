'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ShieldCheck,
  GraduationCap,
  Heart,
  School,
  Sparkles,
  Layers,
  CheckCircle2,
  CheckSquare,
  BookOpen,
  Calendar,
  ChevronDown,
  Check,
  X,
  LucideIcon,
} from 'lucide-react';

export type RoleTabId = 'manage' | 'teacher' | 'parent' | 'student';

export interface RoleTabItem {
  id: RoleTabId;
  label: string;
  roleTitle: string;
  badge: string;
  subtitle: string;
  iconName: 'ShieldCheck' | 'GraduationCap' | 'Heart' | 'School' | 'CheckSquare' | 'BookOpen' | 'Calendar';
  colorTheme: 'emerald' | 'teal' | 'indigo' | 'amber' | 'sky';
  href: string;
}

interface RoleNavTabsProps {
  title?: string;
  description?: string;
  availableRoles: RoleTabItem[];
  activeRole: RoleTabId;
  userName?: string;
  variant?: 'grid' | 'bottom-sheet';
  onRoleChange?: (roleId: RoleTabId) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck,
  GraduationCap,
  Heart,
  School,
  CheckSquare,
  BookOpen,
  Calendar,
};

const THEME_STYLES = {
  emerald: {
    activeBg: 'bg-emerald-600 text-white shadow-emerald-200/50',
    activeRing: 'ring-2 ring-emerald-500/30',
    activeBadge: 'bg-white/20 text-white',
    inactiveIconBg: 'bg-emerald-50 text-emerald-700',
    inactiveBorder: 'hover:border-emerald-200 hover:bg-emerald-50/40',
    accentText: 'text-emerald-700',
  },
  teal: {
    activeBg: 'bg-teal-600 text-white shadow-teal-200/50',
    activeRing: 'ring-2 ring-teal-500/30',
    activeBadge: 'bg-white/20 text-white',
    inactiveIconBg: 'bg-teal-50 text-teal-700',
    inactiveBorder: 'hover:border-teal-200 hover:bg-teal-50/40',
    accentText: 'text-teal-700',
  },
  indigo: {
    activeBg: 'bg-indigo-600 text-white shadow-indigo-200/50',
    activeRing: 'ring-2 ring-indigo-500/30',
    activeBadge: 'bg-white/20 text-white',
    inactiveIconBg: 'bg-indigo-50 text-indigo-700',
    inactiveBorder: 'hover:border-indigo-200 hover:bg-indigo-50/40',
    accentText: 'text-indigo-700',
  },
  amber: {
    activeBg: 'bg-amber-600 text-white shadow-amber-200/50',
    activeRing: 'ring-2 ring-amber-500/30',
    activeBadge: 'bg-white/20 text-white',
    inactiveIconBg: 'bg-amber-50 text-amber-700',
    inactiveBorder: 'hover:border-amber-200 hover:bg-amber-50/40',
    accentText: 'text-amber-700',
  },
  sky: {
    activeBg: 'bg-sky-600 text-white shadow-sky-200/50',
    activeRing: 'ring-2 ring-sky-500/30',
    activeBadge: 'bg-white/20 text-white',
    inactiveIconBg: 'bg-sky-50 text-sky-700',
    inactiveBorder: 'hover:border-sky-200 hover:bg-sky-50/40',
    accentText: 'text-sky-700',
  },
};

export default function RoleNavTabs({
  title = 'Pilih Tampilan Sesuai Peran',
  description = 'Akun Anda memiliki beberapa akses wewenang. Pilih modul yang ingin Anda buka saat ini.',
  availableRoles,
  activeRole,
  variant = 'grid',
  onRoleChange,
}: RoleNavTabsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isModalOpen]);

  const handleRoleClick = (e: React.MouseEvent, roleTab: RoleTabItem) => {
    if (onRoleChange) {
      e.preventDefault();
      setIsModalOpen(false);
      if (roleTab.id !== activeRole) {
        onRoleChange(roleTab.id);
      }
    } else {
      setIsModalOpen(false);
    }
  };

  if (!availableRoles || availableRoles.length <= 1) {
    return null;
  }

  const activeTabItem = availableRoles.find((r) => r.id === activeRole) || availableRoles[0];
  const ActiveIcon = ICON_MAP[activeTabItem.iconName] || BookOpen;

  // Render modal bawah jika variant === 'bottom-sheet'
  if (variant === 'bottom-sheet') {
    const activeTheme = THEME_STYLES[activeTabItem.colorTheme] || THEME_STYLES.teal;

    return (
      <>
        {/* Trigger Card Kompak */}
        <div
          onClick={() => setIsModalOpen(true)}
          className="w-full flex items-center justify-between bg-white/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-teal-300 hover:shadow-xs transition-all cursor-pointer group select-none animate-fade-in"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm shadow-2xs group-hover:scale-105 transition-transform ${activeTheme.inactiveIconBg} border border-slate-200/60`}>
              <ActiveIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {activeTabItem.label}
                </p>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/70">
                  {activeTabItem.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate hidden sm:block">
                {activeTabItem.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 p-2 min-[481px]:px-3.5 min-[481px]:py-2 rounded-xl bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-700 text-xs font-bold transition-all border border-teal-200/70 shrink-0 cursor-pointer shadow-2xs"
          >
            <span className="max-[480px]:hidden">Ganti Peran</span>
            <ChevronDown className="w-3.5 h-3.5 text-teal-600 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>

        {/* Modal Bawah (Bottom Sheet) */}
        {mounted && isModalOpen && createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsModalOpen(false);
            }}
          >
            <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
              {/* Drag Handle (Mobile) */}
              <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              {/* Header Bottom Sheet */}
              <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">
                      {title}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer transition-colors shrink-0"
                  aria-label="Tutup modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List Role Items */}
              <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-2.5">
                {availableRoles.map((roleTab) => {
                  const isSelected = roleTab.id === activeRole;
                  const Icon = ICON_MAP[roleTab.iconName] || BookOpen;
                  const theme = THEME_STYLES[roleTab.colorTheme] || THEME_STYLES.teal;

                  return (
                    <Link
                      key={roleTab.id}
                      href={roleTab.href}
                      prefetch={true}
                      onClick={(e) => handleRoleClick(e, roleTab)}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${isSelected
                        ? 'border-teal-600 bg-teal-50/70 shadow-xs ring-1 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30 hover:shadow-xs'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0 border transition-transform ${isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                            : `${theme.inactiveIconBg} border-slate-200/60`
                            }`}
                        >
                          <Icon className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-teal-950' : 'text-slate-900'}`}>
                              {roleTab.label}
                            </p>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${isSelected
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                              {roleTab.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {roleTab.subtitle}
                          </p>
                          {isSelected && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-teal-700">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Sedang Aktif</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                          ? 'bg-teal-600 border-teal-600'
                          : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Footer Bottom Sheet */}
              <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 safe-area-inset-bottom">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="w-full bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 p-3.5 sm:p-5 shadow-xs space-y-3 sm:space-y-4 animate-fade-in">
      {/* Header bar switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                {title}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <Sparkles className="w-3 h-3 text-purple-500" />
                {availableRoles.length} Peran Aktif
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {description}
            </p>
          </div>
        </div>

        {activeTabItem && (
          <div className="flex items-center gap-1.5 self-start sm:self-center text-[11px] text-slate-600 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/70">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">Tampilan aktif:</span>
            <span className="font-bold text-slate-800">{activeTabItem.label}</span>
          </div>
        )}
      </div>

      {/* Role Navigation Button Grid / Scrollable Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {availableRoles.map((roleTab) => {
          const isActive = roleTab.id === activeRole;
          const Icon = ICON_MAP[roleTab.iconName] || BookOpen;
          const theme = THEME_STYLES[roleTab.colorTheme] || THEME_STYLES.emerald;

          return (
            <Link
              key={roleTab.id}
              href={roleTab.href}
              prefetch={true}
              onClick={(e) => handleRoleClick(e, roleTab)}
              className={`group relative flex items-start gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-98 select-none ${isActive
                ? `${theme.activeBg} border-transparent shadow-md ${theme.activeRing} scale-[1.01]`
                : `bg-white/80 text-slate-700 border-slate-200/80 hover:bg-white hover:shadow-xs ${theme.inactiveBorder}`
                }`}
            >
              {/* Icon Container */}
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-2xs ${isActive ? 'bg-white/20 text-white' : theme.inactiveIconBg
                  }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`text-xs sm:text-[13px] font-bold tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-900 group-hover:text-slate-950'
                      }`}
                  >
                    {roleTab.label}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${isActive
                      ? theme.activeBadge
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/80'
                      }`}
                  >
                    {roleTab.badge}
                  </span>
                </div>

                <p
                  className={`text-[11px] leading-tight line-clamp-1 mt-0.5 ${isActive ? 'text-white/80' : 'text-slate-500'
                    }`}
                >
                  {roleTab.subtitle}
                </p>

                {isActive && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-white/90">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Sedang Dibuka</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
