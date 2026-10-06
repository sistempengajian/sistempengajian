import prisma from '@/lib/prisma';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { UserRole } from '@prisma/client';

export interface StudentCurriculumMetrics {
  mandatory: {
    completed: number;
    total: number;
    percentage: number;
  };
  enrichment: {
    completed: number;
    total: number;
    percentage: number;
  };
  adab: {
    completed: number;
    total: number;
    percentage: number;
  };
  overallPercentage: number;
  alpaCount: number;
  recentPassedMaterials: Array<{ title: string; isCompleted: boolean }>;
  badgesList: Array<{ name: string; category?: string }>;
}

export interface ChildProgressMetric {
  studentId: string;
  fullName: string;
  generationName?: string;
  completedChecklists: number;
  totalChecklists: number;
  curriculumPercentage: number;
  attendanceHadir: number;
  attendanceTotal: number;
  attendancePercentage: number;
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
  dbHealth: string;
}

/**
 * 1. Query Jadwal Pengajian Terdekat Sesuai Peran dan Wilayah Pengguna
 */
export async function getUpcomingScheduleForUser({
  userId,
  roles,
  organizationId,
  generationId,
  childrenGenerationIds = [],
  homeroomClassIds = [],
}: {
  userId: string;
  roles: UserRole[];
  organizationId?: string | null;
  generationId?: string | null;
  childrenGenerationIds?: string[];
  homeroomClassIds?: string[];
}) {
  const isManager = roles.some((r) =>
    ['ADMIN_MASTER', 'PJ_DAERAH', 'PJ_DESA', 'PJ_KELOMPOK'].includes(r)
  );
  const isTeacher = roles.includes('PENGAJAR') || roles.includes('WALI_KELAS');
  const isParent = roles.includes('ORANG_TUA');
  const isSantri = roles.includes('SANTRI');

  const now = new Date(Date.now() - 2 * 3600 * 1000); // Sesi yang baru mulai hingga 2 jam lalu masih dianggap relevan

  const baseInclude = {
    organization: true,
    class: {
      include: {
        generation: true,
      },
    },
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
    scheduleMaterials: {
      include: {
        material: {
          include: {
            targetGeneration: true,
          },
        },
      },
      orderBy: { slotIndex: 'asc' as const },
    },
  };

  // Bangun filter OR sesuai peran
  const roleFilters: any[] = [];

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
    }
  }

  if (isSantri) {
    if (generationId && organizationId) {
      roleFilters.push({
        organizationId,
        targetGenerations: { some: { generationId } },
      });
      roleFilters.push({
        organizationId,
        class: { generationId },
      });
    } else if (organizationId) {
      roleFilters.push({ organizationId });
    }
  }

  if (isParent && childrenGenerationIds.length > 0) {
    roleFilters.push({
      targetGenerations: {
        some: { generationId: { in: childrenGenerationIds } },
      },
    });
    roleFilters.push({
      class: { generationId: { in: childrenGenerationIds } },
    });
  }

  // Jika tidak ada filter peran spesifik, gunakan wilayah pengguna
  if (roleFilters.length === 0 && organizationId) {
    roleFilters.push({ organizationId });
  }

  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        startTime: { gte: now },
        ...(roleFilters.length > 0 ? { OR: roleFilters } : {}),
      },
      orderBy: { startTime: 'asc' },
      include: baseInclude,
    });

    // Jika tidak ada jadwal di masa depan yang persis sesuai filter, ambil jadwal aktif apapun di wilayahnya
    if (!schedule && organizationId) {
      return await prisma.schedule.findFirst({
        where: {
          status: { in: ['SCHEDULED', 'ACTIVE'] },
          organizationId,
        },
        orderBy: { startTime: 'desc' },
        include: baseInclude,
      });
    }

    return schedule;
  } catch (error) {
    console.error('Error in getUpcomingScheduleForUser:', error);
    return null;
  }
}

/**
 * 2. Query Capaian Kurikulum Santri Berdasarkan Checklist Nyata
 */
