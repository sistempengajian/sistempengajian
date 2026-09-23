import React from 'react';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import KurikulumClientWrapper, { KurikulumRoleConfigData } from '@/components/kurikulum/KurikulumClientWrapper';
import { getMaterialsPaginated } from './actions';
import { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';

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
  const matchedRole = availableRoles.find((r) => r.id === roleQuery);
  const initialActiveRole: RoleTabId = matchedRole ? matchedRole.id : availableRoles[0].id;

  // 4. Siapkan data fallback santri jika pengguna adalah Pengajar tanpa kelas binaan
  let teacherStudentsFallback: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    generationCode?: string | null;
    generationName?: string;
  }[] = [];

  if (isTeacher && formattedHomeroomClasses.length === 0 && userProfile?.organizationId) {
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

    teacherStudentsFallback = students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      generationCode: s.generation?.code || null,
      generationName: s.generation?.name || 'Santri',
    }));
  }

  // 5. Konfigurasi konteks per masing-masing role yang tersedia
  let teacherActiveClassId: string | null = null;
  let teacherAvailableStudents: any[] = [];
  let teacherGenCode = currentGenCode;

  if (formattedHomeroomClasses.length > 0) {
    const targetClass =
      (resolvedParams.classId && formattedHomeroomClasses.find((c) => c.id === resolvedParams.classId)) ||
      formattedHomeroomClasses[0];

    teacherActiveClassId = targetClass.id;
    teacherAvailableStudents = targetClass.students;

    if (!resolvedParams.gen && targetClass.generationCode) {
      teacherGenCode = targetClass.generationCode;
    }
  } else {
    teacherAvailableStudents = teacherStudentsFallback;
  }

  let parentAvailableStudents: any[] = [];
  let parentActiveStudentId: string | null = null;
  let parentGenCode = currentGenCode;

  if (userProfile?.children && userProfile.children.length > 0) {
    parentAvailableStudents = userProfile.children.map((rel) => ({
      id: rel.student.id,
      fullName: rel.student.fullName,
      avatarUrl: rel.student.avatarUrl,
      generationCode: rel.student.generation?.code || null,
      generationName: rel.student.generation?.name || 'Santri',
    }));
    parentActiveStudentId = resolvedParams.studentId || parentAvailableStudents[0]?.id || null;
    if (!resolvedParams.gen && parentActiveStudentId) {
      const selectedChild = parentAvailableStudents.find((c) => c.id === parentActiveStudentId);
      if (selectedChild?.generationCode) {
        parentGenCode = selectedChild.generationCode;
      }
    }
  }

  let studentGenCode = currentGenCode;
  if (!resolvedParams.gen && userProfile?.generation?.code) {
    studentGenCode = userProfile.generation.code;
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

  const roleConfigs: Record<
    RoleTabId,
    {
      userRoleCategory: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ';
      canManage: boolean;
      activeStudentId: string | null;
      activeClassId: string | null;
      availableStudents: typeof parentAvailableStudents;
      currentGenCode: string;
      headerTitle: string;
      headerSubtitle: string;
    }
  > = {
    student: {
      userRoleCategory: 'SANTRI',
      canManage: false,
      activeStudentId: user?.id || null,
      activeClassId: null,
      availableStudents: [],
      currentGenCode: studentGenCode,
      headerTitle: 'Buku Capaian Saya',
      headerSubtitle:
        'Buku kendali capaian materi, capaian hafalan, dan evaluasi hasil belajar mandiri Anda.',
    },
    parent: {
      userRoleCategory: 'ORANG_TUA',
      canManage: false,
      activeStudentId: parentActiveStudentId,
      activeClassId: null,
      availableStudents: parentAvailableStudents,
      currentGenCode: parentGenCode,
      headerTitle: 'Rapor & Capaian Ananda',
      headerSubtitle:
        'Pantau progres capaian materi, nilai evaluasi, dan catatan ustadz untuk anak-anak Anda di rumah.',
    },
    teacher: {
      userRoleCategory: 'TEACHER',
      canManage: false,
      activeStudentId: resolvedParams.studentId || null,
      activeClassId: teacherActiveClassId,
      availableStudents: teacherAvailableStudents,
      currentGenCode: teacherGenCode,
      headerTitle: 'Jurnal Nilai & Capaian Santri',
      headerSubtitle:
        'Evaluasi progres capaian materi, checklist pencapaian santri binaan, dan monitoring target hafalan.',
    },
    manage: {
      userRoleCategory: 'PJ',
      canManage: isManager,
      activeStudentId: null,
      activeClassId: null,
      availableStudents: [],
      currentGenCode: resolvedParams.gen || 'CABERAWIT',
      headerTitle: 'Kurikulum Berjenjang',
      headerSubtitle:
        'Silabus materi, capaian hafalan, dan checklist target pembelajaran santri 4 baku jenjang usia.',
    },
  };

  // 6. Pre-fetch initial materials untuk seluruh availableRoles secara paralel
  const roleDataResults = await Promise.all(
    availableRoles.map(async (r) => {
      const config = roleConfigs[r.id];
      const initialPaginatedData = await getMaterialsPaginated({
        genCode: config.currentGenCode,
        page: 1,
        limit: 5,
        studentId: config.activeStudentId || undefined,
        classId: r.id === 'teacher' && config.activeClassId ? config.activeClassId : undefined,
        filterOrgId: resolvedParams.filterOrgId || undefined,
      });
      return {
        id: r.id,
        config: {
          ...config,
          initialPaginatedData,
        },
      };
    })
  );

  const roleDataMap: Record<string, KurikulumRoleConfigData> = {};
  for (const res of roleDataResults) {
    roleDataMap[res.id] = res.config;
  }

  return (
    <KurikulumClientWrapper
      initialActiveRole={initialActiveRole}
      availableRoles={availableRoles}
      roleDataMap={roleDataMap}
      generations={generations.map((g) => ({
        id: g.id,
        code: g.code,
        name: g.name,
        minAge: g.minAge,
        maxAge: g.maxAge,
        description: g.description,
      }))}
      userTierLevel={userTierLevel}
      userOrganizationId={userProfile?.organization?.id || null}
      userOrganizationName={userProfile?.organization?.name || ''}
      parentOrganizationName={userProfile?.organization?.parent?.name || ''}
      homeroomClasses={formattedHomeroomClasses}
      subOrganizations={subOrganizations}
      activeFilterOrgId={resolvedParams.filterOrgId || null}
      userName={userProfile?.fullName}
    />
  );
}
