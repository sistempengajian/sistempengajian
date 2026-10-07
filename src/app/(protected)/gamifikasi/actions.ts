'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getEffectiveAuthUser } from '@/lib/auth';
import {
  LeaderboardFilterOptions,
  LeaderboardDashboardData,
  LeaderboardEntry,
  GamificationPodium,
  GamificationMission,
  GamificationBadge,
  GamificationUserProfile,
  StudentGamificationDashboardData,
  LeaderboardRegionTier,
  OrganizationOption,
  MissionCategory,
  calculateLevelInfo,
} from './types';
import { SEED_BADGES } from '@/lib/constants';

// ==============================================================================
// MISSION DEFINITIONS
// ==============================================================================
const MISSION_DEFINITIONS = [
  {
    id: 'daily_presensi_tepat_waktu',
    code: 'DAILY_ATTENDANCE',
    title: 'Hadir Tepat Waktu Hari Ini',
    description: 'Presensi pengajian sebelum ustadz memulai kajian dengan status Hadir.',
    category: 'DAILY' as MissionCategory,
    iconName: 'Clock',
    rewardXp: 15,
    targetGoal: 1,
    expiresInLabel: 'Berakhir 23:59',
  },
  {
    id: 'daily_checklist_materi',
    code: 'DAILY_CHECKLIST',
    title: 'Tuntaskan 1 Checklist Materi',
    description: 'Selesaikan dan setorkan minimal 1 poin materi tilawah/hafalan hari ini.',
    category: 'DAILY' as MissionCategory,
    iconName: 'BookCheck',
    rewardXp: 20,
    targetGoal: 1,
    expiresInLabel: 'Berakhir 23:59',
  },
  {
    id: 'daily_paraf_ortu',
    code: 'DAILY_PARAF',
    title: 'Dapatkan Paraf Tugas dari Orang Tua',
    description: 'Mintakan paraf atau verifikasi tugas rumah kepada ayah/bunda di rumah hari ini.',
    category: 'DAILY' as MissionCategory,
    iconName: 'HeartHandshake',
    rewardXp: 25,
    targetGoal: 1,
    expiresInLabel: 'Berakhir 23:59',
  },
  {
    id: 'weekly_perfect_attendance',
    code: 'WEEKLY_ATTENDANCE',
    title: 'Presensi Sempurna 1 Pekan',
    description: 'Hadir pada sesi pengajian kelasmu pekan ini tanpa alpa (minimal 3 sesi).',
    category: 'WEEKLY' as MissionCategory,
    iconName: 'CalendarCheck',
    rewardXp: 50,
    targetGoal: 3,
    expiresInLabel: 'Reset Hari Minggu',
  },
  {
    id: 'weekly_assignment_master',
    code: 'WEEKLY_ASSIGNMENTS',
    title: 'Koleksi 2 Tugas Berpredikat Baik',
    description: 'Selesaikan minimal 2 tugas rumah pekan ini dan raih penilaian dari Ustadz.',
    category: 'WEEKLY' as MissionCategory,
    iconName: 'FileCheck',
    rewardXp: 60,
    targetGoal: 2,
    expiresInLabel: 'Reset Hari Minggu',
  },
  {
    id: 'weekly_streak_5_days',
    code: 'WEEKLY_STREAK',
    title: 'Pertahankan Streak 5 Hari',
    description: 'Jaga keistiqomahan hadir pengajian selama minimal 5 hari.',
    category: 'WEEKLY' as MissionCategory,
    iconName: 'Flame',
    rewardXp: 40,
    targetGoal: 5,
    expiresInLabel: 'Reset Hari Minggu',
  },
  {
    id: 'milestone_hafalan_10',
    code: 'MILESTONE_HAFALAN',
    title: 'Tuntaskan 10 Checklist Materi',
    description: 'Mencapai kemajuan kurikulum dengan menyelesaikan 10 materi pengajian.',
    category: 'MILESTONE' as MissionCategory,
    iconName: 'Award',
    rewardXp: 100,
    targetGoal: 10,
    expiresInLabel: 'Permanen',
  },
  {
    id: 'milestone_badge_collector',
    code: 'MILESTONE_BADGES',
    title: 'Kolektor 3 Lencana Prestasi',
    description: 'Buka dan dapatkan minimal 3 trofi lencana penghargaan kehormatan.',
    category: 'MILESTONE' as MissionCategory,
    iconName: 'Trophy',
    rewardXp: 150,
    targetGoal: 3,
    expiresInLabel: 'Permanen',
  },
  {
    id: 'milestone_sinergi_ortu',
    code: 'MILESTONE_SINERGI',
    title: 'Sinergi Keluarga Teladan',
    description: 'Tuntaskan 5 tugas dengan verifikasi/paraf lengkap dari orang tua di rumah.',
    category: 'MILESTONE' as MissionCategory,
    iconName: 'Home',
    rewardXp: 120,
    targetGoal: 5,
    expiresInLabel: 'Permanen',
  },
];

