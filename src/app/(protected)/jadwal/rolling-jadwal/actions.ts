'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ScheduleType, TierLevel } from '@prisma/client';
import { getScopedOrganizationIds } from '@/lib/scoped-access';
import {
  generateRollingScheduleSessions,
  type GeneratorInput,
  type GeneratorResult,
} from '@/lib/rollingScheduleGenerator';

// ── Helper: get auth context ──────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true, roles: { select: { role: true } } },
  });
  if (!dbUser || !dbUser.organizationId) throw new Error('User profile not found');

  return {
    ...dbUser,
    organizationId: dbUser.organizationId as string,
    roleCodes: dbUser.roles.map((r) => r.role),
  };
}

/** Dapatkan array orgId yang diizinkan (null = global). Jika null, skip filter. */
async function getScopedOrgFilter(
  ctx: { roleCodes: import('@prisma/client').UserRole[]; organizationId: string }
): Promise<string[]> {
  const ids = await getScopedOrganizationIds(ctx.roleCodes, ctx.organizationId);
  return ids ?? [];
}

// ── getRollingPengajianForSchedule ────────────────────────────────────────────

/**
 * Mengambil daftar blueprint RollingPengajian yang tersedia untuk
 * wilayah pengguna aktif, lengkap dengan detail antrian materi & pengajar.
 */
