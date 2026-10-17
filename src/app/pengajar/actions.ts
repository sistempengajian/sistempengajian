'use server';

import prisma from '@/lib/prisma';
import { verifyTeacherLessonPlanToken } from '@/lib/studentAbsenceToken';
import { revalidatePath } from 'next/cache';

function formatIndonesianDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function formatIndonesianTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

export interface ChecklistItemMetric {
  id: string;
  materialId: string;
  itemTitle: string;
  description: string | null;
  pointsWeight: number;
  orderIndex: number;
  completionTierLevel: string;
  completedStudentsCount: number;
  totalStudentsInGen: number;
  masteryPercentage: number;
  isPlanned: boolean;
}

export interface MaterialMetric {
  id: string;
  title: string;
  description: string | null;
  fileUrl?: string | null;
  isMandatory: boolean;
  isFallback: boolean;
  orderIndex: number;
  circlePercentage: number;
  completedStudentsCount: number;
  totalStudentsInGen: number;
  checklistItems: ChecklistItemMetric[];
}

export interface GenerationTabPlan {
  generationId: string;
  generationName: string;
  generationCode: string;
  isGeneralTab?: boolean;
  totalStudentsCount: number;
  totalMaterialsCount: number;
  materials: MaterialMetric[];
}

export interface TeacherLessonPlanData {
  success: boolean;
  error?: string;
  schedule?: {
    id: string;
    title: string;
    dayDate: string;
    startTime: string;
    endTime: string;
    venuePlaceName: string;
    organizationName: string;
    status: string;
    isCompletedSession: boolean;
    plannedChecklistItemIds: string[];
    teacherBroadcastNote: string;
  };
  teacher?: {
    id: string;
    fullName: string;
    isSubstitute: boolean;
    isPrimary: boolean;
  };
  tabs?: GenerationTabPlan[];
}

/**
 * 1. Mengambil data rencana ajar sesi, multi-jenjang tabs, circle progress bar, dan ketuntasan santri
 */
