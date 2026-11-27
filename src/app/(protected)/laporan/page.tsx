import React from 'react';
import {
  getAccessibleStudents,
  getChildDevelopmentReport,
} from './actions';
import LaporanClientWrapper from '@/components/laporan/LaporanClientWrapper';
import { ChildDevelopmentReport } from './types';
import { UserX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { RoleTabId, RoleTabItem } from '@/components/navigation/RoleNavTabs';
import { requireProtectedAuth } from '@/lib/auth';
import { normalizeRoleTabParam } from '@/lib/role-context';
import { resolveGlobalActiveRole } from '@/lib/role-context-server';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

export const metadata = {
  title: 'Laporan Perkembangan Santri | Sistem Pengajian',
  description: 'Rekapitulasi presensi kehadiran, penguasaan materi kurikulum, dan evaluasi karakter santri.',
};

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    studentId?: string;
    childId?: string;
    period?: string;
    role?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const targetStudentId = resolvedParams.studentId || resolvedParams.childId;
  const targetPeriod = resolvedParams.period || 'THIS_MONTH';

  // Tentukan role pilihan: prioritaskan ?role= eksplisit (Opsi A), fallback ke cookie global
  const normalizedUrlRole = normalizeRoleTabParam(resolvedParams.role);
  const { activeRole: preferredTabId } = await resolveGlobalActiveRole({
    searchParamRole: normalizedUrlRole,
    availableRoleIds: ['manage', 'teacher', 'parent', 'student'],
  });

  let preferredRole: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN' | undefined;
  if (preferredTabId === 'student') preferredRole = 'SANTRI';
  else if (preferredTabId === 'parent') preferredRole = 'ORANG_TUA';
  else if (preferredTabId === 'teacher') preferredRole = 'PENGAJAR';
  else if (preferredTabId === 'manage') preferredRole = 'ADMIN';

  const { effectiveUserId } = await requireProtectedAuth('lean');

  // 1. Ambil daftar santri yang diizinkan untuk diakses user ini menggunakan ID Prisma yang valid
  const { students, defaultStudentId, userRoleCategory, availableRoles } =
    await getAccessibleStudents(effectiveUserId, preferredRole);

  if (students.length === 0 || !defaultStudentId) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
          <UserX className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">
          Belum Ada Data Santri Terhubung
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Akun Anda saat ini belum memiliki relasi ananda santri atau kelas binaan aktif. Hubungi pengurus wilayah / admin untuk menautkan data santri.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Tentukan santri aktif
  const activeStudentId =
    targetStudentId && students.some((s) => s.id === targetStudentId)
      ? targetStudentId
      : defaultStudentId;

  // 3. Parallel pre-fetching laporan perkembangan untuk santri yang tersedia (maksimal 4 santri pertama)
  const preloadedReportsMap: Record<string, ChildDevelopmentReport> = {};

  const studentsToPreload = students.slice(0, 4);
  const reportResults = await Promise.allSettled(
    studentsToPreload.map(async (s) => {
      const report = await getChildDevelopmentReport(s.id, targetPeriod);
      return { key: `${s.id}_${targetPeriod}`, report };
    })
  );

  reportResults.forEach((res) => {
    if (res.status === 'fulfilled') {
      preloadedReportsMap[res.value.key] = res.value.report;
    }
  });

  const initialReport =
    preloadedReportsMap[`${activeStudentId}_${targetPeriod}`] ||
    (await getChildDevelopmentReport(activeStudentId, targetPeriod));

  // Siapkan item navigasi role kanonik (?role=student|parent|teacher|manage)
  const roleNavItems: RoleTabItem[] = availableRoles.map((r) => {
    if (r.id === 'SANTRI') {
      return {
        id: 'student',
        label: 'Santri',
        roleTitle: 'Santri (Rapor Saya)',
        badge: 'Santri',
        subtitle: 'Lihat capaian & perkembangan belajar pribadi',
        iconName: 'GraduationCap',
        colorTheme: 'emerald',
        href: '/laporan?role=student',
      };
    }
    if (r.id === 'ORANG_TUA') {
      return {
        id: 'parent',
        label: 'Orang Tua',
        roleTitle: 'Orang Tua (Rapor Anak)',
        badge: 'Wali',
        subtitle: 'Pantau perkembangan dan rapor ananda',
        iconName: 'Heart',
        colorTheme: 'indigo',
        href: '/laporan?role=parent',
      };
    }
    if (r.id === 'PENGAJAR') {
      return {
        id: 'teacher',
        label: 'Pengajar',
        roleTitle: 'Wali Kelas / Pengajar',
        badge: 'Guru',
        subtitle: 'Kelola & evaluasi rapor santri binaan',
        iconName: 'School',
        colorTheme: 'teal',
        href: '/laporan?role=teacher',
      };
    }
    return {
      id: 'manage',
      label: 'Admin',
      roleTitle: 'Pengurus / Admin',
      badge: 'Admin',
      subtitle: 'Tinjau rekap rapor santri kelompok binaan',
      iconName: 'ShieldCheck',
      colorTheme: 'amber',
      href: '/laporan?role=manage',
    };
  });

  const activeRoleTabId: RoleTabId =
    userRoleCategory === 'SANTRI'
      ? 'student'
      : userRoleCategory === 'PENGAJAR'
        ? 'teacher'
        : userRoleCategory === 'ADMIN'
          ? 'manage'
          : 'parent';

  return (
    <ErrorBoundary sectionName="Laporan Perkembangan">
      <LaporanClientWrapper
        key={activeRoleTabId}
        initialReport={initialReport}
        availableStudents={students}
        preloadedReportsMap={preloadedReportsMap}
        userRoleCategory={userRoleCategory}
        availableRoles={roleNavItems}
        activeRoleTabId={activeRoleTabId}
      />
    </ErrorBoundary>
  );
}
