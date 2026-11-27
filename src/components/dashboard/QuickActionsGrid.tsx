import React from 'react';
import Link from 'next/link';
import {
  School,
  BookOpen,
  CheckSquare,
  CalendarDays,
  Users,
  QrCode,
  GraduationCap,
  Presentation,
  Sparkles,
  Shield,
  Layers,
  Landmark,
  Trophy,
  Award,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import Soft3DIcon, { type Soft3DColorScheme } from '@/components/dashboard/Soft3DIcon';

type QuickRoleKey = 'ADMIN_MASTER' | 'PJ' | 'PENGAJAR' | 'ORANG_TUA' | 'SANTRI';

interface QuickActionItem {
  label: string;
  href: string;
  icon: LucideIcon;
  colorScheme: Soft3DColorScheme;
  inPrimaryBottomNav?: boolean;
  showPendingDot?: boolean;
}

interface QuickActionsGridProps {
  generationName?: string | null;
  theme: {
    roleKey?: QuickRoleKey;
    menuIconClass?: string;
    [key: string]: any;
  };
  isSantri: boolean;
  isOrangTua: boolean;
  isPengajar: boolean;
  isWaliKelas: boolean;
  isPj: boolean;
  isAdmin: boolean;
  pendingApprovalsCount: number;
}

const ROLE_MENU_ITEMS: Record<QuickRoleKey, QuickActionItem[]> = {
  ADMIN_MASTER: [
    { label: 'Kelola Kelas', href: '/kelas?role=manage', icon: School, colorScheme: 'blue' },
    { label: 'Analitika Eksekutif', href: '/analisis', icon: Presentation, colorScheme: 'indigo' },
    { label: 'Approval', href: '/private-remedial', icon: Shield, colorScheme: 'rose', showPendingDot: true },
    { label: 'Kelola User', href: '/users', icon: Users, colorScheme: 'emerald' },
    { label: 'Jenjang Generasi', href: '/generasi', icon: Layers, colorScheme: 'amber' },
    { label: 'Tingkatan Wilayah', href: '/organisasi', icon: Landmark, colorScheme: 'blue' },
    { label: 'Kurikulum', href: '/kurikulum?role=manage', icon: BookOpen, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Jadwal Global', href: '/jadwal?role=manage', icon: CalendarDays, colorScheme: 'blue', inPrimaryBottomNav: true },
    { label: 'Monitoring Tugas', href: '/tugas?role=manage', icon: CheckSquare, colorScheme: 'rose', inPrimaryBottomNav: true },
  ],
  PJ: [
    { label: 'Kelola Kelas', href: '/kelas?role=manage', icon: School, colorScheme: 'blue' },
    { label: 'Analitika Eksekutif', href: '/analisis', icon: Presentation, colorScheme: 'indigo' },
    { label: 'Kelola User', href: '/users', icon: Users, colorScheme: 'emerald' },
    { label: 'Jenjang Generasi', href: '/generasi', icon: Layers, colorScheme: 'amber' },
    { label: 'Tingkatan Wilayah', href: '/organisasi', icon: Landmark, colorScheme: 'rose' },
    { label: 'Profil & Akun', href: '/profil', icon: UserIcon, colorScheme: 'indigo' },
    { label: 'Kurikulum', href: '/kurikulum?role=manage', icon: BookOpen, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Kelola Jadwal', href: '/jadwal?role=manage', icon: CalendarDays, colorScheme: 'blue', inPrimaryBottomNav: true },
    { label: 'Monitoring Tugas', href: '/tugas?role=manage', icon: CheckSquare, colorScheme: 'rose', inPrimaryBottomNav: true },
    { label: 'Approval', href: '/private-remedial', icon: Shield, colorScheme: 'rose', inPrimaryBottomNav: true, showPendingDot: true },
  ],
  PENGAJAR: [
    { label: 'Kelas Binaan', href: '/kelas?role=teacher', icon: School, colorScheme: 'blue' },
    { label: 'Rapor Belajar', href: '/laporan', icon: GraduationCap, colorScheme: 'emerald' },
    { label: 'Analitika & Presentasi', href: '/analisis', icon: Presentation, colorScheme: 'indigo' },
    { label: 'Private / Remedial', href: '/private-remedial', icon: Sparkles, colorScheme: 'amber' },
    { label: 'Buka Presensi', href: '/presensi?role=teacher', icon: QrCode, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Kurikulum', href: '/kurikulum?role=teacher', icon: BookOpen, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Jadwal Mengajar', href: '/jadwal?role=teacher', icon: CalendarDays, colorScheme: 'blue', inPrimaryBottomNav: true },
    { label: 'Tugas Santri', href: '/tugas?role=teacher', icon: CheckSquare, colorScheme: 'rose', inPrimaryBottomNav: true },
  ],
  ORANG_TUA: [
    { label: 'Kelas Ananda', href: '/kelas?role=parent', icon: School, colorScheme: 'blue' },
    { label: 'Target Materi', href: '/kurikulum?role=parent', icon: BookOpen, colorScheme: 'emerald' },
    { label: 'Halaqah Khusus', href: '/private-remedial', icon: Users, colorScheme: 'indigo' },
    { label: 'Profil & Akun', href: '/profil', icon: UserIcon, colorScheme: 'amber' },
    { label: 'Rapor Anak', href: '/laporan?role=parent', icon: GraduationCap, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Tugas Anak', href: '/tugas?role=parent', icon: CheckSquare, colorScheme: 'rose', inPrimaryBottomNav: true },
    { label: 'Jadwal Anak', href: '/jadwal?role=parent', icon: CalendarDays, colorScheme: 'blue', inPrimaryBottomNav: true },
    { label: 'Presensi Anak', href: '/presensi?role=parent', icon: QrCode, colorScheme: 'indigo', inPrimaryBottomNav: true },
  ],
  SANTRI: [
    { label: 'Kelas Saya', href: '/kelas?role=student', icon: School, colorScheme: 'blue' },
    { label: 'Kurikulum', href: '/kurikulum?role=student', icon: BookOpen, colorScheme: 'emerald' },
    { label: 'Halaqah Khusus', href: '/private-remedial', icon: Users, colorScheme: 'indigo' },
    { label: 'Misi & Trofi', href: '/gamifikasi', icon: Award, colorScheme: 'amber' },
    { label: 'Leaderboard', href: '/leaderboard', icon: Trophy, colorScheme: 'rose' },
    { label: 'Profil & Akun', href: '/profil', icon: UserIcon, colorScheme: 'emerald' },
    { label: 'Scan Presensi', href: '/presensi?role=student', icon: QrCode, colorScheme: 'emerald', inPrimaryBottomNav: true },
    { label: 'Rapor Belajar', href: '/laporan?role=student', icon: GraduationCap, colorScheme: 'blue', inPrimaryBottomNav: true },
    { label: 'Tugas Saya', href: '/tugas?role=student', icon: CheckSquare, colorScheme: 'rose', inPrimaryBottomNav: true },
    { label: 'Jadwal Saya', href: '/jadwal?role=student', icon: CalendarDays, colorScheme: 'indigo', inPrimaryBottomNav: true },
  ],
};

function resolveGridColsClass(count: number): string {
  if (count <= 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 4) return 'grid-cols-2 sm:grid-cols-4';
  if (count === 5) return 'grid-cols-3 sm:grid-cols-5';
  return 'grid-cols-3 sm:grid-cols-6';
}

/**
 * Displays quick action menus aligned with the globally active role using Soft 3D squircle icons
 * inside a symmetric soft-glass card grid.
 */
export default function QuickActionsGrid({
  theme,
  isSantri,
  isOrangTua,
  isPengajar,
  isWaliKelas,
  isPj,
  isAdmin,
  pendingApprovalsCount,
}: QuickActionsGridProps) {
  const availableRoles: QuickRoleKey[] = [];
  if (isAdmin) availableRoles.push('ADMIN_MASTER');
  if (isPj && !isAdmin) availableRoles.push('PJ');
  if (isPengajar || isWaliKelas) availableRoles.push('PENGAJAR');
  if (isOrangTua) availableRoles.push('ORANG_TUA');
  if (isSantri) availableRoles.push('SANTRI');

  const activeRole: QuickRoleKey =
    theme.roleKey && availableRoles.includes(theme.roleKey)
      ? theme.roleKey
      : theme.roleKey || availableRoles[0] || 'SANTRI';

  const visibleItems = (ROLE_MENU_ITEMS[activeRole] || []).filter(
    (item) => !item.inPrimaryBottomNav
  );

  const gridColsClass = resolveGridColsClass(visibleItems.length);

  return (
    <section className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/90 p-4 sm:p-5 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-2 px-0.5 mb-3">
        <h2 className={COMMON_THEME.sectionTitleClass}>
          Akses Cepat
        </h2>
      </div>

      <nav aria-label="Menu Fitur Lainnya">
        <div className={`grid ${gridColsClass} gap-x-2 gap-y-2.5 sm:gap-x-3 sm:gap-y-3 items-stretch`}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const hasPending = Boolean(item.showPendingDot && pendingApprovalsCount > 0);
            const badgeText = pendingApprovalsCount > 99 ? '99+' : String(pendingApprovalsCount);
            return (
              <Link
                key={`${activeRole}-${item.label}`}
                href={item.href}
                prefetch={true}
                aria-label={
                  hasPending
                    ? `${item.label} (${pendingApprovalsCount} menunggu verifikasi)`
                    : undefined
                }
                className="group flex flex-col items-center justify-start px-1.5 py-2 rounded-2xl transition-all duration-150 active:scale-95 hover:bg-white/75 cursor-pointer text-center min-w-0"
              >
                <div className="relative shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <Soft3DIcon
                    icon={Icon}
                    colorScheme={item.colorScheme}
                    shape="squircle"
                    size="md"
                  />
                  {hasPending && (
                    <span className="absolute -top-1.5 -right-1.5 z-20 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                      {badgeText}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-snug line-clamp-2 w-full break-words">
                  {item.label}
                  {hasPending && (
                    <span className="sr-only"> ({pendingApprovalsCount} menunggu verifikasi)</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
