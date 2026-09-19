'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import {
  BookOpen,
  Bell,
  LogOut,
  Loader2,
  Check,
  Calendar,
  Sparkles,
  Inbox,
  X,
} from 'lucide-react';
import { logout } from '@/app/(auth)/actions';
import { RoleTheme } from '@/lib/theme';

interface AppHeaderProps {
  roleTheme: RoleTheme;
  roleCodes?: string[];
  userName?: string;
}

function LogoutButton({ isScrolled }: { isScrolled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`group inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 transition-all duration-200 active:scale-95 disabled:opacity-60 cursor-pointer select-none border ${
        isScrolled
          ? 'bg-white/80 hover:bg-rose-50/90 border-slate-200/80 hover:border-rose-200/80 shadow-sm'
          : 'bg-white/40 hover:bg-white/70 border-slate-200/50 hover:border-rose-200/60 shadow-none'
      }`}
      title="Keluar dari sesi"
      aria-label="Keluar dari akun"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
      ) : (
        <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" />
      )}
      <span className="hidden xs:inline sm:inline">Keluar</span>
    </button>
  );
}

export default function AppHeader({
  roleTheme,
  roleCodes = [],
  userName,
}: AppHeaderProps) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Role-appropriate sample notifications
  const sampleNotifications = [
    {
      id: 1,
      title: 'Jadwal Pengajian Aktif',
      message: 'Sesi pengajian pekan ini telah dijadwalkan secara reguler.',
      time: 'Baru saja',
      icon: Calendar,
      unread: true,
    },
    {
      id: 2,
      title: 'Pembaruan Kurikulum',
      message: 'Materi tajwid dan talaqqi surat Al-Mulk telah diperbarui.',
      time: '2 jam lalu',
      icon: Sparkles,
      unread: false,
    },
  ];

  const handleMarkAllRead = () => {
    setHasUnread(false);
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
          {/* Minimalist Logo Emblem */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:bg-emerald-600 group-hover:scale-105 transition-all duration-200 flex-shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </div>

          {/* Typography */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight leading-tight group-hover:text-emerald-700 transition-colors truncate">
                Sistem Pengajian
              </span>

              {/* Role Indicator Badge (Clean, subtle pill) */}
              <span
                className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleTheme.badgeClass}`}
              >
                {roleTheme.roleTitle}
              </span>
            </div>

            <span className="text-[11px] font-medium text-slate-400 tracking-normal block leading-tight truncate">
              Generasi Qur&apos;ani
            </span>
          </div>
        </Link>

        {/* Right: Notification Popover & Minimalist Logout Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Notification Menu Container */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-expanded={isNotifOpen}
              aria-label="Buka daftar notifikasi"
              className={`relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 active:scale-95 transition-all duration-200 border ${
                isNotifOpen
                  ? 'bg-slate-100 text-slate-900 border-slate-300'
                  : isScrolled
                  ? 'bg-white/80 hover:bg-slate-100/80 border-slate-200/80 shadow-sm'
                  : 'bg-white/40 hover:bg-white/70 border-slate-200/50 shadow-none'
              }`}
              title="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {hasUnread && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-white"></span>
                </span>
              )}
            </button>

            {/* Floating Notification Popover */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">Notifikasi</span>
                    {hasUnread ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        1 Baru
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500">
                        Semua terbaca
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {hasUnread && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-slate-500 hover:text-emerald-700 hover:underline px-1.5 py-0.5 transition-colors cursor-pointer"
                      >
                        Tandai dibaca
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsNotifOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Tutup"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sampleNotifications.map((notif) => {
                    const IconComp = notif.icon;
                    const isUnread = hasUnread && notif.unread;

                    return (
                      <div
                        key={notif.id}
                        className={`p-3 rounded-xl border transition-all text-left flex gap-3 items-start ${
                          isUnread
                            ? 'bg-emerald-50/50 border-emerald-100/80'
                            : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/50'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isUnread
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                              {notif.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer hint */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Notifikasi sistem realtime &bull; Sistem Pengajian
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Minimalist Clean Logout Button */}
          <form action={logout}>
            <LogoutButton isScrolled={isScrolled} />
          </form>
        </div>
      </div>
    </header>
  );
}