// Helper: Period keys
function getTodayDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekKey(date: Date = new Date()): string {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getPeriodKeyForMission(category: MissionCategory, date: Date = new Date()): string {
  if (category === 'DAILY') return getTodayDateKey(date);
  if (category === 'WEEKLY') return getWeekKey(date);
  return 'PERMANENT';
}

function getStartAndEndOfWeek(date: Date = new Date()): { startOfWeek: Date; endOfWeek: Date } {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const startOfWeek = new Date(date);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}


// Helper: Date Range for Leaderboard
function getGamifikasiPeriodDates(period: LeaderboardFilterOptions['period']): {
  startDate?: Date;
  endDate?: Date;
  periodLabel: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'THIS_WEEK') {
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(now);
    return {
      startDate: startOfWeek,
      endDate: endOfWeek,
      periodLabel: 'Pekan Ini',
    };
  }

  if (period === 'THIS_MONTH') {
    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return {
      startDate,
      endDate,
      periodLabel: `Bulan Ini (${monthName})`,
    };
  }

  if (period === 'THIS_SEMESTER') {
    const isGenap = month < 6;
    const startMonth = isGenap ? 0 : 6;
    const endMonth = isGenap ? 5 : 11;
    const startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    const semesterLabel = isGenap ? `Semester Genap ${year}` : `Semester Ganjil ${year}/${year + 1}`;
    return {
      startDate,
      endDate,
      periodLabel: semesterLabel,
    };
  }

  // ALL_TIME
  return {
    periodLabel: 'Sepanjang Waktu (Hall of Fame)',
  };
}

// Ensure Badges Seeded in Database
async function ensureSeedBadges() {
  const count = await prisma.badge.count();
  if (count === 0) {
    for (const b of SEED_BADGES) {
      await prisma.badge.upsert({
        where: { codeName: b.codeName },
        update: {},
        create: {
          codeName: b.codeName,
          name: b.name,
          category: b.category,
          iconName: b.iconName,
          criteriaDescription: b.criteriaDescription,
          pointBonus: b.pointBonus,
        },
      });
    }
  }
}

// Automatically evaluate & unlock badges for a student
export async function evaluateAndAwardBadges(studentId: string): Promise<number> {
  await ensureSeedBadges();

  const [student, allBadges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      include: {
        gamification: true,
        badges: true,
        materialProgress: { where: { isCompleted: true } },
        assignmentSubmissions: {
          include: { parentVerification: true },
        },
      },
    }),
    prisma.badge.findMany(),
  ]);

  if (!student) return 0;

  const unlockedBadgeIds = new Set(student.badges.map((b) => b.badgeId));
  const currentStreak = student.gamification?.currentStreakDays || 0;
  const highestStreak = student.gamification?.highestStreakDays || currentStreak;
  const completedChecklistCount = student.materialProgress.length;
  const parentVerifiedCount = student.assignmentSubmissions.filter(
    (s) => s.parentVerification?.isVerifiedByParent
  ).length;

  let newlyUnlockedCount = 0;

  for (const badge of allBadges) {
    if (unlockedBadgeIds.has(badge.id)) continue;

    let qualifies = false;
    if (badge.codeName === 'TAHFIDZ_STARTER' && completedChecklistCount >= 5) {
      qualifies = true;
    } else if (badge.codeName === 'PEJUANG_SHUBUH' && (currentStreak >= 7 || highestStreak >= 7)) {
      qualifies = true;
    } else if (badge.codeName === 'JUARA_ISTIQOMAH' && (currentStreak >= 30 || highestStreak >= 30)) {
      qualifies = true;
    } else if (badge.codeName === 'KELUARGA_QURANI' && parentVerifiedCount >= 5) {
      qualifies = true;
    }

    if (qualifies) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.studentBadge.create({
            data: {
              studentId,
              badgeId: badge.id,
            },
          });

          const currentGamification = await tx.userGamification.findUnique({
            where: { userId: studentId },
          });
          const newPoints = (currentGamification?.totalPoints || 0) + badge.pointBonus;
          const newLevel = calculateLevelInfo(newPoints).level;

          await tx.userGamification.upsert({
            where: { userId: studentId },
            update: {
              totalPoints: newPoints,
              level: newLevel,
            },
            create: {
              userId: studentId,
              totalPoints: badge.pointBonus,
              level: newLevel,
              currentStreakDays: 1,
              highestStreakDays: 1,
            },
          });
        });
        newlyUnlockedCount++;
      } catch (err) {
        // Ignore duplicate key collision
      }
    }
  }

  return newlyUnlockedCount;
}

