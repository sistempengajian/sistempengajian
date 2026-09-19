import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import InteractiveCalendar from '@/components/jadwal/InteractiveCalendar';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import { CalendarIcon, ShieldCheck, GraduationCap, Heart, Calendar } from 'lucide-react';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { UserRole } from '@prisma/client';

export const metadata = {
  title: 'Jadwal Pengajian | Sistem Pengajian Terstruktur',
  description: 'Kalender sesi pengajian, agenda wilayah, delegasi ustadz badal, dan peluncur presensi QR.',
};

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

  // 3. Tentukan Role Tab yang Sedang Aktif
  const roleQuery = (resolvedParams.role || resolvedParams.view || '').toLowerCase();
  let activeRole: RoleTabId;
  const matchedRole = availableRoles.find((r) => r.id === roleQuery);
  if (matchedRole) {
    activeRole = matchedRole.id;
  } else {
    activeRole = availableRoles[0].id;
  }

  // 4. Konfigurasi Filter Scoped Jadwal & Hak Kelola berdasarkan activeRole
  let scheduleWhere: any = {};
  let classWhere: any = {};
  let canManage = false;
  const canPropose = isManager || isTeacher;
  let userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null = null;
  let headerTitle = 'Kelola Jadwal Pengajian & Badal';
  let headerSubtitle = 'Kalender terpadu sesi rutin mingguan, agenda wilayah, delegasi badal pengajar, dan peluncur presensi QR.';

  if (activeRole === 'manage') {
    canManage = isManager;
    if (isPjDaerah) {
      userTierLevel = 'DAERAH';
    } else if (isPjDesa) {
      userTierLevel = 'DESA';
    } else if (isPjKelompok) {
      userTierLevel = 'KELOMPOK';
    } else if (userProfile?.organization?.type) {
      userTierLevel = userProfile.organization.type as 'DAERAH' | 'DESA' | 'KELOMPOK';
    }

    const scopedOrgIds = await getScopedOrganizationIds(roleCodes, userProfile?.organizationId || null);
    if (scopedOrgIds !== null) {
      scheduleWhere = {
        organizationId: { in: scopedOrgIds },
      };
      classWhere = {
        organizationId: { in: scopedOrgIds },
      };
    }
    headerTitle = 'Kelola Jadwal Pengajian Wilayah';
    headerSubtitle = `Kalender sesi pengajian, alokasi ustadz, dan delegasi badal di lingkungan ${userProfile?.organization?.name || 'wilayah binaan'}.`;
  } else if (activeRole === 'teacher') {
    canManage = false; // Pengajar & Wali Kelas dibatasi (hanya delegasi badal & ajukan jadwal)
    if (userProfile?.organization?.type) {
      userTierLevel = userProfile.organization.type as 'DAERAH' | 'DESA' | 'KELOMPOK';
    }
    const homeroomClassIds = (userProfile?.homeroomClasses || []).map((c) => c.id);
    scheduleWhere = {
      OR: [
        {
          teachers: { some: { teacherId: user.id } },
          OR: [
            { approvalStatus: 'APPROVED' },
            { approvalStatus: null },
          ],
        },
        { requestedByUserId: user.id },
        ...(homeroomClassIds.length > 0
          ? [
              {
                AND: [
                  {
                    OR: [
                      { classId: { in: homeroomClassIds } },
                      { targetClasses: { some: { classId: { in: homeroomClassIds } } } },
                    ],
                  },
                  {
                    OR: [
                      { approvalStatus: 'APPROVED' },
                      { approvalStatus: null },
                    ],
                  },
                ],
              },
            ]
          : []),
      ],
    };
    if (userProfile?.organizationId) {
      classWhere = {
        organizationId: userProfile.organizationId,
      };
    }
    headerTitle = 'Jadwal Mengajar & Kelas Binaan';
    headerSubtitle = 'Kalender sesi pengajian yang Anda ampu sebagai Ustadz utama atau badal, serta sesi aktif kelas binaan Anda.';
  } else if (activeRole === 'parent') {
    canManage = false;
    userTierLevel = null;

    const childClassesPromises = (userProfile?.children || []).map((rel) => {
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
    const allChildClassIds = childClassResults.flat().map((c) => c.id);

    const allChildOrgIds = Array.from(
      new Set(
        (userProfile?.children || [])
          .flatMap((rel) => [
            rel.student.organizationId,
            rel.student.organization?.parentId,
          ])
          .filter(Boolean) as string[]
      )
    );

    const allChildGenerationIds = Array.from(
      new Set(
        (userProfile?.children || [])
          .map((rel) => rel.student.generationId)
          .filter(Boolean) as string[]
      )
    );

    scheduleWhere = {
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
    };
    classWhere = {};
    headerTitle = 'Jadwal Pengajian Anak';
    headerSubtitle = 'Pantau jadwal sesi pengajian kelas ananda dan agenda kegiatan pengajian keluarga.';
  } else {
    // activeRole === 'student'
    canManage = false;
    userTierLevel = null;

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
    const studentClassIds = studentClasses.map((c) => c.id);

    const allowedOrgIds = [
      userProfile?.organizationId,
      userProfile?.organization?.parentId,
      userProfile?.organization?.parent?.parentId,
    ].filter(Boolean) as string[];

    scheduleWhere = {
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
              organizationId: { in: allowedOrgIds },
            },
          ],
        },
      ],
    };
    classWhere = {};
    headerTitle = 'Jadwal Pengajian Saya';
    headerSubtitle = 'Jadwal sesi pengajian kelas Anda dan agenda pengajian umum di lingkungan wilayah Anda.';
  }

  // 5. Ambil data jadwal, ustadz, kelas, materi, jenjang, dan organisasi secara paralel
  const needFormData = canManage || canPropose;
  const [schedules, teachers, classes, materials, generations, scopedOrganizations] = await Promise.all([
    prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
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
          orderBy: { slotIndex: 'asc' },
        },
        attendanceSessions: {
          select: {
            id: true,
            isActive: true,
            openedAt: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    }),
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
          where: classWhere,
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
      ? (async () => {
          const sOrgIds = await getScopedOrganizationIds(roleCodes, userProfile?.organizationId || null);
          return prisma.organization.findMany({
            where: sOrgIds !== null ? { id: { in: sOrgIds } } : {},
            select: {
              id: true,
              name: true,
              type: true,
              parentId: true,
            },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          });
        })()
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* Tab Navigasi Multi-Role Pengguna (Hanya tampil jika user memiliki > 1 role) */}
      <RoleNavTabs
        title="Pilih Tampilan Jadwal Sesuai Peran"
        description="Akun Anda memiliki beberapa akses jadwal. Pilih modul jadwal yang ingin Anda pantau atau kelola."
        availableRoles={availableRoles}
        activeRole={activeRole}
      />

      {/* Top Header: Clean & Modern Glassmorphic Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {headerTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-1">
            {headerSubtitle}
          </p>
        </div>
      </div>

      {/* Interactive Calendar & Agenda View Component */}
      <InteractiveCalendar
        schedules={schedules as any}
        availableTeachers={teachers}
        availableClasses={classes as any}
        availableMaterials={materials as any}
        availableGenerations={generations as any}
        scopedOrganizations={scopedOrganizations as any}
        currentUserOrgId={userProfile?.organizationId || null}
        canManage={canManage}
        canPropose={canPropose}
        currentUserId={user.id}
        userTierLevel={userTierLevel}
        roleCodes={roleCodes}
      />
    </div>
  );
}
