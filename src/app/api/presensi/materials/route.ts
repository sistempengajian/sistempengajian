import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { resolveMaterialsForSchedule } from '@/lib/curriculumVersionResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scheduleId = searchParams.get('scheduleId');
    const mode = (searchParams.get('mode') || 'ALL').toUpperCase(); // 'SCHEDULED' | 'GENERATION' | 'ALL'
    const generationId = searchParams.get('generationId') || undefined;
    const search = searchParams.get('search') || undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '5', 10)));

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, message: 'Schedule ID diperlukan' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Tidak terautentikasi' },
        { status: 401 }
      );
    }

    // 1. Ambil konteks jadwal untuk menentukan tier, organisasi, kelas, dan materi terjadwal
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        tierLevel: true,
        organizationId: true,
        classId: true,
        organization: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
        class: {
          select: {
            id: true,
            generationId: true,
            organizationId: true,
          },
        },
        targetClasses: {
          select: {
            class: {
              select: {
                id: true,
                generationId: true,
                organizationId: true,
              },
            },
          },
        },
        targetGenerations: {
          select: { generationId: true },
        },
        scheduleMaterials: {
          select: { materialId: true, slotIndex: true },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, message: 'Jadwal tidak ditemukan' },
        { status: 404 }
      );
    }

    const relevantOrgIds: string[] = [];
    if (schedule.organizationId) relevantOrgIds.push(schedule.organizationId);
    if (schedule.organization?.parentId) relevantOrgIds.push(schedule.organization.parentId);

    const scheduledMaterialIds = schedule.scheduleMaterials.map((sm: { materialId: string }) => sm.materialId);

    // Identifikasi jenjang yang relevan untuk jadwal/kelas ini
    const relevantGenerationIds = new Set<string>();
    if (schedule.targetGenerations && schedule.targetGenerations.length > 0) {
      schedule.targetGenerations.forEach((g: { generationId: string }) => relevantGenerationIds.add(g.generationId));
    }
    if (schedule.class?.generationId) {
      relevantGenerationIds.add(schedule.class.generationId);
    }

    // 2. Susun Prisma where clause
    let whereClause: any = {
      isActive: true,
      OR: [
        { organizationId: null },
        { creatorTierLevel: 'DAERAH' },
        ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
      ],
    };

    if (mode === 'SCHEDULED') {
      whereClause = {
        isActive: true,
        id: { in: scheduledMaterialIds },
      };
    } else if (mode === 'GENERATION') {
      const targetGenId =
        generationId ||
        schedule.class?.generationId ||
        Array.from(relevantGenerationIds)[0];

      if (targetGenId) {
        whereClause.targetGenerationId = targetGenId;
      } else if (relevantGenerationIds.size > 0) {
        whereClause.targetGenerationId = { in: Array.from(relevantGenerationIds) };
      }
    } else if (mode === 'ALL') {
      if (generationId && generationId !== 'ALL') {
        whereClause.targetGenerationId = generationId;
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            {
              checklistItems: {
                some: {
                  itemTitle: { contains: q, mode: 'insensitive' },
                },
              },
            },
          ],
        },
      ];
    }

    // 3. Hitung total data yang cocok
    const total = await prisma.material.count({ where: whereClause });

    // Mode SCHEDULED memuat seluruh materi jadwal sekaligus; mode GENERATION dan ALL memuat paginasi
    const isScheduledMode = mode === 'SCHEDULED';
    const takeAmount = isScheduledMode ? Math.max(scheduledMaterialIds.length, 1) : limit;
    const skipAmount = isScheduledMode ? 0 : (page - 1) * limit;

    // 4. Query materi dengan checklist items dan customizations
    const rawMaterials = await prisma.material.findMany({
      where: whereClause,
      skip: skipAmount,
      take: takeAmount,
      include: {
        targetGeneration: {
          select: { id: true, name: true, code: true },
        },
        checklistItems: {
          where: {
            OR: [
              { organizationId: null },
              { tierLevel: 'DAERAH' },
              ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
            ],
          },
          orderBy: { orderIndex: 'asc' },
        },
        customizations: {
          where:
            relevantOrgIds.length > 0
              ? { organizationId: { in: relevantOrgIds } }
              : undefined,
        },
      },
      orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
    });

    // 5. Terapkan resolver kustomisasi kurikulum per tingkat pengajian
    const baseResolved = resolveMaterialsForSchedule(rawMaterials as any, {
      scheduleTierLevel: schedule.tierLevel,
      scheduleOrganizationId: schedule.organizationId,
      parentOrganizationId: schedule.organization?.parentId || null,
      scheduleOrganizationName: schedule.organization?.name || '',
      parentOrganizationName: schedule.organization?.parent?.name || '',
    });

    const scheduleMaterialMap = new Map<string, number>();
    schedule.scheduleMaterials.forEach((sm: { materialId: string; slotIndex: number }) => {
      scheduleMaterialMap.set(sm.materialId, sm.slotIndex);
    });

    const items = baseResolved
      .map((m) => {
        const isScheduled = scheduleMaterialMap.has(m.id);
        const slotIndex = scheduleMaterialMap.get(m.id);
        return {
          ...m,
          isScheduled,
          slotIndex: isScheduled ? slotIndex : undefined,
        };
      })
      .sort((a, b) => {
        if (a.isScheduled && !b.isScheduled) return -1;
        if (!a.isScheduled && b.isScheduled) return 1;
        if (a.isScheduled && b.isScheduled) {
          return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
        }
        return 0;
      });

    // 6. Ambil progres capaian santri untuk checklist yang baru dimuat
    const relevantChecklistItemIds: string[] = [];
    items.forEach((m) => {
      m.checklistItems.forEach((ci) => relevantChecklistItemIds.push(ci.id));
    });

    // Dapatkan daftar santri yang relevan di kelas atau sesi ini
    const targetClassesMap = new Map<
      string,
      { id: string; organizationId: string; generationId: string }
    >();

    if (schedule.class) {
      targetClassesMap.set(schedule.class.id, {
        id: schedule.class.id,
        organizationId: schedule.class.organizationId,
        generationId: schedule.class.generationId,
      });
    }

    if (schedule.targetClasses && schedule.targetClasses.length > 0) {
      for (const tc of schedule.targetClasses) {
        if (tc.class) {
          targetClassesMap.set(tc.class.id, {
            id: tc.class.id,
            organizationId: tc.class.organizationId,
            generationId: tc.class.generationId,
          });
        }
      }
    }

    const targetClassesList = Array.from(targetClassesMap.values());

    const studentWhere: any = {
      roles: {
        some: { role: 'SANTRI' },
      },
    };

    if (targetClassesList.length > 0) {
      studentWhere.OR = targetClassesList.map((c) => ({
        organizationId: c.organizationId,
        generationId: c.generationId,
      }));
    } else {
      const orgIds: string[] = [schedule.organizationId];
      if (schedule.tierLevel === 'DESA') {
        const subOrgs = await prisma.organization.findMany({
          where: { parentId: schedule.organizationId },
          select: { id: true },
        });
        orgIds.push(...subOrgs.map((o) => o.id));
      } else if (schedule.tierLevel === 'DAERAH') {
        const desaOrgs = await prisma.organization.findMany({
          where: { parentId: schedule.organizationId },
          select: { id: true },
        });
        const desaIds = desaOrgs.map((o) => o.id);
        orgIds.push(...desaIds);
        if (desaIds.length > 0) {
          const kelompokOrgs = await prisma.organization.findMany({
            where: { parentId: { in: desaIds } },
            select: { id: true },
          });
          orgIds.push(...kelompokOrgs.map((o) => o.id));
        }
      }

      studentWhere.organizationId = { in: orgIds };

      if (schedule.targetGenerations && schedule.targetGenerations.length > 0) {
        studentWhere.generationId = {
          in: schedule.targetGenerations.map((g: { generationId: string }) => g.generationId),
        };
      }
    }

    const studentsInClass = await prisma.user.findMany({
      where: studentWhere,
      select: { id: true },
    });

    const studentIds = Array.from(
      new Set([
        ...studentsInClass.map((s: { id: string }) => s.id),
        ...(studentId ? [studentId] : []),
      ])
    );

    const progress =
      relevantChecklistItemIds.length > 0 && studentIds.length > 0
        ? await prisma.materialChecklistProgress.findMany({
            where: {
              studentId: { in: studentIds },
              checklistItemId: { in: relevantChecklistItemIds },
            },
            select: {
              checklistItemId: true,
              studentId: true,
              score: true,
              isCompleted: true,
              teacherFeedback: true,
              evaluatedAt: true,
            },
          })
        : [];

    const hasMore = isScheduledMode ? false : page * limit < total;

    return NextResponse.json({
      success: true,
      items,
      progress: progress.map((p) => ({
        ...p,
        evaluatedAt: p.evaluatedAt.toISOString(),
      })),
      total,
      hasMore,
      page,
    });
  } catch (error: any) {
    console.error('Error fetching presensi materials:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal memuat materi kurikulum presensi',
      },
      { status: 500 }
    );
  }
}
