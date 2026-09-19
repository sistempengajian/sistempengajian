import { TierLevel, CompletionTierLevel } from '@prisma/client';

export interface RawChecklistItem {
  id: string;
  materialId: string;
  organizationId: string | null;
  tierLevel?: TierLevel | null;
  itemTitle: string;
  description: string | null;
  completionTierLevel: CompletionTierLevel | string;
  pointsWeight: number;
  orderIndex: number;
}

export interface RawCustomization {
  id: string;
  materialId: string;
  organizationId: string;
  tierLevel: TierLevel;
  customTitle: string | null;
  customDescription: string | null;
  customFileUrl?: string | null;
  excludedItemIds?: string[];
  itemOverrides?: Record<
    string,
    {
      itemTitle?: string;
      description?: string;
      pointsWeight?: number;
      completionTierLevel?: CompletionTierLevel | string;
    }
  > | any;
}

export interface RawMaterialInput {
  id: string;
  title: string;
  description: string | null;
  creatorTierLevel?: TierLevel;
  organizationId?: string | null;
  targetGenerationId: string;
  targetGeneration?: {
    id: string;
    name: string;
    code: string;
  } | null;
  isMandatoryForTarget: boolean;
  checklistItems: RawChecklistItem[];
  customizations?: RawCustomization[];
}

export interface ResolvedChecklistItem {
  id: string;
  materialId: string;
  itemTitle: string;
  description: string | null;
  completionTierLevel: string;
  pointsWeight: number;
  orderIndex: number;
  isOverridden?: boolean;
  overriddenBy?: 'DESA' | 'KELOMPOK';
  isNewLocal?: boolean;
  addedBy?: 'DESA' | 'KELOMPOK';
}

export interface ResolvedMaterial {
  id: string;
  title: string;
  description: string | null;
  targetGenerationId: string;
  targetGeneration?: {
    id: string;
    name: string;
    code: string;
  };
  isMandatoryForTarget: boolean;
  activeVersion: 'ASLI' | 'DESA' | 'KELOMPOK';
  versionLabel: string;
  isCustomized: boolean;
  checklistItems: ResolvedChecklistItem[];
}

export interface ScheduleVersionContext {
  scheduleTierLevel: TierLevel;
  scheduleOrganizationId: string;
  parentOrganizationId?: string | null;
  scheduleOrganizationName?: string;
  parentOrganizationName?: string;
}

/**
 * Menyelaraskan materi kurikulum dan butir capaiannya agar sesuai dengan tingkatan
 * dan organisasi jadwal pengajian aktif (Kelompok, Desa, atau Daerah).
 */
