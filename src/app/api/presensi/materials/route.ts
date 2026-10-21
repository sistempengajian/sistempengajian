import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { TierLevel, Prisma } from '@prisma/client';
import { resolveMaterialsForSchedule } from '@/lib/curriculumVersionResolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scheduleId = searchParams.get('scheduleId');
    const scope = (searchParams.get('scope') || searchParams.get('mode') || 'SCHEDULED').toUpperCase();
    const generationId = searchParams.get('generationId') || undefined;
    const generationIdsParam = searchParams.get('generationIds') || undefined;
    const monthsParam = searchParams.get('months') || undefined;
    const search = searchParams.get('search') || undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, message: 'Schedule ID diperlukan' },
        { status: 400 }
      );
    }

    const { authUser, dbUser } = await getEffectiveAuthUser();

    if (!authUser || !dbUser) {
      return NextResponse.json(
        { success: false, message: 'Tidak terautentikasi' },
        { status: 401 }
      );
    }

    // 1. Ambil konteks jadwal untuk menentukan tier, organisasi, kelas, waktu sesi, dan materi terjadwal
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        startTime: true,
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
          select: {
            materialId: true,
            slotIndex: true,
            material: {
              select: {
                id: true,
                targetGenerationId: true,
              },
            },
          },
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

    const sessionWibDate = new Date(
      schedule.startTime.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    );
    const sessionYear = sessionWibDate.getFullYear();
    const sessionMonth = sessionWibDate.getMonth() + 1; // 1 - 12

    const relevantOrgIds: string[] = [];
    if (schedule.organizationId) relevantOrgIds.push(schedule.organizationId);
    if (schedule.organization?.parentId) relevantOrgIds.push(schedule.organization.parentId);

    const scheduledMaterialIds = schedule.scheduleMaterials.map((sm) => sm.materialId);

    // Identifikasi jenjang yang relevan untuk jadwal/kelas ini
    const relevantGenerationIds = new Set<string>();
    if (schedule.targetGenerations && schedule.targetGenerations.length > 0) {
      schedule.targetGenerations.forEach((g) => relevantGenerationIds.add(g.generationId));
    }
    if (schedule.class?.generationId) {
      relevantGenerationIds.add(schedule.class.generationId);
    }
    if (schedule.targetClasses && schedule.targetClasses.length > 0) {
      schedule.targetClasses.forEach((tc: any) => {
        if (tc.class?.generationId) relevantGenerationIds.add(tc.class.generationId);
      });
    }

    // Resolusi generationId spesifik jika diberikan studentId
    let studentGenId: string | undefined = undefined;
    if (studentId) {
      const studentObj = await prisma.user.findUnique({
        where: { id: studentId },
        select: { generationId: true },
      });
      if (studentObj?.generationId) {
        studentGenId = studentObj.generationId;
      }
    }

    const targetGenId =
      generationId && generationId !== 'ALL'
        ? generationId
        : studentGenId ||
          schedule.class?.generationId ||
          Array.from(relevantGenerationIds)[0];

    // Ambil target materi bulanan kalender sesuai bulan/tahun sesi ini
    const monthlyTargetsThisMonth = await prisma.materialMonthlyTarget.findMany({
      where: {
        year: sessionYear,
        month: sessionMonth,
        isActive: true,
        OR: [
          { organizationId: null },
          { tierLevel: 'DAERAH' },
          ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
        ],
      },
      select: {
        materialId: true,
        orderIndex: true,
        generationId: true,
        month: true,
      },
      orderBy: { orderIndex: 'asc' },
    });

    const monthlyTargetMaterialIds = monthlyTargetsThisMonth.map((t) => t.materialId);
    const monthlyTargetIdSet = new Set(monthlyTargetMaterialIds);
    const monthlyTargetOrderMap = new Map<string, number>();
    monthlyTargetsThisMonth.forEach((t) => monthlyTargetOrderMap.set(t.materialId, t.orderIndex));

    // Filter lanjutan multi-select jenjang dan bulan
    const filterGenIds = generationIdsParam
      ? generationIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
      : generationId && generationId !== 'ALL'
        ? [generationId]
        : [];

    const filterMonths = monthsParam
      ? monthsParam
          .split(',')
          .map((m) => parseInt(m.trim(), 10))
          .filter((m) => !isNaN(m) && m >= 1 && m <= 12)
      : [];

    const isAdvancedFilterActive = filterGenIds.length > 0 || filterMonths.length > 0;

    // 2. Susun Prisma where clause
    const baseOrgFilter: Prisma.MaterialWhereInput = {
      isActive: true,
      OR: [
        { organizationId: null },
        { creatorTierLevel: TierLevel.DAERAH },
        ...(relevantOrgIds.length > 0 ? [{ organizationId: { in: relevantOrgIds } }] : []),
      ],
    };

    let whereClause: any = {
      ...baseOrgFilter,
    };

    if (isAdvancedFilterActive) {
      // Mode Filter Lanjutan: Multi-Jenjang & Multi-Bulan langsung dari seluruh kurikulum database
      if (filterGenIds.length > 0) {
        whereClause.targetGenerationId = { in: filterGenIds };
      }
      if (filterMonths.length > 0) {
        whereClause.monthlyTargets = {
          some: {
            month: { in: filterMonths },
            isActive: true,
          },
        };
      }
    } else if (scope === 'SCHEDULED') {
      // 4. JADWAL: materi bulanan sesuai jenjang santri + materi tambahan/umum dalam sesi
      const genMatchingScheduledIds = schedule.scheduleMaterials
        .filter((sm) => !sm.material?.targetGenerationId || (targetGenId && sm.material.targetGenerationId === targetGenId))
        .map((sm) => sm.materialId);

      const genMatchingMonthlyTargetIds = targetGenId
        ? monthlyTargetsThisMonth.filter((t) => t.generationId === targetGenId).map((t) => t.materialId)
        : monthlyTargetMaterialIds;

      const activeScheduleIds = Array.from(
        new Set([...genMatchingScheduledIds, ...genMatchingMonthlyTargetIds])
      );

      whereClause = {
        isActive: true,
        id: { in: activeScheduleIds.length > 0 ? activeScheduleIds : ['__NONE__'] },
      };
    } else if (scope === 'MONTHLY') {
      // 3. BULANAN: semua materi yang terdaftar dalam bulan ini sesuai jenjang santri
      const genMatchingMonthlyTargetIds = targetGenId
        ? monthlyTargetsThisMonth.filter((t) => t.generationId === targetGenId).map((t) => t.materialId)
        : monthlyTargetMaterialIds;

      whereClause = {
        isActive: true,
        id: { in: genMatchingMonthlyTargetIds.length > 0 ? genMatchingMonthlyTargetIds : ['__NONE__'] },
      };
    } else if (scope === 'ADDITIONAL') {
      // 5. TAMBAHAN: materi umum sesi (!targetGenerationId) ATAU materi terjadwal yang bukan target bulanan
      const additionalIds = schedule.scheduleMaterials
        .filter((sm) => {
          const isGeneral = !sm.material?.targetGenerationId;
          const isNotMonthly = !monthlyTargetIdSet.has(sm.materialId);
          return isGeneral || isNotMonthly;
        })
        .map((sm) => sm.materialId);

      whereClause = {
        isActive: true,
        id: { in: additionalIds.length > 0 ? additionalIds : ['__NONE__'] },
      };
    } else if (scope === 'GENERATION') {
      // 2. JENJANG: semua materi kurikulum sesuai jenjang santri (tidak dibatasi target bulanan)
      whereClause = {
        ...baseOrgFilter,
        targetGenerationId: targetGenId || { in: Array.from(relevantGenerationIds) },
      };
    } else if (scope === 'ALL') {
      // 1. SEMUA: semua materi semua jenjang
      whereClause = {
        ...baseOrgFilter,
      };
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
              targetGeneration: {
                name: { contains: q, mode: 'insensitive' },
              },
            },
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

    // Mode SCHEDULED, MONTHLY, ADDITIONAL, GENERATION, & Filter Lanjutan memuat penuh (hingga 100 materi); mode ALL paginasi
    const isFullLoadMode =
      scope !== 'ALL' || isAdvancedFilterActive || (search && search.trim().length > 0);
    const takeAmount = isFullLoadMode ? Math.max(total, 50) : limit;
    const skipAmount = isFullLoadMode ? 0 : (page - 1) * limit;

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
        monthlyTargets: {
          select: { month: true, year: true, generationId: true },
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
    schedule.scheduleMaterials.forEach((sm) => {
      scheduleMaterialMap.set(sm.materialId, sm.slotIndex);
    });

    const items = baseResolved
      .map((m) => {
        const isMonthlyTarget = monthlyTargetIdSet.has(m.id);
        const isScheduled = scheduleMaterialMap.has(m.id) || isMonthlyTarget;
        const slotIndex = scheduleMaterialMap.get(m.id);
        return {
          ...m,
          isScheduled,
          isMonthlyTarget,
          slotIndex: isScheduled ? slotIndex : undefined,
          monthlyTargets: (m as any).monthlyTargets || [],
        };
      })
      .sort((a, b) => {
        const aMonthlyOrder = monthlyTargetOrderMap.has(a.id) ? monthlyTargetOrderMap.get(a.id)! : 999;
        const bMonthlyOrder = monthlyTargetOrderMap.has(b.id) ? monthlyTargetOrderMap.get(b.id)! : 999;
        if (aMonthlyOrder !== bMonthlyOrder) return aMonthlyOrder - bMonthlyOrder;

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

    // Kumpulkan studentIds untuk query progress
    const studentIds = studentId ? [studentId] : [];

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

    // 7. Agregasi hitungan akurat langsung dari database untuk 5 cakupan materi
    const [countAll, countGeneration, countMonthly, countScheduled, countAdditional] = await Promise.all([
      // 1. SEMUA: Seluruh materi kurikulum aktif lembaga
      prisma.material.count({
        where: baseOrgFilter,
      }),
      // 2. JENJANG: Semua materi kurikulum jenjang santri aktif
      targetGenId
        ? prisma.material.count({
            where: {
              ...baseOrgFilter,
              targetGenerationId: targetGenId,
            },
          })
        : Promise.resolve(0),
      // 3. BULANAN: Materi target bulanan jenjang santri di bulan sesi ini
      targetGenId
        ? prisma.material.count({
            where: {
              isActive: true,
              targetGenerationId: targetGenId,
              monthlyTargets: {
                some: {
                  month: sessionMonth,
                  year: sessionYear,
                  generationId: targetGenId,
                  isActive: true,
                },
              },
            },
          })
        : Promise.resolve(0),
      // 4. JADWAL: Materi terjadwal + materi bulanan santri aktif
      (() => {
        const schedIds = schedule.scheduleMaterials
          .filter((sm) => !sm.material?.targetGenerationId || (targetGenId && sm.material.targetGenerationId === targetGenId))
          .map((sm) => sm.materialId);
        const monthIds = targetGenId
          ? monthlyTargetsThisMonth.filter((t) => t.generationId === targetGenId).map((t) => t.materialId)
          : [];
        const combined = Array.from(new Set([...schedIds, ...monthIds]));
        return Promise.resolve(combined.length);
      })(),
      // 5. TAMBAHAN: Materi umum atau materi terjadwal yang bukan target bulanan
      (() => {
        const addIds = schedule.scheduleMaterials
          .filter((sm) => !sm.material?.targetGenerationId || !monthlyTargetIdSet.has(sm.materialId))
          .map((sm) => sm.materialId);
        return Promise.resolve(addIds.length);
      })(),
    ]);

    const counts = {
      ALL: countAll,
      GENERATION: countGeneration,
      MONTHLY: countMonthly,
      SCHEDULED: countScheduled,
      ADDITIONAL: countAdditional,
    };

    const hasMore = isFullLoadMode ? false : page * limit < total;

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
      counts,
      sessionMonth,
      sessionYear,
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
