import prisma from '@/lib/prisma';
import { getEffectiveAuthUser } from '@/lib/auth';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { formatWibTime, formatWibDate, getWibTodayRange } from '@/lib/utils';
import { generateSessionSecret, generateQrPayload, TOTP_STEP_SECONDS } from '@/lib/totp';
import { resolveMaterialsForSchedule } from '@/lib/curriculumVersionResolver';
import { getParentAbsenceHistory } from '@/app/(protected)/presensi/actions';
import { AttendanceStatus, AttendanceMethod, ApprovalStatus, UserRole } from '@prisma/client';
import type { RoleTabItem } from '@/components/navigation/RoleNavTabs';
import type {
  ChildAttendanceSummary,
  ChildScheduleInfo,
} from '@/components/presensi/ParentAttendanceMonitor';

export type PresensiUserProfile = NonNullable<
  Awaited<ReturnType<typeof getEffectiveAuthUser>>['dbUser']
>;

export const ATTENDANCE_RECORD_INCLUDE = {
  absenceConfirmation: {
    include: {
      parent: {
        select: { fullName: true },
      },
    },
  },
} as const;

export const PRESENSI_SCHEDULE_INCLUDE = {
  organization: {
    include: {
      parent: true,
    },
  },
  class: {
    include: {
      generation: true,
      organization: true,
    },
  },
  targetClasses: {
    include: {
      class: {
        include: {
          generation: true,
          organization: true,
        },
      },
    },
  },
  targetGenerations: {
    include: {
      generation: true,
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
    orderBy: {
      slotIndex: 'asc' as const,
    },
  },
  teachers: {
    include: {
      teacher: true,
    },
  },
  attendanceSessions: {
    take: 1,
    orderBy: {
      createdAt: 'desc' as const,
    },
    include: {
      records: {
        include: ATTENDANCE_RECORD_INCLUDE,
      },
    },
  },
} as const;

export async function loadDirectSchedule(requestedScheduleId?: string) {
  if (!requestedScheduleId) return null;
  return prisma.schedule.findUnique({
    where: { id: requestedScheduleId },
    include: PRESENSI_SCHEDULE_INCLUDE,
  });
}

export function isUserAssignedTeacher(schedule: any, userId: string): boolean {
  if (!schedule) return false;
  const isTeacher = schedule.teachers.some((t: any) => t.teacherId === userId);
  const isHomeroom =
    schedule.class?.homeroomTeacherId === userId ||
    schedule.targetClasses?.some((tc: any) => tc.class?.homeroomTeacherId === userId);
  return isTeacher || Boolean(isHomeroom);
}

export function buildAvailablePresensiRoles(params: {
  roleCodes: string[];
  isPjOrAdmin: boolean;
  isPengajar: boolean;
  isOrangTua: boolean;
  isSantri: boolean;
  requestedScheduleId?: string;
}): RoleTabItem[] {
  const { roleCodes, isPjOrAdmin, isPengajar, isOrangTua, isSantri, requestedScheduleId } =
    params;
  const scheduleQueryParam = requestedScheduleId
    ? `&scheduleId=${encodeURIComponent(requestedScheduleId)}`
    : '';

  const roles: RoleTabItem[] = [];
  if (isPjOrAdmin && !requestedScheduleId) {
    roles.push({
      id: 'manage',
      label: 'Kendali Wilayah',
      roleTitle: 'PJ Wilayah',
      badge: roleCodes.includes('ADMIN_MASTER') ? 'Admin' : 'PJ',
      subtitle: 'Pantau sesi pengajian & buka cockpit presensi wilayah',
      iconName: 'ShieldCheck',
      colorTheme: 'sky',
      href: `/presensi?role=manage${scheduleQueryParam}`,
    });
  }
  if (isPengajar) {
    roles.push({
      id: 'teacher',
      label: 'Mode Pengajar',
      roleTitle: 'Pengajar / Wali',
      badge: 'Guru',
      subtitle: 'Buka QR dinamis & kelola presensi kelas binaan',
      iconName: 'School',
      colorTheme: 'teal',
      href: `/presensi?role=teacher${scheduleQueryParam}`,
    });
  }
  if (isOrangTua) {
    roles.push({
      id: 'parent',
      label: 'Portal Orang Tua',
      roleTitle: 'Wali Santri',
      badge: 'Wali',
      subtitle: 'Pantau kehadiran & ajukan surat izin ananda',
      iconName: 'Heart',
      colorTheme: 'indigo',
      href: `/presensi?role=parent${scheduleQueryParam}`,
    });
  }
  if (isSantri) {
    roles.push({
      id: 'student',
      label: 'Presensi Santri',
      roleTitle: 'Santri',
      badge: 'Santri',
      subtitle: 'Scan QR sesi kelas & kartu identitas santri',
      iconName: 'GraduationCap',
      colorTheme: 'emerald',
      href: `/presensi?role=student${scheduleQueryParam}`,
    });
  }
  return roles;
}

export function resolveCockpitTab(tabParam?: string) {
  const normalized = (tabParam || '').toUpperCase();
  if (normalized === 'EVALUATION' || normalized === 'JURNAL' || normalized === 'NILAI') {
    return 'EVALUATION' as const;
  }
  if (normalized === 'MANUAL_SHEET' || normalized === 'MANUAL') {
    return 'MANUAL_SHEET' as const;
  }
  if (normalized === 'BATCH_SCAN' || normalized === 'KARTU') {
    return 'BATCH_SCAN' as const;
  }
  return 'DYNAMIC_QR' as const;
}

export function resolveSantriTab(tabParam?: string): 'SCAN_SESSION' | 'MY_QR_CARD' {
  if (tabParam === 'card' || tabParam === 'kartu' || tabParam === 'MY_QR_CARD') {
    return 'MY_QR_CARD';
  }
  return 'SCAN_SESSION';
}

export async function loadTeacherCockpitData(params: {
  userProfile: PresensiUserProfile;
  directSchedule: Awaited<ReturnType<typeof loadDirectSchedule>>;
  roleCodes: string[];
  isPengajar: boolean;
  isPjOrAdmin: boolean;
}) {
  const { userProfile, directSchedule, roleCodes, isPengajar, isPjOrAdmin } = params;

  let activeSchedule = directSchedule;

  if (!activeSchedule && (isPengajar || isPjOrAdmin)) {
    const { startOfToday, endOfToday } = getWibTodayRange();

    const teacherCondition = !isPjOrAdmin
      ? { teachers: { some: { teacherId: userProfile.id } } }
      : {
          organizationId: {
            in: [userProfile.organizationId, userProfile.organization?.parentId].filter(
              Boolean
            ) as string[],
          },
        };

    // 1. Prioritaskan jadwal yang saat ini sedang ACTIVE untuk HARI INI
    activeSchedule = await prisma.schedule.findFirst({
      where: {
        status: 'ACTIVE',
        startTime: { gte: startOfToday, lte: endOfToday },
        ...teacherCondition,
      },
      orderBy: { startTime: 'asc' },
      include: PRESENSI_SCHEDULE_INCLUDE,
    });

    // 2. Jika tidak ada yang ACTIVE hari ini, cari jadwal HARI INI yang berstatus SCHEDULED
    if (!activeSchedule) {
      activeSchedule = await prisma.schedule.findFirst({
        where: {
          status: 'SCHEDULED',
          startTime: { gte: startOfToday, lte: endOfToday },
          ...teacherCondition,
        },
        orderBy: { startTime: 'asc' },
        include: PRESENSI_SCHEDULE_INCLUDE,
      });
    }

    // 3. Fallback jika tidak ada jadwal hari ini: ambil jadwal ACTIVE paling baru
    if (!activeSchedule) {
      activeSchedule = await prisma.schedule.findFirst({
        where: {
          status: 'ACTIVE',
          ...teacherCondition,
        },
        orderBy: { startTime: 'desc' },
        include: PRESENSI_SCHEDULE_INCLUDE,
      });
    }
  }

  if (!activeSchedule) {
    return { activeSchedule: null as null };
  }

  const isScheduleCompleted = activeSchedule.status === 'COMPLETED';

  // Ambil sesi presensi yang ada (utamakan eager load di relasi scheduleInclude)
  let session: any = (activeSchedule as any).attendanceSessions?.[0] || null;

  if (!session) {
    session = await prisma.attendanceSession.findFirst({
      where: { scheduleId: activeSchedule.id },
      orderBy: { createdAt: 'desc' },
      include: {
        records: { include: ATTENDANCE_RECORD_INCLUDE },
      },
    });
  }

  // HANYA buat sesi baru jika jadwal BELUM COMPLETED dan sesi memang belum pernah ada
  if (!session && !isScheduleCompleted) {
    const dynamicQrSecret = generateSessionSecret();
    session = await prisma.attendanceSession.create({
      data: {
        scheduleId: activeSchedule.id,
        dynamicQrSecret,
        isActive: true,
        qrRefreshSeconds: TOTP_STEP_SECONDS,
        openedAt: new Date(),
      },
      include: {
        records: { include: ATTENDANCE_RECORD_INCLUDE },
      },
    });

    await prisma.schedule.update({
      where: { id: activeSchedule.id },
      data: { status: 'ACTIVE' },
    });
  }

  // Jika jadwal sudah COMPLETED namun belum ada sesi di database
  if (!session) {
    const dynamicQrSecret = generateSessionSecret();
    session = await prisma.attendanceSession.create({
      data: {
        scheduleId: activeSchedule.id,
        dynamicQrSecret,
        isActive: false,
        openedAt: new Date(activeSchedule.startTime),
        closedAt: new Date(activeSchedule.endTime),
      },
      include: {
        records: { include: ATTENDANCE_RECORD_INCLUDE },
      },
    });
  }

  const isSessionActive = Boolean(session.isActive && !isScheduleCompleted);
  const initialQrPayload =
    isSessionActive && session.dynamicQrSecret
      ? generateQrPayload(session.id, session.dynamicQrSecret, session.qrRefreshSeconds)
      : null;

  // Kumpulkan daftar kelas target jadwal (kelas utama maupun multi-kelas gabungan)
  const targetClassesMap = new Map<
    string,
    { id: string; name: string; organizationId: string; generationId: string }
  >();

  if (activeSchedule.class) {
    targetClassesMap.set(activeSchedule.class.id, {
      id: activeSchedule.class.id,
      name: activeSchedule.class.name,
      organizationId: activeSchedule.class.organizationId,
      generationId: activeSchedule.class.generationId,
    });
  }

  if (activeSchedule.targetClasses && activeSchedule.targetClasses.length > 0) {
    for (const tc of activeSchedule.targetClasses) {
      if (tc.class) {
        targetClassesMap.set(tc.class.id, {
          id: tc.class.id,
          name: tc.class.name,
          organizationId: tc.class.organizationId,
          generationId: tc.class.generationId,
        });
      }
    }
  }

  const targetClassesList = Array.from(targetClassesMap.values());

  // Filter daftar santri aktif sesuai target jadwal
  const studentWhere: any = {
    status: 'ACTIVE',
    roles: {
      some: { role: 'SANTRI' },
    },
  };

  if (targetClassesList.length > 0) {
    studentWhere.OR = targetClassesList.map((c) => ({
      organizationId: c.organizationId,
      generationId: c.generationId,
    }));
  } else {
    const orgIds: string[] = [activeSchedule.organizationId];
    if (activeSchedule.tierLevel === 'DESA') {
      const subOrgs = await prisma.organization.findMany({
        where: { parentId: activeSchedule.organizationId },
        select: { id: true },
      });
      orgIds.push(...subOrgs.map((o) => o.id));
    } else if (activeSchedule.tierLevel === 'DAERAH') {
      const desaOrgs = await prisma.organization.findMany({
        where: { parentId: activeSchedule.organizationId },
        select: { id: true },
      });
      const desaIds = desaOrgs.map((o) => o.id);
      orgIds.push(...desaIds);
      if (desaIds.length > 0) {
        const kelompokOrgs = await prisma.organization.findMany({
          where: { parentId: { in: desaIds } },
          select: { id: true },
        });
        orgIds.push(...kelompokOrgs.map((o) => o.id));
      }
    }

    studentWhere.organizationId = { in: orgIds };

    if (activeSchedule.targetGenerations && activeSchedule.targetGenerations.length > 0) {
      studentWhere.generationId = {
        in: activeSchedule.targetGenerations.map((g) => g.generationId),
      };
    }
  }

  const classStudents = await prisma.user.findMany({
    where: studentWhere,
    select: {
      id: true,
      fullName: true,
      organizationId: true,
      generationId: true,
      generation: { select: { id: true, name: true, code: true } },
    },
    orderBy: { fullName: 'asc' },
  });

  const relevantGenerationIds = new Set<string>();
  if (activeSchedule.targetGenerations && activeSchedule.targetGenerations.length > 0) {
    activeSchedule.targetGenerations.forEach((g) =>
      relevantGenerationIds.add(g.generationId)
    );
  }
  targetClassesList.forEach((c) => {
    if (c.generationId) relevantGenerationIds.add(c.generationId);
  });
  classStudents.forEach((s) => {
    if (s.generationId) relevantGenerationIds.add(s.generationId);
  });

  const relevantOrgIds: string[] = [];
  if (activeSchedule.organizationId) {
    relevantOrgIds.push(activeSchedule.organizationId);
  }
  if (activeSchedule.organization?.parentId) {
    relevantOrgIds.push(activeSchedule.organization.parentId);
  }

  const sessionWibDate = new Date(
    activeSchedule.startTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  );
  const sessionYear = sessionWibDate.getFullYear();
  const sessionMonth = sessionWibDate.getMonth() + 1;

  const monthlyTargets = await prisma.materialMonthlyTarget.findMany({
    where: {
      ...(relevantGenerationIds.size > 0
        ? { generationId: { in: Array.from(relevantGenerationIds) } }
        : {}),
      year: sessionYear,
      month: sessionMonth,
      isActive: true,
      OR: [
        { organizationId: null },
        { tierLevel: 'DAERAH' },
        ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
      ],
    },
    select: {
      materialId: true,
      orderIndex: true,
      generationId: true,
    },
    orderBy: { orderIndex: 'asc' },
  });

  const monthlyTargetMaterialIds = monthlyTargets.map((t) => t.materialId);
  const monthlyTargetIdSet = new Set(monthlyTargetMaterialIds);
  const monthlyTargetOrderMap = new Map<string, number>();
  monthlyTargets.forEach((t) => monthlyTargetOrderMap.set(t.materialId, t.orderIndex));

  const scheduledMaterialIds = activeSchedule.scheduleMaterials.map((sm) => sm.materialId);
  const activeMaterialIds = Array.from(
    new Set([...monthlyTargetMaterialIds, ...scheduledMaterialIds])
  );
  const hasActiveCurriculum = activeMaterialIds.length > 0;

  let materialWhere: any;
  if (hasActiveCurriculum) {
    materialWhere = {
      isActive: true,
      id: { in: activeMaterialIds },
    };
  } else if (relevantGenerationIds.size > 0) {
    materialWhere = {
      isActive: true,
      targetGenerationId: { in: Array.from(relevantGenerationIds) },
      OR: [
        { organizationId: null },
        { creatorTierLevel: 'DAERAH' },
        ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
      ],
    };
  } else {
    materialWhere = {
      isActive: true,
      OR: [
        { organizationId: null },
        { creatorTierLevel: 'DAERAH' },
        ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
      ],
    };
  }

  const { startOfToday, endOfToday } = getWibTodayRange();

  const initialStudentGenId =
    classStudents[0]?.generationId || Array.from(relevantGenerationIds)[0] || null;

  const initialTargetMonthlyIds = initialStudentGenId
    ? monthlyTargets
        .filter((t) => t.generationId === initialStudentGenId)
        .map((t) => t.materialId)
    : monthlyTargets.map((t) => t.materialId);

  const initialScheduledGenIds = activeSchedule.scheduleMaterials
    .filter(
      (sm) =>
        !sm.material?.targetGenerationId ||
        (initialStudentGenId && sm.material.targetGenerationId === initialStudentGenId)
    )
    .map((sm) => sm.materialId);

  const initialCombinedSchedIds = Array.from(
    new Set([...initialScheduledGenIds, ...initialTargetMonthlyIds])
  );

  const initialAddIds = activeSchedule.scheduleMaterials
    .filter(
      (sm) => !sm.material?.targetGenerationId || !monthlyTargetIdSet.has(sm.materialId)
    )
    .map((sm) => sm.materialId);

  const [
    todaySchedules,
    allGenerations,
    totalMaterialsCount,
    generationMaterialsCount,
    rawMaterials,
  ] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        startTime: { gte: startOfToday, lte: endOfToday },
        ...(isPjOrAdmin
          ? userProfile.organizationId
            ? { organizationId: userProfile.organizationId }
            : {}
          : { teachers: { some: { teacherId: userProfile.id } } }),
      },
      orderBy: { startTime: 'asc' },
      include: {
        class: { select: { name: true } },
      },
    }),
    prisma.generation.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    }),
    prisma.material.count({
      where: {
        isActive: true,
        OR: [
          { organizationId: null },
          { creatorTierLevel: 'DAERAH' },
          ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
        ],
      },
    }),
    initialStudentGenId
      ? prisma.material.count({
          where: {
            isActive: true,
            targetGenerationId: initialStudentGenId,
            OR: [
              { organizationId: null },
              { creatorTierLevel: 'DAERAH' },
              ...(relevantOrgIds.length > 0
                ? [{ organizationId: { in: relevantOrgIds } }]
                : []),
            ],
          },
        })
      : Promise.resolve(0),
    prisma.material.findMany({
      where: materialWhere,
      include: {
        targetGeneration: {
          select: { id: true, name: true, code: true },
        },
        checklistItems: {
          where: {
            OR: [
              { organizationId: null },
              { tierLevel: 'DAERAH' },
              ...(relevantOrgIds.length > 0
                ? [{ organizationId: { in: relevantOrgIds } }]
                : []),
            ],
          },
          orderBy: { orderIndex: 'asc' },
        },
        customizations: {
          where:
            relevantOrgIds.length > 0
              ? { organizationId: { in: relevantOrgIds } }
              : undefined,
        },
        monthlyTargets: {
          select: { month: true, year: true, generationId: true },
        },
      },
      orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const initialScopeCounts = {
    ALL: totalMaterialsCount,
    GENERATION: generationMaterialsCount,
    MONTHLY: initialTargetMonthlyIds.length,
    SCHEDULED: initialCombinedSchedIds.length,
    ADDITIONAL: initialAddIds.length,
  };

  // Smart default absence
  if (session) {
    const existingStudentIdSet = new Set((session.records || []).map((r: any) => r.studentId));
    const missingStudents = classStudents.filter((s) => !existingStudentIdSet.has(s.id));

    if (missingStudents.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: missingStudents.map((s) => ({
          sessionId: session.id,
          studentId: s.id,
          method: AttendanceMethod.MANUAL_TEACHER,
          status: AttendanceStatus.ALPA,
          notes: 'Status awal presensi sesi (Belum hadir)',
        })),
        skipDuplicates: true,
      });

      const refreshedRecords = await prisma.attendanceRecord.findMany({
        where: { sessionId: session.id },
        include: ATTENDANCE_RECORD_INCLUDE,
      });
      session.records = refreshedRecords;
    }
  }

  const initialHasMore = hasActiveCurriculum
    ? false
    : totalMaterialsCount > rawMaterials.length;

  const relevantChecklistItemIds: string[] = [];
  rawMaterials.forEach((m) => {
    m.checklistItems.forEach((ci) => relevantChecklistItemIds.push(ci.id));
  });

  const studentIds = classStudents.map((s) => s.id);
  const existingChecklistProgress =
    studentIds.length > 0 && relevantChecklistItemIds.length > 0
      ? await prisma.materialChecklistProgress.findMany({
          where: {
            studentId: { in: studentIds },
            checklistItemId: { in: relevantChecklistItemIds },
          },
          select: {
            checklistItemId: true,
            studentId: true,
            score: true,
            isCompleted: true,
            teacherFeedback: true,
            evaluatedAt: true,
          },
        })
      : [];

  const existingSessionEvals = await prisma.studentEvaluation.findMany({
    where: { scheduleId: activeSchedule.id },
    select: { studentId: true },
  });
  const initialEvaluatedStudentIds = Array.from(
    new Set(existingSessionEvals.map((e) => e.studentId))
  );

  const baseResolvedMaterials = resolveMaterialsForSchedule(rawMaterials, {
    scheduleTierLevel: activeSchedule.tierLevel,
    scheduleOrganizationId: activeSchedule.organizationId,
    parentOrganizationId: activeSchedule.organization?.parentId || null,
    scheduleOrganizationName: activeSchedule.organization?.name || '',
    parentOrganizationName: activeSchedule.organization?.parent?.name || '',
  });

  const scheduleMaterialMap = new Map<string, number>();
  activeSchedule.scheduleMaterials.forEach((sm) => {
    scheduleMaterialMap.set(sm.materialId, sm.slotIndex);
  });

  const resolvedMaterials = baseResolvedMaterials
    .map((m) => {
      const isMonthlyTarget = monthlyTargetIdSet.has(m.id);
      const isScheduled = scheduleMaterialMap.has(m.id) || isMonthlyTarget;
      const slotIndex = scheduleMaterialMap.get(m.id);
      return {
        ...m,
        isScheduled,
        isMonthlyTarget,
        slotIndex: isScheduled ? slotIndex : undefined,
        monthlyTargets: (m as any).monthlyTargets || [],
      };
    })
    .sort((a, b) => {
      const aMonthlyOrder = monthlyTargetOrderMap.has(a.id)
        ? monthlyTargetOrderMap.get(a.id)!
        : 999;
      const bMonthlyOrder = monthlyTargetOrderMap.has(b.id)
        ? monthlyTargetOrderMap.get(b.id)!
        : 999;
      if (aMonthlyOrder !== bMonthlyOrder) return aMonthlyOrder - bMonthlyOrder;

      if (a.isScheduled && !b.isScheduled) return -1;
      if (!a.isScheduled && b.isScheduled) return 1;
      if (a.isScheduled && b.isScheduled) {
        return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
      }
      return 0;
    });

  const canCompleteDaerah =
    roleCodes.includes('PJ_DAERAH') || roleCodes.includes('ADMIN_MASTER');
  const canCompleteDesa = roleCodes.includes('PJ_DESA') || canCompleteDaerah;

  const availableSchedulesProp = todaySchedules.map((s) => ({
    id: s.id,
    title: s.title,
    startTime: formatWibTime(s.startTime),
    endTime: formatWibTime(s.endTime),
    className: s.class?.name,
    venueName: s.venuePlaceName || undefined,
    tierLevel: s.tierLevel,
  }));

  if (activeSchedule && !availableSchedulesProp.some((s) => s.id === activeSchedule.id)) {
    availableSchedulesProp.unshift({
      id: activeSchedule.id,
      title: activeSchedule.title,
      startTime: formatWibTime(activeSchedule.startTime),
      endTime: formatWibTime(activeSchedule.endTime),
      className: activeSchedule.class?.name,
      venueName: activeSchedule.venuePlaceName || undefined,
      tierLevel: activeSchedule.tierLevel,
    });
  }

  const scheduleDate = formatWibDate(activeSchedule.startTime);

  const previousSessionSchedule = await prisma.schedule.findFirst({
    where: {
      id: { not: activeSchedule.id },
      startTime: { lt: activeSchedule.startTime },
      teachingSummaryNotes: { not: null },
      OR: [
        ...(activeSchedule.classId ? [{ classId: activeSchedule.classId }] : []),
        ...(relevantGenerationIds.size > 0
          ? [
              {
                targetGenerations: {
                  some: { generationId: { in: Array.from(relevantGenerationIds) } },
                },
              },
            ]
          : []),
        ...(activeSchedule.organizationId
          ? [{ organizationId: activeSchedule.organizationId }]
          : []),
      ],
    },
    orderBy: { startTime: 'desc' },
    select: {
      id: true,
      title: true,
      startTime: true,
      teachingSummaryNotes: true,
    },
  });

  const teachersList = activeSchedule.teachers.map((t) => ({
    id: t.teacherId,
    name: t.teacher.fullName,
    isPrimary: t.isPrimary,
    isSubstitute: t.isSubstitute,
  }));

  if (teachersList.length === 0 && userProfile) {
    teachersList.push({
      id: userProfile.id,
      name: userProfile.fullName,
      isPrimary: true,
      isSubstitute: false,
    });
  }

  const currentScheduleTeacher = activeSchedule.teachers.find(
    (t) => t.teacherId === userProfile.id
  );
  const primaryScheduleTeacher =
    activeSchedule.teachers.find((t) => t.isPrimary) || activeSchedule.teachers[0];
  const teacherInfo = currentScheduleTeacher
    ? {
        name: currentScheduleTeacher.teacher.fullName,
        isSubstitute: currentScheduleTeacher.isSubstitute,
      }
    : primaryScheduleTeacher
    ? {
        name: primaryScheduleTeacher.teacher.fullName,
        isSubstitute: primaryScheduleTeacher.isSubstitute,
      }
    : userProfile
    ? {
        name: userProfile.fullName,
        isSubstitute: false,
      }
    : undefined;

  const studentAbsenceRequests = await prisma.studentAbsenceRequest.findMany({
    where: {
      scheduleId: activeSchedule.id,
    },
    include: {
      approvals: {
        include: {
          approverUser: { select: { fullName: true } },
        },
      },
    },
  });

  const studentItems = classStudents.map((s) => {
    const record = session?.records.find((r: any) => r.studentId === s.id);
    const matchedClass = targetClassesList.find(
      (c) => c.organizationId === s.organizationId && c.generationId === s.generationId
    );
    const matchedAbsence = studentAbsenceRequests.find((ar) => ar.studentId === s.id);

    return {
      id: s.id,
      fullName: s.fullName,
      generationId: s.generationId || undefined,
      generationName: s.generation?.name || 'Santri',
      classId: matchedClass?.id,
      className: matchedClass?.name,
      currentStatus: record ? record.status : AttendanceStatus.ALPA,
      method: record?.method,
      notes: record?.notes,
      checkInTime: record?.checkInTime ? formatWibTime(record.checkInTime) : null,
      absenceConfirmation: record?.absenceConfirmation
        ? {
            id: record.absenceConfirmation.id,
            status: record.absenceConfirmation.status,
            reasonType: record.absenceConfirmation.reasonType,
            parentNotes: record.absenceConfirmation.parentNotes,
            attachmentUrl: record.absenceConfirmation.attachmentUrl,
            parentName: record.absenceConfirmation.parent?.fullName || null,
            confirmedAt: record.absenceConfirmation.confirmedAt
              ? record.absenceConfirmation.confirmedAt.toISOString()
              : null,
          }
        : null,
      studentAbsenceRequest: matchedAbsence
        ? {
            id: matchedAbsence.id,
            absenceType: matchedAbsence.absenceType,
            notes: matchedAbsence.notes,
            attachmentUrl: matchedAbsence.attachmentUrl,
            approvedCount: matchedAbsence.approvedCount,
            status: matchedAbsence.status,
            approverNames: matchedAbsence.approvals
              .filter((a) => a.action === 'APPROVED')
              .map(
                (a) =>
                  `${a.approverUser.fullName} (${
                    a.approverRole === 'PARENT'
                      ? 'Ortu'
                      : a.approverRole === 'HOMEROOM_TEACHER'
                      ? 'Wali Kelas'
                      : 'PJ'
                  })`
              )
              .join(', '),
          }
        : null,
    };
  });

  const classesProp = targetClassesList.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return {
    activeSchedule,
    session,
    isSessionActive,
    initialQrPayload,
    studentItems,
    resolvedMaterials,
    totalMaterialsCount,
    initialHasMore,
    allGenerations,
    initialProgress: existingChecklistProgress.map((p) => ({
      checklistItemId: p.checklistItemId,
      studentId: p.studentId,
      score: p.score,
      isCompleted: p.isCompleted,
      teacherFeedback: p.teacherFeedback,
      evaluatedAt: p.evaluatedAt.toISOString(),
    })),
    initialEvaluatedStudentIds,
    canCompleteDaerah,
    canCompleteDesa,
    availableSchedulesProp,
    classesProp,
    teacherInfo,
    teachersList,
    scheduleDate,
    previousSessionNotes: previousSessionSchedule?.teachingSummaryNotes
      ? {
          scheduleTitle: previousSessionSchedule.title,
          date: formatWibDate(previousSessionSchedule.startTime),
          notes: previousSessionSchedule.teachingSummaryNotes,
        }
      : null,
    sessionMonth,
    sessionYear,
    initialScopeCounts,
  };
}