// ==============================================================================
// 1. ACTION: LEADERBOARD WILAYAH (KELOMPOK, DESA, DAERAH)
// ==============================================================================
export async function getLeaderboardData(
  filterParams?: Partial<LeaderboardFilterOptions>
): Promise<LeaderboardDashboardData> {
  await ensureSeedBadges();

  let currentUser: any = null;
  let effectiveUserId: string | null = null;
  try {
    const authResult = await getEffectiveAuthUser();
    currentUser = authResult.dbUser;
    effectiveUserId = authResult.effectiveUserId;
  } catch {
    // Graceful fallback if called outside request scope
  }

  const isParent = Boolean(currentUser?.roles?.some((r: any) => r.role === 'ORANG_TUA'));
  const activeStudentId = isParent && currentUser?.children && currentUser.children.length > 0
    ? currentUser.children[0].studentUserId
    : (currentUser?.id || effectiveUserId);

  // Query All Organizations for Tier Options
  const allOrganizations = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
    },
    orderBy: { name: 'asc' },
  });

  const availableKelompok: OrganizationOption[] = allOrganizations
    .filter((o) => o.type === 'KELOMPOK')
    .map((o) => ({ id: o.id, name: o.name, type: 'KELOMPOK' as const, parentId: o.parentId }));

  const availableDesa: OrganizationOption[] = allOrganizations
    .filter((o) => o.type === 'DESA')
    .map((o) => ({ id: o.id, name: o.name, type: 'DESA' as const, parentId: o.parentId }));

  const availableDaerah: OrganizationOption[] = allOrganizations
    .filter((o) => o.type === 'DAERAH')
    .map((o) => ({ id: o.id, name: o.name, type: 'DAERAH' as const, parentId: o.parentId }));

  // Determine user's default regional IDs
  let userOrgId = currentUser?.organizationId;
  if (!userOrgId && isParent && currentUser?.children && currentUser.children.length > 0) {
    const child = await prisma.user.findUnique({
      where: { id: currentUser.children[0].studentUserId },
      select: { organizationId: true },
    });
    userOrgId = child?.organizationId || undefined;
  }

  let userDefaultKelompokId: string | undefined = undefined;
  let userDefaultDesaId: string | undefined = undefined;
  let userDefaultDaerahId: string | undefined = undefined;

  if (userOrgId) {
    const userOrg = allOrganizations.find((o) => o.id === userOrgId);
    if (userOrg?.type === 'KELOMPOK') {
      userDefaultKelompokId = userOrg.id;
      userDefaultDesaId = userOrg.parentId || undefined;
      const parentDesa = allOrganizations.find((o) => o.id === userOrg.parentId);
      userDefaultDaerahId = parentDesa?.parentId || availableDaerah[0]?.id;
    } else if (userOrg?.type === 'DESA') {
      userDefaultDesaId = userOrg.id;
      userDefaultDaerahId = userOrg.parentId || availableDaerah[0]?.id;
      const childKel = availableKelompok.find((k) => k.parentId === userOrg.id);
      userDefaultKelompokId = childKel?.id || availableKelompok[0]?.id;
    } else if (userOrg?.type === 'DAERAH') {
      userDefaultDaerahId = userOrg.id;
      const childDesa = availableDesa.find((d) => d.parentId === userOrg.id);
      userDefaultDesaId = childDesa?.id || availableDesa[0]?.id;
      const childKel = availableKelompok.find((k) => k.parentId === childDesa?.id);
      userDefaultKelompokId = childKel?.id || availableKelompok[0]?.id;
    }
  }

  if (!userDefaultKelompokId && availableKelompok.length > 0) userDefaultKelompokId = availableKelompok[0].id;
  if (!userDefaultDesaId && availableDesa.length > 0) userDefaultDesaId = availableDesa[0].id;
  if (!userDefaultDaerahId && availableDaerah.length > 0) userDefaultDaerahId = availableDaerah[0].id;

  // Set default tier & selected organization
  const currentTier: LeaderboardRegionTier = filterParams?.regionTier || 'KELOMPOK';
  const selectedPeriod = filterParams?.period || 'THIS_MONTH';
  const { startDate, endDate, periodLabel } = getGamifikasiPeriodDates(selectedPeriod);

  let selectedOrgId = filterParams?.organizationId;
  let tierLabel = '';
  let matchingOrgIds: string[] = [];

  if (currentTier === 'KELOMPOK') {
    if (!selectedOrgId && availableKelompok.length > 0) {
      selectedOrgId = userDefaultKelompokId || availableKelompok[0].id;
    }
    const org = availableKelompok.find((k) => k.id === selectedOrgId) || availableKelompok[0];
    if (org) {
      selectedOrgId = org.id;
      matchingOrgIds = [org.id];
      tierLabel = `Kelompok ${org.name}`;
    } else {
      tierLabel = 'Tingkat Kelompok';
    }
  } else if (currentTier === 'DESA') {
    if (!selectedOrgId && availableDesa.length > 0) {
      selectedOrgId = userDefaultDesaId || availableDesa[0].id;
    }
    const org = availableDesa.find((d) => d.id === selectedOrgId) || availableDesa[0];
    if (org) {
      selectedOrgId = org.id;
      const childKelompokIds = availableKelompok.filter((k) => k.parentId === org.id).map((k) => k.id);
      matchingOrgIds = [org.id, ...childKelompokIds];
      tierLabel = `Desa ${org.name}`;
    } else {
      tierLabel = 'Tingkat Desa';
    }
  } else {
    // DAERAH
    if (!selectedOrgId && availableDaerah.length > 0) {
      selectedOrgId = userDefaultDaerahId || availableDaerah[0].id;
    }
    const org = availableDaerah.find((d) => d.id === selectedOrgId) || availableDaerah[0];
    if (org) {
      selectedOrgId = org.id;
      const matchingDesaIds = availableDesa.filter((d) => d.parentId === org.id).map((d) => d.id);
      const matchingKelompokIds = availableKelompok
        .filter((k) => k.parentId && matchingDesaIds.includes(k.parentId))
        .map((k) => k.id);
      matchingOrgIds = [org.id, ...matchingDesaIds, ...matchingKelompokIds];
      tierLabel = `Daerah ${org.name}`;
    } else {
      matchingOrgIds = allOrganizations.map((o) => o.id);
      tierLabel = 'Seluruh Wilayah Daerah';
    }
  }

  // Where Clause for Students
  const userWhere: any = {
    roles: {
      some: {
        role: 'SANTRI',
      },
    },
    status: 'ACTIVE',
  };

  if (matchingOrgIds.length > 0) {
    userWhere.organizationId = { in: matchingOrgIds };
  }

  // Query Students with attendances, submissions, progress, badges, and mission claims
  const students = await prisma.user.findMany({
    where: userWhere,
    include: {
      generation: true,
      organization: true,
      gamification: true,
      badges: {
        include: { badge: true },
        where: startDate && endDate
          ? {
              unlockedAt: {
                gte: startDate,
                lte: endDate,
              },
            }
          : undefined,
      },
      attendanceRecords: startDate && endDate
        ? {
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }
        : true,
      assignmentSubmissions: {
        where: startDate && endDate
          ? {
              submittedAt: {
                gte: startDate,
                lte: endDate,
              },
              status: { in: ['SUBMITTED', 'GRADED'] },
            }
          : {
              status: { in: ['SUBMITTED', 'GRADED'] },
            },
        include: {
          assignment: true,
          parentVerification: true,
        },
      },
      materialProgress: {
        where: startDate && endDate
          ? {
              evaluatedAt: {
                gte: startDate,
                lte: endDate,
              },
              isCompleted: true,
            }
          : {
              isCompleted: true,
            },
        include: {
          checklistItem: true,
        },
      },
      missionClaims: startDate && endDate
        ? {
            where: {
              claimedAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }
        : true,
    },
  });

  // Calculate Scores for each Student
  const leaderboardEntries: LeaderboardEntry[] = students.map((std) => {
    const totalLifetimePoints = std.gamification?.totalPoints || 0;
    const currentStreak = std.gamification?.currentStreakDays || 0;
    const highestStreak = std.gamification?.highestStreakDays || currentStreak;

    let periodPoints = 0;
    let hadirCount = 0;
    const totalAttendance = std.attendanceRecords.length;

    // Presensi
    std.attendanceRecords.forEach((att) => {
      if (att.status === 'HADIR') {
        hadirCount++;
        periodPoints += 10;
      } else if (att.status === 'TERLAMBAT') {
        hadirCount += 0.5;
        periodPoints += 5;
      }
    });

    // Poin dari Tugas
    let completedAssignmentsCount = 0;
    std.assignmentSubmissions.forEach((sub) => {
      completedAssignmentsCount++;
      const basePoints = sub.assignment?.pointsReward || 20;
      const bonus = sub.parentVerification?.isVerifiedByParent
        ? (sub.assignment?.parentBonusPoints || 10)
        : 0;
      periodPoints += (basePoints + bonus);
    });

    // Poin dari Checklist Materi
    std.materialProgress.forEach((prog) => {
      const weight = prog.checklistItem?.pointsWeight || 10;
      periodPoints += weight;
    });

    // Poin dari Klaim Misi
    std.missionClaims.forEach((claim) => {
      periodPoints += claim.rewardXp;
    });

    // Poin dari Lencana Baru
    std.badges.forEach((b) => {
      periodPoints += (b.badge?.pointBonus || 50);
    });

    const attendanceRate =
      totalAttendance > 0 ? Math.round((hadirCount / totalAttendance) * 100) : 100;

    // For ALL_TIME, use lifetime points directly. For periods, use calculated period points.
    const finalPoints = (!startDate && !endDate)
      ? totalLifetimePoints
      : periodPoints;

    const levelInfo = calculateLevelInfo(totalLifetimePoints);
    const genName = std.generation?.name || 'Santri';
    const orgName = std.organization?.name || 'Kelompok';

    return {
      studentId: std.id,
      fullName: std.fullName,
      avatarUrl: std.avatarUrl,
      generationName: genName,
      className: `${genName} • ${orgName}`,
      organizationName: orgName,
      rank: 0,
      totalPoints: finalPoints,
      level: levelInfo.level,
      currentStreakDays: currentStreak,
      highestStreakDays: highestStreak,
      attendanceRate,
      completedAssignmentsCount,
      badgesCount: std.badges.length,
      isCurrentUser: std.id === activeStudentId,
    };
  });

  // Sort Leaderboard: Total Points desc, Streak desc, Attendance Rate desc
  leaderboardEntries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.currentStreakDays !== a.currentStreakDays) return b.currentStreakDays - a.currentStreakDays;
    return b.attendanceRate - a.attendanceRate;
  });

  // Assign Rank Numbers
  leaderboardEntries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  // Podium (Ranks 1, 2, 3) & List (Ranks 4-25)
  const podium: GamificationPodium = {
    rank1: leaderboardEntries[0],
    rank2: leaderboardEntries[1],
    rank3: leaderboardEntries[2],
  };

  const rankingsList = leaderboardEntries.slice(3, 25);
  const currentUserRank = leaderboardEntries.find((e) => e.studentId === activeStudentId);

  return {
    podium,
    rankingsList,
    currentUserRank,
    totalParticipants: leaderboardEntries.length,
    currentTier,
    selectedOrgId,
    selectedPeriod,
    periodLabel,
    tierLabel,
    availableKelompok,
    availableDesa,
    availableDaerah,
    userDefaultKelompokId,
    userDefaultDesaId,
    userDefaultDaerahId,
  };
}