export async function getTeacherLessonPlanData(token: string): Promise<TeacherLessonPlanData> {
  const verified = verifyTeacherLessonPlanToken(token);
  if (!verified.valid || !verified.scheduleId || !verified.teacherUserId) {
    return {
      success: false,
      error: verified.error || 'Tautan rencana ajar tidak sah atau telah kedaluwarsa (berlaku 72 jam).',
    };
  }

  try {
    const [schedule, teacherUser] = await Promise.all([
      prisma.schedule.findUnique({
        where: { id: verified.scheduleId },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              parentId: true,
              parent: { select: { id: true, parentId: true } },
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              generationId: true,
              generation: { select: { id: true, name: true, code: true } },
            },
          },
          targetClasses: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  generationId: true,
                  generation: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
          targetGenerations: {
            include: {
              generation: { select: { id: true, name: true, code: true } },
            },
          },
          teachers: {
            where: { teacher: { status: 'ACTIVE' } },
            include: {
              teacher: { select: { id: true, fullName: true, gender: true } },
            },
          },
          scheduleMaterials: {
            include: {
              material: {
                include: {
                  checklistItems: {
                    orderBy: { orderIndex: 'asc' },
                  },
                },
              },
            },
            orderBy: { slotIndex: 'asc' },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: verified.teacherUserId },
        select: { id: true, fullName: true, gender: true },
      }),
    ]);

    if (!schedule || !teacherUser) {
      return {
        success: false,
        error: 'Data jadwal pengajian atau akun pengajar tidak ditemukan.',
      };
    }

    const currentTeacherSt = schedule.teachers.find((t) => t.teacher.id === teacherUser.id);
    const dayDate = formatIndonesianDate(schedule.startTime);
    const startTimeStr = formatIndonesianTime(schedule.startTime);
    const endTimeStr = formatIndonesianTime(schedule.endTime);

    // Hitung tahun & bulan pelaksanaan jadwal dalam WIB
    const wibDate = new Date(schedule.startTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const targetYear = wibDate.getFullYear();
    const targetMonth = wibDate.getMonth() + 1; // 1-12

    // 1. Kumpulkan seluruh Jenjang Target di Jadwal
    const genMap = new Map<string, { id: string; name: string; code: string }>();

    if (schedule.class?.generation) {
      genMap.set(schedule.class.generation.id, schedule.class.generation);
    }

    for (const tc of schedule.targetClasses) {
      if (tc.class?.generation) {
        genMap.set(tc.class.generation.id, tc.class.generation);
      }
    }

    for (const tg of schedule.targetGenerations) {
      if (tg.generation) {
        genMap.set(tg.generation.id, tg.generation);
      }
    }

    const targetGenerations = Array.from(genMap.values());
    const targetGenIds = targetGenerations.map((g) => g.id);

    // Kumpulkan seluruh ID Kelas yang menjadi target
    const targetClassIds = [
      schedule.classId,
      ...schedule.targetClasses.map((tc) => tc.classId),
    ].filter(Boolean) as string[];

    // 2. Kueri seluruh santri binaan aktif yang relevan dengan jadwal
    const activeStudents = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: {
          some: {
            role: 'SANTRI',
          },
        },
        ...(targetGenIds.length > 0 ? { generationId: { in: targetGenIds } } : {}),
        ...(schedule.organizationId ? { organizationId: schedule.organizationId } : {}),
      },
      select: {
        id: true,
        fullName: true,
        generationId: true,
      },
    });

    const studentsByGen = new Map<string, Array<{ id: string; fullName: string }>>();
    for (const s of activeStudents) {
      if (!s.generationId) continue;
      const list = studentsByGen.get(s.generationId) || [];
      list.push(s);
      studentsByGen.set(s.generationId, list);
    }

    const relevantOrgIds: string[] = [];
    if (schedule.organizationId) {
      relevantOrgIds.push(schedule.organizationId);
    }
    if (schedule.organization?.parentId) {
      relevantOrgIds.push(schedule.organization.parentId);
    }
    if (schedule.organization?.parent?.parentId) {
      relevantOrgIds.push(schedule.organization.parent.parentId);
    }

    // 3. Kueri Materi Bulanan Target (MaterialMonthlyTarget)
    // Mendukung target master baku tingkat DAERAH, organisasi terkait (kelompok/desa/daerah), maupun umum
    const monthlyTargets = targetGenIds.length > 0
      ? await prisma.materialMonthlyTarget.findMany({
          where: {
            year: targetYear,
            month: targetMonth,
            isActive: true,
            generationId: { in: targetGenIds },
            OR: [
              { organizationId: null },
              { tierLevel: 'DAERAH' },
              ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
            ],
          },
          include: {
            material: {
              include: {
                checklistItems: {
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
            generation: true,
          },
          orderBy: { orderIndex: 'asc' },
        })
      : [];

    // Fallback: Untuk jenjang yang belum memiliki target bulanan, ambil materi kurikulum aktif
    const fallbackMaterialsByGen = new Map<string, any[]>();
    for (const gen of targetGenerations) {
      const hasTarget = monthlyTargets.some((mt) => mt.generationId === gen.id);
      if (!hasTarget) {
        const fallbacks = await prisma.material.findMany({
          where: {
            targetGenerationId: gen.id,
            isActive: true,
          },
          include: {
            checklistItems: {
              orderBy: { orderIndex: 'asc' },
            },
          },
          take: 6,
          orderBy: { createdAt: 'desc' },
        });
        fallbackMaterialsByGen.set(gen.id, fallbacks);
      }
    }

    // 4. Kueri Kemajuan Santri Secara Batch Paralel (Zero N+1)
    const allChecklistItems: Array<{ id: string; materialId: string }> = [];

    // Dari target bulanan
    for (const mt of monthlyTargets) {
      for (const item of mt.material.checklistItems) {
        allChecklistItems.push({ id: item.id, materialId: mt.materialId });
      }
    }

    // Dari materi fallback
    for (const [_, mats] of fallbackMaterialsByGen.entries()) {
      for (const m of mats) {
        for (const item of m.checklistItems) {
          allChecklistItems.push({ id: item.id, materialId: m.id });
        }
      }
    }

    // Dari materi umum jadwal (scheduleMaterials)
    for (const sm of schedule.scheduleMaterials) {
      for (const item of sm.material.checklistItems) {
        allChecklistItems.push({ id: item.id, materialId: sm.material.id });
      }
    }

    const allChecklistItemIds = Array.from(new Set(allChecklistItems.map((i) => i.id)));
    const allStudentIds = activeStudents.map((s) => s.id);

    const progressRecords = allChecklistItemIds.length > 0 && allStudentIds.length > 0
      ? await prisma.materialChecklistProgress.findMany({
          where: {
            checklistItemId: { in: allChecklistItemIds },
            studentId: { in: allStudentIds },
            isCompleted: true,
          },
          select: {
            checklistItemId: true,
            studentId: true,
          },
        })
      : [];

    // Pemetaan: checklistItemId -> Set<studentId>
    const itemCompletionsMap = new Map<string, Set<string>>();
    for (const prog of progressRecords) {
      let set = itemCompletionsMap.get(prog.checklistItemId);
      if (!set) {
        set = new Set();
        itemCompletionsMap.set(prog.checklistItemId, set);
      }
      set.add(prog.studentId);
    }

    // 5. Rakit Tab Navigasi Per Jenjang
    const plannedSet = new Set(schedule.plannedChecklistItemIds || []);
    const tabs: GenerationTabPlan[] = [];

    for (const gen of targetGenerations) {
      const genStudents = studentsByGen.get(gen.id) || [];
      const totalStudentsInGen = genStudents.length;
      const genStudentIdsSet = new Set(genStudents.map((s) => s.id));

      // Ambil materi untuk jenjang ini (deduplikasi materi jika ada penetapan bertingkat)
      const genTargets = monthlyTargets.filter((mt) => mt.generationId === gen.id);
      let rawMaterials: Array<{ material: any; isFallback: boolean; orderIndex: number }> = [];

      if (genTargets.length > 0) {
        const seenMatIds = new Set<string>();
        const uniqueGenTargets = [];
        for (const t of genTargets) {
          if (!seenMatIds.has(t.materialId)) {
            seenMatIds.add(t.materialId);
            uniqueGenTargets.push(t);
          }
        }

        rawMaterials = uniqueGenTargets.map((t) => ({
          material: t.material,
          isFallback: false,
          orderIndex: t.orderIndex,
        }));
      } else {
        const fallbacks = fallbackMaterialsByGen.get(gen.id) || [];
        rawMaterials = fallbacks.map((m, idx) => ({
          material: m,
          isFallback: true,
          orderIndex: idx,
        }));
      }

      const materialMetrics: MaterialMetric[] = rawMaterials.map(({ material, isFallback, orderIndex }) => {
        const items = material.checklistItems || [];

        const checklistMetrics: ChecklistItemMetric[] = items.map((item: any) => {
          const completedSet = itemCompletionsMap.get(item.id) || new Set();
          // Hitung berapa santri dalam jenjang ini yang tuntas
          let completedInGen = 0;
          for (const sId of completedSet) {
            if (genStudentIdsSet.has(sId)) {
              completedInGen++;
            }
          }

          const masteryPct = totalStudentsInGen > 0
            ? Math.round((completedInGen / totalStudentsInGen) * 100)
            : 0;

          return {
            id: item.id,
            materialId: material.id,
            itemTitle: item.itemTitle,
            description: item.description,
            pointsWeight: item.pointsWeight,
            orderIndex: item.orderIndex,
            completionTierLevel: item.completionTierLevel,
            completedStudentsCount: completedInGen,
            totalStudentsInGen,
            masteryPercentage: masteryPct,
            isPlanned: plannedSet.has(item.id),
          };
        });

        // Hitung persentase circle progress bar materi
        const totalItemsCount = checklistMetrics.length;
        const totalPossibleCompletions = totalItemsCount * totalStudentsInGen;
        let sumActualCompletions = 0;
        for (const cm of checklistMetrics) {
          sumActualCompletions += cm.completedStudentsCount;
        }

        const circlePct = totalPossibleCompletions > 0
          ? Math.min(100, Math.round((sumActualCompletions / totalPossibleCompletions) * 100))
          : 0;

        // Hitung berapa santri yang tuntas seluruh item dalam materi ini
        let studentsCompletedAll = 0;
        if (totalItemsCount > 0 && totalStudentsInGen > 0) {
          for (const s of genStudents) {
            const hasCompletedAll = items.every((it: any) => {
              const cSet = itemCompletionsMap.get(it.id);
              return cSet && cSet.has(s.id);
            });
            if (hasCompletedAll) studentsCompletedAll++;
          }
        }

        return {
          id: material.id,
          title: material.title,
          description: material.description,
          fileUrl: material.fileUrl,
          isMandatory: material.isMandatoryForTarget || false,
          isFallback,
          orderIndex,
          circlePercentage: circlePct,
          completedStudentsCount: studentsCompletedAll,
          totalStudentsInGen,
          checklistItems: checklistMetrics,
        };
      });

      tabs.push({
        generationId: gen.id,
        generationName: gen.name,
        generationCode: gen.code,
        isGeneralTab: false,
        totalStudentsCount: totalStudentsInGen,
        totalMaterialsCount: materialMetrics.length,
        materials: materialMetrics,
      });
    }

    // Tab Tambahan: Materi Umum Sesi (jika ada materi umum dari scheduleMaterials yang belum masuk)
    if (schedule.scheduleMaterials.length > 0) {
      const existingMaterialIds = new Set<string>();
      for (const tab of tabs) {
        for (const m of tab.materials) {
          existingMaterialIds.add(m.id);
        }
      }

      const generalScheduleMaterials = schedule.scheduleMaterials.filter(
        (sm) => !existingMaterialIds.has(sm.material.id)
      );

      if (generalScheduleMaterials.length > 0) {
        const totalAllActiveStudents = activeStudents.length;
        const allStudentIdsSet = new Set(allStudentIds);

        const generalMaterialMetrics: MaterialMetric[] = generalScheduleMaterials.map((sm, idx) => {
          const material = sm.material;
          const items = material.checklistItems || [];

          const checklistMetrics: ChecklistItemMetric[] = items.map((item: any) => {
            const completedSet = itemCompletionsMap.get(item.id) || new Set();
            let completedCount = 0;
            for (const sId of completedSet) {
              if (allStudentIdsSet.has(sId)) completedCount++;
            }

            const masteryPct = totalAllActiveStudents > 0
              ? Math.round((completedCount / totalAllActiveStudents) * 100)
              : 0;

            return {
              id: item.id,
              materialId: material.id,
              itemTitle: item.itemTitle,
              description: item.description,
              pointsWeight: item.pointsWeight,
              orderIndex: item.orderIndex,
              completionTierLevel: item.completionTierLevel,
              completedStudentsCount: completedCount,
              totalStudentsInGen: totalAllActiveStudents,
              masteryPercentage: masteryPct,
              isPlanned: plannedSet.has(item.id),
            };
          });

          const totalItemsCount = checklistMetrics.length;
          const totalPossible = totalItemsCount * totalAllActiveStudents;
          let sumActual = 0;
          for (const cm of checklistMetrics) sumActual += cm.completedStudentsCount;

          const circlePct = totalPossible > 0 ? Math.min(100, Math.round((sumActual / totalPossible) * 100)) : 0;

          let studentsAll = 0;
          if (totalItemsCount > 0 && totalAllActiveStudents > 0) {
            for (const s of activeStudents) {
              const completedAll = items.every((it: any) => itemCompletionsMap.get(it.id)?.has(s.id));
              if (completedAll) studentsAll++;
            }
          }

          return {
            id: material.id,
            title: material.title,
            description: material.description || sm.notes,
            fileUrl: material.fileUrl,
            isMandatory: false,
            isFallback: false,
            orderIndex: sm.slotIndex ?? idx,
            circlePercentage: circlePct,
            completedStudentsCount: studentsAll,
            totalStudentsInGen: totalAllActiveStudents,
            checklistItems: checklistMetrics,
          };
        });

        tabs.push({
          generationId: 'GENERAL_TAB',
          generationName: 'Materi Umum Sesi',
          generationCode: 'UMUM',
          isGeneralTab: true,
          totalStudentsCount: totalAllActiveStudents,
          totalMaterialsCount: generalMaterialMetrics.length,
          materials: generalMaterialMetrics,
        });
      }
    }

    return {
      success: true,
      schedule: {
        id: schedule.id,
        title: schedule.title,
        dayDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venuePlaceName: schedule.venuePlaceName || 'Masjid Kelompok',
        organizationName: schedule.organization.name,
        status: schedule.status,
        isCompletedSession: schedule.status === 'COMPLETED',
        plannedChecklistItemIds: schedule.plannedChecklistItemIds || [],
        teacherBroadcastNote: schedule.teacherBroadcastNote || '',
      },
      teacher: {
        id: teacherUser.id,
        fullName: teacherUser.fullName,
        isSubstitute: currentTeacherSt?.isSubstitute || false,
        isPrimary: currentTeacherSt?.isPrimary || false,
      },
      tabs,
    };
  } catch (err: any) {
    console.error('[getTeacherLessonPlanData Error]:', err);
    return {
      success: false,
      error: 'Terjadi kesalahan sistem saat memuat rencana ajar pengajar.',
    };
  }
}

/**
 * 2. Toggle pemilihan capaian yang direncanakan untuk diajarkan pada sesi ini
 */
export async function togglePlannedChecklistItem(token: string, checklistItemId: string) {
  const verified = verifyTeacherLessonPlanToken(token);
  if (!verified.valid || !verified.scheduleId) {
    return { success: false, error: 'Sesi token tidak valid atau kedaluwarsa.' };
  }

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: verified.scheduleId },
      select: { id: true, status: true, plannedChecklistItemIds: true },
    });

    if (!schedule) {
      return { success: false, error: 'Jadwal pengajian tidak ditemukan.' };
    }

    if (schedule.status === 'COMPLETED') {
      return {
        success: false,
        error: 'Sesi pengajian ini telah selesai, rencana ajar tidak dapat diubah kembali.',
      };
    }

    const currentList = schedule.plannedChecklistItemIds || [];
    let updatedList: string[];
    let isPlannedNow: boolean;

    if (currentList.includes(checklistItemId)) {
      updatedList = currentList.filter((id) => id !== checklistItemId);
      isPlannedNow = false;
    } else {
      updatedList = [...currentList, checklistItemId];
      isPlannedNow = true;
    }

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { plannedChecklistItemIds: updatedList },
    });

    try {
      revalidatePath('/pengajar/sesi/[token]', 'page');
      revalidatePath('/presensi');
    } catch (e) {
      console.warn('[revalidatePath warning]:', e);
    }

    return {
      success: true,
      isPlanned: isPlannedNow,
      plannedChecklistItemIds: updatedList,
    };
  } catch (err: any) {
    console.error('[togglePlannedChecklistItem Error]:', err);
    return { success: false, error: err?.message || 'Gagal memperbarui rencana capaian ajar.' };
  }
}

/**
 * 3. Simpan catatan opsional pengajar untuk santri / orang tua
 */
export async function saveTeacherBroadcastNote(token: string, note: string) {
  const verified = verifyTeacherLessonPlanToken(token);
  if (!verified.valid || !verified.scheduleId) {
    return { success: false, error: 'Sesi token tidak valid atau kedaluwarsa.' };
  }

  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: verified.scheduleId },
      select: { id: true, status: true },
    });

    if (!schedule) {
      return { success: false, error: 'Jadwal pengajian tidak ditemukan.' };
    }

    if (schedule.status === 'COMPLETED') {
      return {
        success: false,
        error: 'Sesi pengajian ini telah selesai.',
      };
    }

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { teacherBroadcastNote: note.trim() || null },
    });

    try {
      revalidatePath('/pengajar/sesi/[token]', 'page');
    } catch (e) {
      console.warn('[revalidatePath warning]:', e);
    }

    return {
      success: true,
      message: 'Catatan pesan pengajar berhasil disimpan.',
    };
  } catch (err: any) {
    console.error('[saveTeacherBroadcastNote Error]:', err);
    return { success: false, error: err?.message || 'Gagal menyimpan catatan pesan pengajar.' };
  }
}
