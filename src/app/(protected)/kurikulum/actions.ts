'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  TierLevel,
  MaterialUsageScope,
  CompletionTierLevel,
  GenerationCode,
  OrganizationType,
  Prisma,
} from '@prisma/client';

/**
 * Helper otentikasi & otorisasi khusus PJ / Admin:
 * Hanya PJ_KELOMPOK, PJ_DESA, PJ_DAERAH, dan ADMIN_MASTER yang berhak melakukan aksi tulis/ubah/hapus.
 * Pengajar, Wali Kelas, Santri, dan Orang Tua dibatasi dalam mode Read-Only.
 */
async function assertPjOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Sesi tidak valid. Silakan login kembali.');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      organization: {
        include: {
          parent: true,
        },
      },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isPjOrAdmin = roleCodes.some((r) =>
    ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
  );

  if (!isPjOrAdmin) {
    throw new Error('Akses ditolak: Hanya Pengurus Wilayah (PJ) atau Admin yang berhak mengelola kurikulum.');
  }

  // Tentukan tingkatan tertinggi pengguna
  let highestTier: TierLevel = TierLevel.KELOMPOK;
  if (roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH')) {
    highestTier = TierLevel.DAERAH;
  } else if (roleCodes.includes('PJ_DESA')) {
    highestTier = TierLevel.DESA;
  }

  return {
    user,
    userProfile,
    roleCodes,
    highestTier,
  };
}

/**
 * Mengambil materi kurikulum berjenjang dengan paginasi (Infinite Scroll),
 * mendukung multi-versi (Versi Asli, Versi Desa, Versi Kelompok),
 * dan isolasi wilayah (Multi-Tenancy) tanpa duplikasi kartu (No Forking).
 */
