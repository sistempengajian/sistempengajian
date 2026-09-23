export interface StudentProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  gender: string;
  organizationName: string;
  generationName: string;
  generationColor?: string | null;
  className: string | null;
  homeroomTeacher: {
    id: string;
    fullName: string;
    phoneNumber?: string | null;
  } | null;
}

export interface AttendanceHeatmapSession {
  id: string;
  sessionTitle: string;
  status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA';
  checkInTime?: string | null;
  method?: string | null;
}

export interface AttendanceHeatmapDay {
  date: string; // YYYY-MM-DD
  status: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA' | 'NONE';
  checkInTime?: string | null;
  sessionTitle?: string;
  method?: string | null;
  sessions?: AttendanceHeatmapSession[];
}

export interface AbsenceRecordItem {
  id: string;
  date: string;
  status: 'IZIN' | 'SAKIT' | 'ALPA';
  sessionTitle: string;
  reason?: string | null;
}

export interface AttendanceAnalytics {
  totalSessions: number;
  attended: number; // HADIR + TERLAMBAT
  onTime: number; // HADIR
  late: number; // TERLAMBAT
  permission: number; // IZIN
  sick: number; // SAKIT
  absent: number; // ALPA
  percentage: number; // 0 - 100
  currentStreak: number;
  bestStreak: number;
  averageCheckInTime: string | null;
  heatmapDays: AttendanceHeatmapDay[];
  absenceHistory: AbsenceRecordItem[];
}

export interface ScheduledMaterialOccurrence {
  scheduleId: string;
  scheduleTitle: string;
  date: string;
  time?: string;
}

export interface ScheduledMaterialChecklistItem {
  id: string;
  itemTitle: string;
  targetType?: string;
  isCompleted: boolean;
  score?: number | null;
  pointsWeight: number;
}

export interface ScheduledMaterialProgressItem {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  totalItems: number;
  completedItems: number;
  percentage: number;
  isScheduledInPeriod: boolean;
  schedules: ScheduledMaterialOccurrence[];
  checklistItems: ScheduledMaterialChecklistItem[];
}

export interface CurriculumCategoryMastery {
  name: string;
  total: number;
  completed: number;
  percentage: number;
  materials: ScheduledMaterialProgressItem[];
}

export interface RecentMilestoneItem {
  id: string;
  materialTitle: string;
  itemTitle: string;
  targetType: string;
  score: number | null;
  evaluatedAt: string;
  pointsWeight: number;
}

export interface NeedsAttentionItem {
  id: string;
  materialTitle: string;
  itemTitle: string;
  teacherFeedback: string;
  score: number | null;
  evaluatedAt: string;
}

export interface CurriculumMasteryAnalytics {
  totalChecklistItems: number;
  completedItems: number;
  masteryPercentage: number;
  categories: CurriculumCategoryMastery[];
  recentMilestones: RecentMilestoneItem[];
  needsAttentionItems: NeedsAttentionItem[];
}

export interface CharacterTrendPoint {
  date: string;
  sessionTitle: string;
  adabScore: number;
  keaktifanScore: number;
}

export interface FeedbackTagCount {
  tag: string;
  count: number;
}

export interface TeacherNoteFeedItem {
  id: string;
  date: string;
  sessionTitle: string;
  teacherName: string;
  note: string;
  tags: string[];
}

export interface CharacterAnalytics {
  averageAdab: number;
  averageKeaktifan: number;
  evaluatedSessionsCount: number;
  trendHistory: CharacterTrendPoint[];
  feedbackTags: FeedbackTagCount[];
  teacherNotesFeed: TeacherNoteFeedItem[];
}

export interface AssignmentAnalytics {
  totalAssignments: number;
  completedAssignments: number;
  verifiedByParentCount: number;
  percentage: number;
}

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  iconName: string;
  earnedAt: string;
}

export interface GamificationSummary {
  points: number;
  level: number;
  badges: BadgeItem[];
}

export interface ChildDevelopmentReport {
  student: StudentProfile;
  period: string; // 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'THIS_SEMESTER'
  attendance: AttendanceAnalytics;
  curriculum: CurriculumMasteryAnalytics;
  character: CharacterAnalytics;
  assignments: AssignmentAnalytics;
  gamification: GamificationSummary;
}

export interface ChildSelectorItem {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  generationName: string;
  className: string | null;
}
