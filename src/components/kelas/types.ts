import { TierLevel, OrganizationType, UserRole, Gender } from '@prisma/client';

export interface ClassTeacherInfo {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  gender: Gender;
  avatarUrl: string | null;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
  } | null;
  roles: {
    role: UserRole;
  }[];
}

export interface ClassOrganizationInfo {
  id: string;
  name: string;
  type: OrganizationType;
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
    type: OrganizationType;
  } | null;
}

export interface ClassGenerationInfo {
  id: string;
  code: string;
  name: string;
  minAge: number;
  maxAge: number;
  color: string | null;
}

export interface ClassWithRelations {
  id: string;
  name: string;
  tierLevel: TierLevel;
  academicYear: string;
  organizationId: string;
  generationId: string;
  homeroomTeacherId: string | null;
  createdAt: Date;
  updatedAt: Date;
  organization: ClassOrganizationInfo;
  generation: ClassGenerationInfo;
  homeroomTeacher: ClassTeacherInfo | null;
  studentCount: number;
  _count: {
    schedules: number;
    assignments: number;
  };
}

export interface ClassMetrics {
  totalClasses: number;
  totalKelompokClasses: number;
  totalDesaDaerahClasses: number;
  totalHomeroomAssigned: number;
}

export interface ClassFilterState {
  search: string;
  generationId: string;
  tierLevel: string;
  academicYear: string;
  page: number;
  limit: number;
  viewMode: 'grid' | 'table';
}

export interface ClassPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ClassUserPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isManager: boolean;
  isAdmin: boolean;
  managerScopeRoles: UserRole[];
}

export interface ClassesOverviewData {
  classes: ClassWithRelations[];
  metrics: ClassMetrics;
  pagination: ClassPagination;
  userPermissions: ClassUserPermissions;
  filterOptions: {
    generations: { id: string; name: string; code: string; color: string | null }[];
    tierLevels: TierLevel[];
    academicYears: string[];
  };
}

export interface ClassFormReferenceData {
  organizations: {
    id: string;
    name: string;
    type: OrganizationType;
    parentId: string | null;
  }[];
  generations: {
    id: string;
    name: string;
    code: string;
    color: string | null;
    minAge: number;
    maxAge: number;
  }[];
  availableTeachers: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
    gender: Gender;
    organizationName: string | null;
    roles: string[];
    currentAssignedClassesCount: number;
  }[];
  academicYears: string[];
  userPermissions: ClassUserPermissions;
}

export interface ClassDetailData {
  classData: ClassWithRelations;
  students: {
    id: string;
    fullName: string;
    gender: Gender;
    phoneNumber: string | null;
    avatarUrl: string | null;
    status: string;
  }[];
  schedules: {
    id: string;
    title: string;
    scheduleType: string;
    venuePlaceName: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }[];
  assignments: {
    id: string;
    title: string;
    taskType: string;
    dueDate: Date | null;
    pointsReward: number;
    submissionsCount: number;
  }[];
  userPermissions: ClassUserPermissions;
}

// ==========================================
// TIPE UNTUK MENU KELAS TERPERSONALISASI
// ==========================================

export interface StudentClassData {
  student: {
    id: string;
    fullName: string;
    avatarUrl: string | null;
    gender: Gender;
    organization: ClassOrganizationInfo | null;
    generation: ClassGenerationInfo | null;
    gamification?: {
      points: number;
      level: number;
    } | null;
  };
  classData: ClassWithRelations | null;
  homeroomTeacher: ClassTeacherInfo | null;
  classmates: {
    id: string;
    fullName: string;
    gender: Gender;
    avatarUrl: string | null;
  }[];
  schedules: {
    id: string;
    title: string;
    scheduleType: string;
    venuePlaceName: string;
    venueType?: string | null;
    startTime: Date;
    endTime: Date;
    status: string;
    teacherName?: string | null;
  }[];
  assignments: {
    id: string;
    title: string;
    taskType: string;
    dueDate: Date | null;
    pointsReward: number;
    requiresParentVerification: boolean;
    submission?: {
      id: string;
      status: string;
      score: number | null;
      submittedAt: Date;
      isVerifiedByParent?: boolean;
    } | null;
  }[];
  attendanceSummary: {
    totalSessions: number;
    attendedCount: number;
    percentage: number;
  };
}

export interface HomeroomStudentItem {
  id: string;
  fullName: string;
  gender: Gender;
  phoneNumber: string | null;
  avatarUrl: string | null;
  parents: {
    parent: {
      id: string;
      fullName: string;
      phoneNumber: string | null;
    };
    relationshipType: string;
  }[];
  attendancePercentage: number;
  completedTasksCount: number;
}

export interface HomeroomClassItem extends ClassWithRelations {
  students: HomeroomStudentItem[];
  schedules: {
    id: string;
    title: string;
    scheduleType: string;
    venuePlaceName: string;
    startTime: Date;
    endTime: Date;
    status: string;
  }[];
  assignments: {
    id: string;
    title: string;
    taskType: string;
    dueDate: Date | null;
    pointsReward: number;
    submissionsCount: number;
    totalStudentsCount: number;
  }[];
}

export interface HomeroomTeacherClassData {
  assignedClasses: HomeroomClassItem[];
  canSwitchToManageMode: boolean;
  teacherInfo: {
    id: string;
    fullName: string;
    organizationName: string | null;
  };
}

export interface ParentChildItem {
  id: string;
  fullName: string;
  gender: Gender;
  avatarUrl: string | null;
  relationshipType: string;
  generation: ClassGenerationInfo | null;
  organization: ClassOrganizationInfo | null;
}

export interface ParentPendingVerificationItem {
  submissionId: string;
  assignmentId: string;
  taskTitle: string;
  taskType: string;
  studentName: string;
  submittedAt: Date;
  submissionText: string | null;
  mediaFileUrl: string | null;
  pointsReward: number;
}

export interface ParentClassData {
  children: ParentChildItem[];
  selectedChildId: string;
  selectedChildClass: ClassWithRelations | null;
  homeroomTeacher: ClassTeacherInfo | null;
  pendingVerifications: ParentPendingVerificationItem[];
  schedules: {
    id: string;
    title: string;
    venuePlaceName: string;
    startTime: Date;
    endTime: Date;
    status: string;
    scheduleType?: string;
    targetScope?: string;
    isCombined?: boolean;
    className?: string | null;
  }[];
  attendanceSummary: {
    totalSessions: number;
    attendedCount: number;
    permissionCount: number;
    percentage: number;
  };
}

