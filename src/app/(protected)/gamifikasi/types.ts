export type GamifikasiScopeType = 'ALL' | 'CLASS' | 'GENERATION' | 'ORGANIZATION';

export type GamifikasiPeriod = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_SEMESTER' | 'ALL_TIME';

export interface GamifikasiFilterOptions {
  scopeType: GamifikasiScopeType;
  scopeId?: string;
  period: GamifikasiPeriod;
  studentId?: string; // Untuk orang tua memilih anak tertentu
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

export interface ScopeOptionItem {
  id: string;
  label: string;
  type: GamifikasiScopeType;
  group?: string;
}

export interface GamificationDashboardData {
  userProfile?: GamificationUserProfile;
  podium: GamificationPodium;
  rankingsList: LeaderboardEntry[];
  dailyMissions: GamificationMission[];
  weeklyMissions: GamificationMission[];
  milestoneMissions: GamificationMission[];
  badges: GamificationBadge[];
  scopeOptions: ScopeOptionItem[];
  currentFilter: GamifikasiFilterOptions;
  periodLabel: string;
  totalParticipants: number;
}
