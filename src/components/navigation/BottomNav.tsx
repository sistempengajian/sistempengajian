'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  QrCode,
  CalendarDays,
  Users,
  FileText,
  ShieldCheck,
  Shield,
  GraduationCap,
  Sparkles,
  CheckSquare,
} from 'lucide-react';

interface BottomNavProps {
  roleCodes?: string[];
}

export default function BottomNav({ roleCodes = [] }: BottomNavProps) {
  const pathname = usePathname();

  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isPengajar = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');
  const isOrangTua = roleCodes.includes('ORANG_TUA');

  // Configure role-tailored navigation items & styles
  const navConfig = (() => {
    if (isAdmin) {
      return {
        activeText: 'text-purple-700 font-bold',
        activeBg: 'scale-105',
        activeIndicator: 'bg-purple-600',
        activeDot: 'bg-purple-600',
        centerGradient: 'from-slate-900 via-purple-900 to-slate-800',
        centerLabel: 'Kendali',
        centerIcon: Shield,
        centerHref: '/dashboard',
        leftItems: [
          { href: '/dashboard', label: 'Home', icon: Home, isActive: pathname === '/dashboard' },
          { href: '/kurikulum', label: 'Kurikulum', icon: BookOpen, isActive: pathname.startsWith('/kurikulum') },
        ],
        rightItems: [
          { href: '/tugas', label: 'Tugas', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
          { href: '/jadwal', label: 'Jadwal', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
        ],
      };
    }

    if (isPj) {
      return {
        activeText: 'text-blue-700 font-bold',
        activeBg: 'scale-105',
        activeIndicator: 'bg-blue-600',
        activeDot: 'bg-blue-600',
        centerGradient: 'from-blue-700 via-indigo-700 to-slate-800',
        centerLabel: 'Approval',
        centerIcon: ShieldCheck,
        centerHref: '/private-remedial',
        leftItems: [
          { href: '/dashboard', label: 'Home', icon: Home, isActive: pathname === '/dashboard' },
          { href: '/jadwal', label: 'Jadwal', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
        ],
        rightItems: [
          { href: '/tugas', label: 'Tugas', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
          { href: '/kurikulum', label: 'Kurikulum', icon: BookOpen, isActive: pathname.startsWith('/kurikulum') },
        ],
      };
    }

    if (isPengajar) {
      return {
        activeText: 'text-teal-700 font-bold',
        activeBg: 'scale-105',
        activeIndicator: 'bg-teal-600',
        activeDot: 'bg-teal-600',
        centerGradient: 'from-teal-700 via-teal-600 to-cyan-500',
        centerLabel: 'Sesi QR',
        centerIcon: QrCode,
        centerHref: '/presensi',
        leftItems: [
          { href: '/dashboard', label: 'Home', icon: Home, isActive: pathname === '/dashboard' },
          { href: '/jadwal', label: 'Jadwal Ajar', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
        ],
        rightItems: [
          { href: '/tugas', label: 'Tugas', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
          { href: '/kurikulum', label: 'Jurnal', icon: BookOpen, isActive: pathname.startsWith('/kurikulum') },
        ],
      };
    }

    if (isOrangTua) {
      return {
        activeText: 'text-indigo-700 font-bold',
        activeBg: 'scale-105',
        activeIndicator: 'bg-indigo-600',
        activeDot: 'bg-indigo-600',
        centerGradient: 'from-indigo-600 via-purple-600 to-rose-500',
        centerLabel: 'Presensi',
        centerIcon: FileText,
        centerHref: '/presensi',
        leftItems: [
          { href: '/dashboard', label: 'Home', icon: Home, isActive: pathname === '/dashboard' },
          { href: '/kurikulum', label: 'Rapor Anak', icon: GraduationCap, isActive: pathname.startsWith('/kurikulum') },
        ],
        rightItems: [
          { href: '/tugas', label: 'Tugas Anak', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
          { href: '/jadwal', label: 'Jadwal Anak', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
        ],
      };
    }

    // Default Santri
    return {
      activeText: 'text-emerald-700 font-bold',
      activeBg: 'scale-105',
      activeIndicator: 'bg-emerald-600',
      activeDot: 'bg-emerald-600',
      centerGradient: 'from-emerald-600 via-emerald-500 to-teal-400',
      centerLabel: 'Presensi',
      centerIcon: QrCode,
      centerHref: '/presensi',
      leftItems: [
        { href: '/dashboard', label: 'Home', icon: Home, isActive: pathname === '/dashboard' },
        { href: '/kurikulum', label: 'Kurikulum', icon: BookOpen, isActive: pathname.startsWith('/kurikulum') },
      ],
      rightItems: [
        { href: '/tugas', label: 'Tugas', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
        { href: '/jadwal', label: 'Jadwal', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
      ],
    };
  })();

  const CenterIcon = navConfig.centerIcon;
  const isCenterActive = pathname === navConfig.centerHref || (navConfig.centerHref === '/presensi' && pathname.startsWith('/presensi'));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 safe-area-bottom shadow-lg shadow-slate-900/5">
      <div className="max-w-md mx-auto px-3 py-1.5 flex items-center justify-between relative">
        {/* Left 2 Items */}
        {navConfig.leftItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={true}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 ${item.isActive
                ? navConfig.activeText
                : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
            >
              {/* Active Top Bar Indicator */}
              {item.isActive && (
                <span
                  className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-[3px] rounded-full ${navConfig.activeIndicator} transition-all duration-300`}
                />
              )}

              <div
                className={`p-1 rounded-xl transition-all ${item.isActive ? navConfig.activeBg : ''
                  }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight text-center">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Action: Role-Tailored (Inline, slightly larger, subtle breathing space) */}
        <div className="flex-1 flex flex-col items-center justify-center mx-1.5 sm:mx-2.5">
          <Link
            href={navConfig.centerHref}
            prefetch={true}
            className="group relative flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200"
            title={navConfig.centerLabel}
          >
            {/* Active Top Bar Indicator */}
            {isCenterActive && (
              <span
                className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-[3px] rounded-full ${navConfig.activeIndicator} transition-all duration-300`}
              />
            )}

            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr ${navConfig.centerGradient} text-white flex items-center justify-center shadow-sm group-hover:scale-105 group-active:scale-95 transition-all duration-200 ${isCenterActive ? 'ring-2 ring-offset-2 ring-emerald-500/50' : ''
                }`}
            >
              <CenterIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className={`text-[10px] font-semibold mt-0.5 tracking-tight truncate max-w-[72px] text-center ${isCenterActive ? navConfig.activeText : 'text-slate-700'
              }`}>
              {navConfig.centerLabel}
            </span>
          </Link>
        </div>

        {/* Right 2 Items */}
        {navConfig.rightItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={true}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all duration-200 ${item.isActive
                ? navConfig.activeText
                : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
            >
              {/* Active Top Bar Indicator */}
              {item.isActive && (
                <span
                  className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-[3px] rounded-full ${navConfig.activeIndicator} transition-all duration-300`}
                />
              )}

              <div
                className={`p-1 rounded-xl transition-all ${item.isActive ? navConfig.activeBg : ''
                  }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              <span className="text-[10px] mt-0.5 tracking-tight text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