// ==============================================================================
// 2. ACTION: CAPAIAN UTAMA, MISI & TROFI SANTRI (STUDENT GAMIFICATION)
// ==============================================================================
export async function getStudentGamificationData(
  targetStudentId?: string
): Promise<StudentGamificationDashboardData> {
  await ensureSeedBadges();

  let currentUser: any = null;
  let effectiveUserId: string | null = null;
  try {
    const authResult = await getEffectiveAuthUser();
    currentUser = authResult.dbUser;
    effectiveUserId = authResult.effectiveUserId;
  } catch {
    // Graceful fallback if called outside request scope
  }

  const isParent = Boolean(currentUser?.roles?.some((r: any) => r.role === 'ORANG_TUA'));
  const isStudent = Boolean(currentUser?.roles?.some((r: any) => r.role === 'SANTRI'));

  let activeStudentId = targetStudentId || currentUser?.id || effectiveUserId;
  if (isParent && currentUser?.children && currentUser.children.length > 0 && !targetStudentId) {
    activeStudentId = currentUser.children[0].studentUserId;
  }

  // Auto-evaluate badges before loading
  if (activeStudentId) {
    await evaluateAndAwardBadges(activeStudentId);
  }

  const [targetStudent, allBadges] = await Promise.all([
    prisma.user.findUnique({
      where: { id: activeStudentId || '' },
      include: {
        generation: true,
        organization: true,
        gamification: true,
        badges: { include: { badge: true } },
        attendanceRecords: true,
        assignmentSubmissions: true,
        materialProgress: { where: { isCompleted: true } },
      },
    }),
    prisma.badge.findMany({ orderBy: { pointBonus: 'asc' } }),
  ]);

  const totalPoints = targetStudent?.gamification?.totalPoints || 0;
  const levelInfo = calculateLevelInfo(totalPoints);
  const currentStreak = targetStudent?.gamification?.currentStreakDays || 0;
  const highestStreak = targetStudent?.gamification?.highestStreakDays || currentStreak;

  // True Rank Calculation in Student Organization
  let trueRank = 1;
  let totalOrgStudentsCount = 0;
  if (targetStudent) {
    const orgCondition = targetStudent.organizationId ? { organizationId: targetStudent.organizationId } : {};

    const [higherCount, totalInOrg] = await Promise.all([
      prisma.user.count({
        where: {
          ...orgCondition,
          roles: { some: { role: 'SANTRI' } },
          status: 'ACTIVE',
          gamification: {
            totalPoints: { gt: totalPoints },
          },
        },
      }),
      prisma.user.count({
        where: {
          ...orgCondition,
          roles: { some: { role: 'SANTRI' } },
          status: 'ACTIVE',
        },
      }),
    ]);

    trueRank = higherCount + 1;
    totalOrgStudentsCount = totalInOrg;
  }

  const userProfile: GamificationUserProfile = {
    studentId: targetStudent?.id || '',
    fullName: targetStudent?.fullName || 'Santri Generasi',
    avatarUrl: targetStudent?.avatarUrl || null,
    generationName: targetStudent?.generation?.name || 'Santri',
    className: targetStudent?.organization?.name,
    organizationName: targetStudent?.organization?.name,
    rank: trueRank,
    totalStudents: totalOrgStudentsCount,
    totalPoints,
    currentLevel: levelInfo.level,
    levelTitle: levelInfo.levelTitle,
    currentLevelPoints: levelInfo.currentLevelPoints,
    nextLevelPoints: levelInfo.nextLevelPoints,
    levelProgressPercent: levelInfo.levelProgressPercent,
    currentStreakDays: currentStreak,
    highestStreakDays: highestStreak,
    totalBadgesUnlocked: targetStudent?.badges.length || 0,
    totalBadgesAvailable: allBadges.length,
    availableClaimableMissions: 0,
    isStudentOrChild: Boolean(isStudent || isParent),
  };

  // Date Boundaries for Missions
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(now);

  const todayKey = getTodayDateKey(now);
  const weekKey = getWeekKey(now);

  // Fetch Existing Mission Claims for Student
  const existingClaims = targetStudent
    ? await prisma.userMissionClaim.findMany({
        where: {
          studentId: targetStudent.id,
          OR: [
            { periodKey: todayKey },
            { periodKey: weekKey },
            { periodKey: 'PERMANENT' },
          ],
        },
        select: { missionCode: true, periodKey: true },
      })
    : [];

  const claimedCodeSet = new Set(existingClaims.map((c) => c.missionCode));

  // Query Real Student Achievements
  const [
    todayAttendance,
    todayChecklist,
    todayVerification,
    weeklyAttendanceCount,
    weeklySubmissionsCount,
    totalParentVerifications,
  ] = await Promise.all([
    targetStudent
      ? prisma.attendanceRecord.findFirst({
          where: {
            studentId: targetStudent.id,
            status: 'HADIR',
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
        })
      : null,
    targetStudent
      ? prisma.materialChecklistProgress.findFirst({
          where: {
            studentId: targetStudent.id,
            isCompleted: true,
            evaluatedAt: { gte: startOfToday, lte: endOfToday },
          },
        })
      : null,
    targetStudent
      ? prisma.assignmentParentVerification.findFirst({
          where: {
            submission: { studentId: targetStudent.id },
            isVerifiedByParent: true,
            verifiedAt: { gte: startOfToday, lte: endOfToday },
          },
        })
      : null,
    targetStudent
      ? prisma.attendanceRecord.count({
          where: {
            studentId: targetStudent.id,
            status: 'HADIR',
            createdAt: { gte: startOfWeek, lte: endOfWeek },
          },
        })
      : 0,
    targetStudent
      ? prisma.assignmentSubmission.count({
          where: {
            studentId: targetStudent.id,
            status: { in: ['SUBMITTED', 'GRADED'] },
            submittedAt: { gte: startOfWeek, lte: endOfWeek },
          },
        })
      : 0,
    targetStudent
      ? prisma.assignmentParentVerification.count({
          where: {
            submission: { studentId: targetStudent.id },
            isVerifiedByParent: true,
          },
        })
      : 0,
  ]);

  const isTodayPunctual = !!todayAttendance;
  const hasCompletedChecklistToday = !!todayChecklist;
  const hasParentVerificationToday = !!todayVerification;
  const totalCompletedChecklist = targetStudent?.materialProgress.length || 0;
  const totalUnlockedBadges = targetStudent?.badges.length || 0;

  // Daily Quests
  const dailyMissions: GamificationMission[] = [
    {
      id: 'daily_presensi_tepat_waktu',
      code: 'DAILY_ATTENDANCE',
      title: 'Hadir Tepat Waktu Hari Ini',
      description: 'Presensi pengajian sebelum ustadz memulai kajian dengan status Hadir.',
      category: 'DAILY',
      iconName: 'Clock',
      rewardXp: 15,
      currentProgress: isTodayPunctual ? 1 : 0,
      targetGoal: 1,
      progressPercent: isTodayPunctual ? 100 : 0,
      isCompleted: isTodayPunctual,
      isClaimed: claimedCodeSet.has('DAILY_ATTENDANCE'),
      expiresInLabel: 'Berakhir 23:59',
    },
    {
      id: 'daily_checklist_materi',
      code: 'DAILY_CHECKLIST',
      title: 'Tuntaskan 1 Checklist Materi',
      description: 'Selesaikan dan setorkan minimal 1 poin materi tilawah/hafalan hari ini.',
      category: 'DAILY',
      iconName: 'BookCheck',
      rewardXp: 20,
      currentProgress: hasCompletedChecklistToday ? 1 : 0,
      targetGoal: 1,
      progressPercent: hasCompletedChecklistToday ? 100 : 0,
      isCompleted: hasCompletedChecklistToday,
      isClaimed: claimedCodeSet.has('DAILY_CHECKLIST'),
      expiresInLabel: 'Berakhir 23:59',
    },
    {
      id: 'daily_paraf_ortu',
      code: 'DAILY_PARAF',
      title: 'Dapatkan Paraf Tugas dari Orang Tua',
      description: 'Mintakan paraf atau verifikasi tugas rumah kepada ayah/bunda di rumah hari ini.',
      category: 'DAILY',
      iconName: 'HeartHandshake',
      rewardXp: 25,
      currentProgress: hasParentVerificationToday ? 1 : 0,
      targetGoal: 1,
      progressPercent: hasParentVerificationToday ? 100 : 0,
      isCompleted: hasParentVerificationToday,
      isClaimed: claimedCodeSet.has('DAILY_PARAF'),
      expiresInLabel: 'Berakhir 23:59',
    },
  ];

  // Weekly Quests
  const weeklyMissions: GamificationMission[] = [
    {
      id: 'weekly_perfect_attendance',
      code: 'WEEKLY_ATTENDANCE',
      title: 'Presensi Sempurna 1 Pekan',
      description: 'Hadir pada sesi pengajian kelasmu pekan ini tanpa alpa (minimal 3 sesi).',
      category: 'WEEKLY',
      iconName: 'CalendarCheck',
      rewardXp: 50,
      currentProgress: Math.min(3, weeklyAttendanceCount),
      targetGoal: 3,
      progressPercent: Math.min(100, Math.round((Math.min(3, weeklyAttendanceCount) / 3) * 100)),
      isCompleted: weeklyAttendanceCount >= 3,
      isClaimed: claimedCodeSet.has('WEEKLY_ATTENDANCE'),
      expiresInLabel: 'Reset Hari Minggu',
    },
    {
      id: 'weekly_assignment_master',
      code: 'WEEKLY_ASSIGNMENTS',
      title: 'Koleksi 2 Tugas Berpredikat Baik',
      description: 'Selesaikan minimal 2 tugas rumah pekan ini dan raih penilaian dari Ustadz.',
      category: 'WEEKLY',
      iconName: 'FileCheck',
      rewardXp: 60,
      currentProgress: Math.min(2, weeklySubmissionsCount),
      targetGoal: 2,
      progressPercent: Math.min(100, Math.round((Math.min(2, weeklySubmissionsCount) / 2) * 100)),
      isCompleted: weeklySubmissionsCount >= 2,
      isClaimed: claimedCodeSet.has('WEEKLY_ASSIGNMENTS'),
      expiresInLabel: 'Reset Hari Minggu',
    },
    {
      id: 'weekly_streak_5_days',
      code: 'WEEKLY_STREAK',
      title: 'Pertahankan Streak 5 Hari',
      description: 'Jaga keistiqomahan hadir pengajian selama minimal 5 hari.',
      category: 'WEEKLY',
      iconName: 'Flame',
      rewardXp: 40,
      currentProgress: Math.min(5, Math.max(currentStreak, highestStreak)),
      targetGoal: 5,
      progressPercent: Math.min(100, Math.round((Math.min(5, Math.max(currentStreak, highestStreak)) / 5) * 100)),
      isCompleted: Math.max(currentStreak, highestStreak) >= 5,
      isClaimed: claimedCodeSet.has('WEEKLY_STREAK'),
      expiresInLabel: 'Reset Hari Minggu',
    },
  ];

  // Milestone Quests
  const milestoneMissions: GamificationMission[] = [
    {
      id: 'milestone_hafalan_10',
      code: 'MILESTONE_HAFALAN',
      title: 'Tuntaskan 10 Checklist Materi',
      description: 'Mencapai kemajuan kurikulum dengan menyelesaikan 10 materi pengajian.',
      category: 'MILESTONE',
      iconName: 'Award',
      rewardXp: 100,
      currentProgress: Math.min(10, totalCompletedChecklist),
      targetGoal: 10,
      progressPercent: Math.min(100, Math.round((Math.min(10, totalCompletedChecklist) / 10) * 100)),
      isCompleted: totalCompletedChecklist >= 10,
      isClaimed: claimedCodeSet.has('MILESTONE_HAFALAN'),
      expiresInLabel: 'Permanen',
    },
    {
      id: 'milestone_badge_collector',
      code: 'MILESTONE_BADGES',
      title: 'Kolektor 3 Lencana Prestasi',
      description: 'Buka dan dapatkan minimal 3 trofi lencana penghargaan kehormatan.',
      category: 'MILESTONE',
      iconName: 'Trophy',
      rewardXp: 150,
      currentProgress: Math.min(3, totalUnlockedBadges),
      targetGoal: 3,
      progressPercent: Math.min(100, Math.round((Math.min(3, totalUnlockedBadges) / 3) * 100)),
      isCompleted: totalUnlockedBadges >= 3,
      isClaimed: claimedCodeSet.has('MILESTONE_BADGES'),
      expiresInLabel: 'Permanen',
    },
    {
      id: 'milestone_sinergi_ortu',
      code: 'MILESTONE_SINERGI',
      title: 'Sinergi Keluarga Teladan',
      description: 'Tuntaskan 5 tugas dengan verifikasi/paraf dari orang tua di rumah.',
      category: 'MILESTONE',
      iconName: 'Home',
      rewardXp: 120,
      currentProgress: Math.min(5, totalParentVerifications),
      targetGoal: 5,
      progressPercent: Math.min(100, Math.round((Math.min(5, totalParentVerifications) / 5) * 100)),
      isCompleted: totalParentVerifications >= 5,
      isClaimed: claimedCodeSet.has('MILESTONE_SINERGI'),
      expiresInLabel: 'Permanen',
    },
  ];

  // Count Claimable Missions
  let claimableCount = 0;
  [...dailyMissions, ...weeklyMissions, ...milestoneMissions].forEach((m) => {
    if (m.isCompleted && !m.isClaimed) {
      claimableCount++;
    }
  });
  userProfile.availableClaimableMissions = claimableCount;

  // Badges Transformation
  const studentBadgeMap = new Map<string, any>();
  targetStudent?.badges.forEach((sb: any) => {
    studentBadgeMap.set(sb.badgeId, sb);
  });

  const badges: GamificationBadge[] = allBadges.map((badge) => {
    const studentBadge = studentBadgeMap.get(badge.id);
    const isUnlocked = !!studentBadge;

    let progressHint = '';
    let progressPercent = isUnlocked ? 100 : 0;

    if (!isUnlocked) {
      if (badge.codeName === 'PEJUANG_SHUBUH') {
        const streakVal = Math.max(currentStreak, highestStreak);
        progressHint = `${streakVal} / 7 Hari Streak`;
        progressPercent = Math.min(100, Math.round((streakVal / 7) * 100));
      } else if (badge.codeName === 'JUARA_ISTIQOMAH') {
        const streakVal = Math.max(currentStreak, highestStreak);
        progressHint = `${streakVal} / 30 Hari Streak`;
        progressPercent = Math.min(100, Math.round((streakVal / 30) * 100));
      } else if (badge.codeName === 'KELUARGA_QURANI') {
        progressHint = `${Math.min(5, totalParentVerifications)} / 5 Paraf Ortu`;
        progressPercent = Math.min(100, Math.round((Math.min(5, totalParentVerifications) / 5) * 100));
      } else if (badge.codeName === 'TAHFIDZ_STARTER') {
        progressHint = `${Math.min(5, totalCompletedChecklist)} / 5 Materi Selesai`;
        progressPercent = Math.min(100, Math.round((Math.min(5, totalCompletedChecklist) / 5) * 100));
      } else {
        progressHint = 'Belum memenuhi kriteria';
        progressPercent = 0;
      }
    }

    return {
      id: badge.id,
      codeName: badge.codeName,
      name: badge.name,
      iconName: badge.iconName,
      category: badge.category,
      criteriaDescription: badge.criteriaDescription,
      pointBonus: badge.pointBonus,
      isUnlocked,
      unlockedAt: studentBadge
        ? new Date(studentBadge.unlockedAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : undefined,
      progressHint,
      progressPercent,
    };
  });

  return {
    userProfile,
    dailyMissions,
    weeklyMissions,
    milestoneMissions,
    badges,
  };
}

// ==============================================================================
// 3. ACTION: CLAIM MISSION REWARD (IDEMPOTENT & SECURE)
// ==============================================================================
export async function claimMissionReward(
  studentId: string,
  missionCode: string,
  requestedRewardXp: number
): Promise<{ success: boolean; message: string; newPoints?: number }> {
  try {
    const { dbUser: currentUser } = await getEffectiveAuthUser();

    if (!currentUser) {
      return { success: false, message: 'Autentikasi diperlukan untuk mengklaim reward.' };
    }

    // Check authorization: must be student themselves, or parent of student, or authorized staff
    const isSelf = currentUser.id === studentId;
    const isParent = Boolean(
      currentUser.children?.some((c) => c.studentUserId === studentId)
    );
    const isStaff = currentUser.roles.some((r) =>
      ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r.role)
    );

    if (!isSelf && !isParent && !isStaff) {
      return { success: false, message: 'Anda tidak memiliki hak akses untuk mengklaim hadiah santri ini.' };
    }

    // Find mission specification from master definitions
    const missionDef = MISSION_DEFINITIONS.find((m) => m.code === missionCode);
    if (!missionDef) {
      return { success: false, message: 'Misi tidak valid atau tidak terdaftar dalam sistem.' };
    }

    // Determine period key
    const now = new Date();
    const periodKey = getPeriodKeyForMission(missionDef.category, now);

    // 1. Check if already claimed for this period
    const existingClaim = await prisma.userMissionClaim.findUnique({
      where: {
        studentId_missionCode_periodKey: {
          studentId,
          missionCode,
          periodKey,
        },
      },
    });

    if (existingClaim) {
      return {
        success: false,
        message: 'Hadiah untuk misi ini sudah pernah kamu klaim pada periode ini.',
      };
    }

    // 2. Validate mission completion server-side
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const { startOfWeek, endOfWeek } = getStartAndEndOfWeek(now);

    let isCriteriaMet = false;

    if (missionCode === 'DAILY_ATTENDANCE') {
      const att = await prisma.attendanceRecord.findFirst({
        where: {
          studentId,
          status: 'HADIR',
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      });
      isCriteriaMet = !!att;
    } else if (missionCode === 'DAILY_CHECKLIST') {
      const prog = await prisma.materialChecklistProgress.findFirst({
        where: {
          studentId,
          isCompleted: true,
          evaluatedAt: { gte: startOfToday, lte: endOfToday },
        },
      });
      isCriteriaMet = !!prog;
    } else if (missionCode === 'DAILY_PARAF') {
      const paraf = await prisma.assignmentParentVerification.findFirst({
        where: {
          submission: { studentId },
          isVerifiedByParent: true,
          verifiedAt: { gte: startOfToday, lte: endOfToday },
        },
      });
      isCriteriaMet = !!paraf;
    } else if (missionCode === 'WEEKLY_ATTENDANCE') {
      const count = await prisma.attendanceRecord.count({
        where: {
          studentId,
          status: 'HADIR',
          createdAt: { gte: startOfWeek, lte: endOfWeek },
        },
      });
      isCriteriaMet = count >= 3;
    } else if (missionCode === 'WEEKLY_ASSIGNMENTS') {
      const count = await prisma.assignmentSubmission.count({
        where: {
          studentId,
          status: { in: ['SUBMITTED', 'GRADED'] },
          submittedAt: { gte: startOfWeek, lte: endOfWeek },
        },
      });
      isCriteriaMet = count >= 2;
    } else if (missionCode === 'WEEKLY_STREAK') {
      const gamification = await prisma.userGamification.findUnique({
        where: { userId: studentId },
      });
      const streak = Math.max(gamification?.currentStreakDays || 0, gamification?.highestStreakDays || 0);
      isCriteriaMet = streak >= 5;
    } else if (missionCode === 'MILESTONE_HAFALAN') {
      const count = await prisma.materialChecklistProgress.count({
        where: {
          studentId,
          isCompleted: true,
        },
      });
      isCriteriaMet = count >= 10;
    } else if (missionCode === 'MILESTONE_BADGES') {
      const count = await prisma.studentBadge.count({
        where: { studentId },
      });
      isCriteriaMet = count >= 3;
    } else if (missionCode === 'MILESTONE_SINERGI') {
      const count = await prisma.assignmentParentVerification.count({
        where: {
          submission: { studentId },
          isVerifiedByParent: true,
        },
      });
      isCriteriaMet = count >= 5;
    }

    if (!isCriteriaMet) {
      return {
        success: false,
        message: 'Syarat capaian misi ini belum terpenuhi. Silakan selesaikan target terlebih dahulu.',
      };
    }

    // 3. Atomic Transaction: Record Claim & Increment XP
    const actualReward = missionDef.rewardXp;

    const result = await prisma.$transaction(async (tx) => {
      await tx.userMissionClaim.create({
        data: {
          studentId,
          missionCode,
          periodKey,
          rewardXp: actualReward,
        },
      });

      const currentGamification = await tx.userGamification.findUnique({
        where: { userId: studentId },
      });

      const newPoints = (currentGamification?.totalPoints || 0) + actualReward;
      const newLevelInfo = calculateLevelInfo(newPoints);

      const updated = await tx.userGamification.upsert({
        where: { userId: studentId },
        update: {
          totalPoints: newPoints,
          level: newLevelInfo.level,
        },
        create: {
          userId: studentId,
          totalPoints: newPoints,
          level: newLevelInfo.level,
          currentStreakDays: 1,
          highestStreakDays: 1,
        },
      });

      return { newPoints: updated.totalPoints };
    });

    revalidatePath('/gamifikasi');
    revalidatePath('/leaderboard');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `🎉 Alhamdulillah! Berhasil mengklaim +${actualReward} XP. Total Poin sekarang: ${result.newPoints.toLocaleString('id-ID')} XP!`,
      newPoints: result.newPoints,
    };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return {
        success: false,
        message: 'Hadiah untuk misi ini telah berhasil diklaim sebelumnya.',
      };
    }
    console.error('Error claiming mission reward:', error);
    return { success: false, message: error.message || 'Gagal mengklaim hadiah.' };
  }
}
