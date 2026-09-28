'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  GamifikasiFilterOptions,
  GamificationDashboardData,
  LeaderboardEntry,
  GamificationPodium,
  GamificationMission,
  GamificationBadge,
  GamificationUserProfile,
  ScopeOptionItem,
} from './types';
import { SEED_BADGES } from '@/lib/constants';

// Level thresholds calculation
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

// Date Range Helper for Leaderboard Filters
function getGamifikasiPeriodDates(period: GamifikasiFilterOptions['period']): {
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

// Main Server Action: Fetch Gamification & Leaderboard Dashboard Data
export async function getGamificationDashboardData(
  filterParams?: Partial<GamifikasiFilterOptions>
): Promise<GamificationDashboardData> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const currentFilter: GamifikasiFilterOptions = {
    scopeType: filterParams?.scopeType || 'ALL',
    scopeId: filterParams?.scopeId,
    period: filterParams?.period || 'THIS_MONTH',
    studentId: filterParams?.studentId,
  };

  const { startDate, endDate, periodLabel } = getGamifikasiPeriodDates(currentFilter.period);

  // 1. Dapatkan informasi profil user login
  let currentUser = authUser
    ? await prisma.user.findUnique({
        where: { id: authUser.id },
        include: {
          roles: true,
          generation: true,
          organization: true,
          gamification: true,
          children: {
            include: {
              student: {
                include: {
                  generation: true,
                  gamification: true,
                  badges: { include: { badge: true } },
                },
              },
            },
          },
        },
      })
    : null;

  // Tentukan target student ID untuk misi & profil (Santri sendiri atau anak terpilih jika Ortu)
  const isParent = Boolean(currentUser?.roles.some((r) => r.role === 'ORANG_TUA'));
  const isStudent = Boolean(currentUser?.roles.some((r) => r.role === 'SANTRI'));

  let activeStudentId = currentUser?.id;
  if (isParent && currentUser?.children && currentUser.children.length > 0) {
    if (currentFilter.studentId) {
      activeStudentId = currentFilter.studentId;
    } else {
      activeStudentId = currentUser.children[0].studentUserId;
    }
  }

  // 2. Query Scope Options (Kelas, Jenjang, Kelompok)
  const [classes, generations, organizations, dbBadges] = await Promise.all([
    prisma.class.findMany({
      select: { id: true, name: true, generation: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.generation.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { minAge: 'asc' },
    }),
    prisma.organization.findMany({
      where: { type: 'KELOMPOK' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.badge.findMany({
      orderBy: { pointBonus: 'asc' },
    }),
  ]);

  // Jika tabel badges masih kosong, pastikan auto-seed badge dasar
  let allBadges = dbBadges;
  if (allBadges.length === 0) {
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
    allBadges = await prisma.badge.findMany({ orderBy: { pointBonus: 'asc' } });
  }

  const scopeOptions: ScopeOptionItem[] = [
    { id: 'ALL', label: 'Semua Santri (Gabungan)', type: 'ALL' },
    ...generations.map((g) => ({
      id: g.id,
      label: `Jenjang: ${g.name}`,
      type: 'GENERATION' as const,
      group: 'Jenjang Usia',
    })),
    ...classes.map((c) => ({
      id: c.id,
      label: `Kelas: ${c.name}`,
      type: 'CLASS' as const,
      group: 'Daftar Kelas',
    })),
    ...organizations.map((o) => ({
      id: o.id,
      label: `Kelompok: ${o.name}`,
      type: 'ORGANIZATION' as const,
      group: 'Kelompok Pengajian',
    })),
  ];

  // 3. Bangun Where Clause untuk Pengambilan Santri
  const userWhere: any = {
    roles: {
      some: {
        role: 'SANTRI',
      },
    },
    status: 'ACTIVE',
  };

  if (currentFilter.scopeType === 'GENERATION' && currentFilter.scopeId) {
    userWhere.generationId = currentFilter.scopeId;
  } else if (currentFilter.scopeType === 'ORGANIZATION' && currentFilter.scopeId) {
    userWhere.organizationId = currentFilter.scopeId;
  } else if (currentFilter.scopeType === 'CLASS' && currentFilter.scopeId) {
    // Cari santri yang berada di kelas ini
    const classObj = await prisma.class.findUnique({
      where: { id: currentFilter.scopeId },
      include: { generation: true },
    });
    if (classObj?.generationId) {
      userWhere.generationId = classObj.generationId;
    }
  }

  // 4. Ambil semua santri sesuai scope
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

  // 5. Hitung Poin Santri untuk Periode Terpilih
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
        periodPoints += 10; // 10 Poin per kehadiran
      } else if (att.status === 'TERLAMBAT') {
        hadirCount += 0.5;
        periodPoints += 5;
      }
    });

    // Poin dari Tugas Selesai
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

    // Poin dari Lencana Terbuka
    const badgesCount = std.badges.length;
    if (!startDate) {
      // All-time: prioritaskan totalPoints dari DB gamification
      periodPoints = Math.max(totalLifetimePoints, periodPoints + (badgesCount * 50));
    } else {
      periodPoints = Math.max(periodPoints, Math.min(totalLifetimePoints, 50));
    }

    const attendanceRate =
      totalAttendance > 0 ? Math.round((hadirCount / totalAttendance) * 100) : 100;

    const levelInfo = calculateLevelInfo(periodPoints > 0 ? periodPoints : totalLifetimePoints);

    // Cek nama kelas jika ada
    const genName = std.generation?.name || 'Santri';
    const orgName = std.organization?.name || 'Kelompok';

    return {
      studentId: std.id,
      fullName: std.fullName,
      avatarUrl: std.avatarUrl,
      generationName: genName,
      className: `${genName} - ${orgName}`,
      organizationName: orgName,
      rank: 0, // Akan di-assign setelah sorting
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

  // Urutkan leaderboard: Poin Tertinggi -> Streak Tertinggi -> Presensi Tertinggi
  leaderboardEntries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.currentStreakDays !== a.currentStreakDays) return b.currentStreakDays - a.currentStreakDays;
    return b.attendanceRate - a.attendanceRate;
  });

  // Assign Ranking Index (1-based)
  leaderboardEntries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  // Pisahkan Podium (Rank 1, 2, 3) dan List Ranks (4 - 10+)
  const podium: GamificationPodium = {
    rank1: leaderboardEntries[0],
    rank2: leaderboardEntries[1],
    rank3: leaderboardEntries[2],
  };

  const rankingsList = leaderboardEntries.slice(3, 10);

  // 6. Evaluasi Data Profil Pengguna Aktif (Santri / Anak)
  let userProfile: GamificationUserProfile | undefined = undefined;
  const targetStudent = students.find((s) => s.id === activeStudentId) || students[0];

  if (targetStudent) {
    const targetEntry = leaderboardEntries.find((e) => e.studentId === targetStudent.id);
    const totalPoints = targetEntry?.totalPoints || targetStudent.gamification?.totalPoints || 0;
    const levelInfo = calculateLevelInfo(totalPoints);

    userProfile = {
      studentId: targetStudent.id,
      fullName: targetStudent.fullName,
      avatarUrl: targetStudent.avatarUrl,
      generationName: targetStudent.generation?.name || 'Santri',
      className: targetStudent.organization?.name,
      rank: targetEntry?.rank || 1,
      totalStudents: students.length,
      totalPoints,
      currentLevel: levelInfo.level,
      levelTitle: levelInfo.levelTitle,
      currentLevelPoints: levelInfo.currentLevelPoints,
      nextLevelPoints: levelInfo.nextLevelPoints,
      levelProgressPercent: levelInfo.levelProgressPercent,
      currentStreakDays: targetStudent.gamification?.currentStreakDays || 0,
      highestStreakDays: targetStudent.gamification?.highestStreakDays || 0,
      totalBadgesUnlocked: targetStudent.badges.length,
      totalBadgesAvailable: allBadges.length,
      availableClaimableMissions: 0, // Akan dihitung dari misi yang selesai tapi belum diklaim
      isStudentOrChild: Boolean(isStudent || isParent),
    };
  }

  // 7. Hitung Progress Misi Harian, Pekanan, dan Milestones
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Presensi hari ini
  const todayAttendance = targetStudent
    ? await prisma.attendanceRecord.findFirst({
        where: {
          studentId: targetStudent.id,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      })
    : null;

  // Checklist hari ini
  const todayChecklist = targetStudent
    ? await prisma.materialChecklistProgress.findFirst({
        where: {
          studentId: targetStudent.id,
          evaluatedAt: { gte: startOfToday, lte: endOfToday },
          isCompleted: true,
        },
      })
    : null;

  // Paraf Ortu aktif
  const todayVerification = targetStudent
    ? await prisma.assignmentSubmission.findFirst({
        where: {
          studentId: targetStudent.id,
          parentVerification: { isNot: null },
        },
      })
    : null;

  const isTodayPunctual = todayAttendance?.status === 'HADIR';
  const hasCompletedChecklistToday = !!todayChecklist;
  const hasParentVerification = !!todayVerification;

  const currentStreak = targetStudent?.gamification?.currentStreakDays || 0;
  const totalSubmissions = targetStudent?.assignmentSubmissions.length || 0;
  const totalCompletedChecklist = targetStudent?.materialProgress.length || 0;

  // Daftar Misi Harian (Daily Quests)
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

  // Daftar Misi Pekanan (Weekly Quests)
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

  // Daftar Milestone Quests (Sepanjang Waktu)
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

  // Hitung berapa misi yang siap diklaim
  let claimableCount = 0;
  [...dailyMissions, ...weeklyMissions, ...milestoneMissions].forEach((m) => {
    if (m.isCompleted && !m.isClaimed) {
      claimableCount++;
    }
  });

  if (userProfile) {
    userProfile.availableClaimableMissions = claimableCount;
  }

  // 8. Transform Badges (Unlocked vs Locked)
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
    podium,
    rankingsList,
    dailyMissions,
    weeklyMissions,
    milestoneMissions,
    badges,
    scopeOptions,
    currentFilter,
    periodLabel,
    totalParticipants: students.length,
  };
}

// Server Action: Klaim Hadiah Misi Berhasil
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

    // Update total points in UserGamification
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
