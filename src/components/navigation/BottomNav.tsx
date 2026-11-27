'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveRole } from '@/components/navigation/ActiveRoleContext';
import { getScopedRoleCodesForTab } from '@/lib/role-context';
import {
  Home,
  BookOpen,
  QrCode,
  CalendarDays,
  Users,
  FileText,
  ShieldCheck,
  Presentation,
  GraduationCap,
  Sparkles,
  CheckSquare,
} from 'lucide-react';

interface BottomNavProps {
  roleCodes?: string[];
}

export default function BottomNav({ roleCodes = [] }: BottomNavProps) {
  const pathname = usePathname() || '';
  const activeRoleCtx = useActiveRole();

  const scopedRoleCodes =
    activeRoleCtx && activeRoleCtx.availableRoles.length > 0
      ? getScopedRoleCodesForTab(activeRoleCtx.activeRole, roleCodes)
      : roleCodes;

  const isAdmin = scopedRoleCodes.includes('ADMIN_MASTER');
  const isPj =
    scopedRoleCodes.includes('PJ_KELOMPOK') ||
    scopedRoleCodes.includes('PJ_DESA') ||
    scopedRoleCodes.includes('PJ_DAERAH');
  const isPengajar =
    scopedRoleCodes.includes('PENGAJAR') || scopedRoleCodes.includes('WALI_KELAS');
  const isOrangTua = scopedRoleCodes.includes('ORANG_TUA');

  // Configure role-tailored navigation items & styles
  const navConfig = (() => {
    if (isAdmin) {
      return {
        activeText: 'text-purple-700 font-bold',
        activeBg: 'scale-105',
        activeIndicator: 'bg-purple-600',
        activeDot: 'bg-purple-600',
        centerGradient: 'from-slate-900 via-purple-900 to-slate-800',
        centerLabel: 'Analitika',
        centerIcon: Presentation,
        centerHref: '/analisis',
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
          { href: '/laporan', label: 'Rapor Anak', icon: GraduationCap, isActive: pathname.startsWith('/laporan') },
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
        { href: '/laporan', label: 'Rapor', icon: GraduationCap, isActive: pathname.startsWith('/laporan') },
      ],
      rightItems: [
        { href: '/tugas', label: 'Tugas', icon: CheckSquare, isActive: pathname.startsWith('/tugas') },
        { href: '/jadwal', label: 'Jadwal', icon: CalendarDays, isActive: pathname.startsWith('/jadwal') },
      ],
    };
  })();

  const navItems = [
    ...navConfig.leftItems,
    {
      href: navConfig.centerHref,
      label: navConfig.centerLabel,
      icon: navConfig.centerIcon,
      isActive:
        pathname === navConfig.centerHref ||
        pathname.startsWith(`${navConfig.centerHref}/`),
    },
    ...navConfig.rightItems,
  ];

  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md z-40 rounded-[26px] bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_12px_32px_-6px_rgba(15,23,42,0.14)] safe-area-bottom">
      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={true}
              aria-current={item.isActive ? 'page' : undefined}
              className={`relative flex-1 min-w-0 min-h-[52px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                item.isActive
                  ? navConfig.activeText
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              {item.isActive && (
                <span
                  aria-hidden="true"
                  className={`absolute -top-1 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full ${navConfig.activeIndicator} transition-all duration-300`}
                />
              )}

              <div
                className={`p-1 rounded-xl transition-all ${
                  item.isActive ? navConfig.activeBg : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    item.isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'
                  }`}
                />
              </div>
              <span className="text-[11px] sm:text-xs mt-0.5 tracking-tight text-center truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
