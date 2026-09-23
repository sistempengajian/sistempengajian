import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getAssignmentsData } from './actions';
import TugasClientWrapper from '@/components/tugas/TugasClientWrapper';
import { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';

export const metadata = {
  title: 'Tugas Pasca-Pengajian | Sistem Pengajian Terstruktur',
  description: 'Modul pengerjaan, setoran suara, checklist harian, koreksi pengajar, dan paraf digital orang tua.',
};

export default async function TugasPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; role?: string; view?: string }>;
}) {
  const resolvedParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // 1. Ambil data profil & peran user
  const currentUser = await prisma.user.findUnique({
    where: { id: authUser.id },
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
  const isManager = roleCodes.some((r) =>
    ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
  );

  const isTeacher =
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    currentUser.homeroomClasses.length > 0 ||
    currentUser.scheduleAssignments.length > 0;

  const isParent =
    roleCodes.includes('ORANG_TUA') ||
    currentUser.children.length > 0;

  const isSantri =
    roleCodes.includes('SANTRI') ||
    (Boolean(currentUser.generationId) && Boolean(currentUser.organizationId) && !isManager && !isTeacher);

  // 2. Susun Menu Tab Sesuai Multi-Peran User
  const availableRoles: RoleTabItem[] = [];

  if (isManager) {
    let badge = 'PJ Wilayah';
    if (roleCodes.includes('ADMIN_MASTER')) badge = 'Admin Master';
    else if (roleCodes.includes('PJ_DAERAH')) badge = 'PJ Daerah';
    else if (roleCodes.includes('PJ_DESA')) badge = 'PJ Desa';
    else if (roleCodes.includes('PJ_KELOMPOK')) badge = 'PJ Kelompok';

    availableRoles.push({
      id: 'manage',
      label: 'Monitoring Tugas',
      roleTitle: 'Pengurus Wilayah',
      badge,
      subtitle: 'Statistik kepatuhan penugasan wilayah',
      iconName: 'ShieldCheck',
      colorTheme: 'emerald',
      href: '/tugas?role=manage',
    });
  }

  if (isTeacher) {
    availableRoles.push({
      id: 'teacher',
      label: 'Penugasan & Koreksi',
      roleTitle: 'Wali Kelas & Pengajar',
      badge: 'Pengajar',
      subtitle: 'Buat tugas & antrean koreksi setoran',
      iconName: 'GraduationCap',
      colorTheme: 'teal',
      href: '/tugas?role=teacher',
    });
  }

  if (isParent) {
    availableRoles.push({
      id: 'parent',
      label: 'Paraf & Dampingi Anak',
      roleTitle: 'Orang Tua / Wali',
      badge: 'Orang Tua',
      subtitle: 'Dengar hafalan & paraf digital tugas ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: '/tugas?role=parent',
    });
  }

  if (isSantri) {
    availableRoles.push({
      id: 'student',
      label: 'Tugas & Setoran Saya',
      roleTitle: 'Santri Binaan',
      badge: 'Santri',
      subtitle: 'Setor rekaman suara & checklist amalan mandiri',
      iconName: 'CheckSquare',
      colorTheme: 'amber',
      href: '/tugas?role=student',
    });
  }

  if (availableRoles.length === 0) {
    availableRoles.push({
      id: 'manage',
      label: 'Tugas Pengajian',
      roleTitle: 'Pengguna Sistem',
      badge: 'Umum',
      subtitle: 'Pusat tugas & kegiatan amalan santri',
      iconName: 'CheckSquare',
      colorTheme: 'emerald',
      href: '/tugas?role=manage',
    });
  }

  // 3. Tentukan Role Tab yang Sedang Aktif
  const roleQuery = (resolvedParams.role || resolvedParams.view || '').toLowerCase();
  const matchedRole = availableRoles.find((r) => r.id === roleQuery);
  const initialActiveRole: RoleTabId = matchedRole ? matchedRole.id : availableRoles[0].id;

  // 4. Ambil data tugas untuk semua availableRoles secara paralel
  const roleDataResults = await Promise.all(
    availableRoles.map(async (r) => {
      let targetBackendRole: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' = 'PJ';
      if (r.id === 'student') targetBackendRole = 'SANTRI';
      else if (r.id === 'parent') targetBackendRole = 'ORANG_TUA';
      else if (r.id === 'teacher') targetBackendRole = 'PENGAJAR';
      else targetBackendRole = 'PJ';

      const roleData = await getAssignmentsData(resolvedParams?.studentId, targetBackendRole);
      return { id: r.id, data: roleData };
    })
  );

  const roleDataMap: Record<string, any> = {};
  for (const item of roleDataResults) {
    roleDataMap[item.id] = item.data;
  }

  return (
    <TugasClientWrapper
      initialActiveRole={initialActiveRole}
      availableRoles={availableRoles}
      roleDataMap={roleDataMap}
    />
  );
}
