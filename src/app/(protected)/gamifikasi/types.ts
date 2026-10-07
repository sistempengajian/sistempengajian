export type LeaderboardRegionTier = 'KELOMPOK' | 'DESA' | 'DAERAH';

export type GamifikasiPeriod = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_SEMESTER' | 'ALL_TIME';

export interface LeaderboardFilterOptions {
  regionTier: LeaderboardRegionTier;
  organizationId?: string;
  period: GamifikasiPeriod;
}

export interface LeaderboardEntry {
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  generationName?: string;
  className?: string;
  organizationName?: string;
  rank: number;
  totalPoints: number;
  level: number;
  currentStreakDays: number;
  highestStreakDays: number;
  attendanceRate: number; // 0 - 100%
  completedAssignmentsCount: number;
  badgesCount: number;
  isCurrentUser: boolean;
}

export interface GamificationPodium {
  rank1?: LeaderboardEntry;
  rank2?: LeaderboardEntry;
  rank3?: LeaderboardEntry;
}

export type MissionCategory = 'DAILY' | 'WEEKLY' | 'MILESTONE';

export interface GamificationMission {
  id: string;
  code: string;
  title: string;
  description: string;
  category: MissionCategory;
  iconName: string;
  rewardXp: number;
  currentProgress: number;
  targetGoal: number;
  progressPercent: number;
  isCompleted: boolean;
  isClaimed: boolean;
  expiresInLabel?: string;
}

export interface GamificationBadge {
  id: string;
  codeName: string;
  name: string;
  iconName: string;
  category: string;
  criteriaDescription: string;
  pointBonus: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  progressHint?: string;
  progressPercent?: number;
}

export interface GamificationUserProfile {
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  generationName?: string;
  className?: string;
  organizationName?: string;
  rank: number;
  totalStudents: number;
  totalPoints: number;
  currentLevel: number;
  levelTitle: string;
  currentLevelPoints: number;
  nextLevelPoints: number;
  levelProgressPercent: number;
  currentStreakDays: number;
  highestStreakDays: number;
  totalBadgesUnlocked: number;
  totalBadgesAvailable: number;
  availableClaimableMissions: number;
  isStudentOrChild: boolean;
}

export interface OrganizationOption {
  id: string;
  name: string;
  type: LeaderboardRegionTier;
  parentId?: string | null;
}

export interface LeaderboardDashboardData {
  podium: GamificationPodium;
  rankingsList: LeaderboardEntry[];
  currentUserRank?: LeaderboardEntry;
  totalParticipants: number;
  currentTier: LeaderboardRegionTier;
  selectedOrgId?: string;
  selectedPeriod: GamifikasiPeriod;
  periodLabel: string;
  tierLabel: string;
  availableKelompok: OrganizationOption[];
  availableDesa: OrganizationOption[];
  availableDaerah: OrganizationOption[];
  userDefaultKelompokId?: string;
  userDefaultDesaId?: string;
  userDefaultDaerahId?: string;
}

export interface StudentGamificationDashboardData {
  userProfile: GamificationUserProfile;
  dailyMissions: GamificationMission[];
  weeklyMissions: GamificationMission[];
  milestoneMissions: GamificationMission[];
  badges: GamificationBadge[];
}

export function calculateLevelInfo(totalPoints: number): {
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
