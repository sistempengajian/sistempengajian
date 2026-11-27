'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Bell,
  X,
  User as UserIcon,
} from 'lucide-react';
import { RoleTheme } from '@/lib/theme';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface HeaderNotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  href?: string;
  unread?: boolean;
}

interface AppHeaderProps {
  roleTheme: RoleTheme;
  roleCodes?: string[];
  userName?: string;
  notifications?: HeaderNotificationItem[];
}

export default function AppHeader({
  roleTheme,
  roleCodes = [],
  userName,
  notifications = [],
}: AppHeaderProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(isNotifOpen, notifPanelRef, () => setIsNotifOpen(false));

  const unreadCount = notifications.filter(
    (item) => item.unread && !readIds.includes(item.id)
  ).length;
  const hasUnread = unreadCount > 0;

  // Dynamic header transparency on scroll:
  // At top (scrollY <= 10): 0% opacity / completely transparent (bg-transparent, no border, no shadow)
  // When scrolled down (scrollY > 10): frosted glass translucency (bg-white/75 backdrop-blur-md)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close notifications on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsNotifOpen(false);
      }
    }

    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotifOpen]);

  const handleMarkAllRead = () => {
    setReadIds(notifications.map((n) => n.id));
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-white/75 backdrop-blur-md border-b border-slate-200/60 shadow-sm'
          : 'bg-transparent backdrop-blur-none border-b border-transparent shadow-none'
      }`}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Left: Branding & App Title */}
        <Link
          href="/dashboard"
          prefetch={true}
          className="flex items-center gap-2.5 sm:gap-3 group select-none min-w-0"
        >
          {/* Vibrant Blue-Teal Quran / Book Emblem */}
          <div
            className="relative overflow-hidden w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-teal-500 text-white flex items-center justify-center group-hover:scale-105 transition-all duration-200 flex-shrink-0"
            style={{
              boxShadow: '0 6px 16px -3px rgba(37, 99, 235, 0.42)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  'radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0) 62%)',
                boxShadow:
                  'inset 0 1.5px 3px rgba(255, 255, 255, 0.45), inset 0 -3px 6px rgba(15, 23, 42, 0.18)',
              }}
            />
            <BookOpen className="relative z-10 w-5 h-5 stroke-[2.1] drop-shadow-sm" />
          </div>

          {/* Typography */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-tight group-hover:text-emerald-700 transition-colors truncate">
                Sistem Pengajian
              </span>

              {/* Role Indicator Badge (Clean, subtle pill) */}
              <span
                className={`hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleTheme.badgeClass}`}
              >
                {roleTheme.roleTitle}
              </span>
            </div>

            <span className="text-xs font-medium text-slate-600 tracking-normal block leading-tight truncate">
              Generasi Qur&apos;ani
            </span>
          </div>
        </Link>

        {/* Right: Notification Popover & Minimalist Profile Link */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Notification Menu Container */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-expanded={isNotifOpen}
              aria-label="Buka daftar notifikasi"
              className={`relative w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-2xl text-slate-600 hover:text-slate-900 active:scale-95 transition-all duration-200 border cursor-pointer ${
                isNotifOpen
                  ? 'bg-slate-100 text-slate-900 border-slate-300'
                  : isScrolled
                  ? 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm'
                  : 'bg-white/95 hover:bg-white border-white/90 shadow-[0_6px_16px_-4px_rgba(15,23,42,0.08)]'
              }`}
              title="Notifikasi"
            >
              <Bell className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
              {hasUnread && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-white"></span>
                </span>
              )}
            </button>

            {/* Floating Notification Popover (Full-width inset on narrow mobile to prevent 360px clipping) */}
            {isNotifOpen && (
              <div
                ref={notifPanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Panel Notifikasi"
                className="fixed inset-x-3 top-16 sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Notifikasi</span>
                    {hasUnread ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {unreadCount} Baru
                      </span>
                    ) : notifications.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                        Semua terbaca
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                        Kosong
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {hasUnread && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="min-h-[36px] text-xs font-medium text-slate-600 hover:text-emerald-700 hover:underline px-2.5 py-1.5 transition-colors cursor-pointer"
                      >
                        Tandai dibaca
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Tutup"
                      aria-label="Tutup daftar notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notifications List / Honest Empty State */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-2 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200/70">
                        <Bell className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800">
                        Belum ada pemberitahuan baru
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                        Pemberitahuan terkait jadwal pengajian, persetujuan approval, atau tugas terbaru akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const isUnread = Boolean(notif.unread && !readIds.includes(notif.id));
                      const itemClass = `p-3 rounded-xl border transition-all text-left flex gap-3 items-start ${
                        isUnread
                          ? 'bg-emerald-50/50 border-emerald-100/80 hover:bg-emerald-50'
                          : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/50'
                      }`;
                      const innerContent = (
                        <>
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isUnread
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200/70 text-slate-600'
                            }`}
                          >
                            <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {notif.title}
                              </h4>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {notif.time}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-snug">
                              {notif.message}
                            </p>
                          </div>
                        </>
                      );

                      if (notif.href) {
                        return (
                          <Link
                            key={notif.id}
                            href={notif.href}
                            prefetch={true}
                            onClick={() => {
                              setReadIds((prev) =>
                                prev.includes(notif.id) ? prev : [...prev, notif.id]
                              );
                              setIsNotifOpen(false);
                            }}
                            className={itemClass}
                          >
                            {innerContent}
                          </Link>
                        );
                      }

                      return (
                        <div key={notif.id} className={itemClass}>
                          {innerContent}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer hint */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-center">
                  <span className="text-xs text-slate-500 font-medium">
                    Notifikasi sistem realtime &bull; Sistem Pengajian
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Link */}
          <Link
            href="/profil"
            prefetch={true}
            className={`inline-flex items-center justify-center gap-2 w-11 h-11 sm:w-auto sm:h-10 sm:min-w-[44px] sm:px-3 rounded-2xl text-xs font-bold text-slate-700 hover:text-emerald-700 active:scale-95 transition-all duration-200 border select-none ${
              isScrolled
                ? 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm'
                : 'bg-white/95 hover:bg-white border-white/90 shadow-[0_6px_16px_-4px_rgba(15,23,42,0.08)]'
            }`}
            title="Profil Pengguna & Pengaturan Akun"
            aria-label="Buka Profil Pengguna"
          >
            <span className={`font-extrabold text-sm sm:text-xs ${roleTheme.heroNameColor || 'text-emerald-700'}`}>
              {userName ? userName.trim().charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </span>
            <span className="hidden sm:inline max-w-[110px] truncate text-slate-700">
              {userName ? userName.split(' ')[0] : 'Profil'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