export async function loadStudentScannerData(params: {
  userProfile: PresensiUserProfile;
  requestedScheduleId?: string;
}) {
  const { userProfile, requestedScheduleId } = params;

  const userOrgIds = [
    userProfile.organizationId,
    userProfile.organization?.parentId,
  ].filter(Boolean) as string[];

  const sessionInclude = {
    attendanceSessions: {
      take: 1,
      orderBy: { createdAt: 'desc' as const },
      include: {
        records: {
          where: { studentId: userProfile.id },
        },
      },
    },
  };

  let activeSchedule: any = null;

  if (requestedScheduleId) {
    const candidateSchedule = await prisma.schedule.findUnique({
      where: { id: requestedScheduleId },
      include: {
        ...sessionInclude,
        class: true,
        targetClasses: { include: { class: true } },
        targetGenerations: true,
      },
    });

    if (candidateSchedule) {
      const isOrgEligible = userOrgIds.includes(candidateSchedule.organizationId);
      const matchesClass =
        candidateSchedule.class?.generationId === userProfile.generationId ||
        candidateSchedule.targetClasses?.some(
          (tc: any) => tc.class?.generationId === userProfile.generationId
        ) ||
        candidateSchedule.targetGenerations?.some(
          (tg: any) => tg.generationId === userProfile.generationId
        );

      if (isOrgEligible || matchesClass) {
        activeSchedule = candidateSchedule;
      }
    }
  }

  if (!activeSchedule) {
    const studentClasses = await prisma.class.findMany({
      where: {
        generationId: userProfile.generationId || undefined,
        OR: [
          { organizationId: userProfile.organizationId || undefined },
          { organizationId: userProfile.organization?.parentId || undefined },
        ],
      },
      select: { id: true },
    });
    const studentClassIds = studentClasses.map((c) => c.id);
    const { startOfToday, endOfToday } = getWibTodayRange();

    const studentScheduleBaseWhere = {
      organizationId: { in: userOrgIds },
      OR: [{ approvalStatus: ApprovalStatus.APPROVED }, { approvalStatus: null }],
      AND: [
        {
          OR: [
            ...(studentClassIds.length > 0
              ? [
                  { classId: { in: studentClassIds } },
                  { targetClasses: { some: { classId: { in: studentClassIds } } } },
                ]
              : []),
            ...(userProfile.generationId
              ? [
                  { targetGenerations: { some: { generationId: userProfile.generationId } } },
                  { class: { generationId: userProfile.generationId } },
                ]
              : []),
            {
              classId: null,
              targetClasses: { none: {} },
              targetGenerations: { none: {} },
            },
          ],
        },
      ],
    };

    activeSchedule = await prisma.schedule.findFirst({
      where: {
        ...studentScheduleBaseWhere,
        status: 'ACTIVE',
        startTime: { gte: startOfToday, lte: endOfToday },
      },
      orderBy: { startTime: 'asc' },
      include: sessionInclude,
    });

    if (!activeSchedule) {
      activeSchedule = await prisma.schedule.findFirst({
        where: {
          ...studentScheduleBaseWhere,
          status: 'SCHEDULED',
          startTime: { gte: startOfToday, lte: endOfToday },
        },
        orderBy: { startTime: 'asc' },
        include: sessionInclude,
      });
    }

    if (!activeSchedule) {
      activeSchedule = await prisma.schedule.findFirst({
        where: {
          ...studentScheduleBaseWhere,
          status: 'ACTIVE',
        },
        orderBy: { startTime: 'desc' },
        include: sessionInclude,
      });
    }
  }

  let isAlreadyPresent = false;
  let checkInTimeStr: string | null = null;

  if (activeSchedule) {
    const session = activeSchedule.attendanceSessions?.[0];
    const myRecord = session?.records?.[0];
    if (myRecord && (myRecord.status === 'HADIR' || myRecord.status === 'TERLAMBAT')) {
      isAlreadyPresent = true;
      checkInTimeStr = myRecord.checkInTime ? formatWibTime(myRecord.checkInTime) : null;
    }
  }

  return {
    activeSchedule: activeSchedule
      ? {
          id: activeSchedule.id,
          title: activeSchedule.title,
          venuePlaceName: activeSchedule.venuePlaceName,
          startTime: formatWibTime(activeSchedule.startTime),
          endTime: formatWibTime(activeSchedule.endTime),
        }
      : null,
    isAlreadyPresent,
    checkInTime: checkInTimeStr,
  };
}

