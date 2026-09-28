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
