import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import JadwalClientWrapper, { RoleConfigData } from '@/components/jadwal/JadwalClientWrapper';
import { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { UserRole } from '@prisma/client';

export const metadata = {
  title: 'Jadwal Pengajian | Sistem Pengajian Terstruktur',
  description: 'Kalender sesi pengajian, agenda wilayah, delegasi ustadz badal, dan peluncur presensi QR.',
};

const SCHEDULE_INCLUDE = {
  teachers: {
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
        },
      },
    },
  },
  organization: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
  class: {
    select: {
      id: true,
      name: true,
      tierLevel: true,
      homeroomTeacherId: true,
      generation: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  },
  targetClasses: {
    include: {
      class: {
        select: {
          id: true,
          name: true,
          tierLevel: true,
          homeroomTeacherId: true,
        },
      },
    },
  },
  targetGenerations: {
    include: {
      generation: {
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
        },
      },
    },
  },
  scheduleMaterials: {
    include: {
      material: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { slotIndex: 'asc' as const },
  },
  attendanceSessions: {
    select: {
      id: true,
      isActive: true,
      openedAt: true,
    },
  },
};

function enrichSchedules(
  schedules: any[],
  roleId: RoleTabId,
  parentChildrenInfo?: {
    id: string;
    fullName: string;
    generationId?: string | null;
    organizationId?: string | null;
    parentOrgId?: string | null;
    classIds: string[];
  }[]
) {
  return schedules.map((sch) => {
    const connectedClasses: string[] = [];
    if (sch.class?.name && !connectedClasses.includes(sch.class.name)) {
      connectedClasses.push(sch.class.name);
    }
    if (sch.targetClasses) {
      for (const tc of sch.targetClasses) {
        if (tc.class?.name && !connectedClasses.includes(tc.class.name)) {
          connectedClasses.push(tc.class.name);
        }
      }
    }

    let connectedStudents: { id: string; fullName: string }[] = [];
    if (roleId === 'parent' && parentChildrenInfo && parentChildrenInfo.length > 0) {
      const scheduleClassIds = new Set<string>();
      if (sch.class?.id) scheduleClassIds.add(sch.class.id);
      if (sch.targetClasses) {
        for (const tc of sch.targetClasses) {
          if (tc.class?.id) scheduleClassIds.add(tc.class.id);
        }
      }

      const scheduleGenIds = new Set<string>();
      if (sch.targetGenerations) {
        for (const tg of sch.targetGenerations) {
          if (tg.generation?.id) scheduleGenIds.add(tg.generation.id);
        }
      }

      const isGeneral = scheduleClassIds.size === 0 && scheduleGenIds.size === 0;

      for (const child of parentChildrenInfo) {
        // 1. Cek kelas spesifik anak
        const classMatched = child.classIds.some((cId) => scheduleClassIds.has(cId));
        if (classMatched) {
          connectedStudents.push({ id: child.id, fullName: child.fullName });
          continue;
        }

        // 2. Cek jenjang / generasi anak
        const genMatched = child.generationId && scheduleGenIds.has(child.generationId);
        if (genMatched) {
          connectedStudents.push({ id: child.id, fullName: child.fullName });
          continue;
        }

        // 3. Cek jadwal umum wilayah ananda
        if (
          isGeneral &&
          (sch.organizationId === child.organizationId || sch.organizationId === child.parentOrgId)
        ) {
          connectedStudents.push({ id: child.id, fullName: child.fullName });
          continue;
        }
      }

      // Fallback jika hanya punya 1 anak dan tampil di feed orang tua
      if (connectedStudents.length === 0 && parentChildrenInfo.length === 1) {
        connectedStudents.push({
          id: parentChildrenInfo[0].id,
          fullName: parentChildrenInfo[0].fullName,
        });
      }
    }

    return {
      ...sch,
      connectedStudents,
      connectedClasses,
    };
  });
}

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; view?: string }>;
}) {
  const resolvedParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Ambil data profil pengguna beserta relasi organisasi, kelas binaan & anak
  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      organization: {
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
        },
      },
      homeroomClasses: { select: { id: true, name: true } },
      scheduleAssignments: { select: { id: true }, take: 1 },
      children: {
        include: {
          student: {
            include: {
              organization: {
                include: {
                  parent: true,
                },
              },
              generation: true,
            },
          },
        },
      },
    },
  });

  if (!userProfile) {
    redirect('/login');
  }

  const roleCodes = (userProfile?.roles.map((r) => r.role) || []) as UserRole[];
  const isPjDaerah = roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');
  const isManager = isPjDaerah || isPjDesa || isPjKelompok;

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
      label: 'Kelola Jadwal Wilayah',
      roleTitle: 'Pengurus Wilayah',
      badge,
      subtitle: 'Kalender sesi pengajian, badal & presensi wilayah',
      iconName: 'ShieldCheck',
      colorTheme: 'emerald',
      href: '/jadwal?role=manage',
    });
  }

  if (isTeacher) {
    availableRoles.push({
      id: 'teacher',
      label: 'Jadwal Mengajar Saya',
      roleTitle: 'Pengajar & Badal',
      badge: 'Pengajar',
      subtitle: 'Sesi pengampu, kesiapan badal & buka QR kelas',
      iconName: 'GraduationCap',
      colorTheme: 'teal',
      href: '/jadwal?role=teacher',
    });
  }

  if (isParent) {
    availableRoles.push({
      id: 'parent',
      label: 'Jadwal Pengajian Anak',
      roleTitle: 'Orang Tua / Wali',
      badge: 'Orang Tua',
      subtitle: 'Kalender jadwal pengajian kelas ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: '/jadwal?role=parent',
    });
  }

  if (isSantri) {
    availableRoles.push({
      id: 'student',
      label: 'Jadwal Pengajian Saya',
      roleTitle: 'Santri Binaan',
      badge: 'Santri',
      subtitle: 'Jadwal kelas pengajian & agenda umum santri',
      iconName: 'Calendar',
      colorTheme: 'amber',
      href: '/jadwal?role=student',
    });
  }

  if (availableRoles.length === 0) {
    availableRoles.push({
      id: 'manage',
      label: 'Jadwal Pengajian',
      roleTitle: 'Pengguna Sistem',
      badge: 'Umum',
      subtitle: 'Kalender sesi pengajian dan agenda kegiatan',
      iconName: 'Calendar',
      colorTheme: 'emerald',
      href: '/jadwal?role=manage',
    });
  }

  // 3. Tentukan Role Tab Awal
  const roleQuery = (resolvedParams.role || resolvedParams.view || '').toLowerCase();
  const matchedRole = availableRoles.find((r) => r.id === roleQuery);
  const initialActiveRole: RoleTabId = matchedRole ? matchedRole.id : availableRoles[0].id;

  // 4. Scoped Org IDs (hanya di-query 1x jika user manager)
  const scopedOrgIds = isManager
    ? await getScopedOrganizationIds(roleCodes, userProfile?.organizationId || null)
    : null;

  // 5. Jika user memiliki peran Orang Tua, siapkan data anak & kelasnya
  let parentChildrenInfo: {
    id: string;
    fullName: string;
    generationId?: string | null;
    organizationId?: string | null;
    parentOrgId?: string | null;
    classIds: string[];
  }[] = [];
  let allChildClassIds: string[] = [];
  let allChildOrgIds: string[] = [];
  let allChildGenerationIds: string[] = [];

  if (isParent && userProfile?.children && userProfile.children.length > 0) {
    const childClassesPromises = userProfile.children.map((rel) => {
      const student = rel.student;
      return prisma.class.findMany({
        where: {
          generationId: student.generationId || undefined,
          OR: [
            { organizationId: student.organizationId || undefined },
            { organizationId: student.organization?.parentId || undefined },
          ],
        },
        select: { id: true },
      });
    });

    const childClassResults = await Promise.all(childClassesPromises);
    allChildClassIds = childClassResults.flat().map((c) => c.id);

    parentChildrenInfo = userProfile.children.map((rel, idx) => ({
      id: rel.student.id,
      fullName: rel.student.fullName,
      generationId: rel.student.generationId,
      organizationId: rel.student.organizationId,
      parentOrgId: rel.student.organization?.parentId,
      classIds: childClassResults[idx]?.map((c) => c.id) || [],
    }));

    allChildOrgIds = Array.from(
      new Set(
        userProfile.children
          .flatMap((rel) => [
            rel.student.organizationId,
            rel.student.organization?.parentId,
          ])
          .filter(Boolean) as string[]
      )
    );

    allChildGenerationIds = Array.from(
      new Set(
        userProfile.children
          .map((rel) => rel.student.generationId)
          .filter(Boolean) as string[]
      )
    );
  }

  // 6. Jika user memiliki peran Santri, siapkan kelas binaannya
  let studentClassIds: string[] = [];
  if (isSantri) {
    const studentClasses = await prisma.class.findMany({
      where: {
        generationId: userProfile?.generationId || undefined,
        OR: [
          { organizationId: userProfile?.organizationId || undefined },
          { organizationId: userProfile?.organization?.parentId || undefined },
        ],
      },
      select: { id: true },
    });
    studentClassIds = studentClasses.map((c) => c.id);
  }

  // 7. Konfigurasi Filter Scoped Jadwal & Hak Kelola untuk masing-masing role
  const roleConfigs: Record<
    RoleTabId,
    {
      scheduleWhere: any;
      canManage: boolean;
      canPropose: boolean;
      userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
      headerTitle: string;
      headerSubtitle: string;
      parentChildrenInfo?: typeof parentChildrenInfo;
    }
  > = {
    manage: {
      scheduleWhere: scopedOrgIds !== null ? { organizationId: { in: scopedOrgIds } } : {},
      canManage: isManager,
      canPropose: isManager || isTeacher,
      userTierLevel: isPjDaerah
        ? 'DAERAH'
        : isPjDesa
        ? 'DESA'
        : isPjKelompok
        ? 'KELOMPOK'
        : (userProfile?.organization?.type as any) || null,
      headerTitle: 'Kelola Jadwal Pengajian Wilayah',
      headerSubtitle: `Kalender sesi pengajian, alokasi ustadz, dan delegasi badal di lingkungan ${
        userProfile?.organization?.name || 'wilayah binaan'
      }.`,
    },
    teacher: {
      scheduleWhere: {
        OR: [
          {
            teachers: { some: { teacherId: user.id } },
            OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
          },
          { requestedByUserId: user.id },
          ...((userProfile?.homeroomClasses || []).length > 0
            ? [
                {
                  AND: [
                    {
                      OR: [
                        { classId: { in: (userProfile?.homeroomClasses || []).map((c) => c.id) } },
                        {
                          targetClasses: {
                            some: { classId: { in: (userProfile?.homeroomClasses || []).map((c) => c.id) } },
                          },
                        },
                      ],
                    },
                    {
                      OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      canManage: false,
      canPropose: isManager || isTeacher,
      userTierLevel: (userProfile?.organization?.type as any) || null,
      headerTitle: 'Jadwal Mengajar & Kelas Binaan',
      headerSubtitle:
        'Kalender sesi pengajian yang Anda ampu sebagai Ustadz utama atau badal, serta sesi aktif kelas binaan Anda.',
    },
    parent: {
      scheduleWhere: {
        AND: [
          { OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }] },
          {
            OR: [
              ...(allChildClassIds.length > 0
                ? [
                    { classId: { in: allChildClassIds } },
                    { targetClasses: { some: { classId: { in: allChildClassIds } } } },
                  ]
                : []),
              ...(allChildGenerationIds.length > 0
                ? [{ targetGenerations: { some: { generationId: { in: allChildGenerationIds } } } }]
                : []),
              {
                classId: null,
                targetClasses: { none: {} },
                targetGenerations: { none: {} },
                organizationId: { in: allChildOrgIds },
              },
            ],
          },
        ],
      },
      canManage: false,
      canPropose: false,
      userTierLevel: null,
      headerTitle: 'Jadwal Pengajian Anak',
      headerSubtitle:
        'Pantau jadwal sesi pengajian kelas ananda dan agenda kegiatan pengajian keluarga.',
      parentChildrenInfo,
    },
    student: {
      scheduleWhere: {
        AND: [
          { OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }] },
          {
            OR: [
              ...(studentClassIds.length > 0
                ? [
                    { classId: { in: studentClassIds } },
                    { targetClasses: { some: { classId: { in: studentClassIds } } } },
                  ]
                : []),
              ...(userProfile?.generationId
                ? [{ targetGenerations: { some: { generationId: userProfile.generationId } } }]
                : []),
              {
                classId: null,
                targetClasses: { none: {} },
                targetGenerations: { none: {} },
                organizationId: {
                  in: [
                    userProfile?.organizationId,
                    userProfile?.organization?.parentId,
                    userProfile?.organization?.parent?.parentId,
                  ].filter(Boolean) as string[],
                },
              },
            ],
          },
        ],
      },
      canManage: false,
      canPropose: false,
      userTierLevel: null,
      headerTitle: 'Jadwal Pengajian Saya',
      headerSubtitle:
        'Jadwal sesi pengajian kelas Anda dan agenda pengajian umum di lingkungan wilayah Anda.',
    },
  };

  // 8. Cek apakah ada role yang membutuhkan form data (untuk modal buat/edit jadwal)
  const anyCanManage = availableRoles.some((r) => roleConfigs[r.id]?.canManage);
  const anyCanPropose = availableRoles.some((r) => roleConfigs[r.id]?.canPropose);
  const needFormData = anyCanManage || anyCanPropose;

  // 9. Fetch schedules untuk setiap role dalam availableRoles serta data form secara paralel
  const [scheduleResults, teachers, classes, materials, generations, scopedOrganizations] =
    await Promise.all([
      Promise.all(
        availableRoles.map(async (roleItem) => {
          const config = roleConfigs[roleItem.id];
          const rawSchedules = await prisma.schedule.findMany({
            where: config.scheduleWhere,
            include: SCHEDULE_INCLUDE,
            orderBy: { startTime: 'asc' },
          });
          const enriched = enrichSchedules(rawSchedules, roleItem.id, config.parentChildrenInfo);
          return {
            roleId: roleItem.id,
            schedules: enriched,
            canManage: config.canManage,
            canPropose: config.canPropose,
            userTierLevel: config.userTierLevel,
            headerTitle: config.headerTitle,
            headerSubtitle: config.headerSubtitle,
          };
        })
      ),
      needFormData
        ? prisma.user.findMany({
            where: {
              roles: {
                some: {
                  role: { in: ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'] },
                },
              },
            },
            select: {
              id: true,
              fullName: true,
            },
            orderBy: { fullName: 'asc' },
          })
        : Promise.resolve([]),
      needFormData
        ? prisma.class.findMany({
            where:
              scopedOrgIds !== null
                ? { organizationId: { in: scopedOrgIds } }
                : userProfile?.organizationId
                ? { organizationId: userProfile.organizationId }
                : {},
            select: {
              id: true,
              name: true,
              tierLevel: true,
              organizationId: true,
              generation: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      needFormData
        ? prisma.material.findMany({
            where: { isActive: true },
            select: {
              id: true,
              title: true,
              targetGeneration: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { title: 'asc' },
          })
        : Promise.resolve([]),
      needFormData
        ? prisma.generation.findMany({
            select: {
              id: true,
              name: true,
              code: true,
              color: true,
            },
            orderBy: { minAge: 'asc' },
          })
        : Promise.resolve([]),
      needFormData
        ? prisma.organization.findMany({
            where: scopedOrgIds !== null ? { id: { in: scopedOrgIds } } : {},
            select: {
              id: true,
              name: true,
              type: true,
              parentId: true,
            },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

  const roleDataMap: Record<string, RoleConfigData> = {};
  for (const res of scheduleResults) {
    roleDataMap[res.roleId] = {
      schedules: res.schedules,
      canManage: res.canManage,
      canPropose: res.canPropose,
      userTierLevel: res.userTierLevel,
      headerTitle: res.headerTitle,
      headerSubtitle: res.headerSubtitle,
    };
  }

  return (
    <JadwalClientWrapper
      initialActiveRole={initialActiveRole}
      availableRoles={availableRoles}
      roleDataMap={roleDataMap}
      teachers={teachers}
      classes={classes as any}
      materials={materials as any}
      generations={generations as any}
      scopedOrganizations={scopedOrganizations as any}
      currentUserOrgId={userProfile?.organizationId || null}
      currentUserId={user.id}
      roleCodes={roleCodes}
    />
  );
}

