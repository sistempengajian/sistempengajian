export interface GenerationWithStats {
  id: string;
  code: string;
  name: string;
  minAge: number;
  maxAge: number;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  studentCount: number;
  classCount: number;
  materialCount: number;
}

export interface GenerationsOverviewData {
  generations: GenerationWithStats[];
  metrics: {
    totalGenerations: number;
    totalStudents: number;
    totalClasses: number;
    totalMaterials: number;
  };
  userPermissions: {
    canEdit: boolean;
    canView: boolean;
    roleCodes: string[];
    userFullName: string;
  };
}

export interface CreateGenerationInput {
  name: string;
  code: string;
  minAge: number;
  maxAge: number;
  description?: string | null;
  color?: string | null;
}

export interface UpdateGenerationInput {
  name: string;
  minAge: number;
  maxAge: number;
  description?: string | null;
  color?: string | null;
}
