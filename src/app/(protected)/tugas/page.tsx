import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getAssignmentsData } from './actions';
import StudentTaskView from '@/components/tugas/StudentTaskView';
import TeacherAssignmentView from '@/components/tugas/TeacherAssignmentView';
import ParentTaskView from '@/components/tugas/ParentTaskView';
import PjTaskOverview from '@/components/tugas/PjTaskOverview';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import {
  CheckSquare,
  Award,
  FileText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

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
  let activeRole: RoleTabId;
  const matchedRole = availableRoles.find((r) => r.id === roleQuery);
  if (matchedRole) {
    activeRole = matchedRole.id;
  } else {
    activeRole = availableRoles[0].id;
  }

  // Petakan activeRole ke target role backend getAssignmentsData
  let targetBackendRole: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' = 'PJ';
  if (activeRole === 'student') targetBackendRole = 'SANTRI';
  else if (activeRole === 'parent') targetBackendRole = 'ORANG_TUA';
  else if (activeRole === 'teacher') targetBackendRole = 'PENGAJAR';
  else targetBackendRole = 'PJ';

  // 4. Ambil data tugas terstruktur sesuai role aktif
  const data = await getAssignmentsData(resolvedParams?.studentId, targetBackendRole);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in">
      {/* Tab Navigasi Multi-Role Pengguna (Hanya tampil jika user memiliki > 1 role) */}
      <RoleNavTabs
        title="Pilih Modul Tugas Sesuai Peran"
        description="Akun Anda memiliki beberapa akses tugas. Beralih peran untuk melihat penugasan yang sesuai."
        availableRoles={availableRoles}
        activeRole={activeRole}
      />

      {/* 1. Header Card Minimalis & Clean Sesuai Role Pengguna */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/75 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {data.role === 'SANTRI' && (
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs shrink-0">
                <CheckSquare className="w-4 h-4" />
              </div>
            )}
            {data.role === 'PENGAJAR' && (
              <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            )}
            {data.role === 'ORANG_TUA' && (
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60 shadow-2xs shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
            {data.role === 'PJ' && (
              <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/60 shadow-2xs shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {data.role === 'SANTRI' && 'Tugas & Setoran Mandiri'}
                {data.role === 'PENGAJAR' && 'Pusat Penugasan & Koreksi'}
                {data.role === 'ORANG_TUA' && 'Pendampingan & Paraf Orang Tua'}
                {data.role === 'PJ' && 'Monitoring Penugasan Wilayah'}
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-1.5 leading-relaxed max-w-xl">
            {data.role === 'SANTRI' &&
              'Setor rekaman hafalan mandiri, lengkapi amalan harian, dan kumpulkan poin capaian santri.'}
            {data.role === 'PENGAJAR' &&
              'Kelola tugas pasca-pengajian, koreksi setoran audio santri, dan berikan evaluasi belajar.'}
            {data.role === 'ORANG_TUA' &&
              'Dengarkan hafalan ananda di rumah, periksa amalan harian, dan berikan paraf digital orang tua.'}
            {data.role === 'PJ' &&
              `Pantau kepatuhan penugasan kelas dan tingkat sinergi paraf orang tua di ${data.userProfile.organization?.name || 'wilayah binaan'}.`}
          </p>
        </div>

        {/* Badge Poin Khusus Santri */}
        {data.role === 'SANTRI' && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 self-start sm:self-center shadow-2xs">
            <Award className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600/90 leading-tight">Poin Santri</span>
              <span className="text-sm font-extrabold text-emerald-800 leading-tight">
                {data.userProfile.gamification?.totalPoints || 0} XP
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Konten Tampilan Berdasarkan Role Pengguna */}
      {data.role === 'SANTRI' && (
        <StudentTaskView
          assignments={data.assignments}
          studentName={data.userProfile.fullName}
        />
      )}

      {data.role === 'PENGAJAR' && (
        <TeacherAssignmentView
          assignments={data.assignments}
          gradingQueue={data.gradingQueue}
          availableGenerations={data.availableGenerations}
          availableClasses={data.availableClasses}
          availableMaterials={data.availableMaterials}
          availableStudents={data.availableStudents}
        />
      )}

      {data.role === 'ORANG_TUA' && (
        <ParentTaskView
          childrenList={data.children}
          activeChildId={data.activeChildId}
          assignments={data.assignments}
          allAssignmentsByChild={data.allAssignmentsByChild}
        />
      )}

      {data.role === 'PJ' && (
        <PjTaskOverview
          stats={data.stats}
          assignments={data.assignments}
          organizationName={data.userProfile.organization?.name}
        />
      )}
    </div>
  );
}