export function resolveMaterialForSchedule(
  material: RawMaterialInput,
  context: ScheduleVersionContext
): ResolvedMaterial {
  const {
    scheduleTierLevel,
    scheduleOrganizationId,
    parentOrganizationId,
    scheduleOrganizationName = '',
    parentOrganizationName = '',
  } = context;

  const customizations = material.customizations || [];
  const checklistItems = material.checklistItems || [];

  // 1. Identifikasi Kustomisasi yang Relevan Berdasarkan Konteks Jadwal
  const kelompokCust =
    scheduleTierLevel === TierLevel.KELOMPOK
      ? customizations.find(
          (c) => c.tierLevel === TierLevel.KELOMPOK && c.organizationId === scheduleOrganizationId
        )
      : undefined;

  const desaCust =
    scheduleTierLevel === TierLevel.KELOMPOK || scheduleTierLevel === TierLevel.DESA
      ? customizations.find(
          (c) =>
            c.tierLevel === TierLevel.DESA &&
            (scheduleTierLevel === TierLevel.DESA
              ? c.organizationId === scheduleOrganizationId
              : parentOrganizationId
              ? c.organizationId === parentOrganizationId
              : false)
        )
      : undefined;

  // 2. Identifikasi Butir Capaian Lokal
  const kelompokLocalItems =
    scheduleTierLevel === TierLevel.KELOMPOK
      ? checklistItems.filter(
          (i) =>
            i.tierLevel === TierLevel.KELOMPOK &&
            i.organizationId === scheduleOrganizationId &&
            i.organizationId !== material.organizationId
        )
      : [];

  const desaLocalItems =
    scheduleTierLevel === TierLevel.KELOMPOK || scheduleTierLevel === TierLevel.DESA
      ? checklistItems.filter(
          (i) =>
            i.tierLevel === TierLevel.DESA &&
            (scheduleTierLevel === TierLevel.DESA
              ? i.organizationId === scheduleOrganizationId
              : parentOrganizationId
              ? i.organizationId === parentOrganizationId
              : false) &&
            i.organizationId !== material.organizationId
        )
      : [];

  // Cek apakah versi kustomisasi aktif
  const hasKelompokCustData = Boolean(
    kelompokCust &&
      (kelompokCust.customTitle ||
        kelompokCust.customDescription ||
        (kelompokCust.itemOverrides && Object.keys(kelompokCust.itemOverrides).length > 0) ||
        (kelompokCust.excludedItemIds && kelompokCust.excludedItemIds.length > 0))
  );
  const hasKelompokVersion =
    scheduleTierLevel === TierLevel.KELOMPOK && (hasKelompokCustData || kelompokLocalItems.length > 0);

  const hasDesaCustData = Boolean(
    desaCust &&
      (desaCust.customTitle ||
        desaCust.customDescription ||
        (desaCust.itemOverrides && Object.keys(desaCust.itemOverrides).length > 0) ||
        (desaCust.excludedItemIds && desaCust.excludedItemIds.length > 0))
  );
  const hasDesaVersion =
    (scheduleTierLevel === TierLevel.KELOMPOK || scheduleTierLevel === TierLevel.DESA) &&
    (hasDesaCustData || desaLocalItems.length > 0);

  // 3. Tentukan Active Version
  let activeVersion: 'ASLI' | 'DESA' | 'KELOMPOK' = 'ASLI';
  let versionLabel = 'Versi Standar';

  if (scheduleTierLevel === TierLevel.KELOMPOK) {
    if (hasKelompokVersion) {
      activeVersion = 'KELOMPOK';
      versionLabel = scheduleOrganizationName ? `Versi ${scheduleOrganizationName}` : 'Versi Kelompok';
    } else if (hasDesaVersion) {
      activeVersion = 'DESA';
      versionLabel = parentOrganizationName ? `Versi ${parentOrganizationName}` : 'Versi Desa';
    }
  } else if (scheduleTierLevel === TierLevel.DESA) {
    if (hasDesaVersion) {
      activeVersion = 'DESA';
      versionLabel = scheduleOrganizationName ? `Versi ${scheduleOrganizationName}` : 'Versi Desa';
    }
  }

  const isCustomized = activeVersion !== 'ASLI';

  // 4. Hitung Judul & Deskripsi Sesuai Versi Aktif
  let activeTitle = material.title;
  let activeDescription = material.description;

  if (activeVersion === 'KELOMPOK') {
    if (kelompokCust?.customTitle) {
      activeTitle = kelompokCust.customTitle;
    } else if (desaCust?.customTitle) {
      activeTitle = desaCust.customTitle;
    }

    if (kelompokCust?.customDescription !== undefined && kelompokCust.customDescription !== null) {
      activeDescription = kelompokCust.customDescription;
    } else if (desaCust?.customDescription !== undefined && desaCust.customDescription !== null) {
      activeDescription = desaCust.customDescription;
    }
  } else if (activeVersion === 'DESA') {
    if (desaCust?.customTitle) {
      activeTitle = desaCust.customTitle;
    }
    if (desaCust?.customDescription !== undefined && desaCust.customDescription !== null) {
      activeDescription = desaCust.customDescription;
    }
  }

  // 5. Hitung Butir Capaian Sesuai Versi Aktif
  const resolvedItems: ResolvedChecklistItem[] = [];

  checklistItems.forEach((item) => {
    const isMaster =
      !item.organizationId ||
      item.tierLevel === TierLevel.DAERAH ||
      (material.organizationId && item.organizationId === material.organizationId);

    const isDesaItem =
      item.tierLevel === TierLevel.DESA &&
      (scheduleTierLevel === TierLevel.DESA
        ? item.organizationId === scheduleOrganizationId
        : parentOrganizationId
        ? item.organizationId === parentOrganizationId
        : false) &&
      item.organizationId !== material.organizationId;

    const isKelompokItem =
      item.tierLevel === TierLevel.KELOMPOK &&
      item.organizationId === scheduleOrganizationId &&
      item.organizationId !== material.organizationId;

    if (activeVersion === 'ASLI') {
      if (isMaster) {
        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: item.itemTitle,
          description: item.description,
          completionTierLevel: item.completionTierLevel,
          pointsWeight: item.pointsWeight,
          orderIndex: item.orderIndex,
        });
      }
      return;
    }

    if (activeVersion === 'DESA') {
      if (isKelompokItem) return;

      if (isMaster) {
        // Cek apakah item dikecualikan oleh Desa
        if (desaCust?.excludedItemIds && desaCust.excludedItemIds.includes(item.id)) {
          return;
        }

        const override = (desaCust?.itemOverrides as Record<string, any>)?.[item.id];
        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: override?.itemTitle || item.itemTitle,
          description: override?.description !== undefined ? override.description : item.description,
          pointsWeight: override?.pointsWeight !== undefined ? override.pointsWeight : item.pointsWeight,
          completionTierLevel: override?.completionTierLevel || item.completionTierLevel,
          orderIndex: item.orderIndex,
          isOverridden: Boolean(override),
          overriddenBy: 'DESA',
        });
      } else if (isDesaItem) {
        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: item.itemTitle,
          description: item.description,
          completionTierLevel: item.completionTierLevel,
          pointsWeight: item.pointsWeight,
          orderIndex: item.orderIndex,
          isNewLocal: true,
          addedBy: 'DESA',
        });
      }
      return;
    }

    if (activeVersion === 'KELOMPOK') {
      if (isMaster) {
        // Cek apakah item dikecualikan oleh Kelompok atau Desa
        const isExcluded =
          Boolean(kelompokCust?.excludedItemIds && kelompokCust.excludedItemIds.includes(item.id)) ||
          Boolean(desaCust?.excludedItemIds && desaCust.excludedItemIds.includes(item.id));

        if (isExcluded) {
          return;
        }

        const overrideDesa = (desaCust?.itemOverrides as Record<string, any>)?.[item.id];
        const overrideKelompok = (kelompokCust?.itemOverrides as Record<string, any>)?.[item.id];
        const activeOverride = overrideKelompok || overrideDesa;

        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: activeOverride?.itemTitle || item.itemTitle,
          description:
            activeOverride?.description !== undefined ? activeOverride.description : item.description,
          pointsWeight:
            activeOverride?.pointsWeight !== undefined ? activeOverride.pointsWeight : item.pointsWeight,
          completionTierLevel: activeOverride?.completionTierLevel || item.completionTierLevel,
          orderIndex: item.orderIndex,
          isOverridden: Boolean(activeOverride),
          overriddenBy: overrideKelompok ? 'KELOMPOK' : overrideDesa ? 'DESA' : undefined,
        });
      } else if (isDesaItem) {
        // Cek apakah butir Desa dikecualikan oleh Kelompok
        if (kelompokCust?.excludedItemIds && kelompokCust.excludedItemIds.includes(item.id)) {
          return;
        }

        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: item.itemTitle,
          description: item.description,
          completionTierLevel: item.completionTierLevel,
          pointsWeight: item.pointsWeight,
          orderIndex: item.orderIndex,
          isNewLocal: true,
          addedBy: 'DESA',
        });
      } else if (isKelompokItem) {
        resolvedItems.push({
          id: item.id,
          materialId: item.materialId,
          itemTitle: item.itemTitle,
          description: item.description,
          completionTierLevel: item.completionTierLevel,
          pointsWeight: item.pointsWeight,
          orderIndex: item.orderIndex,
          isNewLocal: true,
          addedBy: 'KELOMPOK',
        });
      }
    }
  });

  // Urutkan capaian sesuai orderIndex
  resolvedItems.sort((a, b) => a.orderIndex - b.orderIndex);

  return {
    id: material.id,
    title: activeTitle,
    description: activeDescription,
    targetGenerationId: material.targetGenerationId,
    targetGeneration: material.targetGeneration
      ? {
          id: material.targetGeneration.id,
          name: material.targetGeneration.name,
          code: material.targetGeneration.code,
        }
      : undefined,
    isMandatoryForTarget: material.isMandatoryForTarget,
    activeVersion,
    versionLabel,
    isCustomized,
    checklistItems: resolvedItems,
  };
}

/**
 * Helper untuk memproses daftar materi sekaligus
 */
export function resolveMaterialsForSchedule(
  materials: RawMaterialInput[],
  context: ScheduleVersionContext
): ResolvedMaterial[] {
  return materials.map((m) => resolveMaterialForSchedule(m, context));
}
