import prisma from '@/lib/prisma';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { CACHE_TAGS } from '@/lib/cache';
import { formatWibDate, formatWibTime } from '@/lib/utils';
import { parseAssignmentConfig } from '@/lib/assignmentConfig';
import { ScheduleStatus, ScheduleType, TierLevel, UserRole } from '@prisma/client';
import { unstable_cache } from 'next/cache';

export interface UpcomingScheduleItem {
  id: string;
  title: string;
  scheduleType: ScheduleType;
  tierLevel: TierLevel;
  status: ScheduleStatus;
  startTime: Date | string;
  endTime: Date | string | null;
  venuePlaceName: string;
  teachers: Array<{
    isPrimary: boolean;
    isSubstitute: boolean;
    teacher: {
      id: string;
      fullName: string;
    };
  }>;
}

export interface HeaderNotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  href?: string;
  unread?: boolean;
}

export interface ProgressMetricBucket {
  completed: number;
  total: number;
  percentage: number;
}

export interface MonthlyAttendanceMetric {
  hadir: number;
  total: number;
  percentage: number;
  alpaCount: number;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  dueDate: string | null;
  pointsReward: number;
}

export interface StudentCurriculumMetrics {
  overall: ProgressMetricBucket;
  monthly: ProgressMetricBucket & {
    source: 'TARGET' | 'SCHEDULE' | 'NONE';
  };
  monthlyAttendance: MonthlyAttendanceMetric;
  monthLabel: string;
  overallPercentage: number;
  alpaCount: number;
  recentPassedMaterials: Array<{ title: string; isCompleted: boolean }>;
  badgesList: Array<{ name: string; category?: string }>;
  pendingTasksCount: number;
  pendingTasksList: PendingTaskItem[];
}

export interface ChildProgressMetric {
  studentId: string;
  fullName: string;
  generationName?: string;
  completedChecklists: number;
  totalChecklists: number;
  curriculumPercentage: number;
  monthlyCompletedChecklists: number;
  monthlyTotalChecklists: number;
  monthlyPercentage: number;
  monthlySource: 'TARGET' | 'SCHEDULE' | 'NONE';
  attendanceHadir: number;
  attendanceTotal: number;
  attendancePercentage: number;
  alpaCount: number;
  monthLabel: string;
}

export interface TeacherDashboardMetrics {
  monthlySessionsCount: number;
  pendingGradingsCount: number;
}

export interface PjTerritoryMetrics {
  totalSantri: number;
  attendanceRate: number;
  pendingApprovals: number;
  orgScopeCount: number;
}

export interface AdminGlobalMetrics {
  totalWilayah: number;
  totalDewanGuru: number;
  totalSantri: number;
  pendingApprovals: number;
  dbHealth: 'Normal' | 'Gangguan';
}

/**
 * Mengambil informasi tahun, bulan (1-12), label, dan rentang tanggal awal-akhir bulan ini pada zona waktu WIB.
 */
export function getWibCurrentMonthInfo(baseDate: Date = new Date()) {
  const yearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).format(baseDate); // YYYY-MM
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const startOfMonth = new Date(`${yearStr}-${monthStr}-01T00:00:00+07:00`);
  const endOfMonth = new Date(
    `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999+07:00`
  );

  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'long',
    year: 'numeric',
  }).format(baseDate);

  return { year, month, monthLabel, startOfMonth, endOfMonth };
}

/**
 * Helper terpadu untuk membangun klausa scope jadwal milik seorang santri pada hierarki organisasinya.
 */
function buildStudentOrgScheduleFilters(
  orgIds: string[],
  generationId?: string | null
): any[] {
  const validOrgIds = Array.from(new Set(orgIds.filter(Boolean)));
  if (validOrgIds.length === 0) return [];

  const filters: any[] = [];
  if (generationId) {
    filters.push(
      {
        organizationId: { in: validOrgIds },
        targetGenerations: { some: { generationId } },
      },
      {
        organizationId: { in: validOrgIds },
        class: { generationId },
      },
      {
        organizationId: { in: validOrgIds },
        targetClasses: { some: { class: { generationId } } },
      }
    );
  }
  filters.push({
    organizationId: { in: validOrgIds },
    classId: null,
    targetClasses: { none: {} },
    targetGenerations: { none: {} },
  });
  return filters;
}