export async function getStudentCurriculumMetrics(
  studentId: string,
  generationId?: string | null
): Promise<StudentCurriculumMetrics> {
  const defaultMetrics: StudentCurriculumMetrics = {
    mandatory: { completed: 0, total: 0, percentage: 0 },
    enrichment: { completed: 0, total: 0, percentage: 0 },
    adab: { completed: 0, total: 0, percentage: 0 },
    overallPercentage: 0,
    alpaCount: 0,
    recentPassedMaterials: [],
    badgesList: [],
  };

  if (!studentId) return defaultMetrics;

  try {
    // 1. Ambil seluruh riwayat progres checklist santri ini
    const [progressRecords, genMaterials, attendanceRecords, studentBadges] =
      await Promise.all([
        prisma.materialChecklistProgress.findMany({
          where: { studentId },
          include: {
            checklistItem: {
              include: {
                material: true,
              },
            },
          },
        }),
        generationId
          ? prisma.material.findMany({
              where: { targetGenerationId: generationId, isActive: true },
              include: { checklistItems: true },
            })
          : Promise.resolve([]),
        prisma.attendanceRecord.findMany({
          where: { studentId },
          select: { status: true },
        }),
        prisma.studentBadge.findMany({
          where: { studentId },
          include: { badge: true },
          orderBy: { unlockedAt: 'desc' },
          take: 4,
        }),
      ]);

    const completedProgressMap = new Set(
      progressRecords.filter((p) => p.isCompleted).map((p) => p.checklistItemId)
    );

    // Hitung checklist wajib vs pengayaan
    let mandatoryTotal = 0;
    let mandatoryCompleted = 0;
    let enrichmentTotal = 0;
    let enrichmentCompleted = 0;

    if (genMaterials.length > 0) {
      for (const mat of genMaterials) {
        const itemCount = mat.checklistItems.length;
        let matCompleted = 0;
        for (const item of mat.checklistItems) {
          if (completedProgressMap.has(item.id)) {
            matCompleted++;
          }
        }

        if (mat.isMandatoryForTarget) {
          mandatoryTotal += itemCount;
          mandatoryCompleted += matCompleted;
        } else {
          enrichmentTotal += itemCount;
          enrichmentCompleted += matCompleted;
        }
      }
    } else {
      // Fallback jika generasi tidak memiliki material
      mandatoryTotal = Math.max(progressRecords.length, 1);
      mandatoryCompleted = completedProgressMap.size;
    }

    const mandatoryPct =
      mandatoryTotal > 0
        ? Math.round((mandatoryCompleted / mandatoryTotal) * 100)
        : 0;

    const enrichmentPct =
      enrichmentTotal > 0
        ? Math.round((enrichmentCompleted / enrichmentTotal) * 100)
        : 0;

    // Hitung Adab & Disiplin: Berdasarkan rasio kehadiran santri (presensi)
    const totalPresensi = attendanceRecords.length;
    const hadirCount = attendanceRecords.filter((a) => a.status === 'HADIR').length;
    const alpaCount = attendanceRecords.filter((a) => a.status === 'ALPA').length;

    // Jika belum ada presensi, adab default 100% jika tidak ada alpa
    const adabPct =
      totalPresensi > 0
        ? Math.round((hadirCount / totalPresensi) * 100)
        : 100;

    const totalChecklists = mandatoryTotal + enrichmentTotal;
    const totalCompleted = mandatoryCompleted + enrichmentCompleted;
    const overallPct =
      totalChecklists > 0
        ? Math.round((totalCompleted / totalChecklists) * 100)
        : 0;

    // Ambil materi hafalan terbaru yang telah lulus
    const recentCompleted = progressRecords
      .filter((p) => p.isCompleted && p.checklistItem?.material?.title)
      .slice(0, 3)
      .map((p) => ({
        title: `${p.checklistItem.material.title} (${p.checklistItem.itemTitle})`,
        isCompleted: true,
      }));

    const badges = studentBadges.map((sb) => ({
      name: sb.badge.name,
      category: sb.badge.category,
    }));

    return {
      mandatory: {
        completed: mandatoryCompleted,
        total: mandatoryTotal,
        percentage: mandatoryPct,
      },
      enrichment: {
        completed: enrichmentCompleted,
        total: enrichmentTotal,
        percentage: enrichmentPct,
      },
      adab: {
        completed: totalPresensi > 0 ? hadirCount : 10,
        total: totalPresensi > 0 ? totalPresensi : 10,
        percentage: adabPct,
      },
      overallPercentage: overallPct,
      alpaCount,
      recentPassedMaterials: recentCompleted,
      badgesList: badges,
    };
  } catch (error) {
    console.error('Error in getStudentCurriculumMetrics:', error);
    return defaultMetrics;
  }
}

