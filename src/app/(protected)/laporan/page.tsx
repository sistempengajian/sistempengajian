import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getAccessibleStudents,
  getChildDevelopmentReport,
} from './actions';
import LaporanClientWrapper from '@/components/laporan/LaporanClientWrapper';
import { ChildDevelopmentReport } from './types';
import { UserX, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { RoleTabId, RoleTabItem } from '@/components/navigation/RoleNavTabs';

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

  // Parse role filter jika diberikan
  const rawRole = resolvedParams.role?.toUpperCase();
  let preferredRole: 'ORANG_TUA' | 'PENGAJAR' | 'SANTRI' | 'ADMIN' | undefined;
  if (rawRole === 'SANTRI' || rawRole === 'STUDENT') preferredRole = 'SANTRI';
  else if (rawRole === 'ORANG_TUA' || rawRole === 'PARENT') preferredRole = 'ORANG_TUA';
  else if (rawRole === 'PENGAJAR' || rawRole === 'TEACHER') preferredRole = 'PENGAJAR';
  else if (rawRole === 'ADMIN' || rawRole === 'MANAGE') preferredRole = 'ADMIN';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Ambil daftar santri yang diizinkan untuk diakses user ini
  const { students, defaultStudentId, userRoleCategory, availableRoles } =
    await getAccessibleStudents(user.id, preferredRole);

  if (students.length === 0 || !defaultStudentId) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
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

  // Siapkan item navigasi role untuk RoleNavTabs jika user memiliki multi-peran
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
        href: '/laporan?role=santri',
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
        href: '/laporan?role=orang_tua',
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
        href: '/laporan?role=pengajar',
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
      href: '/laporan?role=admin',
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
    <div className="px-3 sm:px-6 py-4 sm:py-6">
      <LaporanClientWrapper
        initialReport={initialReport}
        availableStudents={students}
        preloadedReportsMap={preloadedReportsMap}
        userRoleCategory={userRoleCategory}
        availableRoles={roleNavItems}
        activeRoleTabId={activeRoleTabId}
      />
    </div>
  );
}