export interface ChildScheduleScope {
  organizationId?: string | null;
  parentOrgId?: string | null;
  grandParentOrgId?: string | null;
  generationId?: string | null;
}

/**
 * 1. Query 3 Jadwal Pengajian Terdekat yang Akan Datang Sesuai Peran dan Wilayah Pengguna
 */
export async function getUpcomingSchedulesForUser({
  userId,
  roles,
  organizationId,
  organizationHierarchyIds = [],
  generationId,
  childrenGenerationIds = [],
  childrenScopes = [],
  homeroomClassIds = [],
}: {
  userId: string;
  roles: UserRole[];
  organizationId?: string | null;
  organizationHierarchyIds?: string[];
  generationId?: string | null;
  childrenGenerationIds?: string[];
  childrenScopes?: ChildScheduleScope[];
  homeroomClassIds?: string[];
}): Promise<UpcomingScheduleItem[]> {
  const isManager = roles.some((r) =>
    ['ADMIN_MASTER', 'PJ_DAERAH', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r)
  );
  const isTeacher = roles.includes('PENGAJAR') || roles.includes('WALI_KELAS');
  const isParent = roles.includes('ORANG_TUA');
  const isSantri = roles.includes('SANTRI');

  const now = new Date(Date.now() - 2 * 3600 * 1000); // Sesi yang baru mulai hingga 2 jam lalu masih dianggap relevan

  // Bangun filter OR sesuai peran
  const roleFilters: any[] = [];
  const santriOrgIds = Array.from(
    new Set([organizationId, ...organizationHierarchyIds].filter(Boolean) as string[])
  );

  if (roles.includes('ADMIN_MASTER')) {
    // Admin Master melihat jadwal terdekat apa saja
    roleFilters.push({});
  } else if (isManager && organizationId) {
    const scopedOrgIds = await getScopedOrganizationIds(roles, organizationId);
    if (scopedOrgIds && scopedOrgIds.length > 0) {
      roleFilters.push({ organizationId: { in: scopedOrgIds } });
    } else {
      roleFilters.push({ organizationId });
    }
  }

  if (isTeacher) {
    roleFilters.push({
      teachers: { some: { teacherId: userId } },
    });
    if (homeroomClassIds.length > 0) {
      roleFilters.push({ classId: { in: homeroomClassIds } });
      roleFilters.push({
        targetClasses: { some: { classId: { in: homeroomClassIds } } },
      });
    }
  }

  if (isSantri && santriOrgIds.length > 0) {
    if (generationId) {
      roleFilters.push(...buildStudentOrgScheduleFilters(santriOrgIds, generationId));
    } else {
      roleFilters.push({ organizationId: { in: santriOrgIds } });
    }
  }

  if (isParent) {
    const effectiveChildScopes: ChildScheduleScope[] =
      childrenScopes.length > 0
        ? childrenScopes
        : childrenGenerationIds.length > 0 && organizationId
          ? childrenGenerationIds.map((genId) => ({
              organizationId,
              generationId: genId,
            }))
          : [];

    for (const child of effectiveChildScopes) {
      const childOrgIds = Array.from(
        new Set(
          [child.organizationId, child.parentOrgId, child.grandParentOrgId].filter(
            Boolean
          ) as string[]
        )
      );
      if (childOrgIds.length === 0) continue;

      if (child.generationId) {
        roleFilters.push(...buildStudentOrgScheduleFilters(childOrgIds, child.generationId));
      } else {
        roleFilters.push({ organizationId: { in: childOrgIds } });
      }
    }
  }

  // Jika tidak ada filter peran spesifik, gunakan wilayah pengguna
  if (roleFilters.length === 0 && organizationId) {
    roleFilters.push({ organizationId });
  }

  if (roleFilters.length === 0) {
    return [];
  }

  const approvalFilter = {
    OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' as const }],
  };

  try {
    return await prisma.schedule.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        ...approvalFilter,
        startTime: { gte: now },
        OR: roleFilters,
      },
      orderBy: { startTime: 'asc' },
      take: 3,
      select: {
        id: true,
        title: true,
        scheduleType: true,
        tierLevel: true,
        status: true,
        startTime: true,
        endTime: true,
        venuePlaceName: true,
        teachers: {
          orderBy: [{ isPrimary: 'desc' }, { isSubstitute: 'asc' }],
          select: {
            isPrimary: true,
            isSubstitute: true,
            teacher: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('Error in getUpcomingSchedulesForUser:', error);
    return [];
  }
}

/**
 * Cached version of getUpcomingSchedulesForUser.
 * Uses Next.js Data Cache with a 5-minute revalidation window and cache tags.
 */
export function getCachedUpcomingSchedules(
  args: Parameters<typeof getUpcomingSchedulesForUser>[0]
) {
  const roleKeyPart = [...args.roles].sort().join(',');
  return unstable_cache(
    (params: Parameters<typeof getUpcomingSchedulesForUser>[0]) =>
      getUpcomingSchedulesForUser(params),
    ['schedule:upcoming-list:v1', args.userId, roleKeyPart],
    {
      revalidate: 300,
      tags: [CACHE_TAGS.UPCOMING_SCHEDULE, CACHE_TAGS.upcomingScheduleUser(args.userId)],
    }
  )(args);
}

/**
 * Shared computation engine for student curriculum (overall generation & current month)
 * and current month attendance aligned with Menu Rapor (/laporan):
 * conducted sessions (COMPLETED, ACTIVE, or startTime <= now), with missing records counted as ALPA.
 */
async function computeStudentDashboardMetrics({
  studentId,
  generationId,
  orgHierarchyIds = [],
}: {
  studentId: string;
  generationId?: string | null;
  orgHierarchyIds?: string[];
}) {
  const { year, month, monthLabel, startOfMonth, endOfMonth } = getWibCurrentMonthInfo();

  const validOrgIds = Array.from(new Set(orgHierarchyIds.filter(Boolean)));
  const orgMaterialFilter =
    validOrgIds.length > 0
      ? {
          OR: [
            { creatorTierLevel: 'DAERAH' as const },
            { organizationId: null },
            { organizationId: { in: validOrgIds } },
          ],
        }
      : {
          OR: [{ creatorTierLevel: 'DAERAH' as const }, { organizationId: null }],
        };

  const orgChecklistFilter =
    validOrgIds.length > 0
      ? {
          OR: [
            { organizationId: null },
            { tierLevel: 'DAERAH' as const },
            { organizationId: { in: validOrgIds } },
            { material: { organizationId: { in: validOrgIds } } },
          ],
        }
      : {
          OR: [{ organizationId: null }, { tierLevel: 'DAERAH' as const }],
        };

  const studentScheduleScope: any[] = [
    { attendanceSessions: { some: { records: { some: { studentId } } } } },
    ...buildStudentOrgScheduleFilters(validOrgIds, generationId),
  ];

  const [progressRecords, genMaterials, monthlyTargets, monthlySchedules] = await Promise.all([
    prisma.materialChecklistProgress.findMany({
      where: { studentId },
      orderBy: { evaluatedAt: 'desc' },
      include: {
        checklistItem: {
          include: {
            material: {
              select: { id: true, title: true, isActive: true },
            },
          },
        },
      },
    }),
    generationId
      ? prisma.material.findMany({
          where: {
            targetGenerationId: generationId,
            isActive: true,
            ...orgMaterialFilter,
          },
          include: {
            checklistItems: {
              where: orgChecklistFilter,
              select: { id: true },
            },
          },
        })
      : Promise.resolve([]),
    generationId
      ? prisma.materialMonthlyTarget.findMany({
          where: {
            generationId,
            year,
            month,
            isActive: true,
            OR: [
              { organizationId: null },
              { tierLevel: 'DAERAH' },
              ...(validOrgIds.length > 0 ? [{ organizationId: { in: validOrgIds } }] : []),
            ],
          },
          include: {
            material: {
              select: {
                id: true,
                isActive: true,
                checklistItems: {
                  where: orgChecklistFilter,
                  select: { id: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.schedule.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
        startTime: { gte: startOfMonth, lte: endOfMonth },
        AND: [{ OR: studentScheduleScope }],
      },
      select: {
        id: true,
        startTime: true,
        status: true,
        scheduleMaterials: {
          select: {
            material: {
              select: {
                id: true,
                isActive: true,
                checklistItems: {
                  where: orgChecklistFilter,
                  select: { id: true },
                },
              },
            },
          },
        },
        attendanceSessions: {
          orderBy: { openedAt: 'desc' },
          select: {
            records: {
              where: { studentId },
              select: { status: true },
            },
          },
        },
      },
    }),
  ]);

  const completedChecklistIds = new Set(
    progressRecords.filter((p) => p.isCompleted).map((p) => p.checklistItemId)
  );

  // 1. Progress Keseluruhan Pencapaian Sesuai Jenjang Santri
  const overallChecklistIds = new Set<string>();
  for (const mat of genMaterials) {
    for (const item of mat.checklistItems) {
      overallChecklistIds.add(item.id);
    }
  }
  let overallCompleted = 0;
  overallChecklistIds.forEach((itemId) => {
    if (completedChecklistIds.has(itemId)) {
      overallCompleted++;
    }
  });
  const overallTotal = overallChecklistIds.size;
  const overallPercentage =
    overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0;

  // 2. Progress Pencapaian Bulan Ini (prioritas Target Bulanan; fallback ke materi terjadwal bulan ini)
  const monthlyTargetItemIds = new Set<string>();
  for (const mt of monthlyTargets) {
    if (!mt.material?.isActive) continue;
    for (const item of mt.material.checklistItems) {
      monthlyTargetItemIds.add(item.id);
    }
  }

  let monthlySource: 'TARGET' | 'SCHEDULE' | 'NONE' = 'NONE';
  const monthlyItemIds = new Set<string>();

  if (monthlyTargetItemIds.size > 0) {
    monthlySource = 'TARGET';
    monthlyTargetItemIds.forEach((id) => monthlyItemIds.add(id));
  } else {
    for (const sched of monthlySchedules) {
      for (const sm of sched.scheduleMaterials) {
        if (!sm.material?.isActive) continue;
        for (const item of sm.material.checklistItems) {
          monthlyItemIds.add(item.id);
        }
      }
    }
    if (monthlyItemIds.size > 0) {
      monthlySource = 'SCHEDULE';
    }
  }

  let monthlyCompleted = 0;
  monthlyItemIds.forEach((itemId) => {
    if (completedChecklistIds.has(itemId)) {
      monthlyCompleted++;
    }
  });
  const monthlyTotal = monthlyItemIds.size;
  const monthlyPercentage =
    monthlyTotal > 0 ? Math.round((monthlyCompleted / monthlyTotal) * 100) : 0;

  // 3. Kehadiran Santri Bulan Ini: disamakan persis dengan Menu Rapor (/laporan)
  // Mengambil sesi berstatus COMPLETED, ACTIVE, atau sudah melewati waktu mulai (startTime <= now);
  // jika belum ada record presensi pada sesi terlaksana tersebut, dihitung sebagai ALPA.
  const now = new Date();
  const conductedMonthSchedules = monthlySchedules.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'ACTIVE' || s.startTime <= now
  );
  let hadirCount = 0;
  let alpaCount = 0;

  for (const sched of conductedMonthSchedules) {
    const record = sched.attendanceSessions.flatMap((sess) => sess.records)[0];
    const status = record ? record.status : 'ALPA';
    if (status === 'HADIR' || status === 'TERLAMBAT') {
      hadirCount++;
    } else if (status === 'ALPA') {
      alpaCount++;
    }
  }

  const totalHeldSessions = conductedMonthSchedules.length;
  const attendancePercentage =
    totalHeldSessions > 0
      ? Math.round((hadirCount / totalHeldSessions) * 100)
      : 0;

  const recentCompleted = progressRecords
    .filter((p) => p.isCompleted && p.checklistItem?.material?.title)
    .slice(0, 3)
    .map((p) => ({
      title: `${p.checklistItem.material.title} (${p.checklistItem.itemTitle})`,
      isCompleted: true,
    }));

  return {
    overall: {
      completed: overallCompleted,
      total: overallTotal,
      percentage: overallPercentage,
    },
    monthly: {
      completed: monthlyCompleted,
      total: monthlyTotal,
      percentage: monthlyPercentage,
      source: monthlySource,
    },
    monthlyAttendance: {
      hadir: hadirCount,
      total: totalHeldSessions,
      percentage: attendancePercentage,
      alpaCount,
    },
    monthLabel,
    recentPassedMaterials: recentCompleted,
  };
}

/**
 * Mengambil ringkasan tugas santri yang belum dikerjakan (selaras dengan filter tab Belum Dikerjakan di /tugas).
 */
async function getStudentPendingTasksSummary(
  studentId: string,
  generationId?: string | null,
  orgHierarchyIds: string[] = []
): Promise<{ count: number; items: PendingTaskItem[] }> {
  const validOrgIds = Array.from(new Set(orgHierarchyIds.filter(Boolean)));
  if (validOrgIds.length === 0 && !generationId) {
    return { count: 0, items: [] };
  }

  const rawAssignments = await prisma.assignment.findMany({
    where: {
      OR: [
        ...(validOrgIds.length > 0 ? [{ organizationId: { in: validOrgIds } }] : []),
        ...(generationId ? [{ material: { targetGenerationId: generationId } }] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      pointsReward: true,
      attachmentUrl: true,
      submissions: {
        where: { studentId },
        select: { status: true },
        take: 1,
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const pendingAssignments = rawAssignments.filter((a) => {
    const cfg = parseAssignmentConfig(a.attachmentUrl);
    if (cfg.targetStudentIds && cfg.targetStudentIds.length > 0) {
      if (!cfg.targetStudentIds.includes(studentId)) return false;
    } else if (cfg.targetGenerationIds && cfg.targetGenerationIds.length > 0) {
      if (!generationId || !cfg.targetGenerationIds.includes(generationId)) return false;
    }

    const sub = a.submissions[0];
    return !sub || sub.status === 'PENDING';
  });

  return {
    count: pendingAssignments.length,
    items: pendingAssignments.slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      pointsReward: a.pointsReward,
    })),
  };
}

/**
 * 2. Query Capaian Kurikulum & Kehadiran Santri Berdasarkan Data Nyata
 */
export async function getStudentCurriculumMetrics(
  studentId: string,
  generationId?: string | null,
  orgHierarchyIds: string[] = []
): Promise<StudentCurriculumMetrics> {
  const { monthLabel } = getWibCurrentMonthInfo();
  const defaultMetrics: StudentCurriculumMetrics = {
    overall: { completed: 0, total: 0, percentage: 0 },
    monthly: { completed: 0, total: 0, percentage: 0, source: 'NONE' },
    monthlyAttendance: { hadir: 0, total: 0, percentage: 0, alpaCount: 0 },
    monthLabel,
    overallPercentage: 0,
    alpaCount: 0,
    recentPassedMaterials: [],
    badgesList: [],
    pendingTasksCount: 0,
    pendingTasksList: [],
  };

  if (!studentId) return defaultMetrics;

  try {
    const [computed, studentBadges, pendingTasks] = await Promise.all([
      computeStudentDashboardMetrics({
        studentId,
        generationId,
        orgHierarchyIds,
      }),
      prisma.studentBadge.findMany({
        where: { studentId },
        include: { badge: true },
        orderBy: { unlockedAt: 'desc' },
        take: 4,
      }),
      getStudentPendingTasksSummary(studentId, generationId, orgHierarchyIds).catch(() => ({
        count: 0,
        items: [] as PendingTaskItem[],
      })),
    ]);

    return {
      overall: computed.overall,
      monthly: computed.monthly,
      monthlyAttendance: computed.monthlyAttendance,
      monthLabel: computed.monthLabel,
      overallPercentage: computed.overall.percentage,
      alpaCount: computed.monthlyAttendance.alpaCount,
      recentPassedMaterials: computed.recentPassedMaterials,
      badgesList: studentBadges.map((sb) => ({
        name: sb.badge.name,
        category: sb.badge.category,
      })),
      pendingTasksCount: pendingTasks.count,
      pendingTasksList: pendingTasks.items,
    };
  } catch (error) {
    console.error('Error in getStudentCurriculumMetrics:', error);
    return defaultMetrics;
  }
}

/**
 * 3. Query Capaian Progres & Kehadiran Nyata Ananda untuk Tampilan Orang Tua
 */
export async function getChildrenProgressMetrics(
  childrenList: Array<{
    student: {
      id: string;
      fullName: string;
      organizationId?: string | null;
      organization?: {
        parentId?: string | null;
        parent?: { parentId?: string | null } | null;
      } | null;
      generationId?: string | null;
      generation?: { name: string } | null;
    };
  }>
): Promise<Record<string, ChildProgressMetric>> {
  const result: Record<string, ChildProgressMetric> = {};
  const { monthLabel } = getWibCurrentMonthInfo();

  if (!childrenList || childrenList.length === 0) return result;

  await Promise.all(
    childrenList.map(async ({ student }) => {
      try {
        const childOrgIds = [
          student.organizationId,
          student.organization?.parentId,
          student.organization?.parent?.parentId,
        ].filter(Boolean) as string[];

        const computed = await computeStudentDashboardMetrics({
          studentId: student.id,
          generationId: student.generationId,
          orgHierarchyIds: childOrgIds,
        });

        result[student.id] = {
          studentId: student.id,
          fullName: student.fullName,
          generationName: student.generation?.name,
          completedChecklists: computed.overall.completed,
          totalChecklists: computed.overall.total,
          curriculumPercentage: computed.overall.percentage,
          monthlyCompletedChecklists: computed.monthly.completed,
          monthlyTotalChecklists: computed.monthly.total,
          monthlyPercentage: computed.monthly.percentage,
          monthlySource: computed.monthly.source,
          attendanceHadir: computed.monthlyAttendance.hadir,
          attendanceTotal: computed.monthlyAttendance.total,
          attendancePercentage: computed.monthlyAttendance.percentage,
          alpaCount: computed.monthlyAttendance.alpaCount,
          monthLabel: computed.monthLabel,
        };
      } catch (err) {
        console.error(`Error computing metrics for child ${student.id}:`, err);
        result[student.id] = {
          studentId: student.id,
          fullName: student.fullName,
          generationName: student.generation?.name,
          completedChecklists: 0,
          totalChecklists: 0,
          curriculumPercentage: 0,
          monthlyCompletedChecklists: 0,
          monthlyTotalChecklists: 0,
          monthlyPercentage: 0,
          monthlySource: 'NONE',
          attendanceHadir: 0,
          attendanceTotal: 0,
          attendancePercentage: 0,
          alpaCount: 0,
          monthLabel,
        };
      }
    })
  );

  return result;
}

/**
 * 3B. Query Metrik Operasional Pengajar / Wali Kelas
 */
export async function getTeacherDashboardMetrics(
  teacherId: string,
  homeroomClassIds: string[] = []
): Promise<TeacherDashboardMetrics> {
  if (!teacherId) {
    return { monthlySessionsCount: 0, pendingGradingsCount: 0 };
  }

  try {
    const { startOfMonth, endOfMonth } = getWibCurrentMonthInfo();

    const [monthlySessionsCount, pendingGradingsCount] = await Promise.all([
      prisma.schedule.count({
        where: {
          status: { not: 'CANCELLED' },
          OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
          startTime: { gte: startOfMonth, lte: endOfMonth },
          AND: [
            {
              OR: [
                { teachers: { some: { teacherId } } },
                ...(homeroomClassIds.length > 0
                  ? [
                      { classId: { in: homeroomClassIds } },
                      { targetClasses: { some: { classId: { in: homeroomClassIds } } } },
                    ]
                  : []),
              ],
            },
          ],
        },
      }),
      prisma.assignmentSubmission.count({
        where: {
          status: { in: ['SUBMITTED', 'VERIFIED_BY_PARENT'] },
          assignment: { teacherId },
        },
      }),
    ]);

    return { monthlySessionsCount, pendingGradingsCount };
  } catch (error) {
    console.error('Error in getTeacherDashboardMetrics:', error);
    return { monthlySessionsCount: 0, pendingGradingsCount: 0 };
  }
}

/**
 * 4. Query Metrik Wilayah Nyata untuk Pengurus (PJ Kelompok, Desa, Daerah)
 */
export async function getPjTerritoryMetrics(
  roles: UserRole[],
  organizationId?: string | null
): Promise<PjTerritoryMetrics> {
  const defaultMetrics: PjTerritoryMetrics = {
    totalSantri: 0,
    attendanceRate: 0,
    pendingApprovals: 0,
    orgScopeCount: 1,
  };

  if (!organizationId) return defaultMetrics;

  try {
    const scopedOrgIds = await getScopedOrganizationIds(roles, organizationId);
    const targetOrgIds =
      scopedOrgIds && scopedOrgIds.length > 0 ? scopedOrgIds : [organizationId];

    const [santriCount, attendanceSessions, pendingCount] = await Promise.all([
      prisma.user.count({
        where: {
          status: 'ACTIVE',
          roles: { some: { role: 'SANTRI' } },
          organizationId: { in: targetOrgIds },
        },
      }),
      prisma.attendanceSession.findMany({
        where: {
          schedule: { organizationId: { in: targetOrgIds } },
        },
        include: {
          records: {
            select: { status: true },
          },
        },
        orderBy: { openedAt: 'desc' },
        take: 30, // Ambil 30 sesi terbaru untuk perhitungan rata-rata terkini
      }),
      prisma.schedule.count({
        where: {
          scheduleType: 'PRIVATE_REMEDIAL',
          approvalStatus: 'PENDING',
          organizationId: { in: targetOrgIds },
        },
      }),
    ]);

    let totalAttendanceRecords = 0;
    let hadirRecords = 0;

    for (const session of attendanceSessions) {
      totalAttendanceRecords += session.records.length;
      hadirRecords += session.records.filter(
        (r) => r.status === 'HADIR' || r.status === 'TERLAMBAT'
      ).length;
    }

    const rate =
      totalAttendanceRecords > 0
        ? Math.round((hadirRecords / totalAttendanceRecords) * 1000) / 10
        : 0;

    return {
      totalSantri: santriCount,
      attendanceRate: rate,
      pendingApprovals: pendingCount,
      orgScopeCount: targetOrgIds.length,
    };
  } catch (error) {
    console.error('Error in getPjTerritoryMetrics:', error);
    return defaultMetrics;
  }
}

/**
 * 5. Query Metrik Global Nyata untuk Admin Master
 */
export async function getAdminGlobalMetrics(): Promise<AdminGlobalMetrics> {
  try {
    const [totalWilayah, totalDewanGuru, totalSantri, pendingApprovals] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count({
        where: {
          status: 'ACTIVE',
          roles: {
            some: {
              role: { in: ['PENGAJAR', 'WALI_KELAS'] },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          status: 'ACTIVE',
          roles: {
            some: { role: 'SANTRI' },
          },
        },
      }),
      prisma.schedule.count({
        where: {
          scheduleType: 'PRIVATE_REMEDIAL',
          approvalStatus: 'PENDING',
        },
      }),
      prisma.$queryRaw`SELECT 1`,
    ]);

    return {
      totalWilayah,
      totalDewanGuru,
      totalSantri,
      pendingApprovals,
      dbHealth: 'Normal',
    };
  } catch (error) {
    console.error('Error in getAdminGlobalMetrics:', error);
    return {
      totalWilayah: 0,
      totalDewanGuru: 0,
      totalSantri: 0,
      pendingApprovals: 0,
      dbHealth: 'Gangguan',
    };
  }
}

/**
 * 6. Ringkasan Notifikasi Header Berbasis Data Nyata (Ringan & Ter-cache)
 */
async function getHeaderNotificationsSummary({
  userId,
  roleCodes,
  organizationId,
  parentOrgId,
  generationId,
}: {
  userId: string;
  roleCodes: string[];
  organizationId?: string | null;
  parentOrgId?: string | null;
  generationId?: string | null;
}): Promise<HeaderNotificationItem[]> {
  try {
    const isAdmin = roleCodes.includes('ADMIN_MASTER');
    const isPj =
      roleCodes.includes('PJ_KELOMPOK') ||
      roleCodes.includes('PJ_DESA') ||
      roleCodes.includes('PJ_DAERAH');
    const isTeacher = roleCodes.includes('PENGAJAR') || roleCodes.includes('WALI_KELAS');
    const isSantri = roleCodes.includes('SANTRI');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
    const next24Hours = new Date(now.getTime() + 24 * 3600 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const orgHierarchy = [organizationId, parentOrgId].filter(Boolean) as string[];
    const scopedOrgIds =
      isPj && organizationId
        ? await getScopedOrganizationIds(roleCodes as UserRole[], organizationId)
        : null;

    const upcomingOrgIds =
      scopedOrgIds && scopedOrgIds.length > 0 ? scopedOrgIds : orgHierarchy;

    const [upcomingToday, pendingApprovalsCount, pendingGradingsCount, pendingStudentTasksCount] =
      await Promise.all([
        isAdmin || upcomingOrgIds.length > 0 || isTeacher
          ? prisma.schedule.findFirst({
              where: {
                status: { in: ['SCHEDULED', 'ACTIVE'] },
                OR: [{ approvalStatus: null }, { approvalStatus: 'APPROVED' }],
                startTime: { gte: oneHourAgo, lte: next24Hours },
                ...(isAdmin
                  ? {}
                  : {
                      OR: [
                        ...(upcomingOrgIds.length > 0
                          ? [{ organizationId: { in: upcomingOrgIds } }]
                          : []),
                        ...(isTeacher ? [{ teachers: { some: { teacherId: userId } } }] : []),
                      ],
                    }),
              },
              orderBy: { startTime: 'asc' },
              select: {
                id: true,
                title: true,
                startTime: true,
                venuePlaceName: true,
              },
            })
          : Promise.resolve(null),
        isAdmin || isPj
          ? prisma.schedule.count({
              where: {
                scheduleType: 'PRIVATE_REMEDIAL',
                approvalStatus: 'PENDING',
                ...(!isAdmin && scopedOrgIds && scopedOrgIds.length > 0
                  ? { organizationId: { in: scopedOrgIds } }
                  : {}),
              },
            })
          : Promise.resolve(0),
        isTeacher
          ? prisma.assignmentSubmission.count({
              where: {
                status: { in: ['SUBMITTED', 'VERIFIED_BY_PARENT'] },
                assignment: { teacherId: userId },
              },
            })
          : Promise.resolve(0),
        isSantri && generationId && orgHierarchy.length > 0
          ? prisma.assignment.count({
              where: {
                dueDate: { gte: now, lte: next7Days },
                class: {
                  generationId,
                  organizationId: { in: orgHierarchy },
                },
                submissions: {
                  none: { studentId: userId },
                },
              },
            })
          : Promise.resolve(0),
      ]);

    const items: HeaderNotificationItem[] = [];

    if (upcomingToday) {
      items.push({
        id: `schedule-${upcomingToday.id}`,
        title: `Jadwal Terdekat: ${upcomingToday.title}`,
        message: `${formatWibDate(upcomingToday.startTime, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })} • ${formatWibTime(upcomingToday.startTime)} WIB${
          upcomingToday.venuePlaceName ? ` di ${upcomingToday.venuePlaceName}` : ''
        }`,
        time: `${formatWibTime(upcomingToday.startTime)} WIB`,
        href: '/jadwal',
        unread: true,
      });
    }

    if (pendingApprovalsCount > 0) {
      items.push({
        id: `approvals-${pendingApprovalsCount}`,
        title: 'Antrean Approval Pengajian',
        message: `Ada ${pendingApprovalsCount} pengajuan sesi Private/Remedial menunggu verifikasi Anda.`,
        time: 'Menunggu',
        href: '/private-remedial',
        unread: true,
      });
    }

    if (pendingGradingsCount > 0) {
      items.push({
        id: `gradings-${pendingGradingsCount}`,
        title: 'Koreksi Tugas Santri',
        message: `${pendingGradingsCount} kiriman tugas santri menunggu penilaian Anda.`,
        time: 'Perlu Nilai',
        href: '/tugas?role=teacher',
        unread: true,
      });
    }

    if (pendingStudentTasksCount > 0) {
      items.push({
        id: `tasks-${pendingStudentTasksCount}`,
        title: 'Tugas Mendekati Batas Waktu',
        message: `Anda memiliki ${pendingStudentTasksCount} tugas pekan ini yang belum dikumpulkan.`,
        time: 'Pekan Ini',
        href: '/tugas?role=student',
        unread: true,
      });
    }

    return items;
  } catch (error) {
    console.error('Error in getHeaderNotificationsSummary:', error);
    return [];
  }
}

export function getCachedHeaderNotifications(
  args: Parameters<typeof getHeaderNotificationsSummary>[0]
) {
  const roleKeyPart = [...args.roleCodes].sort().join(',');
  return unstable_cache(
    (params: Parameters<typeof getHeaderNotificationsSummary>[0]) =>
      getHeaderNotificationsSummary(params),
    ['header:notifications', args.userId, roleKeyPart],
    {
      revalidate: 120,
      tags: [CACHE_TAGS.UPCOMING_SCHEDULE, CACHE_TAGS.upcomingScheduleUser(args.userId)],
    }
  )(args);
}
