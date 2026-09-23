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
import KelasClientWrapper from '@/components/kelas/KelasClientWrapper';
import { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import {
  ClassesOverviewData,
  StudentClassData,
  HomeroomTeacherClassData,
  ParentClassData,
} from '@/components/kelas/types';

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
  const availableRoles: RoleTabItem[] = [];

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

  let activeRole: RoleTabId;
  const matchedRole = availableRoles.find(
    (r) => r.id === roleQuery || (roleQuery === 'manage' && r.id === 'manage')
  );

  if (matchedRole) {
    activeRole = matchedRole.id;
  } else {
    // Default prioritas:
    activeRole = availableRoles[0].id;
  }

  // 4. Pre-fetch Data Paralel untuk Semua Role yang Tersedia (Zero Delay Switch)
  const roleDataMap: {
    manage?: ClassesOverviewData;
    teacher?: HomeroomTeacherClassData;
    parent?: ParentClassData;
    student?: StudentClassData;
  } = {};

  const childId =
    typeof resolvedSearchParams.childId === 'string'
      ? resolvedSearchParams.childId
      : undefined;

  await Promise.all(
    availableRoles.map(async (roleItem) => {
      try {
        if (roleItem.id === 'manage') {
          roleDataMap.manage = await getClassesOverview(user.id, resolvedSearchParams);
        } else if (roleItem.id === 'teacher') {
          roleDataMap.teacher = await getHomeroomTeacherClassData(user.id);
        } else if (roleItem.id === 'parent') {
          roleDataMap.parent = await getParentClassData(user.id, childId);
        } else if (roleItem.id === 'student') {
          roleDataMap.student = await getStudentClassData(user.id);
        }
      } catch (err) {
        console.error(`Error pre-fetching kelas data for role ${roleItem.id}:`, err);
      }
    })
  );

  const tabParam = typeof resolvedSearchParams.tab === 'string' ? resolvedSearchParams.tab.toLowerCase() : undefined;
  const initialStudentTab = tabParam === 'jadwal' || tabParam === 'tugas' || tabParam === 'teman' ? tabParam : undefined;
  const initialTeacherTab = tabParam === 'santri' || tabParam === 'jadwal' || tabParam === 'tugas' ? tabParam : undefined;

  return (
    <KelasClientWrapper
      initialActiveRole={activeRole}
      availableRoles={availableRoles}
      roleDataMap={roleDataMap}
      initialStudentTab={initialStudentTab}
      initialTeacherTab={initialTeacherTab}
      userName={currentUser.fullName}
    />
  );
}
