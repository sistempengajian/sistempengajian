'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { RollingIntervalType, TierLevel, UserRole } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import { resolveMaterialForSchedule } from '@/lib/curriculumVersionResolver';

export interface QueueItemInput {
  slotIndex: number;
  materialId: string;
}

export interface QueueStepInput {
  stepOrder: number;
  title?: string | null;
  items: QueueItemInput[];
}

export interface MaterialRollingInput {
  name: string;
  rollingType: RollingIntervalType;
  itemsPerSession: number;
  targetGenerationId?: string | null;
  queues: QueueStepInput[];
}

export interface ServerUserContext {
  userId: string;
  organizationId?: string | null;
  roleCodes: UserRole[];
}

/**
 * Mengambil daftar Rolling Materi dalam lingkup organisasi user
 */
export async function getMaterialRollings(
  targetGenerationId?: string,
  userCtx?: ServerUserContext
) {
  let organizationId = userCtx?.organizationId;
  let roleCodes = userCtx?.roleCodes;

  if (!organizationId || !roleCodes) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Anda harus login untuk mengakses data ini.', data: [] };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: true,
        organization: true,
      },
    });

    if (!userProfile?.organizationId) {
      return { error: 'Pengguna tidak terdaftar dalam wilayah.', data: [] };
    }

    organizationId = userProfile.organizationId;
    roleCodes = userProfile.roles.map((r) => r.role as UserRole);
  }

  const scopedOrgIds = await getScopedOrganizationIds(roleCodes, organizationId);

  const whereClause: any = {};
  if (scopedOrgIds !== null) {
    whereClause.organizationId = { in: scopedOrgIds };
  }

  if (targetGenerationId && targetGenerationId !== 'ALL') {
    whereClause.targetGenerationId = targetGenerationId;
  }

  if (!(prisma as any).materialRolling) {
    console.warn('prisma.materialRolling is not loaded yet in this process. Please restart dev server.');
    return { data: [], error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  const rollings = await prisma.materialRolling.findMany({
    where: whereClause,
    include: {
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
      queues: {
        orderBy: { stepOrder: 'asc' },
        include: {
          items: {
            orderBy: { slotIndex: 'asc' },
            include: {
              material: {
                select: {
                  id: true,
                  title: true,
                  creatorTierLevel: true,
                  organizationId: true,
                  targetGeneration: {
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return { data: rollings };
}

/**
 * Mengambil daftar materi yang tersedia untuk dipilih ke dalam antrean rolling
 * dengan resolusi versi otomatis sesuai tingkatan organisasi user
 */
export async function getAvailableMaterialsForRolling(generationId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengakses materi.', data: [] };
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

  if (!userProfile?.organization) {
    return { error: 'Wilayah pengguna tidak ditemukan.', data: [] };
  }

  const userTierLevel = userProfile.organization.type as TierLevel;

  const whereClause: any = {
    isActive: true,
  };

  if (generationId && generationId !== 'ALL') {
    whereClause.targetGenerationId = generationId;
  }

  // Materi yang boleh diakses: materi jenjang user atau yang scope-nya ALL_TIERS / sesuai tier
  const rawMaterials = await prisma.material.findMany({
    where: whereClause,
    include: {
      targetGeneration: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      checklistItems: true,
      customizations: true,
    },
    orderBy: [
      { creatorTierLevel: 'asc' },
      { title: 'asc' },
    ],
  });

  // Terapkan resolusi versi kurikulum wilayah
  const resolvedMaterials = rawMaterials.map((mat) => {
    const resolved = resolveMaterialForSchedule(mat as any, {
      scheduleTierLevel: userTierLevel,
      scheduleOrganizationId: userProfile.organization!.id,
      parentOrganizationId: userProfile.organization!.parentId,
      scheduleOrganizationName: userProfile.organization!.name,
      parentOrganizationName: userProfile.organization!.parent?.name,
    });

    return {
      id: mat.id,
      rawTitle: mat.title,
      resolvedTitle: resolved.title,
      creatorTierLevel: mat.creatorTierLevel,
      activeVersion: resolved.activeVersion,
      versionLabel: resolved.versionLabel,
      isCustomized: resolved.isCustomized,
      targetGenerationId: mat.targetGenerationId,
      targetGeneration: mat.targetGeneration,
      organization: mat.organization,
    };
  });

  return { data: resolvedMaterials };
}

/**
 * Membuat data Rolling Materi baru beserta antrean dan slot materinya
 */
export async function createMaterialRolling(input: MaterialRollingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk membuat rolling materi.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama rolling materi wajib diisi.' };
  }

  if (input.itemsPerSession < 1) {
    return { error: 'Jumlah materi per pengajian minimal 1.' };
  }

  if (!input.queues || input.queues.length < 2) {
    return { error: 'Daftar antrean materi minimal harus memiliki 2 antrean.' };
  }

  // Validasi setiap antrean harus memiliki materi yang dipilih
  for (let i = 0; i < input.queues.length; i++) {
    const q = input.queues[i];
    if (!q.items || q.items.length === 0) {
      return { error: `Antrean ke-${i + 1} belum memiliki materi yang dipilih.` };
    }
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      organization: true,
      roles: true,
    },
  });

  if (!userProfile?.organization) {
    return { error: 'Organisasi wilayah pengguna tidak ditemukan.' };
  }

  const tierLevel = userProfile.organization.type as TierLevel;

  if (!(prisma as any).materialRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    const createdRolling = await prisma.$transaction(
      async (tx) => {
        // 1. Buat master rolling
        const rolling = await tx.materialRolling.create({
          data: {
            name,
            rollingType: input.rollingType || RollingIntervalType.PER_PENGAJIAN,
            itemsPerSession: input.itemsPerSession,
            tierLevel,
            organizationId: userProfile.organizationId!,
            targetGenerationId: input.targetGenerationId || null,
          },
        });

        // 2. Buat queues dan items
        for (let qIdx = 0; qIdx < input.queues.length; qIdx++) {
          const qInput = input.queues[qIdx];
          const queue = await tx.materialRollingQueue.create({
            data: {
              rollingId: rolling.id,
              stepOrder: qIdx + 1,
              title: qInput.title || `Antrean #${qIdx + 1}`,
            },
          });

          // 3. Masukkan slot materi via createMany
          const validItems = qInput.items
            .map((it, sIdx) => ({
              queueId: queue.id,
              slotIndex: sIdx,
              materialId: it.materialId,
            }))
            .filter((it) => !!it.materialId);

          if (validItems.length > 0) {
            await tx.materialRollingQueueItem.createMany({
              data: validItems,
            });
          }
        }

        return rolling;
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-materi');
    return { success: true, data: createdRolling };
  } catch (err: any) {
    console.error('Error creating material rolling:', err);
    return { error: err.message || 'Gagal menyimpan rolling materi.' };
  }
}

/**
 * Mengedit data Rolling Materi beserta pembaharuan antrean dan slot materinya
 */
export async function updateMaterialRolling(id: string, input: MaterialRollingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk mengedit rolling materi.' };
  }

  const name = input.name?.trim();
  if (!name) {
    return { error: 'Nama rolling materi wajib diisi.' };
  }

  if (input.itemsPerSession < 1) {
    return { error: 'Jumlah materi per pengajian minimal 1.' };
  }

  if (!input.queues || input.queues.length < 2) {
    return { error: 'Daftar antrean materi minimal harus memiliki 2 antrean.' };
  }

  if (!(prisma as any).materialRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Update master rolling
        await tx.materialRolling.update({
          where: { id },
          data: {
            name,
            rollingType: input.rollingType,
            itemsPerSession: input.itemsPerSession,
            targetGenerationId: input.targetGenerationId || null,
          },
        });

        // 2. Hapus queues lama (cascade items)
        await tx.materialRollingQueue.deleteMany({
          where: { rollingId: id },
        });

        // 3. Masukkan queues dan items baru via createMany
        for (let qIdx = 0; qIdx < input.queues.length; qIdx++) {
          const qInput = input.queues[qIdx];
          const queue = await tx.materialRollingQueue.create({
            data: {
              rollingId: id,
              stepOrder: qIdx + 1,
              title: qInput.title || `Antrean #${qIdx + 1}`,
            },
          });

          const validItems = qInput.items
            .map((it, sIdx) => ({
              queueId: queue.id,
              slotIndex: sIdx,
              materialId: it.materialId,
            }))
            .filter((it) => !!it.materialId);

          if (validItems.length > 0) {
            await tx.materialRollingQueueItem.createMany({
              data: validItems,
            });
          }
        }
      },
      { maxWait: 15000, timeout: 30000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-materi');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating material rolling:', err);
    return { error: err.message || 'Gagal memperbarui rolling materi.' };
  }
}

/**
 * Menghapus data Rolling Materi
 */
export async function deleteMaterialRolling(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Anda harus login untuk menghapus rolling materi.' };
  }

  if (!(prisma as any).materialRolling) {
    return { error: 'Model baru belum terdeteksi pada server dev. Silakan restart npm run dev.' };
  }

  try {
    await prisma.materialRolling.delete({
      where: { id },
    });

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-materi');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting material rolling:', err);
    return { error: err.message || 'Gagal menghapus rolling materi.' };
  }
}