export async function getRollingPengajianForSchedule() {
  try {
    const ctx = await getAuthContext();
    const orgIds = await getScopedOrgFilter(ctx);

    const blueprints = await prisma.rollingPengajian.findMany({
      where: { organizationId: { in: orgIds.length > 0 ? orgIds : undefined }, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        targetScope: true,
        tierLevel: true,
        organizationId: true,
        venuePlaceName: true,
        venueType: true,
        materialRolling: {
          select: {
            id: true,
            name: true,
            rollingType: true,
            itemsPerSession: true,
            queues: {
              orderBy: { stepOrder: 'asc' },
              select: {
                id: true,
                stepOrder: true,
                title: true,
                items: {
                  orderBy: { slotIndex: 'asc' },
                  select: {
                    slotIndex: true,
                    materialId: true,
                    material: { select: { title: true } },
                  },
                },
              },
            },
          },
        },
        teacherRolling: {
          select: {
            id: true,
            name: true,
            rollingType: true,
            teachersPerSession: true,
            queues: {
              orderBy: { stepOrder: 'asc' },
              select: {
                id: true,
                stepOrder: true,
                title: true,
                items: {
                  orderBy: { slotIndex: 'asc' },
                  select: {
                    slotIndex: true,
                    teacherId: true,
                    substituteTeacherId: true,
                    teacher: { select: { fullName: true } },
                    substituteTeacher: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
        targetClasses: {
          select: {
            classId: true,
            class: { select: { name: true, generation: { select: { name: true } } } },
          },
        },
        targetGenerations: {
          select: {
            generationId: true,
            generation: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: blueprints };
  } catch (error) {
    console.error('[getRollingPengajianForSchedule]', error);
    return { success: false, error: (error as Error).message };
  }
}

// ── previewRollingScheduleSessions ───────────────────────────────────────────

export interface PreviewInput {
  rollingPengajianId: string;
  selectedDays: number[];
  startTime: string;
  endTime: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  startMaterialStep?: number;
  startTeacherStep?: number;
}

/**
 * Dry-run: menghitung sesi yang akan dibuat tanpa menyimpan ke DB.
 * Mengembalikan GeneratorResult untuk ditampilkan di preview UI.
 */
export async function previewRollingScheduleSessions(
  input: PreviewInput
): Promise<{ success: boolean; data?: GeneratorResult; error?: string }> {
  try {
    const ctx = await getAuthContext();
    const orgIds = await getScopedOrgFilter(ctx);

    const bp = await prisma.rollingPengajian.findFirst({
      where: { id: input.rollingPengajianId, organizationId: { in: orgIds.length > 0 ? orgIds : undefined } },
      select: {
        id: true,
        name: true,
        targetScope: true,
        tierLevel: true,
        organizationId: true,
        venuePlaceName: true,
        venueType: true,
        materialRolling: {
          select: {
            id: true,
            rollingType: true,
            itemsPerSession: true,
            queues: {
              orderBy: { stepOrder: 'asc' },
              select: {
                stepOrder: true,
                title: true,
                items: {
                  orderBy: { slotIndex: 'asc' },
                  select: {
                    slotIndex: true,
                    materialId: true,
                    material: { select: { title: true } },
                  },
                },
              },
            },
          },
        },
        teacherRolling: {
          select: {
            id: true,
            rollingType: true,
            teachersPerSession: true,
            queues: {
              orderBy: { stepOrder: 'asc' },
              select: {
                stepOrder: true,
                title: true,
                items: {
                  orderBy: { slotIndex: 'asc' },
                  select: {
                    slotIndex: true,
                    teacherId: true,
                    substituteTeacherId: true,
                    teacher: { select: { fullName: true } },
                    substituteTeacher: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
        targetClasses: {
          select: { classId: true, class: { select: { name: true } } },
        },
        targetGenerations: {
          select: { generationId: true, generation: { select: { name: true } } },
        },
      },
    });

    if (!bp) return { success: false, error: 'Blueprint tidak ditemukan' };

    const generatorInput: GeneratorInput = {
      blueprint: {
        id: bp.id,
        name: bp.name,
        targetScope: bp.targetScope,
        organizationId: bp.organizationId,
        tierLevel: bp.tierLevel,
        venuePlaceName: bp.venuePlaceName,
        venueType: bp.venueType,
        materialRolling: {
          id: bp.materialRolling.id,
          rollingType: bp.materialRolling.rollingType,
          itemsPerSession: bp.materialRolling.itemsPerSession,
          queues: bp.materialRolling.queues.map((q) => ({
            stepOrder: q.stepOrder,
            title: q.title,
            items: q.items.map((i) => ({
              slotIndex: i.slotIndex,
              materialId: i.materialId,
              materialTitle: i.material.title,
            })),
          })),
        },
        teacherRolling: {
          id: bp.teacherRolling.id,
          rollingType: bp.teacherRolling.rollingType,
          teachersPerSession: bp.teacherRolling.teachersPerSession,
          queues: bp.teacherRolling.queues.map((q) => ({
            stepOrder: q.stepOrder,
            title: q.title,
            items: q.items.map((i) => ({
              slotIndex: i.slotIndex,
              teacherId: i.teacherId,
              teacherName: i.teacher.fullName,
              substituteTeacherId: i.substituteTeacherId,
              substituteTeacherName: i.substituteTeacher?.fullName ?? null,
            })),
          })),
        },
        targetClasses: bp.targetClasses.map((tc) => ({
          classId: tc.classId,
          className: tc.class.name,
        })),
        targetGenerations: bp.targetGenerations.map((tg) => ({
          generationId: tg.generationId,
          generationName: tg.generation.name,
        })),
      },
      selectedDays: input.selectedDays,
      startTime: input.startTime,
      endTime: input.endTime,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      startMaterialStep: input.startMaterialStep ?? 0,
      startTeacherStep: input.startTeacherStep ?? 0,
    };

    const result = generateRollingScheduleSessions(generatorInput);
    return { success: true, data: result };
  } catch (error) {
    console.error('[previewRollingScheduleSessions]', error);
    return { success: false, error: (error as Error).message };
  }
}

// ── generateAndSaveRollingSchedule ───────────────────────────────────────────

/**
 * Generate sesi dan simpan ke DB dalam satu transaksi Prisma.
 */
export async function generateAndSaveRollingSchedule(
  input: PreviewInput & { overrideVenuePlaceName?: string; overrideVenueType?: string }
): Promise<{ success: boolean; batchId?: string; totalCreated?: number; error?: string }> {
  try {
    await getAuthContext();

    // Ambil blueprint (sama dengan preview, tapi di sini kita jalankan generator ulang dengan batchId baru)
    const previewResult = await previewRollingScheduleSessions(input);
    if (!previewResult.success || !previewResult.data) {
      return { success: false, error: previewResult.error };
    }

    const { batchId, sessions } = previewResult.data;
    if (sessions.length === 0) {
      return { success: false, error: 'Tidak ada sesi yang dapat dibuat. Periksa rentang tanggal dan hari yang dipilih.' };
    }

    // Simpan dalam transaksi dengan timeout 60 detik untuk mendukung batch besar
    await prisma.$transaction(
      async (tx) => {
        for (const session of sessions) {
          const created = await tx.schedule.create({
            data: {
              title: session.title,
              scheduleType: ScheduleType.REGULAR_ROUTINE,
              tierLevel: session.tierLevel as TierLevel,
              organizationId: session.organizationId,
              classId: session.classId,
              targetScope: session.targetScope,
              venuePlaceName: input.overrideVenuePlaceName ?? session.venuePlaceName,
              venueType: input.overrideVenueType ?? session.venueType,
              startTime: session.startTime,
              endTime: session.endTime,
              rollingPengajianId: session.rollingPengajianId,
              rollingBatchId: batchId,
              rollingMaterialStepOrder: session.rollingMaterialStepOrder,
              rollingTeacherStepOrder: session.rollingTeacherStepOrder,
            },
          });

          // Buat ScheduleClass entries untuk seluruh kelas peserta gabungan
          if (session.targetClassIds && session.targetClassIds.length > 0) {
            await tx.scheduleClass.createMany({
              data: session.targetClassIds.map((cid) => ({
                scheduleId: created.id,
                classId: cid,
              })),
            });
          }

          // Buat ScheduleGeneration entries jika targetScope GENERASI
          if (session.targetGenerationIds && session.targetGenerationIds.length > 0) {
            await tx.scheduleGeneration.createMany({
              data: session.targetGenerationIds.map((gid) => ({
                scheduleId: created.id,
                generationId: gid,
              })),
            });
          }

          // Buat ScheduleTeacher entries
          const teachersData = [
            {
              scheduleId: created.id,
              teacherId: session.primaryTeacherId,
              isPrimary: true,
              isSubstitute: false,
            },
          ];
          if (session.substituteTeacherId) {
            teachersData.push({
              scheduleId: created.id,
              teacherId: session.substituteTeacherId,
              isPrimary: false,
              isSubstitute: true,
            });
          }
          await tx.scheduleTeacher.createMany({
            data: teachersData,
          });

          // Buat ScheduleMaterial entries via createMany
          if (session.scheduleMaterials.length > 0) {
            await tx.scheduleMaterial.createMany({
              data: session.scheduleMaterials.map((mat) => ({
                scheduleId: created.id,
                materialId: mat.materialId,
                slotIndex: mat.slotIndex,
              })),
            });
          }
        }
      },
      { maxWait: 20000, timeout: 60000 }
    );

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-jadwal');
    return { success: true, batchId, totalCreated: sessions.length };
  } catch (error) {
    console.error('[generateAndSaveRollingSchedule]', error);
    return { success: false, error: (error as Error).message };
  }
}

// ── getRollingJadwalBatches ───────────────────────────────────────────────────

/**
 * Mengambil daftar batch yang sudah pernah dibuat, dikelompokkan per batchId.
 */
export async function getRollingJadwalBatches(
  userCtx?: { userId: string; organizationId: string; roleCodes: import('@prisma/client').UserRole[] }
) {
  try {
    const ctx = userCtx
      ? { id: userCtx.userId, organizationId: userCtx.organizationId, roleCodes: userCtx.roleCodes }
      : await getAuthContext();
    const orgIds = await getScopedOrgFilter(ctx);

    // Ambil semua schedule dengan rollingBatchId, lalu group di memory
    const schedules = await prisma.schedule.findMany({
      where: {
        organizationId: { in: orgIds.length > 0 ? orgIds : undefined },
        rollingBatchId: { not: null },
      },
      select: {
        id: true,
        rollingBatchId: true,
        rollingPengajianId: true,
        startTime: true,
        endTime: true,
        classId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch blueprint names separately
    const blueprintIds = [...new Set(schedules.map((s) => s.rollingPengajianId).filter(Boolean) as string[])];
    const blueprintNames = blueprintIds.length > 0
      ? await prisma.rollingPengajian.findMany({
          where: { id: { in: blueprintIds } },
          select: { id: true, name: true },
        })
      : [];
    const blueprintNameMap = new Map(blueprintNames.map((b) => [b.id, b.name]));

    // Group by batchId
    const batches = new Map<
      string,
      {
        batchId: string;
        blueprintName: string;
        rollingPengajianId: string | null;
        totalSessions: number;
        firstSession: Date;
        lastSession: Date;
        createdAt: Date;
      }
    >();

    for (const s of schedules) {
      const bId = s.rollingBatchId!;
      if (!batches.has(bId)) {
        batches.set(bId, {
          batchId: bId,
          blueprintName: blueprintNameMap.get(s.rollingPengajianId ?? '') ?? 'Blueprint tidak diketahui',
          rollingPengajianId: s.rollingPengajianId,
          totalSessions: 0,
          firstSession: s.startTime,
          lastSession: s.startTime,
          createdAt: s.createdAt,
        });
      }
      const b = batches.get(bId)!;
      b.totalSessions++;
      if (s.startTime < b.firstSession) b.firstSession = s.startTime;
      if (s.startTime > b.lastSession) b.lastSession = s.startTime;
    }

    return { success: true, data: Array.from(batches.values()) };
  } catch (error) {
    console.error('[getRollingJadwalBatches]', error);
    return { success: false, error: (error as Error).message };
  }
}

// ── deleteRollingJadwalBatch ──────────────────────────────────────────────────

/**
 * Hapus semua sesi Schedule dalam satu batch rolling berdasarkan batchId.
 */
export async function deleteRollingJadwalBatch(batchId: string) {
  try {
    const ctx = await getAuthContext();
    const orgIds = await getScopedOrgFilter(ctx);

    const deleted = await prisma.schedule.deleteMany({
      where: {
        rollingBatchId: batchId,
        organizationId: orgIds.length > 0 ? { in: orgIds } : undefined,
      },
    });

    revalidatePath('/jadwal');
    revalidatePath('/jadwal/rolling-jadwal');
    return { success: true, deletedCount: deleted.count };
  } catch (error) {
    console.error('[deleteRollingJadwalBatch]', error);
    return { success: false, error: (error as Error).message };
  }
}