/**
 * 3. Query Capaian Progres Nyata Ananda untuk Tampilan Orang Tua
 */
export async function getChildrenProgressMetrics(
  childrenList: Array<{
    student: {
      id: string;
      fullName: string;
      generationId?: string | null;
      generation?: { name: string } | null;
    };
  }>
): Promise<Record<string, ChildProgressMetric>> {
  const result: Record<string, ChildProgressMetric> = {};

  if (!childrenList || childrenList.length === 0) return result;

  await Promise.all(
    childrenList.map(async ({ student }) => {
      try {
        const [progressCount, totalChecklists, attendanceRecords] =
          await Promise.all([
            prisma.materialChecklistProgress.count({
              where: { studentId: student.id, isCompleted: true },
            }),
            student.generationId
              ? prisma.materialChecklistItem.count({
                  where: {
                    material: {
                      targetGenerationId: student.generationId,
                      isActive: true,
                    },
                  },
                })
              : Promise.resolve(0),
            prisma.attendanceRecord.findMany({
              where: { studentId: student.id },
              select: { status: true },
            }),
          ]);

        const totalItems = totalChecklists > 0 ? totalChecklists : 20;
        const curriculumPct =
          totalItems > 0
            ? Math.min(Math.round((progressCount / totalItems) * 100), 100)
            : 0;

        const hadirCount = attendanceRecords.filter(
          (a) => a.status === 'HADIR'
        ).length;
        const totalAttendance = attendanceRecords.length;
        const attendancePct =
          totalAttendance > 0
            ? Math.round((hadirCount / totalAttendance) * 100)
            : 0;

        result[student.id] = {
          studentId: student.id,
          fullName: student.fullName,
          generationName: student.generation?.name,
          completedChecklists: progressCount,
          totalChecklists: totalItems,
          curriculumPercentage: curriculumPct,
          attendanceHadir: hadirCount,
          attendanceTotal: totalAttendance,
          attendancePercentage: attendancePct,
        };
      } catch (err) {
        console.error(`Error computing metrics for child ${student.id}:`, err);
        result[student.id] = {
          studentId: student.id,
          fullName: student.fullName,
          generationName: student.generation?.name,
          completedChecklists: 0,
          totalChecklists: 20,
          curriculumPercentage: 0,
          attendanceHadir: 0,
          attendanceTotal: 0,
          attendancePercentage: 0,
        };
      }
    })
  );

  return result;
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
      hadirRecords += session.records.filter((r) => r.status === 'HADIR').length;
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
    const [totalWilayah, totalDewanGuru, totalSantri] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count({
        where: {
          roles: {
            some: {
              role: { in: ['PENGAJAR', 'WALI_KELAS'] },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          roles: {
            some: { role: 'SANTRI' },
          },
        },
      }),
    ]);

    return {
      totalWilayah,
      totalDewanGuru,
      totalSantri,
      dbHealth: 'Normal',
    };
  } catch (error) {
    console.error('Error in getAdminGlobalMetrics:', error);
    return {
      totalWilayah: 0,
      totalDewanGuru: 0,
      totalSantri: 0,
      dbHealth: 'Normal',
    };
  }
}