export async function getMaterialsPaginated({
  genCode,
  page = 1,
  limit = 5,
  search = '',
  scope = 'ALL',
  studentId,
  classId,
  filterOrgId,
}: {
  genCode: string;
  page?: number;
  limit?: number;
  search?: string;
  scope?: 'ALL' | 'DAERAH' | 'DESA' | 'KELOMPOK' | 'MASTER' | 'CUSTOM';
  studentId?: string;
  classId?: string;
  filterOrgId?: string;
}) {
  const skip = (Math.max(page, 1) - 1) * limit;

  // Ambil konteks pengguna saat ini untuk isolasi wilayah (multi-tenancy)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile = null;
  if (user) {
    userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        organization: {
          include: {
            parent: true,
          },
        },
      },
    });
  }

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isSuperAdminOrDaerah = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const userOrgId = userProfile?.organizationId;
  const parentOrgId = userProfile?.organization?.parentId;

  // Bangun daftar ID organisasi yang boleh diakses pengguna
  const allowedOrgs: string[] = [];
  if (userOrgId) allowedOrgs.push(userOrgId);
  if (parentOrgId) allowedOrgs.push(parentOrgId);

  // Susun klausul filter dengan array AND
  const andConditions: Prisma.MaterialWhereInput[] = [
    {
      targetGeneration: {
        code: genCode,
      },
    },
  ];

  // 1. Isolasi Wilayah (Multi-Tenancy)
  if (!isSuperAdminOrDaerah) {
    if (isPjDesa && userOrgId) {
      andConditions.push({
        OR: [
          { creatorTierLevel: TierLevel.DAERAH },
          { organizationId: userOrgId },
          { organization: { parentId: userOrgId } },
        ],
      });
    } else if (allowedOrgs.length > 0) {
      andConditions.push({
        OR: [
          { creatorTierLevel: TierLevel.DAERAH },
          { organizationId: { in: allowedOrgs } },
        ],
      });
    } else {
      andConditions.push({
        creatorTierLevel: TierLevel.DAERAH,
      });
    }
  }

  // 2. Filter Tingkatan Materi (creatorTierLevel) & Scope
  if (scope === 'DAERAH') {
    andConditions.push({
      creatorTierLevel: TierLevel.DAERAH,
    });
  } else if (scope === 'DESA') {
    andConditions.push({
      creatorTierLevel: TierLevel.DESA,
    });
  } else if (scope === 'KELOMPOK') {
    andConditions.push({
      creatorTierLevel: TierLevel.KELOMPOK,
    });
  } else if (scope === 'MASTER') {
    andConditions.push({
      creatorTierLevel: TierLevel.DAERAH,
      customizations: {
        none: {
          organizationId: { in: allowedOrgs.length > 0 ? allowedOrgs : ['00000000-0000-0000-0000-000000000000'] },
        },
      },
    });
  } else if (scope === 'CUSTOM') {
    andConditions.push({
      OR: [
        { creatorTierLevel: { not: TierLevel.DAERAH } },
        {
          customizations: {
            some: {
              organizationId: { in: allowedOrgs.length > 0 ? allowedOrgs : ['00000000-0000-0000-0000-000000000000'] },
            },
          },
        },
      ],
    });
  }

  // 3. Pencarian Teks (Search)
  if (search.trim()) {
    andConditions.push({
      OR: [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.MaterialWhereInput = {
    AND: andConditions,
  };

  const [total, items] = await Promise.all([
    prisma.material.count({ where }),
    prisma.material.findMany({
      where,
      include: {
        checklistItems: {
          where: isSuperAdminOrDaerah
            ? undefined
            : {
              OR: [
                { organizationId: null },
                ...(allowedOrgs.length > 0 ? [{ organizationId: { in: allowedOrgs } }] : []),
              ],
            },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            ...(studentId
              ? {
                studentProgress: {
                  where: { studentId },
                  select: {
                    id: true,
                    score: true,
                    teacherFeedback: true,
                    feedbackTags: true,
                    isCompleted: true,
                    evaluatedAt: true,
                  },
                },
              }
              : {}),
          },
          orderBy: { orderIndex: 'asc' },
        },
        customizations: {
          where: isSuperAdminOrDaerah
            ? undefined
            : allowedOrgs.length > 0
              ? { organizationId: { in: allowedOrgs } }
              : undefined,
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        targetGeneration: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  // 4. Tentukan target santri untuk perhitungan progres kolektif jika studentId tidak diberikan
  let targetStudentIds: string[] = [];
  let scopeLabel = '';

  if (studentId) {
    targetStudentIds = [studentId];
  } else if (classId) {
    // 4a. Wali Kelas dengan kelas binaan terpilih
    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        generationId: true,
      },
    });

    if (targetClass) {
      scopeLabel = targetClass.name;
      const students = await prisma.user.findMany({
        where: {
          organizationId: targetClass.organizationId,
          generationId: targetClass.generationId,
          roles: { some: { role: 'SANTRI' } },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  } else if (filterOrgId) {
    // 4b. Filter spesifik organisasi (misal PJ Desa memilih salah satu kelompok)
    const targetOrg = await prisma.organization.findUnique({
      where: { id: filterOrgId },
      select: { id: true, name: true },
    });
    scopeLabel = targetOrg?.name || 'Kelompok';
    const students = await prisma.user.findMany({
      where: {
        organizationId: filterOrgId,
        generation: { code: genCode },
        roles: { some: { role: 'SANTRI' } },
      },
      select: { id: true },
    });
    targetStudentIds = students.map((s) => s.id);
  } else {
    // 4c. Berdasarkan cakupan wilayah & peran pengguna
    if (isPjDesa && userOrgId) {
      // PJ Desa: Seluruh santri di desa dan kelompok binaan di bawahnya
      const childOrgs = await prisma.organization.findMany({
        where: { parentId: userOrgId },
        select: { id: true },
      });
      const orgIds = [userOrgId, ...childOrgs.map((c) => c.id)];
      scopeLabel = userProfile?.organization?.name
        ? `Desa ${userProfile.organization.name}`
        : 'Tingkat Desa';

      const students = await prisma.user.findMany({
        where: {
          organizationId: { in: orgIds },
          generation: { code: genCode },
          roles: { some: { role: 'SANTRI' } },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    } else if (isSuperAdminOrDaerah) {
      // PJ Daerah / Admin Master
      scopeLabel = 'Tingkat Daerah';
      const students = await prisma.user.findMany({
        where: {
          generation: { code: genCode },
          roles: { some: { role: 'SANTRI' } },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    } else if (userOrgId) {
      // Pengajar / PJ Kelompok: Seluruh santri di kelompoknya untuk jenjang aktif
      scopeLabel = userProfile?.organization?.name
        ? `Kelompok ${userProfile.organization.name}`
        : 'Kelompok';
      const students = await prisma.user.findMany({
        where: {
          organizationId: userOrgId,
          generation: { code: genCode },
          roles: { some: { role: 'SANTRI' } },
        },
        select: { id: true },
      });
      targetStudentIds = students.map((s) => s.id);
    }
  }

  // 5. Query batch progres capaian santri (jika dalam mode kolektif dan target santri > 0)
  const itemProgressMap = new Map<string, { completedCount: number; scores: number[] }>();
  const materialStudentCompletions = new Map<string, Map<string, number>>();

  if (!studentId && targetStudentIds.length > 0) {
    const allChecklistItemIds = items.flatMap((m) => m.checklistItems.map((c: any) => c.id));
    const itemToMaterialId = new Map<string, string>();

    for (const m of items) {
      materialStudentCompletions.set(m.id, new Map());
      for (const c of m.checklistItems) {
        itemProgressMap.set(c.id, { completedCount: 0, scores: [] });
        itemToMaterialId.set(c.id, m.id);
      }
    }

    if (allChecklistItemIds.length > 0) {
      const allProgress = await prisma.materialChecklistProgress.findMany({
        where: {
          checklistItemId: { in: allChecklistItemIds },
          studentId: { in: targetStudentIds },
        },
        select: {
          checklistItemId: true,
          studentId: true,
          score: true,
          isCompleted: true,
        },
      });

      for (const p of allProgress) {
        const itemAgg = itemProgressMap.get(p.checklistItemId);
        if (itemAgg) {
          if (typeof p.score === 'number') {
            itemAgg.scores.push(p.score);
          }
          if (p.isCompleted) {
            itemAgg.completedCount++;
            const matId = itemToMaterialId.get(p.checklistItemId);
            if (matId) {
              const studentMap = materialStudentCompletions.get(matId);
              if (studentMap) {
                studentMap.set(p.studentId, (studentMap.get(p.studentId) || 0) + 1);
              }
            }
          }
        }
      }
    }
  }

  return {
    items: items.map((m) => {
      // Hitung agregasi progres capaian santri untuk materi ini
      let progressSummary: {
        totalItems: number;
        completedItems: number;
        averageScore: number;
        percentage: number;
        status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
        totalStudents?: number;
        completedStudents?: number;
        scopeLabel?: string;
        isGroupView?: boolean;
      } | null = null;

      const totalItems = m.checklistItems.length;

      if (studentId) {
        // Mode Individu Santri
        if (totalItems === 0) {
          progressSummary = {
            totalItems: 0,
            completedItems: 0,
            averageScore: 0,
            percentage: 0,
            status: 'NOT_STARTED',
            totalStudents: 1,
            completedStudents: 0,
            scopeLabel: 'Individu',
            isGroupView: false,
          };
        } else {
          let totalScoreSum = 0;
          let completedCount = 0;

          m.checklistItems.forEach((c: any) => {
            const prog = c.studentProgress?.[0];
            if (prog) {
              if (prog.isCompleted) completedCount++;
              if (typeof prog.score === 'number') {
                totalScoreSum += prog.score;
              }
            }
          });

          // Rumus: Rata-rata nilai setiap capaian dibagi jumlah total capaian dalam materi
          const averageScore = Math.round(totalScoreSum / totalItems);

          progressSummary = {
            totalItems,
            completedItems: completedCount,
            averageScore,
            percentage: averageScore, // Sesuai kesepakatan: persentase circle line bar dari skor rata-rata
            status:
              completedCount === totalItems && totalItems > 0
                ? 'COMPLETED'
                : completedCount > 0 || totalScoreSum > 0
                  ? 'IN_PROGRESS'
                  : 'NOT_STARTED',
            totalStudents: 1,
            completedStudents: completedCount === totalItems && totalItems > 0 ? 1 : 0,
            scopeLabel: 'Individu',
            isGroupView: false,
          };
        }
      } else {
        // Mode Kolektif (Kelas Binaan, Kelompok, Desa, atau Daerah)
        const totalStudents = targetStudentIds.length;
        if (totalItems === 0 || totalStudents === 0) {
          progressSummary = {
            totalItems,
            completedItems: 0,
            averageScore: 0,
            percentage: 0,
            status: 'NOT_STARTED',
            totalStudents,
            completedStudents: 0,
            scopeLabel: scopeLabel || 'Kolektif',
            isGroupView: true,
          };
        } else {
          let totalCompletedItemsSum = 0;
          let totalScoreSum = 0;
          let totalScoresCount = 0;

          m.checklistItems.forEach((c: any) => {
            const agg = itemProgressMap.get(c.id);
            if (agg) {
              totalCompletedItemsSum += agg.completedCount;
              agg.scores.forEach((s) => {
                totalScoreSum += s;
                totalScoresCount++;
              });
            }
          });

          const totalPossibleCompletions = totalItems * totalStudents;
          const percentage = totalPossibleCompletions > 0
            ? Math.round((totalCompletedItemsSum / totalPossibleCompletions) * 100)
            : 0;

          const averageScore = totalScoresCount > 0
            ? Math.round(totalScoreSum / totalScoresCount)
            : 0;

          const studentMap = materialStudentCompletions.get(m.id);
          let completedStudentsCount = 0;
          if (studentMap) {
            studentMap.forEach((completedCount) => {
              if (completedCount >= totalItems) {
                completedStudentsCount++;
              }
            });
          }

          progressSummary = {
            totalItems,
            completedItems: totalCompletedItemsSum,
            averageScore,
            percentage,
            status:
              percentage === 100
                ? 'COMPLETED'
                : percentage > 0
                  ? 'IN_PROGRESS'
                  : 'NOT_STARTED',
            totalStudents,
            completedStudents: completedStudentsCount,
            scopeLabel: scopeLabel || 'Kolektif',
            isGroupView: true,
          };
        }
      }

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        fileUrl: m.fileUrl,
        creatorTierLevel: m.creatorTierLevel,
        isMandatoryForTarget: m.isMandatoryForTarget,
        allowedUsageScope: m.allowedUsageScope,
        organizationId: m.organizationId,
        organization: m.organization
          ? { id: m.organization.id, name: m.organization.name, type: m.organization.type }
          : null,
        targetGeneration: m.targetGeneration
          ? { id: m.targetGeneration.id, name: m.targetGeneration.name, code: m.targetGeneration.code }
          : null,
        progressSummary,
        checklistItems: m.checklistItems.map((c: any) => {
          const prog = c.studentProgress?.[0] || null;
          const totalStudents = targetStudentIds.length;
          const agg = itemProgressMap.get(c.id);
          const groupProgress = !studentId && totalStudents > 0 ? {
            totalStudents,
            completedCount: agg?.completedCount || 0,
            percentage: Math.round(((agg?.completedCount || 0) / totalStudents) * 100),
            averageScore: agg && agg.scores.length > 0
              ? Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length)
              : 0,
          } : null;

          return {
            id: c.id,
            materialId: c.materialId,
            itemTitle: c.itemTitle,
            description: c.description,
            completionTierLevel: c.completionTierLevel,
            pointsWeight: c.pointsWeight,
            orderIndex: c.orderIndex,
            organizationId: c.organizationId,
            tierLevel: c.tierLevel,
            organization: c.organization
              ? { id: c.organization.id, name: c.organization.name, type: c.organization.type }
              : null,
            studentProgress: prog
              ? {
                id: prog.id,
                score: prog.score,
                teacherFeedback: prog.teacherFeedback,
                feedbackTags: prog.feedbackTags || [],
                isCompleted: Boolean(prog.isCompleted),
                evaluatedAt: prog.evaluatedAt ? prog.evaluatedAt.toISOString() : null,
              }
              : null,
            groupProgress,
          };
        }),
        customizations: m.customizations.map((cust) => ({
          id: cust.id,
          materialId: cust.materialId,
          organizationId: cust.organizationId,
          tierLevel: cust.tierLevel,
          customTitle: cust.customTitle,
          customDescription: cust.customDescription,
          customFileUrl: cust.customFileUrl,
          excludedItemIds: cust.excludedItemIds,
          itemOverrides:
            (cust.itemOverrides as Record<
              string,
              { itemTitle?: string; description?: string; pointsWeight?: number }
            >) || {},
          organization: cust.organization
            ? { id: cust.organization.id, name: cust.organization.name, type: cust.organization.type }
            : null,
        })),
      };
    }),
    currentUserContext: {
      userOrg: userProfile?.organization
        ? {
          id: userProfile.organization.id,
          name: userProfile.organization.name,
          type: userProfile.organization.type,
        }
        : null,
      parentOrg: userProfile?.organization?.parent
        ? {
          id: userProfile.organization.parent.id,
          name: userProfile.organization.parent.name,
          type: userProfile.organization.parent.type,
        }
        : null,
    },
    total,
    page,
    hasMore: skip + items.length < total,
  };
}

/**
 * Membuat Materi Kurikulum Baru (Hanya PJ/Admin)
 */
export async function createMaterial(formData: FormData) {
  try {
    const { user, userProfile, highestTier } = await assertPjOrAdmin();

    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const fileUrl = (formData.get('fileUrl') as string)?.trim() || null;
    const targetGenerationCode = (formData.get('targetGenerationCode') as string)?.trim();
    const isMandatory = formData.get('isMandatory') === 'true';

    const creatorTierLevel = highestTier; // DAERAH, DESA, atau KELOMPOK

    if (!title || !targetGenerationCode) {
      return { error: 'Judul materi dan jenjang generasi wajib diisi.' };
    }

    const generation = await prisma.generation.findUnique({
      where: { code: targetGenerationCode },
    });

    if (!generation) {
      return { error: 'Jenjang generasi tidak ditemukan.' };
    }

    const newMaterial = await prisma.material.create({
      data: {
        title,
        description,
        fileUrl,
        authorId: user.id,
        creatorTierLevel,
        organizationId: userProfile?.organizationId || null,
        targetGenerationId: generation.id,
        isMandatoryForTarget: isMandatory,
        allowedUsageScope: MaterialUsageScope.ALL_TIERS,
      },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    revalidatePath('/dashboard');
    return { success: true, materialId: newMaterial.id };
  } catch (err: any) {
    console.error('Error creating material:', err);
    return { error: err.message || 'Gagal menyimpan materi baru.' };
  }
}

/**
 * Mengubah / Mengedit Materi Kurikulum Asli (Hanya PJ Tingkat Pembuat atau di atasnya)
 */
export async function updateMaterial(formData: FormData) {
  try {
    const { userProfile, highestTier } = await assertPjOrAdmin();

    const materialId = formData.get('materialId') as string;
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const fileUrl = (formData.get('fileUrl') as string)?.trim() || null;
    const targetGenerationCode = (formData.get('targetGenerationCode') as string)?.trim();
    const isMandatory = formData.get('isMandatory') === 'true';
    const upgradeTierLevel = (formData.get('upgradeTierLevel') as TierLevel) || null;

    if (!materialId || !title) {
      return { error: 'ID Materi dan judul materi wajib diisi.' };
    }

    const existing = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!existing) {
      return { error: 'Materi tidak ditemukan.' };
    }

    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };

    const userTierRank = TIER_RANK[highestTier] ?? 1;
    const materialTierRank = TIER_RANK[existing.creatorTierLevel] ?? 1;

    if (userTierRank < materialTierRank) {
      return {
        error:
          'Anda tidak memiliki wewenang mengubah materi baku dari tingkatan di atas Anda. Gunakan fitur Kustomisasi Lokal Versi Anda.',
      };
    }

    let targetGenerationId = existing.targetGenerationId;
    if (targetGenerationCode) {
      const gen = await prisma.generation.findUnique({
        where: { code: targetGenerationCode },
      });
      if (gen) targetGenerationId = gen.id;
    }

    // Logika Upgrade Tingkatan Materi (Promosi dari tingkat bawah ke tingkat di atasnya)
    let isUpgradingTier = false;
    let newCreatorTierLevel: TierLevel = existing.creatorTierLevel;
    let newOrganizationId: string | null = existing.organizationId;

    if (upgradeTierLevel && upgradeTierLevel !== existing.creatorTierLevel) {
      const targetRank = TIER_RANK[upgradeTierLevel];
      if (!targetRank || targetRank <= materialTierRank) {
        return { error: 'Tingkatan upgrade harus lebih tinggi dari tingkatan materi saat ini.' };
      }
      if (userTierRank < targetRank) {
        return {
          error: 'Anda tidak memiliki wewenang untuk meningkatkan materi ke tingkatan di atas Anda.',
        };
      }

      isUpgradingTier = true;
      newCreatorTierLevel = upgradeTierLevel;

      if (upgradeTierLevel === TierLevel.DAERAH) {
        // Tingkat Daerah menjadi master materi (organizationId null)
        newOrganizationId = null;
      } else if (upgradeTierLevel === TierLevel.DESA) {
        if (highestTier === TierLevel.DESA && userProfile?.organizationId) {
          newOrganizationId = userProfile.organizationId;
        } else if (existing.organizationId) {
          const currentOrg = await prisma.organization.findUnique({
            where: { id: existing.organizationId },
            select: { parentId: true, type: true },
          });
          if (currentOrg?.type === OrganizationType.DESA) {
            newOrganizationId = existing.organizationId;
          } else if (currentOrg?.parentId) {
            newOrganizationId = currentOrg.parentId;
          } else if (userProfile?.organizationId) {
            newOrganizationId = userProfile.organizationId;
          }
        }
      }
    }

    await prisma.material.update({
      where: { id: materialId },
      data: {
        title,
        description,
        fileUrl,
        isMandatoryForTarget: isMandatory,
        targetGenerationId,
        ...(isUpgradingTier
          ? {
            creatorTierLevel: newCreatorTierLevel,
            organizationId: newOrganizationId,
          }
          : {}),
      },
    });

    if (isUpgradingTier) {
      // Perbarui seluruh butir capaian bawaan materi ke tingkatan baru
      await prisma.materialChecklistItem.updateMany({
        where: { materialId },
        data: {
          tierLevel: newCreatorTierLevel,
          organizationId: newCreatorTierLevel === TierLevel.DAERAH ? null : newOrganizationId,
        },
      });

      // Bersihkan record kustomisasi lama yang setingkat dengan tingkat baru jika ada
      await prisma.materialCustomization.deleteMany({
        where: {
          materialId,
          tierLevel: newCreatorTierLevel,
        },
      });
    }

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating material:', err);
    return { error: err.message || 'Gagal memperbarui materi.' };
  }
}

/**
 * Menghapus Materi Kurikulum Master beserta seluruh relasinya (Hanya PJ Pembuat/Daerah)
 */
export async function deleteMaterial(materialId: string) {
  try {
    const { highestTier } = await assertPjOrAdmin();

    const existing = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!existing) {
      return { error: 'Materi tidak ditemukan.' };
    }

    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };

    const userTierRank = TIER_RANK[highestTier] ?? 1;
    const materialTierRank = TIER_RANK[existing.creatorTierLevel] ?? 1;

    if (userTierRank < materialTierRank) {
      return { error: 'Anda tidak memiliki hak untuk menghapus materi dari tingkatan di atas Anda.' };
    }

    await prisma.material.delete({
      where: { id: materialId },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting material:', err);
    return { error: err.message || 'Gagal menghapus materi.' };
  }
}

// ==============================================================================
// KUSTOMISASI MATERI LOKAL (LAYERED VERSIONING: DESA & KELOMPOK)
// ==============================================================================

/**
 * Menyimpan / Memperbarui Kustomisasi Informasi Materi (Judul & Deskripsi Lokal)
 * Berlaku untuk Desa atau Kelompok pengguna.
 */
export async function saveMaterialCustomization(formData: FormData) {
  try {
    const { user, userProfile, highestTier } = await assertPjOrAdmin();

    if (!userProfile?.organizationId) {
      return { error: 'Anda belum terdaftar di unit organisasi wilayah mana pun.' };
    }

    const materialId = formData.get('materialId') as string;
    const customTitle = (formData.get('customTitle') as string)?.trim() || null;
    const customDescription = (formData.get('customDescription') as string)?.trim() || null;
    const customFileUrl = (formData.get('customFileUrl') as string)?.trim() || null;

    if (!materialId) {
      return { error: 'ID Materi wajib disertakan.' };
    }

    const material = await prisma.material.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return { error: 'Materi tidak ditemukan.' };
    }

    // Cek apakah materi dibuat oleh tingkatan sendiri / user memiliki otoritas atas materi asli
    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };
    const userRank = TIER_RANK[highestTier] ?? 1;
    const materialRank = TIER_RANK[material.creatorTierLevel] ?? 1;
    const isOwnerOfMaterial = userRank >= materialRank;

    // Jika materi milik sendiri (contoh: PJ Desa mengedit materi Desa):
    // Perbarui materi asli langsung di tabel Material, JANGAN buat record versi/kustomisasi!
    if (isOwnerOfMaterial) {
      await prisma.material.update({
        where: { id: materialId },
        data: {
          ...(customTitle ? { title: customTitle } : {}),
          ...(customDescription !== undefined ? { description: customDescription } : {}),
          ...(customFileUrl !== undefined ? { fileUrl: customFileUrl } : {}),
        },
      });

      revalidatePath('/kurikulum');
      revalidatePath('/presensi');
      return { success: true };
    }

    // Tentukan tingkatan kustomisasi berdasarkan organisasi pengguna
    const tierLevel: TierLevel = highestTier === TierLevel.DESA ? TierLevel.DESA : TierLevel.KELOMPOK;

    const customization = await prisma.materialCustomization.upsert({
      where: {
        materialId_organizationId: {
          materialId,
          organizationId: userProfile.organizationId,
        },
      },
      create: {
        materialId,
        organizationId: userProfile.organizationId,
        tierLevel,
        customTitle,
        customDescription,
        customFileUrl,
        authorId: user.id,
      },
      update: {
        customTitle,
        customDescription,
        customFileUrl,
        authorId: user.id,
      },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true, customization };
  } catch (err: any) {
    console.error('Error saving material customization:', err);
    return { error: err.message || 'Gagal menyimpan penyesuaian materi.' };
  }
}

/**
 * Mereset / Menghapus Seluruh Versi Lokal Materi (Judul, Deskripsi, Override, dan Capaian Tambahan Lokal)
 */
export async function deleteMaterialVersion(materialId: string) {
  try {
    const { userProfile } = await assertPjOrAdmin();

    if (!userProfile?.organizationId) {
      return { error: 'Anda belum terdaftar di unit organisasi wilayah mana pun.' };
    }

    // 1. Hapus record kustomisasi (judul, deskripsi, dan override butir)
    await prisma.materialCustomization.deleteMany({
      where: {
        materialId,
        organizationId: userProfile.organizationId,
      },
    });

    // 2. Hapus seluruh butir sub-capaian tambahan lokal yang dibuat oleh organisasi ini untuk materi ini
    await prisma.materialChecklistItem.deleteMany({
      where: {
        materialId,
        organizationId: userProfile.organizationId,
      },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting material version:', err);
    return { error: err.message || 'Gagal menghapus versi materi.' };
  }
}

export async function resetMaterialCustomization(materialId: string) {
  return deleteMaterialVersion(materialId);
}

/**
 * Mereset Perubahan (Override) Butir Capaian Master pada Versi Wilayah
 */
export async function resetChecklistItemOverride(materialId: string, itemId: string) {
  try {
    const { userProfile } = await assertPjOrAdmin();

    if (!userProfile?.organizationId) {
      return { error: 'Anda belum terdaftar di unit organisasi wilayah mana pun.' };
    }

    const existingCust = await prisma.materialCustomization.findUnique({
      where: {
        materialId_organizationId: {
          materialId,
          organizationId: userProfile.organizationId,
        },
      },
    });

    if (existingCust && existingCust.itemOverrides) {
      const currentOverrides = { ...(existingCust.itemOverrides as Record<string, any>) };
      delete currentOverrides[itemId];

      await prisma.materialCustomization.update({
        where: { id: existingCust.id },
        data: {
          itemOverrides: currentOverrides,
        },
      });
    }

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true };
  } catch (err: any) {
    console.error('Error resetting checklist item override:', err);
    return { error: err.message || 'Gagal mereset butir capaian.' };
  }
}

/**
 * Menyimpan Perubahan (Override) Butir Capaian Master untuk Versi Wilayah
 */
export async function overrideChecklistItem(formData: FormData) {
  try {
    const { user, userProfile, highestTier } = await assertPjOrAdmin();

    if (!userProfile?.organizationId) {
      return { error: 'Anda belum terdaftar di unit organisasi wilayah mana pun.' };
    }

    const materialId = formData.get('materialId') as string;
    const itemId = formData.get('itemId') as string;
    const itemTitle = (formData.get('itemTitle') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const pointsWeight = parseInt((formData.get('pointsWeight') as string) || '10', 10);
    const completionTierLevel =
      (formData.get('completionTierLevel') as CompletionTierLevel) || CompletionTierLevel.ANY_TIER;

    if (!materialId || !itemId || !itemTitle) {
      return { error: 'ID Materi, ID Butir, dan judul capaian wajib diisi.' };
    }

    // Validasi otoritas pengujian
    if (completionTierLevel === CompletionTierLevel.DAERAH_ONLY && highestTier !== TierLevel.DAERAH) {
      return { error: 'Hanya Pengurus Daerah yang dapat mengunci sub-capaian ke tingkat Khusus Daerah .' };
    }

    if (completionTierLevel === CompletionTierLevel.DESA_AND_ABOVE && highestTier === TierLevel.KELOMPOK) {
      return { error: 'Hanya Pengurus Desa ke atas yang dapat mengatur otoritas Khusus Desa.' };
    }

    const tierLevel: TierLevel = highestTier === TierLevel.DESA ? TierLevel.DESA : TierLevel.KELOMPOK;

    const existingCust = await prisma.materialCustomization.findUnique({
      where: {
        materialId_organizationId: {
          materialId,
          organizationId: userProfile.organizationId,
        },
      },
    });

    const currentOverrides: Record<string, any> =
      (existingCust?.itemOverrides as Record<string, any>) || {};

    currentOverrides[itemId] = {
      itemTitle,
      description,
      pointsWeight: Math.max(5, Math.min(pointsWeight, 100)),
      completionTierLevel,
    };

    await prisma.materialCustomization.upsert({
      where: {
        materialId_organizationId: {
          materialId,
          organizationId: userProfile.organizationId,
        },
      },
      create: {
        materialId,
        organizationId: userProfile.organizationId,
        tierLevel,
        authorId: user.id,
        itemOverrides: currentOverrides,
      },
      update: {
        authorId: user.id,
        itemOverrides: currentOverrides,
      },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true };
  } catch (err: any) {
    console.error('Error overriding checklist item:', err);
    return { error: err.message || 'Gagal menyesuaikan butir capaian.' };
  }
}

// ==============================================================================
// PENGELOLAAN BUTIR SUB-CAPAIAN (MASTER & TAMBAHAN LOKAL)
// ==============================================================================

/**
 * Membuat Sub-Capaian Baru (Bisa Master Materi atau Capaian Tambahan Lokal)
 */
export async function createChecklistItem(formData: FormData) {
  try {
    const { userProfile, highestTier } = await assertPjOrAdmin();

    const materialId = formData.get('materialId') as string;
    const itemTitle = (formData.get('itemTitle') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    let completionTierLevel =
      (formData.get('completionTierLevel') as CompletionTierLevel) || CompletionTierLevel.ANY_TIER;
    const pointsWeight = parseInt((formData.get('pointsWeight') as string) || '10', 10);

    if (!materialId || !itemTitle) {
      return { error: 'ID Materi dan judul sub-capaian wajib diisi.' };
    }

    const parentMaterial = await prisma.material.findUnique({
      where: { id: materialId },
      select: { creatorTierLevel: true, organizationId: true },
    });

    if (!parentMaterial) {
      return { error: 'Materi tidak ditemukan.' };
    }

    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };
    const userRank = TIER_RANK[highestTier] ?? 1;
    const materialRank = TIER_RANK[parentMaterial.creatorTierLevel] ?? 1;
    const isOwnerOfMaterial = userRank >= materialRank;

    // Jika materi milik sendiri: item yang ditambahkan adalah butir asli materi, bukan kustomisasi lokal!
    const isExplicitLocal = formData.get('isLocalItem') === 'true';
    const isLocalItem = !isOwnerOfMaterial && (isExplicitLocal || highestTier !== TierLevel.DAERAH);

    // Validasi otoritas pengujian
    if (completionTierLevel === CompletionTierLevel.DAERAH_ONLY && highestTier !== TierLevel.DAERAH) {
      return { error: 'Hanya Pengurus Daerah yang dapat mengunci sub-capaian ke tingkat Khusus Daerah.' };
    }

    if (completionTierLevel === CompletionTierLevel.DESA_AND_ABOVE && highestTier === TierLevel.KELOMPOK) {
      return { error: 'Hanya Pengurus Desa ke atas yang dapat mengatur otoritas Khusus Desa.' };
    }

    const count = await prisma.materialChecklistItem.count({
      where: { materialId },
    });

    const newItem = await prisma.materialChecklistItem.create({
      data: {
        materialId,
        organizationId: isLocalItem
          ? userProfile?.organizationId || null
          : parentMaterial.organizationId,
        tierLevel: isLocalItem ? highestTier : parentMaterial.creatorTierLevel,
        itemTitle,
        description,
        completionTierLevel,
        pointsWeight: Math.max(5, Math.min(pointsWeight, 100)),
        orderIndex: count,
      },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true, item: newItem };
  } catch (err: any) {
    console.error('Error creating checklist item:', err);
    return { error: err.message || 'Gagal menambahkan sub-capaian.' };
  }
}

/**
 * Mengubah / Mengedit Sub-Capaian Materi
 * - Jika materi milik sendiri atau item lokal milik sendiri: perbarui langsung di MaterialChecklistItem.
 * - Jika materi dari tingkatan atas: simpan sebagai override lokal.
 */
export async function updateChecklistItem(formData: FormData) {
  try {
    const { userProfile, highestTier } = await assertPjOrAdmin();

    const itemId = formData.get('itemId') as string;
    const materialId = formData.get('materialId') as string;
    const itemTitle = (formData.get('itemTitle') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    let completionTierLevel =
      (formData.get('completionTierLevel') as CompletionTierLevel) || CompletionTierLevel.ANY_TIER;
    const pointsWeight = parseInt((formData.get('pointsWeight') as string) || '10', 10);

    if (!itemId || !itemTitle) {
      return { error: 'ID Sub-Capaian dan judul wajib diisi.' };
    }

    const existingItem = await prisma.materialChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        material: true,
      },
    });

    if (!existingItem) {
      return { error: 'Sub-capaian tidak ditemukan.' };
    }

    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };
    const userRank = TIER_RANK[highestTier] ?? 1;
    const materialRank = TIER_RANK[existingItem.material.creatorTierLevel] ?? 1;
    const isOwnerOfMaterial = userRank >= materialRank;
    const isOwnLocalItem = existingItem.organizationId === userProfile?.organizationId;

    // Jika user adalah pemilik materi atau pemilik item lokal:
    // Update langsung record MaterialChecklistItem asli!
    if (isOwnerOfMaterial || isOwnLocalItem) {
      // Validasi otoritas pengujian
      if (completionTierLevel === CompletionTierLevel.DAERAH_ONLY && highestTier !== TierLevel.DAERAH) {
        return { error: 'Hanya Pengurus Daerah yang dapat mengunci sub-capaian ke tingkat Khusus Daerah.' };
      }

      if (completionTierLevel === CompletionTierLevel.DESA_AND_ABOVE && highestTier === TierLevel.KELOMPOK) {
        return { error: 'Hanya Pengurus Desa ke atas yang dapat mengatur otoritas Khusus Desa.' };
      }

      await prisma.materialChecklistItem.update({
        where: { id: itemId },
        data: {
          itemTitle,
          description,
          completionTierLevel,
          pointsWeight: Math.max(5, Math.min(pointsWeight, 100)),
        },
      });

      revalidatePath('/kurikulum');
      revalidatePath('/presensi');
      return { success: true };
    }

    // Jika user BUKAN pemilik materi (misal PJ Desa mengedit item materi Daerah):
    // Simpan sebagai penyesuaian lokal (override)!
    return await overrideChecklistItem(formData);
  } catch (err: any) {
    console.error('Error updating checklist item:', err);
    return { error: err.message || 'Gagal memperbarui sub-capaian.' };
  }
}

/**
 * Menghapus Sub-Capaian Materi
 * - Jika materi milik sendiri atau item lokal milik sendiri: hapus permanen dari MaterialChecklistItem.
 */
export async function deleteChecklistItem(itemId: string) {
  try {
    const { userProfile, highestTier } = await assertPjOrAdmin();

    const existingItem = await prisma.materialChecklistItem.findUnique({
      where: { id: itemId },
      include: {
        material: true,
      },
    });

    if (!existingItem) {
      return { error: 'Sub-capaian tidak ditemukan.' };
    }

    const TIER_RANK: Record<TierLevel, number> = {
      [TierLevel.DAERAH]: 3,
      [TierLevel.DESA]: 2,
      [TierLevel.KELOMPOK]: 1,
    };
    const userRank = TIER_RANK[highestTier] ?? 1;
    const materialRank = TIER_RANK[existingItem.material.creatorTierLevel] ?? 1;
    const isOwnerOfMaterial = userRank >= materialRank;
    const isOwnLocalItem = existingItem.organizationId === userProfile?.organizationId;

    if (!isOwnerOfMaterial && !isOwnLocalItem) {
      return { error: 'Anda tidak memiliki hak menghapus capaian dari wilayah/tingkatan di atas Anda.' };
    }

    await prisma.materialChecklistItem.delete({
      where: { id: itemId },
    });

    revalidatePath('/kurikulum');
    revalidatePath('/presensi');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting checklist item:', err);
    return { error: err.message || 'Gagal menghapus sub-capaian.' };
  }
}

/**
 * Mengambil daftar anak (untuk Orang Tua) atau daftar santri di binaan (untuk Pengajar/Wali Kelas)
 * untuk keperluan selektor tinjauan progres capaian kurikulum.
 */
export async function getAvailableStudentsForReview() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { type: 'NONE' as const, students: [] };

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      children: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              generation: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!userProfile) return { type: 'NONE' as const, students: [] };

  const roleCodes = userProfile.roles.map((r) => r.role);

  // 1. Jika Orang Tua: kembalikan anak-anaknya dari student_parent_relations
  if (roleCodes.includes('ORANG_TUA') && userProfile.children.length > 0) {
    return {
      type: 'PARENT' as const,
      students: userProfile.children.map((rel) => ({
        id: rel.student.id,
        fullName: rel.student.fullName,
        avatarUrl: rel.student.avatarUrl,
        generationCode: rel.student.generation?.code || null,
        generationName: rel.student.generation?.name || 'Santri',
      })),
    };
  }

  // 2. Jika Pengajar / Wali Kelas / PJ: ambil santri di organisasinya
  if (
    roleCodes.includes('PENGAJAR') ||
    roleCodes.includes('WALI_KELAS') ||
    roleCodes.includes('PJ_KELOMPOK')
  ) {
    if (!userProfile.organizationId) return { type: 'NONE' as const, students: [] };

    const students = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: 'SANTRI',
          },
        },
        organizationId: userProfile.organizationId,
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        generation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    });

    return {
      type: 'TEACHER' as const,
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        avatarUrl: s.avatarUrl,
        generationCode: s.generation?.code || null,
        generationName: s.generation?.name || 'Santri',
      })),
    };
  }

  return { type: 'NONE' as const, students: [] };
}

/**
 * Mengambil daftar santri dalam suatu kelas binaan tertentu
 * untuk keperluan peninjauan capaian per santri oleh Wali Kelas.
 */
export async function getStudentsByClassId(classId: string) {
  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      generationId: true,
      generation: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  if (!targetClass) return { classInfo: null, students: [] };

  const students = await prisma.user.findMany({
    where: {
      organizationId: targetClass.organizationId,
      generationId: targetClass.generationId,
      roles: {
        some: {
          role: 'SANTRI',
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      generation: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: { fullName: 'asc' },
  });

  return {
    classInfo: {
      id: targetClass.id,
      name: targetClass.name,
      generationCode: targetClass.generation.code,
      generationName: targetClass.generation.name,
    },
    students: students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      avatarUrl: s.avatarUrl,
      generationCode: s.generation?.code || null,
      generationName: s.generation?.name || 'Santri',
    })),
  };
}


