import React from 'react';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import KurikulumInfiniteList from '@/components/kurikulum/KurikulumInfiniteList';
import { BookOpen } from 'lucide-react';
import { getMaterialsPaginated } from './actions';
import { MaterialData } from '@/components/kurikulum/MaterialCard';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';

export default async function KurikulumPage({
  searchParams,
}: {
  searchParams: Promise<{
    gen?: string;
    studentId?: string;
    role?: string;
    view?: string;
    classId?: string;
    filterOrgId?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  let currentGenCode = (resolvedParams.gen || 'CABERAWIT') as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Ambil data profil pengguna, peran, generasi, organisasi, dan relasi anak & kelas binaan
  const [generations, userProfile] = await Promise.all([
    prisma.generation.findMany({
      orderBy: { minAge: 'asc' },
    }),
    user
      ? prisma.user.findUnique({
          where: { id: user.id },
          include: {
            roles: true,
            generation: true,
            organization: {
              include: {
                parent: true,
              },
            },
            children: {
              include: {
                student: {
                  include: {
                    generation: true,
                  },
                },
              },
            },
            homeroomClasses: {
              select: {
                id: true,
                name: true,
                academicYear: true,
                organizationId: true,
                generationId: true,
                generation: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                organization: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                  },
                },
              },
              orderBy: { name: 'asc' },
            },
            scheduleAssignments: { select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve(null),
  ]);

  // RBAC: Tentukan seluruh peran pengguna
  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isManager = roleCodes.some((r) =>
    ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
  );
  const isTeacher =
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    (userProfile?.homeroomClasses && userProfile.homeroomClasses.length > 0) ||
    (userProfile?.scheduleAssignments && userProfile.scheduleAssignments.length > 0);

  const isParent =
    roleCodes.includes('ORANG_TUA') ||
    (userProfile?.children && userProfile.children.length > 0);

  const isSantri =
    roleCodes.includes('SANTRI') ||
    (Boolean(userProfile?.generationId) && Boolean(userProfile?.organizationId) && !isManager && !isTeacher);

  // Format kelas binaan jika pengguna adalah wali kelas (mendukung multi-kelas)
  let formattedHomeroomClasses: {
    id: string;
    name: string;
    academicYear: string;
    organizationId: string;
    organizationName: string;
    generationId: string;
    generationCode: string;
    generationName: string;
    students: {
      id: string;
      fullName: string;
      avatarUrl?: string | null;
      generationCode?: string | null;
      generationName?: string;
    }[];
  }[] = [];

  if (userProfile?.homeroomClasses && userProfile.homeroomClasses.length > 0) {
    const classPairs = userProfile.homeroomClasses.map((c) => ({
      organizationId: c.organizationId,
      generationId: c.generationId,
    }));

    const classStudents = await prisma.user.findMany({
      where: {
        roles: { some: { role: 'SANTRI' } },
        OR: classPairs,
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        organizationId: true,
        generationId: true,
        generation: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    formattedHomeroomClasses = userProfile.homeroomClasses.map((c) => {
      const studentsInThisClass = classStudents.filter(
        (s) => s.organizationId === c.organizationId && s.generationId === c.generationId
      );
      return {
        id: c.id,
        name: c.name,
        academicYear: c.academicYear,
        organizationId: c.organizationId,
        organizationName: c.organization.name,
        generationId: c.generationId,
        generationCode: c.generation.code,
        generationName: c.generation.name,
        students: studentsInThisClass.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          avatarUrl: s.avatarUrl,
          generationCode: s.generation?.code || null,
          generationName: s.generation?.name || 'Santri',
        })),
      };
    });
  }

  // 2. Susun Menu Tab Sesuai Multi-Peran
  const availableRoles: RoleTabItem[] = [];

  if (isManager) {
    let badge = 'PJ Wilayah';
    if (roleCodes.includes('ADMIN_MASTER')) badge = 'Admin Master';
    else if (roleCodes.includes('PJ_DAERAH')) badge = 'PJ Daerah';
    else if (roleCodes.includes('PJ_DESA')) badge = 'PJ Desa';
    else if (roleCodes.includes('PJ_KELOMPOK')) badge = 'PJ Kelompok';

    availableRoles.push({
      id: 'manage',
      label: 'Kelola Kurikulum',
      roleTitle: 'Pengurus Wilayah',
      badge,
      subtitle: 'Silabus materi & versi tingkat wilayah',
      iconName: 'ShieldCheck',
      colorTheme: 'emerald',
      href: '/kurikulum?role=manage',
    });
  }

  if (isTeacher) {
    availableRoles.push({
      id: 'teacher',
      label: 'Jurnal Nilai Santri',
      roleTitle: 'Wali Kelas & Pengajar',
      badge: formattedHomeroomClasses.length > 0 ? 'Wali Kelas' : 'Pengajar',
      subtitle: 'Evaluasi progres & checklist materi binaan',
      iconName: 'GraduationCap',
      colorTheme: 'teal',
      href: '/kurikulum?role=teacher',
    });
  }

  if (isParent) {
    availableRoles.push({
      id: 'parent',
      label: 'Rapor & Capaian Anak',
      roleTitle: 'Orang Tua / Wali',
      badge: 'Orang Tua',
      subtitle: 'Pantau capaian & progres materi ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: '/kurikulum?role=parent',
    });
  }

  if (isSantri) {
    availableRoles.push({
      id: 'student',
      label: 'Buku Capaian Saya',
      roleTitle: 'Santri Binaan',
      badge: 'Santri',
      subtitle: 'Checklist capaian & target belajar mandiri',
      iconName: 'BookOpen',
      colorTheme: 'amber',
      href: '/kurikulum?role=student',
    });
  }

  if (availableRoles.length === 0) {
    availableRoles.push({
      id: 'manage',
      label: 'Kurikulum Pengajian',
      roleTitle: 'Pengguna Sistem',
      badge: 'Umum',
      subtitle: 'Silabus dan target pembelajaran',
      iconName: 'BookOpen',
      colorTheme: 'emerald',
      href: '/kurikulum?role=manage',
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

  // 4. Konfigurasi konteks berdasarkan activeRole
  let userRoleCategory: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ' = 'PJ';
  let canManage = false;
  let activeStudentId: string | null = null;
  let activeClassId: string | null = null;
  let availableStudents: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    generationCode?: string | null;
    generationName?: string;
  }[] = [];

  if (activeRole === 'student') {
    userRoleCategory = 'SANTRI';
    canManage = false;
    activeStudentId = user?.id || null;
    if (!resolvedParams.gen && userProfile?.generation?.code) {
      currentGenCode = userProfile.generation.code;
    }
  } else if (activeRole === 'parent') {
    userRoleCategory = 'ORANG_TUA';
    canManage = false;
    if (userProfile?.children) {
      availableStudents = userProfile.children.map((rel) => ({
        id: rel.student.id,
        fullName: rel.student.fullName,
        avatarUrl: rel.student.avatarUrl,
        generationCode: rel.student.generation?.code || null,
        generationName: rel.student.generation?.name || 'Santri',
      }));
      activeStudentId = resolvedParams.studentId || availableStudents[0]?.id || null;
      if (!resolvedParams.gen && activeStudentId) {
        const selectedChild = availableStudents.find((c) => c.id === activeStudentId);
        if (selectedChild?.generationCode) {
          currentGenCode = selectedChild.generationCode;
        }
      }
    }
  } else if (activeRole === 'teacher') {
    userRoleCategory = 'TEACHER';
    canManage = false;

    if (formattedHomeroomClasses.length > 0) {
      // Wali Kelas: dukung fleksibilitas multi-kelas
      const targetClass =
        (resolvedParams.classId && formattedHomeroomClasses.find((c) => c.id === resolvedParams.classId)) ||
        formattedHomeroomClasses[0];

      activeClassId = targetClass.id;
      availableStudents = targetClass.students;

      // Jika belum diset di query string, sesuaikan genCode dengan kelas binaan aktif
      if (!resolvedParams.gen && targetClass.generationCode) {
        currentGenCode = targetClass.generationCode;
      }

      activeStudentId = resolvedParams.studentId || null;
    } else if (userProfile?.organizationId) {
      // Pengajar tanpa kelas binaan (tingkat kelompok)
      const students = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: 'SANTRI',
            },
          },
          organizationId: userProfile.organizationId,
        },
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          generation: {
            select: {
              code: true,
              name: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
        take: 50,
      });

      availableStudents = students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        avatarUrl: s.avatarUrl,
        generationCode: s.generation?.code || null,
        generationName: s.generation?.name || 'Santri',
      }));

      activeStudentId = resolvedParams.studentId || null;
    }
  } else {
    // activeRole === 'manage'
    userRoleCategory = 'PJ';
    canManage = isManager;
    activeStudentId = null;
    availableStudents = [];
  }

  // Daftar kelompok bawahan jika user PJ Desa (untuk filter drill-down per kelompok)
  let subOrganizations: { id: string; name: string }[] = [];
  if (roleCodes.includes('PJ_DESA') && userProfile?.organizationId) {
    subOrganizations = await prisma.organization.findMany({
      where: {
        parentId: userProfile.organizationId,
        type: 'KELOMPOK',
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // 5. Ambil data paginasi materi pertama (sesuai filter kelas, studentId, atau org)
  const initialPaginatedData = await getMaterialsPaginated({
    genCode: currentGenCode,
    page: 1,
    limit: 5,
    studentId: activeStudentId || undefined,
    classId: activeRole === 'teacher' && activeClassId ? activeClassId : undefined,
    filterOrgId: resolvedParams.filterOrgId || undefined,
  });

  // Tentukan tingkat otoritas wilayah pengguna
  let userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null = null;
  if (roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH')) {
    userTierLevel = 'DAERAH';
  } else if (roleCodes.includes('PJ_DESA')) {
    userTierLevel = 'DESA';
  } else if (roleCodes.includes('PJ_KELOMPOK')) {
    userTierLevel = 'KELOMPOK';
  } else if (userProfile?.organization?.type) {
    userTierLevel = userProfile.organization.type as 'DAERAH' | 'DESA' | 'KELOMPOK';
  }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in">
      {/* Top Multi-Role Switcher jika user memiliki > 1 peran */}
      {availableRoles.length > 1 && (
        <RoleNavTabs
          title="Menu Kurikulum & Rapor"
          description="Pilih sudut pandang kurikulum sesuai peran yang ingin Anda gunakan."
          availableRoles={availableRoles}
          activeRole={activeRole}
          userName={userProfile?.fullName}
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <span>
                {activeRole === 'student' && 'Buku Capaian Saya'}
                {activeRole === 'parent' && 'Rapor & Capaian Ananda'}
                {activeRole === 'teacher' && 'Jurnal Nilai & Capaian Santri'}
                {activeRole === 'manage' && 'Kurikulum Berjenjang'}
              </span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-1">
            {activeRole === 'student' &&
              'Buku kendali capaian materi, capaian hafalan, dan evaluasi hasil belajar mandiri Anda.'}
            {activeRole === 'parent' &&
              'Pantau progres capaian materi, nilai evaluasi, dan catatan ustadz untuk anak-anak Anda di rumah.'}
            {activeRole === 'teacher' &&
              'Evaluasi progres capaian materi, checklist pencapaian santri binaan, dan monitoring target hafalan.'}
            {activeRole === 'manage' &&
              'Silabus materi, capaian hafalan, dan checklist target pembelajaran santri 4 baku jenjang usia.'}
          </p>
        </div>
      </div>

      {/* Kurikulum Client Container: Tabs, Focus Banner, Caching & Infinite Scroll List */}
      <KurikulumInfiniteList
        initialMaterials={initialPaginatedData.items as MaterialData[]}
        initialTotal={initialPaginatedData.total}
        initialHasMore={initialPaginatedData.hasMore}
        currentGenCode={currentGenCode}
        generations={generations.map((g) => ({
          id: g.id,
          code: g.code,
          name: g.name,
          minAge: g.minAge,
          maxAge: g.maxAge,
          description: g.description,
        }))}
        canManage={canManage}
        userTierLevel={userTierLevel}
        userOrganizationId={userProfile?.organization?.id || null}
        userOrganizationName={userProfile?.organization?.name || ''}
        parentOrganizationName={userProfile?.organization?.parent?.name || ''}
        activeStudentId={activeStudentId}
        availableStudents={availableStudents}
        userRoleCategory={userRoleCategory}
        homeroomClasses={formattedHomeroomClasses}
        activeClassId={activeClassId}
        subOrganizations={subOrganizations}
        activeFilterOrgId={resolvedParams.filterOrgId || null}
      />
    </div>
  );
}