export async function loadParentMonitorData(userProfile: PresensiUserProfile) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const children = userProfile.children || [];
  const childStudentIds = children.map((c) => c.student.id);
  const { startOfToday: startOfDay, endOfToday: endOfDay } = getWibTodayRange();

  const [allPastRecords, absenceHistory, allClasses] = await Promise.all([
    childStudentIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: {
            studentId: { in: childStudentIds },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: {
            studentId: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    getParentAbsenceHistory(undefined, userProfile.id),
    children.length > 0
      ? prisma.class.findMany({
          where: {
            OR: children.map((c) => ({
              generationId: c.student.generationId || undefined,
              organizationId: {
                in: [
                  c.student.organizationId,
                  c.student.organization?.parentId,
                ].filter(Boolean) as string[],
              },
            })),
          },
          select: { id: true, name: true, generationId: true, organizationId: true },
        })
      : Promise.resolve([]),
  ]);

  const pastRecordsByStudent = new Map<string, Array<{ status: string }>>();
  for (const rec of allPastRecords) {
    const list = pastRecordsByStudent.get(rec.studentId) || [];
    list.push(rec);
    pastRecordsByStudent.set(rec.studentId, list);
  }

  const childrenData: ChildAttendanceSummary[] = await Promise.all(
    children.map(async (c) => {
      const student = c.student;
      const studentOrgIds = [
        student.organizationId,
        student.organization?.parentId,
      ].filter(Boolean) as string[];
      const studentClasses = allClasses.filter(
        (cls) =>
          (!cls.generationId || cls.generationId === student.generationId) &&
          cls.organizationId &&
          studentOrgIds.includes(cls.organizationId)
      );
      const studentClass = studentClasses[0];
      const studentClassIds = studentClasses.map((cls) => cls.id);

      const scheduleWhere: any = {
        status: { in: ['ACTIVE', 'SCHEDULED', 'COMPLETED'] },
        startTime: { gte: startOfDay, lte: endOfDay },
        organizationId: { in: studentOrgIds },
        OR: [{ approvalStatus: 'APPROVED' }, { approvalStatus: null }],
        AND: [
          {
            OR: [
              ...(studentClassIds.length > 0
                ? [
                    { classId: { in: studentClassIds } },
                    { targetClasses: { some: { classId: { in: studentClassIds } } } },
                  ]
                : []),
              ...(student.generationId
                ? [
                    { targetGenerations: { some: { generationId: student.generationId } } },
                    { class: { generationId: student.generationId } },
                  ]
                : []),
              {
                classId: null,
                targetClasses: { none: {} },
                targetGenerations: { none: {} },
              },
            ],
          },
        ],
      };

      const todaySchedule = await prisma.schedule.findFirst({
        where: scheduleWhere,
        orderBy: { startTime: 'asc' },
        include: {
          teachers: {
            include: {
              teacher: { select: { fullName: true } },
            },
          },
          scheduleMaterials: {
            include: {
              material: { select: { title: true } },
            },
          },
          attendanceSessions: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              records: {
                where: { studentId: student.id },
              },
            },
          },
        },
      });

      let todayAttendanceStatus:
        | 'HADIR'
        | 'TERLAMBAT'
        | 'IZIN'
        | 'SAKIT'
        | 'ALPA'
        | 'NOT_STARTED' = 'NOT_STARTED';
      let todayCheckInTime: string | null = null;
      let todayNotes: string | null = null;
      let childScheduleInfo: ChildScheduleInfo | null = null;

      if (todaySchedule) {
        const primaryTeacher =
          todaySchedule.teachers.find((t) => t.isPrimary) || todaySchedule.teachers[0];

        childScheduleInfo = {
          scheduleId: todaySchedule.id,
          scheduleTitle: todaySchedule.title,
          startTime: formatWibTime(todaySchedule.startTime),
          endTime: formatWibTime(todaySchedule.endTime),
          venueName: todaySchedule.venuePlaceName,
          teacherName: primaryTeacher?.teacher?.fullName,
          isSubstitute: primaryTeacher?.isSubstitute,
          status: todaySchedule.status as 'ACTIVE' | 'SCHEDULED' | 'COMPLETED',
          materialTitles: todaySchedule.scheduleMaterials.map((sm) => sm.material.title),
        };

        const session = todaySchedule.attendanceSessions?.[0];
        const record = session?.records?.[0];
        if (record) {
          todayAttendanceStatus = record.status as any;
          todayNotes = record.notes;
          todayCheckInTime = record.checkInTime ? formatWibTime(record.checkInTime) : null;
        } else if (todaySchedule.status === 'ACTIVE') {
          todayAttendanceStatus = 'ALPA';
        }
      }

      const pastRecords = pastRecordsByStudent.get(student.id) || [];
      const totalSessions = pastRecords.length;
      const hadirCount = pastRecords.filter(
        (r) => r.status === 'HADIR' || r.status === 'TERLAMBAT'
      ).length;
      const izinCount = pastRecords.filter((r) => r.status === 'IZIN').length;
      const sakitCount = pastRecords.filter((r) => r.status === 'SAKIT').length;
      const alpaCount = pastRecords.filter((r) => r.status === 'ALPA').length;
      const attendanceRate =
        totalSessions > 0 ? Math.round((hadirCount / totalSessions) * 100) : 100;

      return {
        id: student.id,
        fullName: student.fullName,
        generationName: student.generation?.name || 'Santri',
        className: studentClass?.name,
        organizationName: student.organization?.name,
        todaySchedule: childScheduleInfo,
        todayAttendanceStatus,
        todayCheckInTime,
        todayNotes,
        monthlyStats: {
          totalSessions,
          hadirCount,
          izinCount,
          sakitCount,
          alpaCount,
          attendanceRate,
        },
      };
    })
  );

  return { childrenData, absenceHistory };
}

export async function loadPjTerritorySessions(
  roleCodes: UserRole[],
  organizationId: string | null | undefined
) {
  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, organizationId ?? null);
  return prisma.attendanceSession.findMany({
    where: {
      isActive: true,
      ...(scopedOrgIds ? { schedule: { organizationId: { in: scopedOrgIds } } } : {}),
    },
    include: {
      schedule: true,
      records: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
}
