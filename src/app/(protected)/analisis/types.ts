export type AnalyticsScopeType =
  | 'CLASS'
  | 'GENERATION'
  | 'KELOMPOK'
  | 'DESA'
  | 'DAERAH'
  | 'CUSTOM';

export type AnalyticsPeriod =
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_SEMESTER'
  | 'ALL';

export interface ScopeFilterOption {
  id: string;
  name: string;
  type: AnalyticsScopeType;
  subtitle?: string;
  count?: number;
}

export interface StudentSelectorItem {
  id: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  className: string;
  generationName: string;
  organizationName: string;
}

export interface AnalyticsFilterOptions {
  allowedScopeTypes: AnalyticsScopeType[];
  classes: ScopeFilterOption[];
  generations: ScopeFilterOption[];
  kelompoks: ScopeFilterOption[];
  desas: ScopeFilterOption[];
  daerahs: ScopeFilterOption[];
  availableStudents: StudentSelectorItem[];
  defaultScope: {
    type: AnalyticsScopeType;
    id: string;
    name: string;
  };
}

export interface AnalyticsSummaryKPI {
  totalStudents: number;
  activeStudentsCount: number;
  attendanceRate: number; // 0-100%
  onTimeRate: number; // 0-100%
  lateRate: number; // 0-100%
  absentRate: number; // 0-100% (alpa)
  excusedRate: number; // 0-100% (izin/sakit)
  curriculumMasteryRate: number; // 0-100%
  characterAverage: number; // 0-100
  topPerformerCount: number;
  atRiskCount: number;
  averageStreak: number;
}

export interface AttendanceTrendItem {
  periodLabel: string; // misal: "Pekan 1 (1-7 Sep)"
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpa: number;
  rate: number; // persentase hadir+terlambat
}

export interface CurriculumCategoryMastery {
  category: string;
  masteryRate: number; // 0-100%
  completedItems: number;
  totalItems: number;
  color: string;
}

export interface CharacterDimensionScore {
  dimension: string;
  score: number; // 0-100
  benchmark: number; // target (e.g. 75)
}

export interface BenchmarkComparisonItem {
  id: string;
  name: string;
  type: 'KELAS' | 'GENERASI' | 'KELOMPOK' | 'DESA';
  studentCount: number;
  attendanceRate: number;
  curriculumRate: number;
  characterScore: number;
}

export interface PerformerStudentItem {
  studentId: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  className: string;
  generationName: string;
  organizationName: string;
  attendanceRate: number;
  curriculumRate: number;
  characterScore: number;
  compositeScore: number;
  reasons: string[];
  status: 'TOP' | 'STABLE' | 'AT_RISK';
  parentName?: string;
  parentPhone?: string;
  homeroomTeacherName?: string;
}

export interface AnalyticsDashboardData {
  scopeInfo: {
    type: AnalyticsScopeType;
    id: string;
    name: string;
    subtitle: string;
    periodLabel: string;
    dateRangeLabel: string;
  };
  summary: AnalyticsSummaryKPI;
  attendanceTrends: AttendanceTrendItem[];
  curriculumCategories: CurriculumCategoryMastery[];
  characterRadar: CharacterDimensionScore[];
  benchmarkComparison: BenchmarkComparisonItem[];
  topPerformers: PerformerStudentItem[];
  atRiskStudents: PerformerStudentItem[];
  allStudents: PerformerStudentItem[];
  generatedAt: string;
}
