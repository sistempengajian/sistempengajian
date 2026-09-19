import prisma from '@/lib/prisma';
import { TierLevel, UserRole } from '@prisma/client';
import {
  ClassesOverviewData,
  ClassWithRelations,
  ClassDetailData,
  ClassFormReferenceData,
  StudentClassData,
  HomeroomTeacherClassData,
  ParentClassData,
  ParentPendingVerificationItem,
  HomeroomClassItem,
  HomeroomStudentItem,
} from '@/components/kelas/types';
import { getScopedOrganizationIds } from '@/lib/scoped-access';

/**
 * Mengambil daftar kelas terfilter dengan Scoped RBAC wilayah
 */
export async function getClassesOverview(
  currentUserId: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): Promise<ClassesOverviewData> {
  // 1. Ambil data profil & peran user aktif
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      roles: true,
      organization: true,
    },
  });

  if (!currentUser) {
    throw new Error('Pengguna tidak ditemukan atau sesi telah berakhir.');
  }

  const currentUserRoles = currentUser.roles.map((r) => r.role);
  const isAdmin = currentUserRoles.includes('ADMIN_MASTER');
  const isPjDaerah = currentUserRoles.includes('PJ_DAERAH');
  const isPjDesa = currentUserRoles.includes('PJ_DESA');
  const isPjKelompok = currentUserRoles.includes('PJ_KELOMPOK');
  const isManager = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;

  // 2. Dapatkan batas ID organisasi yang boleh diakses
  const scopedOrgIds = await getScopedOrganizationIds(
    currentUserRoles,
    currentUser.organizationId
  );

  // Jika non-admin dan tidak memiliki wilayah binaan valid, kembalikan data kosong
  if (scopedOrgIds !== null && scopedOrgIds.length === 0) {
    return {
      classes: [],
      metrics: {
        totalClasses: 0,
        totalKelompokClasses: 0,
        totalDesaDaerahClasses: 0,
        totalHomeroomAssigned: 0,
      },
      pagination: {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
      },
      userPermissions: {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        isManager: false,
        isAdmin: false,
        managerScopeRoles: currentUserRoles,
      },
      filterOptions: {
        generations: [],
        tierLevels: [TierLevel.KELOMPOK, TierLevel.DESA, TierLevel.DAERAH],
        academicYears: ['2026/2027'],
      },
    };
  }

  // 3. Parsing parameter filter & paginasi
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';
  const generationId =
    typeof searchParams.generationId === 'string' && searchParams.generationId !== 'ALL'
      ? searchParams.generationId
      : undefined;
  const tierLevel =
    typeof searchParams.tierLevel === 'string' && searchParams.tierLevel !== 'ALL'
      ? (searchParams.tierLevel as TierLevel)
      : undefined;
  const academicYear =
    typeof searchParams.academicYear === 'string' && searchParams.academicYear !== 'ALL'
      ? searchParams.academicYear
      : undefined;

  const page = Math.max(1, parseInt((searchParams.page as string) || '1', 10));
  const limit = Math.max(1, Math.min(50, parseInt((searchParams.limit as string) || '12', 10)));
  const skip = (page - 1) * limit;

  // 4. Bangun Klausa Where Prisma
  const baseWhere: any = {};

  if (scopedOrgIds !== null) {
    baseWhere.organizationId = { in: scopedOrgIds };
  }

  const andFilters: any[] = [];

  if (generationId) {
    andFilters.push({ generationId });
  }

  if (tierLevel) {
    andFilters.push({ tierLevel });
  }

  if (academicYear) {
    andFilters.push({ academicYear });
  }

  if (search) {
    andFilters.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { academicYear: { contains: search, mode: 'insensitive' } },
        { organization: { name: { contains: search, mode: 'insensitive' } } },
        { homeroomTeacher: { fullName: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const finalWhere = andFilters.length > 0 ? { ...baseWhere, AND: andFilters } : baseWhere;

  // 5. Eksekusi Query Database
  const [totalCount, rawClasses, metricsAgg, generationsList, distinctYearsRaw] =
    await Promise.all([
      prisma.class.count({ where: finalWhere }),
      prisma.class.findMany({
        where: finalWhere,
        include: {
          organization: {
            include: {
              parent: true,
            },
          },
          generation: true,
          homeroomTeacher: {
            include: {
              organization: true,
              roles: true,
            },
          },
          _count: {
            select: {
              schedules: true,
              assignments: true,
            },
          },
        },
        orderBy: [{ tierLevel: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      // Metrik agregasi dalam scope user
      prisma.class.groupBy({
        by: ['tierLevel', 'homeroomTeacherId'],
        where: baseWhere,
        _count: { _all: true },
      }),
      // Daftar jenjang untuk filter options
      prisma.generation.findMany({
        select: { id: true, name: true, code: true, color: true },
        orderBy: { minAge: 'asc' },
      }),
      // Daftar tahun ajaran yang ada
      prisma.class.findMany({
        where: baseWhere,
        select: { academicYear: true },
        distinct: ['academicYear'],
      }),
    ]);

  // 6. Hitung jumlah santri untuk setiap kelas
  const studentCounts = await Promise.all(
    rawClasses.map((cls) =>
      prisma.user.count({
        where: {
          organizationId: cls.organizationId,
          generationId: cls.generationId,
          roles: {
            some: {
              role: 'SANTRI',
            },
          },
        },
      })
    )
  );

  const classes: ClassWithRelations[] = rawClasses.map((cls, idx) => ({
    id: cls.id,
    name: cls.name,
    tierLevel: cls.tierLevel,
    academicYear: cls.academicYear,
    organizationId: cls.organizationId,
    generationId: cls.generationId,
    homeroomTeacherId: cls.homeroomTeacherId,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
    organization: {
      id: cls.organization.id,
      name: cls.organization.name,
      type: cls.organization.type,
      parentId: cls.organization.parentId,
      parent: cls.organization.parent
        ? {
            id: cls.organization.parent.id,
            name: cls.organization.parent.name,
            type: cls.organization.parent.type,
          }
        : null,
    },
    generation: {
      id: cls.generation.id,
      code: cls.generation.code,
      name: cls.generation.name,
      minAge: cls.generation.minAge,
      maxAge: cls.generation.maxAge,
      color: cls.generation.color,
    },
    homeroomTeacher: cls.homeroomTeacher
      ? {
          id: cls.homeroomTeacher.id,
          fullName: cls.homeroomTeacher.fullName,
          phoneNumber: cls.homeroomTeacher.phoneNumber,
          gender: cls.homeroomTeacher.gender,
          avatarUrl: cls.homeroomTeacher.avatarUrl,
          organization: cls.homeroomTeacher.organization
            ? {
                id: cls.homeroomTeacher.organization.id,
                name: cls.homeroomTeacher.organization.name,
                type: cls.homeroomTeacher.organization.type,
              }
            : null,
          roles: cls.homeroomTeacher.roles.map((r) => ({ role: r.role })),
        }
      : null,
    studentCount: studentCounts[idx] || 0,
    _count: {
      schedules: cls._count.schedules,
      assignments: cls._count.assignments,
    },
  }));

  // 7. Kalkulasi Metrik Ringkasan
  let totalClasses = 0;
  let totalKelompokClasses = 0;
  let totalDesaDaerahClasses = 0;
  let totalHomeroomAssigned = 0;

  for (const item of metricsAgg) {
    const count = item._count._all;
    totalClasses += count;
    if (item.tierLevel === TierLevel.KELOMPOK) {
      totalKelompokClasses += count;
    } else {
      totalDesaDaerahClasses += count;
    }
    if (item.homeroomTeacherId !== null) {
      totalHomeroomAssigned += count;
    }
  }

  // Tahun ajaran unik + default jika kosong
  const academicYearsSet = new Set<string>([
    '2026/2027',
    '2025/2026',
    '2027/2028',
    '2024/2025',
  ]);
  distinctYearsRaw.forEach((y) => {
    if (y.academicYear) academicYearsSet.add(y.academicYear);
  });

  return {
    classes,
    metrics: {
      totalClasses,
      totalKelompokClasses,
      totalDesaDaerahClasses,
      totalHomeroomAssigned,
    },
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    userPermissions: {
      canCreate: isManager,
      canEdit: isManager,
      canDelete: isManager,
      isManager,
      isAdmin,
      managerScopeRoles: currentUserRoles,
    },
    filterOptions: {
      generations: generationsList,
      tierLevels: [TierLevel.KELOMPOK, TierLevel.DESA, TierLevel.DAERAH],
      academicYears: Array.from(academicYearsSet).sort().reverse(),
    },
  };
}

/**
 * Mengambil data referensi untuk formulir tambah/edit kelas (dioptimalkan tanpa query ganda)
 */
export async function getClassFormReferenceData(
  currentUserOrId:
    | string
    | {
        id: string;
        organizationId: string | null;
        roles: { role: UserRole }[];
      }
): Promise<ClassFormReferenceData> {
  const currentUser =
    typeof currentUserOrId === 'string'
      ? await prisma.user.findUnique({
          where: { id: currentUserOrId },
          select: {
            id: true,
            organizationId: true,
            roles: { select: { role: true } },
          },
        })
      : currentUserOrId;

  if (!currentUser) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const currentUserRoles = currentUser.roles.map((r) => r.role);
  const isAdmin = currentUserRoles.includes('ADMIN_MASTER');
  const isPjDaerah = currentUserRoles.includes('PJ_DAERAH');
  const isPjDesa = currentUserRoles.includes('PJ_DESA');
  const isPjKelompok = currentUserRoles.includes('PJ_KELOMPOK');
  const isManager = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;

  // Dapatkan batas organisasi
  const scopedOrgIds = await getScopedOrganizationIds(
    currentUserRoles,
    currentUser.organizationId
  );

  const orgWhere = scopedOrgIds !== null ? { id: { in: scopedOrgIds } } : {};

  // Ambil organisasi, generasi, dan dewan pengajar / wali kelas secara paralel
  const [organizations, generations, teachers, teacherClassCounts] = await Promise.all([
    prisma.organization.findMany({
      where: orgWhere,
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.generation.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        color: true,
        minAge: true,
        maxAge: true,
      },
      orderBy: { minAge: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: {
          some: {
            role: { in: ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH'] },
          },
        },
        ...(scopedOrgIds !== null
          ? {
              OR: [{ organizationId: { in: scopedOrgIds } }, { organizationId: null }],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        gender: true,
        organization: {
          select: { name: true },
        },
        roles: {
          select: { role: true },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.class.groupBy({
      by: ['homeroomTeacherId'],
      where: { homeroomTeacherId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const teacherCountsMap = new Map<string, number>();
  teacherClassCounts.forEach((c) => {
    if (c.homeroomTeacherId) {
      teacherCountsMap.set(c.homeroomTeacherId, c._count._all);
    }
  });

  const availableTeachers = teachers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phoneNumber: t.phoneNumber,
    gender: t.gender,
    organizationName: t.organization?.name || null,
    roles: t.roles.map((r) => r.role),
    currentAssignedClassesCount: teacherCountsMap.get(t.id) || 0,
  }));

  return {
    organizations,
    generations,
    availableTeachers,
    academicYears: ['2026/2027', '2025/2026', '2027/2028', '2024/2025'],
    userPermissions: {
      canCreate: isManager,
      canEdit: isManager,
      canDelete: isManager,
      isManager,
      isAdmin,
      managerScopeRoles: currentUserRoles,
    },
  };
}

/**
 * Mengambil detail kelas, daftar santri terdaftar, jadwal, dan tugas
 */
export async function getClassDetail(
  currentUserOrId:
    | string
    | {
        id: string;
        organizationId: string | null;
        roles: { role: UserRole }[];
      },
  classId: string
): Promise<ClassDetailData> {
  const currentUser =
    typeof currentUserOrId === 'string'
      ? await prisma.user.findUnique({
          where: { id: currentUserOrId },
          select: {
            id: true,
            organizationId: true,
            roles: { select: { role: true } },
          },
        })
      : currentUserOrId;

  if (!currentUser) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const currentUserRoles = currentUser.roles.map((r) => r.role);
  const isAdmin = currentUserRoles.includes('ADMIN_MASTER');
  const isPjDaerah = currentUserRoles.includes('PJ_DAERAH');
  const isPjDesa = currentUserRoles.includes('PJ_DESA');
  const isPjKelompok = currentUserRoles.includes('PJ_KELOMPOK');
  const isManager = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;

  const rawClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      organization: {
        include: { parent: true },
      },
      generation: true,
      homeroomTeacher: {
        include: { organization: true, roles: true },
      },
      _count: {
        select: { schedules: true, assignments: true },
      },
    },
  });

  if (!rawClass) {
    throw new Error('Data kelas tidak ditemukan.');
  }

  // Verifikasi Scoped RBAC
  const scopedOrgIds = await getScopedOrganizationIds(
    currentUserRoles,
    currentUser.organizationId
  );

  if (scopedOrgIds !== null && !scopedOrgIds.includes(rawClass.organizationId)) {
    throw new Error('Anda tidak memiliki izin untuk melihat detail kelas di luar wilayah binaan Anda.');
  }

  // Ambil santri di wilayah & jenjang kelas ini
  const [students, schedules, assignments] = await Promise.all([
    prisma.user.findMany({
      where: {
        organizationId: rawClass.organizationId,
        generationId: rawClass.generationId,
        roles: {
          some: {
            role: 'SANTRI',
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        gender: true,
        phoneNumber: true,
        avatarUrl: true,
        status: true,
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.schedule.findMany({
      where: {
        OR: [
          { classId },
          { targetClasses: { some: { classId } } },
        ],
      },
      select: {
        id: true,
        title: true,
        scheduleType: true,
        venuePlaceName: true,
        startTime: true,
        endTime: true,
        status: true,
      },
      orderBy: { startTime: 'desc' },
      take: 10,
    }),
    prisma.assignment.findMany({
      where: { classId },
      select: {
        id: true,
        title: true,
        taskType: true,
        dueDate: true,
        pointsReward: true,
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const classData: ClassWithRelations = {
    id: rawClass.id,
    name: rawClass.name,
    tierLevel: rawClass.tierLevel,
    academicYear: rawClass.academicYear,
    organizationId: rawClass.organizationId,
    generationId: rawClass.generationId,
    homeroomTeacherId: rawClass.homeroomTeacherId,
    createdAt: rawClass.createdAt,
    updatedAt: rawClass.updatedAt,
    organization: {
      id: rawClass.organization.id,
      name: rawClass.organization.name,
      type: rawClass.organization.type,
      parentId: rawClass.organization.parentId,
      parent: rawClass.organization.parent
        ? {
            id: rawClass.organization.parent.id,
            name: rawClass.organization.parent.name,
            type: rawClass.organization.parent.type,
          }
        : null,
    },
    generation: {
      id: rawClass.generation.id,
      code: rawClass.generation.code,
      name: rawClass.generation.name,
      minAge: rawClass.generation.minAge,
      maxAge: rawClass.generation.maxAge,
      color: rawClass.generation.color,
    },
    homeroomTeacher: rawClass.homeroomTeacher
      ? {
          id: rawClass.homeroomTeacher.id,
          fullName: rawClass.homeroomTeacher.fullName,
          phoneNumber: rawClass.homeroomTeacher.phoneNumber,
          gender: rawClass.homeroomTeacher.gender,
          avatarUrl: rawClass.homeroomTeacher.avatarUrl,
          organization: rawClass.homeroomTeacher.organization
            ? {
                id: rawClass.homeroomTeacher.organization.id,
                name: rawClass.homeroomTeacher.organization.name,
                type: rawClass.homeroomTeacher.organization.type,
              }
            : null,
          roles: rawClass.homeroomTeacher.roles.map((r) => ({ role: r.role })),
        }
      : null,
    studentCount: students.length,
    _count: {
      schedules: rawClass._count.schedules,
      assignments: rawClass._count.assignments,
    },
  };

  return {
    classData,
    students,
    schedules,
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      taskType: a.taskType,
      dueDate: a.dueDate,
      pointsReward: a.pointsReward,
      submissionsCount: a._count.submissions,
    })),
    userPermissions: {
      canCreate: isManager,
      canEdit: isManager,
      canDelete: isManager,
      isManager,
      isAdmin,
      managerScopeRoles: currentUserRoles,
    },
  };
}

/**
 * Mengambil data "Kelas Saya" khusus untuk peran SANTRI
 */
export async function getStudentClassData(studentUserId: string): Promise<StudentClassData> {
  const student = await prisma.user.findUnique({
    where: { id: studentUserId },
    include: {
      organization: {
        include: { parent: true },
      },
      generation: true,
      gamification: true,
    },
  });

  if (!student) {
    throw new Error('Data santri tidak ditemukan.');
  }

  // 1. Cari kelas yang sesuai dengan wilayah & jenjang santri
  let rawClass = null;
  if (student.organizationId && student.generationId) {
    rawClass = await prisma.class.findFirst({
      where: {
        organizationId: student.organizationId,
        generationId: student.generationId,
      },
      orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
      include: {
        organization: { include: { parent: true } },
        generation: true,
        homeroomTeacher: {
          include: { organization: true, roles: true },
        },
        _count: {
          select: { schedules: true, assignments: true },
        },
      },
    });

    // Jika belum ada di tingkat kelompok, cek di tingkat desa (parent)
    if (!rawClass && student.organization?.parentId) {
      rawClass = await prisma.class.findFirst({
        where: {
          organizationId: student.organization.parentId,
          generationId: student.generationId,
        },
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
        include: {
          organization: { include: { parent: true } },
          generation: true,
          homeroomTeacher: {
            include: { organization: true, roles: true },
          },
          _count: {
            select: { schedules: true, assignments: true },
          },
        },
      });
    }
  }

  // Cari seluruh kelas yang relevan untuk santri (Kelompok & Desa)
  const studentClasses = await prisma.class.findMany({
    where: {
      generationId: student.generationId || undefined,
      OR: [
        { organizationId: student.organizationId || undefined },
        { organizationId: student.organization?.parentId || undefined },
      ],
    },
    select: { id: true },
  });
  const studentClassIds = studentClasses.map((c) => c.id);
  if (rawClass?.id && !studentClassIds.includes(rawClass.id)) {
    studentClassIds.push(rawClass.id);
  }

  const studentOrgIds = [
    student.organizationId,
    student.organization?.parentId,
  ].filter(Boolean) as string[];

  // 2. Ambil teman sekelas
  const rawClassmates =
    student.organizationId && student.generationId
      ? await prisma.user.findMany({
          where: {
            organizationId: student.organizationId,
            generationId: student.generationId,
            roles: { some: { role: 'SANTRI' } },
            id: { not: studentUserId },
          },
          select: {
            id: true,
            fullName: true,
            gender: true,
            avatarUrl: true,
          },
          orderBy: { fullName: 'asc' },
          take: 30,
        })
      : [];

  // 3. Ambil jadwal pengajian kelas
  const schedulesWhere: any = {
    status: { in: ['SCHEDULED', 'ACTIVE', 'COMPLETED'] },
    organizationId: { in: studentOrgIds },
    OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
    AND: [
      {
        OR: [
          // 1. Jadwal spesifik kelas santri
          ...(studentClassIds.length > 0
            ? [
                { classId: { in: studentClassIds } },
                // 2. Jadwal gabungan yang secara eksplisit mendaftarkan kelas santri
                { targetClasses: { some: { classId: { in: studentClassIds } } } },
              ]
            : []),
          // 3. Jadwal yang menargetkan jenjang santri secara spesifik
          ...(student.generationId
            ? [
                { targetGenerations: { some: { generationId: student.generationId } } },
              ]
            : []),
          // 4. Jadwal umum wilayah tanpa pembatasan kelas/jenjang tertentu
          {
            classId: null,
            targetClasses: { none: {} },
            targetGenerations: { none: {} },
          },
        ],
      },
    ],
  };

  const rawSchedules = await prisma.schedule.findMany({
    where: schedulesWhere,
    select: {
      id: true,
      title: true,
      scheduleType: true,
      venuePlaceName: true,
      venueType: true,
      startTime: true,
      endTime: true,
      status: true,
      teachers: {
        where: { isPrimary: true },
        include: { teacher: { select: { fullName: true } } },
        take: 1,
      },
    },
    orderBy: { startTime: 'desc' },
    take: 10,
  });

  // 4. Ambil tugas kelas aktif & status pengerjaan santri
  const assignmentsWhere: any = {
    organizationId: { in: studentOrgIds },
    AND: [
      {
        OR: [
          ...(studentClassIds.length > 0 ? [{ classId: { in: studentClassIds } }] : []),
          { classId: null },
        ],
      },
    ],
  };

  const rawAssignments = await prisma.assignment.findMany({
    where: assignmentsWhere,
    include: {
      submissions: {
        where: { studentId: studentUserId },
        select: {
          id: true,
          status: true,
          score: true,
          submittedAt: true,
          parentVerification: {
            select: { isVerifiedByParent: true },
          },
        },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // 5. Hitung ringkasan presensi kehadiran
  const [totalRecords, attendedRecords] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { studentId: studentUserId },
    }),
    prisma.attendanceRecord.count({
      where: {
        studentId: studentUserId,
        status: { in: ['HADIR', 'TERLAMBAT'] },
      },
    }),
  ]);

  const attendancePercentage =
    totalRecords > 0 ? Math.round((attendedRecords / totalRecords) * 100) : 100;

  // Format response
  const classData: ClassWithRelations | null = rawClass
    ? {
        id: rawClass.id,
        name: rawClass.name,
        tierLevel: rawClass.tierLevel,
        academicYear: rawClass.academicYear,
        organizationId: rawClass.organizationId,
        generationId: rawClass.generationId,
        homeroomTeacherId: rawClass.homeroomTeacherId,
        createdAt: rawClass.createdAt,
        updatedAt: rawClass.updatedAt,
        organization: {
          id: rawClass.organization.id,
          name: rawClass.organization.name,
          type: rawClass.organization.type,
          parentId: rawClass.organization.parentId,
          parent: rawClass.organization.parent
            ? {
                id: rawClass.organization.parent.id,
                name: rawClass.organization.parent.name,
                type: rawClass.organization.parent.type,
              }
            : null,
        },
        generation: {
          id: rawClass.generation.id,
          code: rawClass.generation.code,
          name: rawClass.generation.name,
          minAge: rawClass.generation.minAge,
          maxAge: rawClass.generation.maxAge,
          color: rawClass.generation.color,
        },
        homeroomTeacher: rawClass.homeroomTeacher
          ? {
              id: rawClass.homeroomTeacher.id,
              fullName: rawClass.homeroomTeacher.fullName,
              phoneNumber: rawClass.homeroomTeacher.phoneNumber,
              gender: rawClass.homeroomTeacher.gender,
              avatarUrl: rawClass.homeroomTeacher.avatarUrl,
              organization: rawClass.homeroomTeacher.organization
                ? {
                    id: rawClass.homeroomTeacher.organization.id,
                    name: rawClass.homeroomTeacher.organization.name,
                    type: rawClass.homeroomTeacher.organization.type,
                  }
                : null,
              roles: rawClass.homeroomTeacher.roles.map((r) => ({ role: r.role })),
            }
          : null,
        studentCount: rawClassmates.length + 1,
        _count: {
          schedules: rawClass._count.schedules,
          assignments: rawClass._count.assignments,
        },
      }
    : null;

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      avatarUrl: student.avatarUrl,
      gender: student.gender,
      organization: student.organization
        ? {
            id: student.organization.id,
            name: student.organization.name,
            type: student.organization.type,
            parentId: student.organization.parentId,
          }
        : null,
      generation: student.generation
        ? {
            id: student.generation.id,
            code: student.generation.code,
            name: student.generation.name,
            minAge: student.generation.minAge,
            maxAge: student.generation.maxAge,
            color: student.generation.color,
          }
        : null,
      gamification: student.gamification
        ? {
            points: student.gamification.totalPoints,
            level: student.gamification.level,
          }
        : null,
    },
    classData,
    homeroomTeacher: classData?.homeroomTeacher || null,
    classmates: rawClassmates,
    schedules: rawSchedules.map((s) => ({
      id: s.id,
      title: s.title,
      scheduleType: s.scheduleType,
      venuePlaceName: s.venuePlaceName,
      venueType: s.venueType,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      teacherName: s.teachers[0]?.teacher.fullName || null,
    })),
    assignments: rawAssignments.map((a) => ({
      id: a.id,
      title: a.title,
      taskType: a.taskType,
      dueDate: a.dueDate,
      pointsReward: a.pointsReward,
      requiresParentVerification: a.requiresParentVerification,
      submission: a.submissions[0]
        ? {
            id: a.submissions[0].id,
            status: a.submissions[0].status,
            score: a.submissions[0].score,
            submittedAt: a.submissions[0].submittedAt,
            isVerifiedByParent: a.submissions[0].parentVerification?.isVerifiedByParent || false,
          }
        : null,
    })),
    attendanceSummary: {
      totalSessions: totalRecords,
      attendedCount: attendedRecords,
      percentage: attendancePercentage,
    },
  };
}

/**
 * Mengambil data "Kelas Binaan Saya" untuk WALI_KELAS / PENGAJAR
 */
export async function getHomeroomTeacherClassData(
  teacherUserId: string
): Promise<HomeroomTeacherClassData> {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherUserId },
    include: {
      organization: true,
      roles: true,
    },
  });

  if (!teacher) {
    throw new Error('Data pengajar tidak ditemukan.');
  }

  const roleCodes = teacher.roles.map((r) => r.role);
  const canSwitchToManageMode =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  // 1. Ambil kelas yang diampu resmi sebagai Wali Kelas
  const rawClasses = await prisma.class.findMany({
    where: { homeroomTeacherId: teacherUserId },
    include: {
      organization: { include: { parent: true } },
      generation: true,
      homeroomTeacher: {
        include: { organization: true, roles: true },
      },
      _count: {
        select: { schedules: true, assignments: true },
      },
    },
    orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
  });

  // 2. Untuk setiap kelas, ambil daftar santri, jadwal, dan tugas
  const assignedClasses: HomeroomClassItem[] = await Promise.all(
    rawClasses.map(async (cls) => {
      const [studentsRaw, schedulesRaw, assignmentsRaw] = await Promise.all([
        // Ambil santri di kelas ini beserta relasi orang tua
        prisma.user.findMany({
          where: {
            organizationId: cls.organizationId,
            generationId: cls.generationId,
            roles: { some: { role: 'SANTRI' } },
          },
          select: {
            id: true,
            fullName: true,
            gender: true,
            phoneNumber: true,
            avatarUrl: true,
            parents: {
              select: {
                relationshipType: true,
                parent: {
                  select: {
                    id: true,
                    fullName: true,
                    phoneNumber: true,
                  },
                },
              },
            },
            attendanceRecords: {
              where: {
                session: {
                  schedule: {
                    OR: [{ classId: cls.id }, { organizationId: cls.organizationId }],
                  },
                },
              },
              select: { status: true },
            },
            assignmentSubmissions: {
              where: {
                assignment: {
                  OR: [{ classId: cls.id }, { organizationId: cls.organizationId }],
                },
                status: { in: ['SUBMITTED', 'VERIFIED_BY_PARENT', 'GRADED'] },
              },
              select: { id: true },
            },
          },
          orderBy: { fullName: 'asc' },
        }),
        // Jadwal kelas
        prisma.schedule.findMany({
          where: {
            OR: [
              { classId: cls.id },
              { targetClasses: { some: { classId: cls.id } } },
            ],
          },
          select: {
            id: true,
            title: true,
            scheduleType: true,
            venuePlaceName: true,
            startTime: true,
            endTime: true,
            status: true,
          },
          orderBy: { startTime: 'desc' },
          take: 6,
        }),
        // Tugas kelas
        prisma.assignment.findMany({
          where: { classId: cls.id },
          select: {
            id: true,
            title: true,
            taskType: true,
            dueDate: true,
            pointsReward: true,
            _count: { select: { submissions: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      const students: HomeroomStudentItem[] = studentsRaw.map((s) => {
        const totalSessions = s.attendanceRecords.length;
        const attendedSessions = s.attendanceRecords.filter((a) =>
          ['HADIR', 'TERLAMBAT'].includes(a.status)
        ).length;
        const attendancePercentage =
          totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 100;

        return {
          id: s.id,
          fullName: s.fullName,
          gender: s.gender,
          phoneNumber: s.phoneNumber,
          avatarUrl: s.avatarUrl,
          parents: s.parents.map((p) => ({
            relationshipType: p.relationshipType,
            parent: {
              id: p.parent.id,
              fullName: p.parent.fullName,
              phoneNumber: p.parent.phoneNumber,
            },
          })),
          attendancePercentage,
          completedTasksCount: s.assignmentSubmissions.length,
        };
      });

      return {
        id: cls.id,
        name: cls.name,
        tierLevel: cls.tierLevel,
        academicYear: cls.academicYear,
        organizationId: cls.organizationId,
        generationId: cls.generationId,
        homeroomTeacherId: cls.homeroomTeacherId,
        createdAt: cls.createdAt,
        updatedAt: cls.updatedAt,
        organization: {
          id: cls.organization.id,
          name: cls.organization.name,
          type: cls.organization.type,
          parentId: cls.organization.parentId,
          parent: cls.organization.parent
            ? {
                id: cls.organization.parent.id,
                name: cls.organization.parent.name,
                type: cls.organization.parent.type,
              }
            : null,
        },
        generation: {
          id: cls.generation.id,
          code: cls.generation.code,
          name: cls.generation.name,
          minAge: cls.generation.minAge,
          maxAge: cls.generation.maxAge,
          color: cls.generation.color,
        },
        homeroomTeacher: cls.homeroomTeacher
          ? {
              id: cls.homeroomTeacher.id,
              fullName: cls.homeroomTeacher.fullName,
              phoneNumber: cls.homeroomTeacher.phoneNumber,
              gender: cls.homeroomTeacher.gender,
              avatarUrl: cls.homeroomTeacher.avatarUrl,
              organization: cls.homeroomTeacher.organization
                ? {
                    id: cls.homeroomTeacher.organization.id,
                    name: cls.homeroomTeacher.organization.name,
                    type: cls.homeroomTeacher.organization.type,
                  }
                : null,
              roles: cls.homeroomTeacher.roles.map((r) => ({ role: r.role })),
            }
          : null,
        studentCount: students.length,
        _count: {
          schedules: cls._count.schedules,
          assignments: cls._count.assignments,
        },
        students,
        schedules: schedulesRaw,
        assignments: assignmentsRaw.map((a) => ({
          id: a.id,
          title: a.title,
          taskType: a.taskType,
          dueDate: a.dueDate,
          pointsReward: a.pointsReward,
          submissionsCount: a._count.submissions,
          totalStudentsCount: students.length,
        })),
      };
    })
  );

  return {
    assignedClasses,
    canSwitchToManageMode,
    teacherInfo: {
      id: teacher.id,
      fullName: teacher.fullName,
      organizationName: teacher.organization?.name || null,
    },
  };
}

/**
 * Mengambil data "Kelas Ananda" khusus untuk peran ORANG_TUA
 */
export async function getParentClassData(
  parentUserId: string,
  selectedStudentId?: string
): Promise<ParentClassData> {
  // 1. Ambil relasi ananda yang terhubung dengan orang tua ini
  const relations = await prisma.studentParentRelation.findMany({
    where: { parentUserId },
    include: {
      student: {
        include: {
          organization: { include: { parent: true } },
          generation: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const children = relations.map((r) => ({
    id: r.student.id,
    fullName: r.student.fullName,
    gender: r.student.gender,
    avatarUrl: r.student.avatarUrl,
    relationshipType: r.relationshipType,
    generation: r.student.generation
      ? {
          id: r.student.generation.id,
          code: r.student.generation.code,
          name: r.student.generation.name,
          minAge: r.student.generation.minAge,
          maxAge: r.student.generation.maxAge,
          color: r.student.generation.color,
        }
      : null,
    organization: r.student.organization
      ? {
          id: r.student.organization.id,
          name: r.student.organization.name,
          type: r.student.organization.type,
          parentId: r.student.organization.parentId,
        }
      : null,
  }));

  // Tentukan ananda aktif yang dipilih
  const activeChild =
    children.find((c) => c.id === selectedStudentId) || children[0] || null;

  if (!activeChild) {
    return {
      children: [],
      selectedChildId: '',
      selectedChildClass: null,
      homeroomTeacher: null,
      pendingVerifications: [],
      schedules: [],
      attendanceSummary: {
        totalSessions: 0,
        attendedCount: 0,
        permissionCount: 0,
        percentage: 100,
      },
    };
  }

  // 2. Ambil kelas ananda terpilih
  let rawClass = null;
  if (activeChild.organization?.id && activeChild.generation?.id) {
    rawClass = await prisma.class.findFirst({
      where: {
        organizationId: activeChild.organization.id,
        generationId: activeChild.generation.id,
      },
      orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
      include: {
        organization: { include: { parent: true } },
        generation: true,
        homeroomTeacher: {
          include: { organization: true, roles: true },
        },
        _count: {
          select: { schedules: true, assignments: true },
        },
      },
    });

    if (!rawClass && activeChild.organization.parentId) {
      rawClass = await prisma.class.findFirst({
        where: {
          organizationId: activeChild.organization.parentId,
          generationId: activeChild.generation.id,
        },
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
        include: {
          organization: { include: { parent: true } },
          generation: true,
          homeroomTeacher: {
            include: { organization: true, roles: true },
          },
          _count: {
            select: { schedules: true, assignments: true },
          },
        },
      });
    }
  }

  // 3. Ambil tugas ananda yang membutuhkan verifikasi orang tua (belum diverifikasi)
  const pendingSubmissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId: activeChild.id,
      assignment: { requiresParentVerification: true },
      OR: [
        { parentVerification: null },
        { parentVerification: { isVerifiedByParent: false } },
      ],
    },
    include: {
      assignment: true,
      student: { select: { fullName: true } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 5,
  });

  const pendingVerifications: ParentPendingVerificationItem[] = pendingSubmissions.map((s) => ({
    submissionId: s.id,
    assignmentId: s.assignmentId,
    taskTitle: s.assignment.title,
    taskType: s.assignment.taskType,
    studentName: s.student.fullName,
    submittedAt: s.submittedAt,
    submissionText: s.submissionText,
    mediaFileUrl: s.mediaFileUrl,
    pointsReward: s.assignment.pointsReward,
  }));

  // Ambil seluruh ID kelas yang relevan untuk jenjang & organisasi ananda (Kelompok & Desa)
  const childClasses = await prisma.class.findMany({
    where: {
      generationId: activeChild.generation?.id || undefined,
      OR: [
        { organizationId: activeChild.organization?.id || undefined },
        { organizationId: activeChild.organization?.parentId || undefined },
      ],
    },
    select: { id: true },
  });
  const childClassIds = childClasses.map((c) => c.id);
  if (rawClass?.id && !childClassIds.includes(rawClass.id)) {
    childClassIds.push(rawClass.id);
  }

  const childOrgIds = [
    activeChild.organization?.id,
    activeChild.organization?.parentId,
  ].filter(Boolean) as string[];

  // 4. Ambil jadwal kelas ananda
  const schedulesWhere: any = {
    status: { in: ['SCHEDULED', 'ACTIVE', 'COMPLETED'] },
    organizationId: { in: childOrgIds },
    OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
    AND: [
      {
        OR: [
          // 1. Jadwal spesifik kelas anak
          ...(childClassIds.length > 0
            ? [
                { classId: { in: childClassIds } },
                // 2. Jadwal gabungan yang secara eksplisit mendaftarkan kelas anak
                { targetClasses: { some: { classId: { in: childClassIds } } } },
              ]
            : []),
          // 3. Jadwal yang menargetkan jenjang anak secara spesifik
          ...(activeChild.generation?.id
            ? [
                { targetGenerations: { some: { generationId: activeChild.generation.id } } },
              ]
            : []),
          // 4. Jadwal umum wilayah tanpa pembatasan kelas/jenjang tertentu
          {
            classId: null,
            targetClasses: { none: {} },
            targetGenerations: { none: {} },
          },
        ],
      },
    ],
  };

  const rawSchedules = await prisma.schedule.findMany({
    where: schedulesWhere,
    select: {
      id: true,
      title: true,
      venuePlaceName: true,
      startTime: true,
      endTime: true,
      status: true,
      scheduleType: true,
      targetScope: true,
      classId: true,
      class: { select: { name: true } },
      targetClasses: { select: { classId: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 8,
  });

  const schedules = rawSchedules.map((s) => ({
    id: s.id,
    title: s.title,
    venuePlaceName: s.venuePlaceName,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    scheduleType: s.scheduleType,
    targetScope: s.targetScope,
    isCombined: s.targetClasses.length > 1 || (s.targetClasses.length > 0 && Boolean(s.classId)),
    className: s.class?.name || null,
  }));

  // 5. Hitung riwayat kehadiran ananda
  const [totalSessions, attendedCount, permissionCount] = await Promise.all([
    prisma.attendanceRecord.count({
      where: { studentId: activeChild.id },
    }),
    prisma.attendanceRecord.count({
      where: {
        studentId: activeChild.id,
        status: { in: ['HADIR', 'TERLAMBAT'] },
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        studentId: activeChild.id,
        status: { in: ['IZIN', 'SAKIT'] },
      },
    }),
  ]);

  const percentage =
    totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

  const selectedChildClass: ClassWithRelations | null = rawClass
    ? {
        id: rawClass.id,
        name: rawClass.name,
        tierLevel: rawClass.tierLevel,
        academicYear: rawClass.academicYear,
        organizationId: rawClass.organizationId,
        generationId: rawClass.generationId,
        homeroomTeacherId: rawClass.homeroomTeacherId,
        createdAt: rawClass.createdAt,
        updatedAt: rawClass.updatedAt,
        organization: {
          id: rawClass.organization.id,
          name: rawClass.organization.name,
          type: rawClass.organization.type,
          parentId: rawClass.organization.parentId,
          parent: rawClass.organization.parent
            ? {
                id: rawClass.organization.parent.id,
                name: rawClass.organization.parent.name,
                type: rawClass.organization.parent.type,
              }
            : null,
        },
        generation: {
          id: rawClass.generation.id,
          code: rawClass.generation.code,
          name: rawClass.generation.name,
          minAge: rawClass.generation.minAge,
          maxAge: rawClass.generation.maxAge,
          color: rawClass.generation.color,
        },
        homeroomTeacher: rawClass.homeroomTeacher
          ? {
              id: rawClass.homeroomTeacher.id,
              fullName: rawClass.homeroomTeacher.fullName,
              phoneNumber: rawClass.homeroomTeacher.phoneNumber,
              gender: rawClass.homeroomTeacher.gender,
              avatarUrl: rawClass.homeroomTeacher.avatarUrl,
              organization: rawClass.homeroomTeacher.organization
                ? {
                    id: rawClass.homeroomTeacher.organization.id,
                    name: rawClass.homeroomTeacher.organization.name,
                    type: rawClass.homeroomTeacher.organization.type,
                  }
                : null,
              roles: rawClass.homeroomTeacher.roles.map((r) => ({ role: r.role })),
            }
          : null,
        studentCount: 0,
        _count: {
          schedules: rawClass._count.schedules,
          assignments: rawClass._count.assignments,
        },
      }
    : null;

  return {
    children,
    selectedChildId: activeChild.id,
    selectedChildClass,
    homeroomTeacher: selectedChildClass?.homeroomTeacher || null,
    pendingVerifications,
    schedules,
    attendanceSummary: {
      totalSessions,
      attendedCount,
      permissionCount,
      percentage,
    },
  };
}

