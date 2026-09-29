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
} from './types';
import { SEED_BADGES } from '@/lib/constants';

// Level thresholds calculation helper (Internal non-exported helper for server action)
function calculateLevelInfo(totalPoints: number): {
  level: number;
  levelTitle: string;
  currentLevelPoints: number;
  nextLevelPoints: number;
  levelProgressPercent: number;
} {
  const levels = [
    { level: 1, min: 0, max: 100, title: 'Santri Pemula' },
    { level: 2, min: 101, max: 250, title: 'Pencari Ilmu' },
    { level: 3, min: 251, max: 500, title: 'Pejuang Tholabul Ilmi' },
    { level: 4, min: 501, max: 850, title: 'Bintang Pengajian' },
    { level: 5, min: 851, max: 1300, title: 'Duta Disiplin' },
    { level: 6, min: 1301, max: 1900, title: "Ksatria Qur'ani" },
    { level: 7, min: 1901, max: 2700, title: 'Penjaga Sunnah' },
    { level: 8, min: 2701, max: 3700, title: 'Teladan Generasi' },
    { level: 9, min: 3701, max: 5000, title: "Mahkota Qur'ani" },
    { level: 10, min: 5001, max: 100000, title: "Master Generasi Qur'ani" },
  ];

  const currentLevelObj =
    levels.find((l) => totalPoints >= l.min && totalPoints <= l.max) || levels[levels.length - 1];

  const currentLevel = currentLevelObj.level;
  const levelTitle = currentLevelObj.title;
  const minPoints = currentLevelObj.min;
  const maxPoints = currentLevelObj.max;

  const pointsIntoLevel = Math.max(0, totalPoints - minPoints);
  const span = maxPoints - minPoints;
  const levelProgressPercent = span > 0 ? Math.min(100, Math.round((pointsIntoLevel / span) * 100)) : 100;

  return {
    level: currentLevel,
    levelTitle,
    currentLevelPoints: totalPoints,
    nextLevelPoints: maxPoints,
    levelProgressPercent,
  };
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
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startDate: monday,
      endDate: sunday,
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

// Ensure Badges Seeded
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

// ==============================================================================
// 1. ACTION: LEADERBOARD WILAYAH (KELOMPOK, DESA, DAERAH)
// ==============================================================================
export async function getLeaderboardData(
  filterParams?: Partial<LeaderboardFilterOptions>
): Promise<LeaderboardDashboardData> {
  await ensureSeedBadges();

  const { authUser, dbUser: currentUser, effectiveUserId } = await getEffectiveAuthUser();

  const isParent = Boolean(currentUser?.roles.some((r) => r.role === 'ORANG_TUA'));
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

  // Determine user's default regional IDs (Kelompok, Desa, Daerah)
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

  // Determine org filter based on tier
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
      // Get all kelompok under this desa + desa itself
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
      matchingOrgIds = allOrganizations.map((o) => o.id);
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

  // Query Students with attendances, submissions, progress, badges
  const students = await prisma.user.findMany({
    where: userWhere,
    include: {
      generation: true,
      organization: true,
      gamification: true,
      badges: {
        include: { badge: true },
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
      assignmentSubmissions: startDate && endDate
        ? {
            where: {
              submittedAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          }
        : true,
      materialProgress: startDate && endDate
        ? {
            where: {
              evaluatedAt: {
                gte: startDate,
                lte: endDate,
              },
              isCompleted: true,
            },
          }
        : {
            where: {
              isCompleted: true,
            },
          },
    },
  });

  // Calculate Scores for each Student
  const leaderboardEntries: LeaderboardEntry[] = students.map((std) => {
    const totalLifetimePoints = std.gamification?.totalPoints || 0;
    const currentStreak = std.gamification?.currentStreakDays || 0;
    const highestStreak = std.gamification?.highestStreakDays || currentStreak;

    // Hitung poin periode aktif
    let periodPoints = 0;
    let hadirCount = 0;
    let totalAttendance = std.attendanceRecords.length;

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
      if (sub.status === 'GRADED' || sub.status === 'SUBMITTED') {
        completedAssignmentsCount++;
        periodPoints += (sub.score || 20);
      }
    });

    // Poin dari Checklist Materi
    const completedChecklistsCount = std.materialProgress.length;
    periodPoints += (completedChecklistsCount * 5);

    // Poin dari Lencana
    const badgesCount = std.badges.length;
    if (!startDate) {
      periodPoints = Math.max(totalLifetimePoints, periodPoints + (badgesCount * 50));
    } else {
      periodPoints = Math.max(periodPoints, Math.min(totalLifetimePoints, 50));
    }

    const attendanceRate =
      totalAttendance > 0 ? Math.round((hadirCount / totalAttendance) * 100) : 100;

    const levelInfo = calculateLevelInfo(periodPoints > 0 ? periodPoints : totalLifetimePoints);

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
      totalPoints: periodPoints > 0 ? periodPoints : (totalLifetimePoints > 0 ? totalLifetimePoints : 50),
      level: levelInfo.level,
      currentStreakDays: currentStreak,
      highestStreakDays: highestStreak,
      attendanceRate,
      completedAssignmentsCount,
      badgesCount,
      isCurrentUser: std.id === activeStudentId,
    };
  });

  // Sort Leaderboard
  leaderboardEntries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.currentStreakDays !== a.currentStreakDays) return b.currentStreakDays - a.currentStreakDays;
    return b.attendanceRate - a.attendanceRate;
  });

  // Assign Rank Numbers
  leaderboardEntries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  // Podium (Ranks 1, 2, 3) & List (Ranks 4-10)
  const podium: GamificationPodium = {
    rank1: leaderboardEntries[0],
    rank2: leaderboardEntries[1],
    rank3: leaderboardEntries[2],
  };

  const rankingsList = leaderboardEntries.slice(3, 10);
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

  const { authUser, dbUser: currentUser, effectiveUserId } = await getEffectiveAuthUser();

  const isParent = Boolean(currentUser?.roles.some((r) => r.role === 'ORANG_TUA'));
  const isStudent = Boolean(currentUser?.roles.some((r) => r.role === 'SANTRI'));

  let activeStudentId = targetStudentId || currentUser?.id || effectiveUserId;
  if (isParent && currentUser?.children && currentUser.children.length > 0 && !targetStudentId) {
    activeStudentId = currentUser.children[0].studentUserId;
  }

  const [targetStudent, allBadges, totalStudentsCount] = await Promise.all([
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
    prisma.user.count({
      where: {
        roles: { some: { role: 'SANTRI' } },
        status: 'ACTIVE',
      },
    }),
  ]);

  const totalPoints = targetStudent?.gamification?.totalPoints || 0;
  const levelInfo = calculateLevelInfo(totalPoints);
  const currentStreak = targetStudent?.gamification?.currentStreakDays || 0;
  const highestStreak = targetStudent?.gamification?.highestStreakDays || currentStreak;

  const userProfile: GamificationUserProfile = {
    studentId: targetStudent?.id || '',
    fullName: targetStudent?.fullName || 'Santri Generasi',
    avatarUrl: targetStudent?.avatarUrl || null,
    generationName: targetStudent?.generation?.name || 'Santri',
    className: targetStudent?.organization?.name,
    organizationName: targetStudent?.organization?.name,
    rank: 1, // Akan dihitung atau di-display
    totalStudents: totalStudentsCount,
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

  // Misi Harian, Pekanan, Milestones
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [todayAttendance, todayChecklist, todayVerification] = await Promise.all([
    targetStudent
      ? prisma.attendanceRecord.findFirst({
          where: {
            studentId: targetStudent.id,
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
        })
      : null,
    targetStudent
      ? prisma.materialChecklistProgress.findFirst({
          where: {
            studentId: targetStudent.id,
            evaluatedAt: { gte: startOfToday, lte: endOfToday },
            isCompleted: true,
          },
        })
      : null,
    targetStudent
      ? prisma.assignmentSubmission.findFirst({
          where: {
            studentId: targetStudent.id,
            parentVerification: { isNot: null },
          },
        })
      : null,
  ]);

  const isTodayPunctual = todayAttendance?.status === 'HADIR';
  const hasCompletedChecklistToday = !!todayChecklist;
  const hasParentVerification = !!todayVerification;
  const totalSubmissions = targetStudent?.assignmentSubmissions.length || 0;
  const totalCompletedChecklist = targetStudent?.materialProgress.length || 0;

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
      isClaimed: false,
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
      isClaimed: false,
      expiresInLabel: 'Berakhir 23:59',
    },
    {
      id: 'daily_paraf_ortu',
      code: 'DAILY_PARAF',
      title: 'Dapatkan Paraf Tugas dari Orang Tua',
      description: 'Mintakan paraf atau verifikasi tugas rumah kepada ayah/bunda di rumah.',
      category: 'DAILY',
      iconName: 'HeartHandshake',
      rewardXp: 25,
      currentProgress: hasParentVerification ? 1 : 0,
      targetGoal: 1,
      progressPercent: hasParentVerification ? 100 : 0,
      isCompleted: hasParentVerification,
      isClaimed: false,
      expiresInLabel: 'Berakhir 23:59',
    },
  ];

  // Weekly Quests
  const weeklyMissions: GamificationMission[] = [
    {
      id: 'weekly_perfect_attendance',
      code: 'WEEKLY_ATTENDANCE',
      title: 'Presensi Sempurna 1 Pekan',
      description: 'Hadir pada seluruh jadwal sesi pengajian kelasmu pekan ini tanpa alpa.',
      category: 'WEEKLY',
      iconName: 'CalendarCheck',
      rewardXp: 50,
      currentProgress: Math.min(3, currentStreak),
      targetGoal: 3,
      progressPercent: Math.min(100, Math.round((Math.min(3, currentStreak) / 3) * 100)),
      isCompleted: currentStreak >= 3,
      isClaimed: false,
      expiresInLabel: 'Reset Hari Minggu',
    },
    {
      id: 'weekly_assignment_master',
      code: 'WEEKLY_ASSIGNMENTS',
      title: 'Koleksi 2 Tugas Berpredikat Baik',
      description: 'Selesaikan minimal 2 tugas rumah dan raih penilaian lulus dari Ustadz.',
      category: 'WEEKLY',
      iconName: 'FileCheck',
      rewardXp: 60,
      currentProgress: Math.min(2, totalSubmissions),
      targetGoal: 2,
      progressPercent: Math.min(100, Math.round((Math.min(2, totalSubmissions) / 2) * 100)),
      isCompleted: totalSubmissions >= 2,
      isClaimed: false,
      expiresInLabel: 'Reset Hari Minggu',
    },
    {
      id: 'weekly_streak_5_days',
      code: 'WEEKLY_STREAK',
      title: 'Pertahankan Streak 5 Hari',
      description: 'Jaga keistiqomahan hadir pengajian selama 5 hari berturut-turut.',
      category: 'WEEKLY',
      iconName: 'Flame',
      rewardXp: 40,
      currentProgress: Math.min(5, currentStreak),
      targetGoal: 5,
      progressPercent: Math.min(100, Math.round((Math.min(5, currentStreak) / 5) * 100)),
      isCompleted: currentStreak >= 5,
      isClaimed: false,
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
      isClaimed: false,
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
      currentProgress: Math.min(3, targetStudent?.badges.length || 0),
      targetGoal: 3,
      progressPercent: Math.min(100, Math.round((Math.min(3, targetStudent?.badges.length || 0) / 3) * 100)),
      isCompleted: (targetStudent?.badges.length || 0) >= 3,
      isClaimed: false,
      expiresInLabel: 'Permanen',
    },
    {
      id: 'milestone_sinergi_ortu',
      code: 'MILESTONE_SINERGI',
      title: 'Sinergi Keluarga Teladan',
      description: 'Tuntaskan 5 tugas dengan paraf lengkap dari orang tua di rumah.',
      category: 'MILESTONE',
      iconName: 'Home',
      rewardXp: 120,
      currentProgress: hasParentVerification ? 1 : 0,
      targetGoal: 5,
      progressPercent: hasParentVerification ? 20 : 0,
      isCompleted: false,
      isClaimed: false,
      expiresInLabel: 'Permanen',
    },
  ];

  // Count Claimable
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
        progressHint = `${currentStreak} / 7 Hari Shubuh`;
        progressPercent = Math.min(100, Math.round((currentStreak / 7) * 100));
      } else if (badge.codeName === 'JUARA_ISTIQOMAH') {
        progressHint = `${currentStreak} / 30 Hari Streak`;
        progressPercent = Math.min(100, Math.round((currentStreak / 30) * 100));
      } else if (badge.codeName === 'KELUARGA_QURANI') {
        progressHint = `${hasParentVerification ? 1 : 0} / 10 Paraf Ortu`;
        progressPercent = hasParentVerification ? 10 : 0;
      } else if (badge.codeName === 'TAHFIDZ_STARTER') {
        progressHint = `${Math.min(5, totalCompletedChecklist)} / 5 Surat Selesai`;
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
// 3. ACTION: CLAIM MISSION REWARD
// ==============================================================================
export async function claimMissionReward(
  studentId: string,
  missionCode: string,
  rewardXp: number
): Promise<{ success: boolean; message: string; newPoints?: number }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Autentikasi diperlukan.' };
    }

    const currentGamification = await prisma.userGamification.findUnique({
      where: { userId: studentId },
    });

    const newPoints = (currentGamification?.totalPoints || 0) + rewardXp;
    const newLevelInfo = calculateLevelInfo(newPoints);

    await prisma.userGamification.upsert({
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

    revalidatePath('/gamifikasi');
    revalidatePath('/leaderboard');
    return {
      success: true,
      message: `🎉 Selamat! Kamu berhasil mengklaim +${rewardXp} XP. Total Poin sekarang: ${newPoints} XP!`,
      newPoints,
    };
  } catch (error: any) {
    console.error('Error claiming mission reward:', error);
    return { success: false, message: error.message || 'Gagal mengklaim hadiah.' };
  }
}
