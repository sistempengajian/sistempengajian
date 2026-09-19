import { UserRole, Gender, ParentRelationType, OrganizationType } from '@prisma/client';

export interface UserRoleItem {
  id: string;
  role: UserRole;
}

export interface UserParentRelationItem {
  id: string;
  relationshipType: ParentRelationType;
  parent: {
    id: string;
    fullName: string;
    phoneNumber: string | null;
    email: string | null;
  };
}

export interface UserChildRelationItem {
  id: string;
  relationshipType: ParentRelationType;
  student: {
    id: string;
    fullName: string;
    gender: Gender;
    generation: {
      id: string;
      name: string;
      color: string | null;
    } | null;
    organization: {
      id: string;
      name: string;
      type: OrganizationType;
    } | null;
  };
}

export interface UserWithRelations {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  phoneNumber: string | null;
  gender: Gender;
  avatarUrl: string | null;
  birthPlace?: string | null;
  birthDate?: string | Date | null;
  status: string; // 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  createdAt: string | Date;
  updatedAt: string | Date;
  
  // Relations
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    parentName?: string | null;
  } | null;
  
  generationId: string | null;
  generation: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  } | null;

  roles: UserRoleItem[];
  parents: UserParentRelationItem[];
  children: UserChildRelationItem[];

  // Aggregated Counts for Safety Guard
  stats: {
    classesCount: number;
    assignmentsCount: number;
    submissionsCount: number;
    attendancesCount: number;
  };
}

export interface UserMetrics {
  totalUsers: number;
  totalSantri: number;
  totalPengajar: number;
  totalPj: number;
  totalOrangTua: number;
  totalAdmin: number;
  activeUsers: number;
}

export interface UserFilterParams {
  role?: string;
  organizationId?: string;
  generationId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UsersOverviewData {
  users: UserWithRelations[];
  metrics: UserMetrics;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  currentUserPermissions: {
    canCreateUser: boolean;
    canEditUser: boolean;
    canDeleteUser: boolean;
    allowedRolesToAssign: UserRole[];
    manageableRoles: UserRole[];
    userScopeRole: UserRole;
  };
}

export interface OrganizationOption {
  id: string;
  name: string;
  type: OrganizationType;
  parentId: string | null;
  parentName?: string | null;
}

export interface GenerationOption {
  id: string;
  name: string;
  code: string;
  color: string | null;
}

export interface FormReferenceData {
  organizations: OrganizationOption[];
  generations: GenerationOption[];
  availableRoles: {
    role: UserRole;
    label: string;
    description: string;
  }[];
}

export interface CreateUserInput {
  fullName: string;
  username?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  gender: Gender;
  birthPlace?: string | null;
  birthDate?: string | Date | null;
  status?: string;
  roles: UserRole[];
  organizationId?: string | null;
  generationId?: string | null;
  parentRelation?: {
    parentId?: string;
    newParentName?: string;
    newParentPhone?: string;
    relationshipType: ParentRelationType;
  };
}

export interface UpdateUserInput {
  fullName: string;
  username?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  gender: Gender;
  birthPlace?: string | null;
  birthDate?: string | Date | null;
  status: string;
  roles: UserRole[];
  organizationId?: string | null;
  generationId?: string | null;
}
