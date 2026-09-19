import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import {
  getClassesOverview,
  getStudentClassData,
  getHomeroomTeacherClassData,
  getParentClassData,
} from './queries';
import ClassManagementView from '@/components/kelas/ClassManagementView';
import StudentClassView from '@/components/kelas/student/StudentClassView';
import HomeroomClassView from '@/components/kelas/teacher/HomeroomClassView';
import ParentClassView from '@/components/kelas/parent/ParentClassView';
import ClassRoleNav, {
  ClassRoleTabItem,
  ClassRoleType,
} from '@/components/kelas/ClassRoleNav';

export const metadata: Metadata = {
  title: 'Kelas Pengajian | Sistem Pengajian',
  description: 'Ruang kelas pengajian berjenjang, penugasan wali kelas, dan pembinaan santri',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function KelasPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Ambil data user & relasi
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      fullName: true,
      organizationId: true,
      generationId: true,
      roles: { select: { role: true } },
      children: { select: { id: true }, take: 1 },
      homeroomClasses: { select: { id: true }, take: 1 },
      scheduleAssignments: { select: { id: true }, take: 1 },
    },
  });

  if (!currentUser) {
    redirect('/login');
  }

  const roleCodes = currentUser.roles.map((r) => r.role);
  const isManager =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  const isTeacher =
    roleCodes.includes('WALI_KELAS') ||
    roleCodes.includes('PENGAJAR') ||
    currentUser.homeroomClasses.length > 0 ||
    currentUser.scheduleAssignments.length > 0;

  const isParent =
    roleCodes.includes('ORANG_TUA') ||
    currentUser.children.length > 0;

  const isSantri =
    roleCodes.includes('SANTRI') ||
    (Boolean(currentUser.generationId) && Boolean(currentUser.organizationId) && !isManager && !isTeacher);

  // 2. Susun Tab Menu Sesuai Multi-Peran User
  const availableRoles: ClassRoleTabItem[] = [];

  if (isManager) {
    let badge = 'PJ Wilayah';
    if (roleCodes.includes('ADMIN_MASTER')) badge = 'Admin Master';
    else if (roleCodes.includes('PJ_DAERAH')) badge = 'PJ Daerah';
    else if (roleCodes.includes('PJ_DESA')) badge = 'PJ Desa';
    else if (roleCodes.includes('PJ_KELOMPOK')) badge = 'PJ Kelompok';

    availableRoles.push({
      id: 'manage',
      label: 'Kelola Kelas',
      roleTitle: 'Pengurus Wilayah',
      badge,
      subtitle: 'Manajemen kelas & penugasan wali kelas',
      iconName: 'ShieldCheck',
      colorTheme: 'emerald',
      href: '/kelas?role=manage',
    });
  }

  if (isTeacher) {
    const isWali = roleCodes.includes('WALI_KELAS') || currentUser.homeroomClasses.length > 0;
    availableRoles.push({
      id: 'teacher',
      label: 'Kelas Binaan',
      roleTitle: 'Wali Kelas & Pengajar',
      badge: isWali ? 'Wali Kelas' : 'Pengajar',
      subtitle: 'Monitoring santri, presensi, & tugas kelas',
      iconName: 'GraduationCap',
      colorTheme: 'teal',
      href: '/kelas?role=teacher',
    });
  }

  if (isParent) {
    availableRoles.push({
      id: 'parent',
      label: 'Kelas Ananda',
      roleTitle: 'Orang Tua / Wali',
      badge: 'Orang Tua',
      subtitle: 'Pantau kelas, jadwal, & tugas ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: '/kelas?role=parent',
    });
  }

  if (isSantri) {
    availableRoles.push({
      id: 'student',
      label: 'Kelas Saya',
      roleTitle: 'Santri Binaan',
      badge: 'Santri',
      subtitle: 'Ruang kelas belajar, jadwal, & tugas',
      iconName: 'School',
      colorTheme: 'amber',
      href: '/kelas?role=student',
    });
  }

  if (availableRoles.length === 0) {
    availableRoles.push({
      id: 'manage',
      label: 'Kelola Kelas',
      roleTitle: 'Pengguna Sistem',
      badge: 'Umum',
      subtitle: 'Daftar kelas pengajian',
      iconName: 'ShieldCheck',
      colorTheme: 'emerald',
      href: '/kelas?role=manage',
    });
  }

  // 3. Tentukan Role Tab yang Sedang Aktif
  const resolvedSearchParams = await searchParams;
  const roleQuery = (
    typeof resolvedSearchParams.role === 'string'
      ? resolvedSearchParams.role
      : typeof resolvedSearchParams.view === 'string'
      ? resolvedSearchParams.view
      : ''
  ).toLowerCase();

  let activeRole: ClassRoleType;
  const matchedRole = availableRoles.find(
    (r) => r.id === roleQuery || (roleQuery === 'manage' && r.id === 'manage')
  );

  if (matchedRole) {
    activeRole = matchedRole.id;
  } else {
    // Default prioritas:
    activeRole = availableRoles[0].id;
  }

  // 4. Fetch Data Hanya untuk Role yang Aktif
  let viewContent = null;

  if (activeRole === 'student') {
    const studentData = await getStudentClassData(user.id);
    const tabParam = typeof resolvedSearchParams.tab === 'string' ? resolvedSearchParams.tab.toLowerCase() : undefined;
    const initialTab = tabParam === 'jadwal' || tabParam === 'tugas' || tabParam === 'teman' ? tabParam : undefined;
    viewContent = <StudentClassView data={studentData} initialTab={initialTab} />;
  } else if (activeRole === 'parent') {
    const childId =
      typeof resolvedSearchParams.childId === 'string'
        ? resolvedSearchParams.childId
        : undefined;
    const parentData = await getParentClassData(user.id, childId);
    viewContent = <ParentClassView data={parentData} />;
  } else if (activeRole === 'teacher') {
    const teacherData = await getHomeroomTeacherClassData(user.id);
    const tabParam = typeof resolvedSearchParams.tab === 'string' ? resolvedSearchParams.tab.toLowerCase() : undefined;
    const initialTab = tabParam === 'santri' || tabParam === 'jadwal' || tabParam === 'tugas' ? tabParam : undefined;
    viewContent = <HomeroomClassView data={teacherData} initialTab={initialTab} />;
  } else {
    // activeRole === 'manage'
    const data = await getClassesOverview(user.id, resolvedSearchParams);
    viewContent = <ClassManagementView initialData={data} />;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Role Navigation Switcher jika memiliki > 1 peran */}
      {availableRoles.length > 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <ClassRoleNav
            availableRoles={availableRoles}
            activeRole={activeRole}
            userName={currentUser.fullName}
          />
        </div>
      )}

      {/* Tampilan Konten Sesuai Role yang Dipilih */}
      {viewContent}
    </div>
  );
}
