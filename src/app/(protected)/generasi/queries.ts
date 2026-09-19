import prisma from '@/lib/prisma';
import { GenerationsOverviewData, GenerationWithStats } from '@/components/generasi/types';

/**
 * Mengambil seluruh data jenjang generasi beserta statistik agregasi (santri, kelas, kurikulum)
 * untuk Server Component halaman /generasi.
 */
export async function getGenerationsData(userId: string): Promise<GenerationsOverviewData> {
  // 1. Ambil data profil pengguna & perannya
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      roles: {
        select: { role: true },
      },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');
  const canView = roleCodes.some((r) =>
    [
      'ADMIN_MASTER',
      'PJ_DAERAH',
      'PJ_DESA',
      'PJ_KELOMPOK',
      'PENGAJAR',
      'WALI_KELAS',
    ].includes(r)
  );

  if (!canView) {
    return {
      generations: [],
      metrics: {
        totalGenerations: 0,
        totalStudents: 0,
        totalClasses: 0,
        totalMaterials: 0,
      },
      userPermissions: {
        canEdit: false,
        canView: false,
        roleCodes,
        userFullName: userProfile?.fullName || 'Pengguna',
      },
    };
  }

  // 2. Fetch seluruh generasi berurutan dari usia termuda ke tertua
  const generations = await prisma.generation.findMany({
    orderBy: { minAge: 'asc' },
    include: {
      _count: {
        select: {
          users: {
            where: {
              roles: {
                some: {
                  role: 'SANTRI',
                },
              },
            },
          },
          classes: true,
          materials: true,
        },
      },
    },
  });

  // 3. Fetch metrik global
  const [totalStudents, totalClasses, totalMaterials] = await Promise.all([
    prisma.user.count({
      where: {
        roles: {
          some: {
            role: 'SANTRI',
          },
        },
      },
    }),
    prisma.class.count(),
    prisma.material.count(),
  ]);

  const generationsWithStats: GenerationWithStats[] = generations.map((gen) => ({
    id: gen.id,
    code: gen.code,
    name: gen.name,
    minAge: gen.minAge,
    maxAge: gen.maxAge,
    description: gen.description,
    color: gen.color || 'emerald',
    createdAt: gen.createdAt,
    updatedAt: gen.updatedAt,
    studentCount: gen._count.users,
    classCount: gen._count.classes,
    materialCount: gen._count.materials,
  }));

  return {
    generations: generationsWithStats,
    metrics: {
      totalGenerations: generationsWithStats.length,
      totalStudents,
      totalClasses,
      totalMaterials,
    },
    userPermissions: {
      canEdit,
      canView,
      roleCodes,
      userFullName: userProfile?.fullName || 'Pengguna',
    },
  };
}

/**
 * Mengambil detail jenjang generasi tunggal berdasarkan ID untuk halaman edit
 * Memvalidasi apakah user memiliki hak akses Pengelola (ADMIN_MASTER atau PJ_DAERAH)
 */
export async function getGenerationById(
  id: string,
  userId: string
): Promise<{ canEdit: boolean; generation: GenerationWithStats | null }> {
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: {
        select: { role: true },
      },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

  if (!canEdit) {
    return { canEdit: false, generation: null };
  }

  const gen = await prisma.generation.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: {
            where: {
              roles: {
                some: {
                  role: 'SANTRI',
                },
              },
            },
          },
          classes: true,
          materials: true,
        },
      },
    },
  });

  if (!gen) {
    return { canEdit: true, generation: null };
  }

  const generationWithStats: GenerationWithStats = {
    id: gen.id,
    code: gen.code,
    name: gen.name,
    minAge: gen.minAge,
    maxAge: gen.maxAge,
    description: gen.description,
    color: gen.color || 'emerald',
    createdAt: gen.createdAt,
    updatedAt: gen.updatedAt,
    studentCount: gen._count.users,
    classCount: gen._count.classes,
    materialCount: gen._count.materials,
  };

  return {
    canEdit: true,
    generation: generationWithStats,
  };
}
