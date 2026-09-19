import { OrganizationType } from '@prisma/client';

export interface OrganizationWithStats {
  id: string;
  name: string;
  type: OrganizationType; // DAERAH, DESA, KELOMPOK
  parentId: string | null;
  parentName: string | null;
  parentType: OrganizationType | null;
  createdAt: Date;
  updatedAt: Date;
  childrenCount: number;
  userCount: number;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  materialCount: number;
  scheduleCount: number;
}

export interface OrganizationTreeNode {
  id: string;
  name: string;
  type: OrganizationType;
  parentId: string | null;
  children: OrganizationTreeNode[];
  stats: {
    users: number;
    classes: number;
    materials: number;
  };
}

export interface OrganizationsOverviewData {
  organizations: OrganizationWithStats[];
  tree: OrganizationTreeNode[];
  metrics: {
    totalDaerah: number;
    totalDesa: number;
    totalKelompok: number;
    totalUsers: number;
  };
  userPermissions: {
    canEdit: boolean;
    canView: boolean;
    roleCodes: string[];
    userOrgId: string | null;
    userOrgType: OrganizationType | null;
    editableOrgIds?: string[];
    deletableOrgIds?: string[];
    canCreateOrg?: boolean;
  };
}

export interface ParentOption {
  id: string;
  name: string;
  type: OrganizationType;
  parentName?: string | null;
}

export interface CreateOrganizationInput {
  name: string;
  type: OrganizationType;
  parentId?: string | null;
}

export interface UpdateOrganizationInput {
  name: string;
  parentId?: string | null;
}
