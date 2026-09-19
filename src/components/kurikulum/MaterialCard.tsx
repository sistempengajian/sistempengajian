'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  CheckCircle2,
  Plus,
  ChevronDown,
  Pencil,
  Trash2,
  FileText,
  ExternalLink,
  Layers,
  MessageSquare,
  Check,
  Star,
} from 'lucide-react';
import MaterialCustomizeModal from './MaterialCustomizeModal';
import CircularProgressBar from './CircularProgressBar';

export interface ChecklistItemGroupProgress {
  totalStudents: number;
  completedCount: number;
  percentage: number;
  averageScore: number;
}

export interface ChecklistItemData {
  id: string;
  materialId?: string;
  itemTitle: string;
  description: string | null;
  completionTierLevel: string;
  pointsWeight: number;
  orderIndex?: number;
  organizationId?: string | null;
  tierLevel?: string;
  isOverridden?: boolean;
  overriddenBy?: 'DESA' | 'KELOMPOK';
  isNewLocal?: boolean;
  addedBy?: 'DESA' | 'KELOMPOK';
  originalItemTitle?: string;
  originalDescription?: string | null;
  originalPointsWeight?: number;
  originalCompletionTierLevel?: string;
  organization?: {
    id?: string;
    name: string;
    type?: string;
  } | null;
  studentProgress?: {
    id: string;
    score: number | null;
    teacherFeedback: string | null;
    feedbackTags: string[];
    isCompleted: boolean;
    evaluatedAt: string | null;
  } | null;
  groupProgress?: ChecklistItemGroupProgress | null;
}

export interface MaterialCustomizationData {
  id: string;
  materialId: string;
  organizationId: string;
  tierLevel: 'DESA' | 'KELOMPOK';
  customTitle?: string | null;
  customDescription?: string | null;
  customFileUrl?: string | null;
  excludedItemIds?: string[];
  itemOverrides?: Record<
    string,
    {
      itemTitle?: string;
      description?: string;
      pointsWeight?: number;
      completionTierLevel?: string;
    }
  >;
  organization?: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export interface MaterialProgressSummary {
  totalItems: number;
  completedItems: number;
  averageScore: number;
  percentage: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  totalStudents?: number;
  completedStudents?: number;
  scopeLabel?: string;
  isGroupView?: boolean;
}

export interface MaterialData {
  id: string;
  title: string;
  description: string | null;
  fileUrl?: string | null;
  creatorTierLevel: string;
  isMandatoryForTarget: boolean;
  allowedUsageScope?: string;
  organizationId?: string | null;
  organization?: {
    id?: string;
    name: string;
    type?: string;
  } | null;
  targetGeneration?: {
    id?: string;
    name: string;
    code: string;
  } | null;
  checklistItems: ChecklistItemData[];
  customizations?: MaterialCustomizationData[];
  progressSummary?: MaterialProgressSummary | null;
}

interface MaterialCardProps {
  material: MaterialData;
  canManage?: boolean; // Hanya true untuk PJ / Admin Master
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  userOrganizationId?: string | null;
  userOrganizationName?: string;
  parentOrganizationName?: string;
  onEditMaterial?: (material: MaterialData) => void;
  onDeleteMaterial?: (materialId: string, title: string) => void;
  onDeleteVersion?: (materialId: string, title: string) => void;
  onAddChecklistItem?: (materialId: string, isLocal?: boolean, isOwner?: boolean) => void;
  onEditChecklistItem?: (materialId: string, item: ChecklistItemData, isOwner?: boolean) => void;
  onDeleteChecklistItem?: (itemId: string, title: string) => void;
  onRefresh?: () => void;
}

export default function MaterialCard({
  material,
  canManage = false,
  userTierLevel,
  userOrganizationId,
  userOrganizationName = '',
  parentOrganizationName = '',
  onEditMaterial,
  onDeleteMaterial,
  onDeleteVersion,
  onAddChecklistItem,
  onEditChecklistItem,
  onDeleteChecklistItem,
  onRefresh,
}: MaterialCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const versionDropdownRef = useRef<HTMLDivElement>(null);

  // Bobot hierarki tingkatan: DAERAH (3) > DESA (2) > KELOMPOK (1)
  const TIER_RANK: Record<string, number> = {
    DAERAH: 3,
    DESA: 2,
    KELOMPOK: 1,
  };

  const userRank = userTierLevel ? (TIER_RANK[userTierLevel] ?? 0) : 0;
  const materialRank = TIER_RANK[material.creatorTierLevel] ?? 1;

  // Cek wewenang atas materi asli:
  // 1. Jika materi dibuat di tingkat lebih bawah (userRank > materialRank):
  //    Tingkat atas (misal Daerah atas materi Desa/Kelompok, atau Desa atas materi Kelompok)
  //    memiliki hak akses penuh sebagai pemilik materi asli (edit asli full akses, tidak dapat edit versi).
  // 2. Jika materi dibuat di tingkat yang sama (userRank === materialRank):
  //    - Daerah: seluruh admin/PJ Daerah dapat mengelola materi Daerah (userRank >= 3).
  //    - Desa / Kelompok: hanya dapat dikelola jika berasal dari organisasi yang sama (isSameOrg).
  // 3. Jika materi dibuat di tingkat lebih atas (userRank < materialRank):
  //    Hanya dapat melihat atau membuat kustomisasi/penyesuaian versi lokal untuk tingkatannya.
  const isSameOrg = !material.organizationId || !userOrganizationId || material.organizationId === userOrganizationId;
  const isHigherTierThanMaterial = userRank > materialRank;
  const isSameTierOwner =
    userRank === materialRank &&
    (material.creatorTierLevel === 'DAERAH' ? userRank >= 3 : isSameOrg);
  const isOwnerOfMaterial = isHigherTierThanMaterial || isSameTierOwner;
  const canDeleteThisMaterial = canManage && isOwnerOfMaterial;

  // Kustomisasi Desa dan Kelompok (hanya relevan jika materi aslinya dari tingkatan atas)
  const desaCustomization = material.customizations?.find((c) => c.tierLevel === 'DESA');
  const kelompokCustomization = material.customizations?.find((c) => c.tierLevel === 'KELOMPOK');

  const userTierLabel = userTierLevel === 'DESA' ? 'Desa' : 'Kelompok';

  const userCustomization = material.customizations?.find((c) =>
    userOrganizationId ? c.organizationId === userOrganizationId : c.tierLevel === userTierLevel
  );
  const hasCustData = Boolean(
    userCustomization &&
    (userCustomization.customTitle ||
      userCustomization.customDescription ||
      (userCustomization.itemOverrides && Object.keys(userCustomization.itemOverrides).length > 0))
  );
  const hasUserLocalItems = material.checklistItems.some((i) =>
    userOrganizationId
      ? i.organizationId === userOrganizationId
      : i.tierLevel === userTierLevel && i.organizationId !== material.organizationId
  );
  const hasUserVersion = !isOwnerOfMaterial && (hasCustData || hasUserLocalItems);

  const hasDesaCustom =
    material.creatorTierLevel === 'DAERAH' &&
    Boolean(
      desaCustomization ||
      material.checklistItems.some(
        (i) => i.tierLevel === 'DESA' && i.organizationId !== material.organizationId
      )
    );
  const hasKelompokCustom =
    material.creatorTierLevel !== 'KELOMPOK' &&
    Boolean(
      kelompokCustomization ||
      material.checklistItems.some(
        (i) => i.tierLevel === 'KELOMPOK' && i.organizationId !== material.organizationId
      )
    );

  // Default active version
  const getInitialVersion = (): 'ASLI' | 'DESA' | 'KELOMPOK' => {
    if (isOwnerOfMaterial) return 'ASLI';
    if (userTierLevel === 'KELOMPOK' && hasKelompokCustom) return 'KELOMPOK';
    if (userTierLevel === 'DESA' && hasDesaCustom) return 'DESA';
    if (hasKelompokCustom && userTierLevel !== 'DESA') return 'KELOMPOK';
    if (hasDesaCustom) return 'DESA';
    return 'ASLI';
  };

  const [activeVersion, setActiveVersion] = useState<'ASLI' | 'DESA' | 'KELOMPOK'>(getInitialVersion);

  // Tutup dropdown versi saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        versionDropdownRef.current &&
        !versionDropdownRef.current.contains(event.target as Node)
      ) {
        setIsVersionDropdownOpen(false);
      }
    };
    if (isVersionDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVersionDropdownOpen]);

  // Otomatis terbuka jika URL memuat hash ID materi ini
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === `#material-${material.id}`) {
      setIsExpanded(true);
    }
  }, [material.id]);

  // --------------------------------------------------------------------------
  // Hitung Teks & Butir Capaian Berdasarkan Versi Aktif
  // --------------------------------------------------------------------------

  let activeTitle = material.title;
  let activeDescription = material.description;
  let isTitleOrDescCustomized = false;

  if (!isOwnerOfMaterial) {
    if (activeVersion === 'DESA' && desaCustomization) {
      if (desaCustomization.customTitle) {
        activeTitle = desaCustomization.customTitle;
        isTitleOrDescCustomized = true;
      }
      if (desaCustomization.customDescription) {
        activeDescription = desaCustomization.customDescription;
        isTitleOrDescCustomized = true;
      }
    } else if (activeVersion === 'KELOMPOK') {
      if (kelompokCustomization?.customTitle) {
        activeTitle = kelompokCustomization.customTitle;
        isTitleOrDescCustomized = true;
      } else if (desaCustomization?.customTitle) {
        activeTitle = desaCustomization.customTitle;
        isTitleOrDescCustomized = true;
      }

      if (kelompokCustomization?.customDescription) {
        activeDescription = kelompokCustomization.customDescription;
        isTitleOrDescCustomized = true;
      } else if (desaCustomization?.customDescription) {
        activeDescription = desaCustomization.customDescription;
        isTitleOrDescCustomized = true;
      }
    }
  }

  // Filter Butir Capaian
  interface ComputedChecklistItem extends ChecklistItemData {
    isOverridden?: boolean;
    overriddenBy?: 'DESA' | 'KELOMPOK';
    isNewLocal?: boolean;
    addedBy?: 'DESA' | 'KELOMPOK';
  }

  const activeItems: ComputedChecklistItem[] = [];

  material.checklistItems.forEach((item) => {
    const isMaster = !item.organizationId;
    const isDesaItem = item.tierLevel === 'DESA';
    const isKelompokItem = item.tierLevel === 'KELOMPOK';

    if (isOwnerOfMaterial || activeVersion === 'ASLI') {
      if (
        isMaster ||
        (material.organizationId && item.organizationId === material.organizationId) ||
        item.tierLevel === material.creatorTierLevel
      ) {
        activeItems.push({
          ...item,
          originalItemTitle: item.itemTitle,
          originalDescription: item.description,
          originalPointsWeight: item.pointsWeight,
          originalCompletionTierLevel: item.completionTierLevel,
        });
      }
      return;
    }

    if (activeVersion === 'DESA') {
      if (isKelompokItem) return;
      if (isMaster) {
        const override = desaCustomization?.itemOverrides?.[item.id];
        activeItems.push({
          ...item,
          originalItemTitle: item.itemTitle,
          originalDescription: item.description,
          originalPointsWeight: item.pointsWeight,
          originalCompletionTierLevel: item.completionTierLevel,
          itemTitle: override?.itemTitle || item.itemTitle,
          description: override?.description !== undefined ? override.description : item.description,
          pointsWeight: override?.pointsWeight !== undefined ? override.pointsWeight : item.pointsWeight,
          completionTierLevel: override?.completionTierLevel || item.completionTierLevel,
          isOverridden: Boolean(override),
          overriddenBy: 'DESA',
        });
      } else if (isDesaItem) {
        activeItems.push({
          ...item,
          isNewLocal: true,
          addedBy: 'DESA',
        });
      }
      return;
    }

    if (activeVersion === 'KELOMPOK') {
      if (isMaster) {
        const overrideDesa = desaCustomization?.itemOverrides?.[item.id];
        const overrideKelompok = kelompokCustomization?.itemOverrides?.[item.id];
        const activeOverride = overrideKelompok || overrideDesa;

        activeItems.push({
          ...item,
          originalItemTitle: item.itemTitle,
          originalDescription: item.description,
          originalPointsWeight: item.pointsWeight,
          originalCompletionTierLevel: item.completionTierLevel,
          itemTitle: activeOverride?.itemTitle || item.itemTitle,
          description:
            activeOverride?.description !== undefined ? activeOverride.description : item.description,
          pointsWeight:
            activeOverride?.pointsWeight !== undefined ? activeOverride.pointsWeight : item.pointsWeight,
          completionTierLevel: activeOverride?.completionTierLevel || item.completionTierLevel,
          isOverridden: Boolean(activeOverride),
          overriddenBy: overrideKelompok ? 'KELOMPOK' : 'DESA',
        });
      } else if (isDesaItem) {
        activeItems.push({
          ...item,
          isNewLocal: true,
          addedBy: 'DESA',
        });
      } else if (isKelompokItem) {
        activeItems.push({
          ...item,
          isNewLocal: true,
          addedBy: 'KELOMPOK',
        });
      }
    }
  });

  // Label Asal Pembuat
  const tierName =
    material.creatorTierLevel === 'DAERAH'
      ? 'Daerah'
      : material.creatorTierLevel === 'DESA'
        ? 'Desa'
        : 'Kelompok';

  const tierOriginLabel = material.organization?.name
    ? `${tierName} ${material.organization.name}`
    : tierName;

  // Daftar versi yang tersedia untuk switch versi
  const availableVersions: { key: 'ASLI' | 'DESA' | 'KELOMPOK'; label: string }[] = [];
  if (!isOwnerOfMaterial) {
    availableVersions.push({ key: 'ASLI', label: 'Versi Asli' });
    if (hasDesaCustom) {
      availableVersions.push({ key: 'DESA', label: 'Versi Desa' });
    }
    if (hasKelompokCustom) {
      availableVersions.push({ key: 'KELOMPOK', label: 'Versi Kelompok' });
    }
  }

  // Tombol switch versi hanya ditampilkan jika materi bukan buatan sendiri dan memiliki versi lain
  const showVersionSwitch = !isOwnerOfMaterial && availableVersions.length > 1;

  const activeVersionLabel =
    activeVersion === 'ASLI'
      ? 'Versi Asli'
      : activeVersion === 'DESA'
        ? 'Versi Desa'
        : 'Versi Kelompok';

  // Handler klik tombol Edit (Pen)
  const handleEditClick = () => {
    if (isOwnerOfMaterial) {
      // Jika materi dibuat sendiri: edit materi asli langsung
      if (onEditMaterial) onEditMaterial(material);
    } else {
      // Jika materi dari tingkatan atas: buka modal penyesuaian khusus tingkatan pengguna
      setIsCustomizeModalOpen(true);
    }
  };

  const desaName =
    desaCustomization?.organization?.name || parentOrganizationName || userOrganizationName || 'Desa';
  const kelompokName =
    kelompokCustomization?.organization?.name || userOrganizationName || 'Kelompok';

  return (
    <div
      id={`material-${material.id}`}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 transition-all hover:border-slate-300 scroll-mt-24 space-y-3"
    >
      {/* 1. Header Bar: Badge Asal & Switcher Versi Sejajar di Sisi Kanan */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Sisi Kiri: Badge Tingkatan Pembuat & Status Wajib */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${material.creatorTierLevel === 'DAERAH'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : material.creatorTierLevel === 'DESA'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
          >
            {tierOriginLabel}
          </span>

          {material.isMandatoryForTarget ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <Lock className="w-3 h-3 text-rose-500" />
              <span>Wajib</span>
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Pengayaan
            </span>
          )}
        </div>

        {/* Sisi Kanan: Toggle Accordion Sub-Capaian */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isExpanded ? 'Tutup rincian sub-capaian' : 'Buka rincian sub-capaian'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-teal-600' : ''
              }`}
          />
        </button>
      </div>

      {/* 2. Judul & Deskripsi Materi */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug break-words">
              {activeTitle}
            </h3>

            {/* Indikator Teks Progres: Kolektif vs Individu */}
            {material.progressSummary && material.progressSummary.totalItems > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 pt-0.5 flex-wrap">
                {material.progressSummary.isGroupView ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-600 font-medium">
                      <strong className="text-slate-900 font-bold">{material.progressSummary.completedStudents || 0}</strong> dari{' '}
                      <strong className="text-slate-900 font-bold">{material.progressSummary.totalStudents || 0}</strong> Santri Tuntas Modul
                    </span>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-700">
                    {material.progressSummary.completedItems} dari {material.progressSummary.totalItems} Capaian Selesai
                  </span>
                )}
              </div>
            )}
          </div>

          {/* CIRCULAR PROGRESS BAR: Lingkaran progress dengan angka di tengah dan warna dinamis */}
          {material.progressSummary && material.progressSummary.totalItems > 0 && (
            <div
              className="shrink-0 pt-0.5"
              title={
                material.progressSummary.isGroupView
                  ? `Ketercapaian Kolektif: ${material.progressSummary.percentage}% (${material.progressSummary.completedStudents || 0}/${material.progressSummary.totalStudents || 0} Santri Tuntas)`
                  : `Rata-rata Nilai: ${material.progressSummary.averageScore}%`
              }
            >
              <CircularProgressBar
                value={material.progressSummary.percentage}
                size={48}
                strokeWidth={3.8}
              />
            </div>
          )}
        </div>

        {activeDescription && (
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
            {activeDescription}
          </p>
        )}

        {/* Link URL File / Dokumen PDF Referensi */}
        {material.fileUrl && (
          <div className="pt-0.5">
            <a
              href={material.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50/70 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Buka E-Kitab / Dokumen Materi</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Bar Bagian Bawah Deskripsi: Tombol Versi di Kiri, Edit & Hapus di Kanan */}
        {(showVersionSwitch || canManage || (canDeleteThisMaterial && onDeleteMaterial) || (hasUserVersion && onDeleteVersion)) && (
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {/* Kiri: 1 Tombol Switch Versi */}
            <div>
              {showVersionSwitch && (
                <div className="relative" ref={versionDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    title="Ganti versi materi"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeVersionLabel}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {/* Menu Dropdown Switch Versi */}
                  {isVersionDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-36 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-30 text-xs animate-fade-in">
                      {availableVersions.map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => {
                            setActiveVersion(v.key);
                            setIsVersionDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${activeVersion === v.key
                            ? 'font-bold text-teal-700 bg-teal-50/60'
                            : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>{v.label}</span>
                          {activeVersion === v.key && (
                            <span className="text-[10px] text-teal-600 font-bold">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kanan: Tombol Edit (Pen) & Tombol Hapus */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Tombol Edit (Pen) */}
              {canManage && (
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-teal-700 hover:bg-teal-50/50 hover:border-teal-200 transition-colors cursor-pointer"
                  title={isOwnerOfMaterial ? 'Edit materi ini' : `Sesuaikan materi untuk versi ${userTierLabel}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Tombol Hapus Versi Lokal (tetap tampil di versi asli maupun versi lain jika ada versi lokal) */}
              {canManage && !isOwnerOfMaterial && hasUserVersion && onDeleteVersion && (
                <button
                  type="button"
                  onClick={() => onDeleteVersion(material.id, material.title)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-700 hover:bg-rose-50/50 hover:border-rose-200 transition-colors cursor-pointer"
                  title={`Hapus seluruh versi ${userTierLabel} materi ini`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Tombol Hapus Materi Asli (Khusus Pemilik Materi) */}
              {canDeleteThisMaterial && onDeleteMaterial && (
                <button
                  type="button"
                  onClick={() => onDeleteMaterial(material.id, material.title)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-700 hover:bg-rose-50/50 hover:border-rose-200 transition-colors cursor-pointer"
                  title="Hapus materi ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Rincian Sub-Capaian & Target Checklist */}
      {isExpanded && (
        <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Target Capaian ({activeItems.length})</span>
            </h4>

            {/* Tombol Tambah Capaian:
                - Jika pemilik materi -> Tambah capaian materi
                - Jika bukan pemilik -> Capaian Tambahan [Desa/Kelompok] */}
            {canManage && onAddChecklistItem && (
              <button
                type="button"
                onClick={() => onAddChecklistItem(material.id, !isOwnerOfMaterial, isOwnerOfMaterial)}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-teal-200/60 bg-teal-50 text-teal-700 hover:bg-teal-100 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {isOwnerOfMaterial ? 'Tambah Capaian' : `Capaian ${userTierLabel}`}
                </span>
              </button>
            )}
          </div>

          {/* Daftar Butir Sub-Capaian Aktif */}
          <div className="space-y-1.5">
            {activeItems.map((item, idx) => {
              const isLockedDaerah = item.completionTierLevel === 'DAERAH_ONLY';
              const isLockedDesa = item.completionTierLevel === 'DESA_AND_ABOVE';

              const hasItemWatermark = !isOwnerOfMaterial && (item.isOverridden || item.isNewLocal);
              const itemVersionLabel =
                item.tierLevel === 'DESA' || item.overriddenBy === 'DESA' ? 'Desa' : 'Kelompok';

              return (
                <div
                  key={item.id}
                  className="p-2.5 sm:p-3 rounded-xl border bg-slate-50/60 border-slate-200/70 flex flex-col items-start justify-end gap-2.5 transition-all"
                >
                  <div className="flex items-center gap-3 justify-between w-full">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {item.studentProgress?.isCompleted ? (
                        <div
                          className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                          title="Capaian Tuntas Terverifikasi"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                          {idx + 1}
                        </span>
                      )}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-900 leading-snug">
                            {item.itemTitle}
                          </span>

                          {/* Badge Nilai Capaian jika sudah dinilai (Mode Individu) */}
                          {item.studentProgress && typeof item.studentProgress.score === 'number' && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${item.studentProgress.score >= 80
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.studentProgress.score >= 60
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              title="Nilai Capaian Santri"
                            >
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>Nilai: {item.studentProgress.score}</span>
                            </span>
                          )}

                          {/* Mini Linear Progress Bar & Badge untuk Capaian Kolektif */}
                          {item.groupProgress && !item.studentProgress && (
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <div
                                className="w-16 sm:w-24 h-2 bg-slate-200/90 rounded-full overflow-hidden shrink-0"
                                title={`Ketercapaian: ${item.groupProgress.completedCount} dari ${item.groupProgress.totalStudents} santri (${item.groupProgress.percentage}%)`}
                              >
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${item.groupProgress.percentage >= 80
                                    ? 'bg-emerald-500'
                                    : item.groupProgress.percentage >= 50
                                      ? 'bg-teal-500'
                                      : item.groupProgress.percentage > 0
                                        ? 'bg-amber-500'
                                        : 'bg-transparent'
                                    }`}
                                  style={{ width: `${item.groupProgress.percentage}%` }}
                                />
                              </div>

                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${item.groupProgress.percentage >= 80
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : item.groupProgress.percentage >= 50
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : item.groupProgress.percentage > 0
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                              >
                                <span>
                                  {item.groupProgress.completedCount}/{item.groupProgress.totalStudents} Santri ({item.groupProgress.percentage}%)
                                </span>
                              </span>

                              {item.groupProgress.averageScore > 0 && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-semibold"
                                  title={`Rata-rata nilai: ${item.groupProgress.averageScore}`}
                                >
                                  <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
                                  <span>{item.groupProgress.averageScore}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol Edit & Hapus Sub-Capaian */}
                    {canManage && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {onEditChecklistItem && (
                          <button
                            type="button"
                            onClick={() => onEditChecklistItem(material.id, item, isOwnerOfMaterial)}
                            className="p-1 rounded-md text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                            title={isOwnerOfMaterial ? 'Edit capaian ini' : `Sesuaikan capaian untuk versi ${userTierLabel}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {onDeleteChecklistItem && (isOwnerOfMaterial || item.isNewLocal) && (
                          <button
                            type="button"
                            onClick={() => onDeleteChecklistItem(item.id, item.itemTitle)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus capaian ini"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                      {item.description}
                    </p>
                  )}

                  {/* Pesan Catatan Ustadz untuk capaian ini */}
                  {item.studentProgress?.teacherFeedback && (
                    <div className="w-full mt-1 p-2.5 rounded-xl bg-teal-50/70 border border-teal-200/60 space-y-1">
                      <div className="flex items-center gap-1.5 text-teal-800 text-[11px] font-bold">
                        <MessageSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>Catatan Ustadz:</span>
                        {item.studentProgress.evaluatedAt && (
                          <span className="text-[10px] text-teal-600/70 font-normal ml-auto">
                            {new Date(item.studentProgress.evaluatedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed italic">
                        "{item.studentProgress.teacherFeedback}"
                      </p>
                      {item.studentProgress.feedbackTags && item.studentProgress.feedbackTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.studentProgress.feedbackTags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded-md bg-white border border-teal-200/80 text-teal-700 text-[10px] font-semibold"
                            >
                              #{tag.replace(/^#/, '')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bagian Bawah: Watermark samar di kiri sejajar dengan badge poin di kanan */}
                  <div className="flex items-center justify-between w-full pt-2 border-t border-slate-200/50">
                    {/* Kiri: Watermark samar teks abu-abu */}
                    <div className="min-w-0">
                      {hasItemWatermark ? (
                        <span className="text-[10px] text-slate-400 italic">
                          * Versi {itemVersionLabel}
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>

                    {/* Kanan: Badge Poin Reward & Otoritas */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] sm:text-[11px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200 shadow-2xs">
                        +{item.pointsWeight} Poin
                      </span>

                      {/* Badge Khusus Daerah 🔒 */}
                      {isLockedDaerah && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                          title="Hanya dapat disahkan oleh Tim Penguji Tingkat Daerah"
                        >
                          <Lock className="w-2.5 h-2.5 text-amber-700" />
                          <span>Daerah</span>
                        </span>
                      )}

                      {/* Badge Khusus Desa 🏛️ */}
                      {isLockedDesa && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300"
                          title="Hanya dapat disahkan oleh Tim Penguji Tingkat Desa ke atas"
                        >
                          <Lock className="w-2.5 h-2.5 text-purple-700" />
                          <span>Desa</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeItems.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                Belum ada butir target capaian pada versi ini.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Kustomisasi Informasi Materi (Desa / Kelompok) */}
      {!isOwnerOfMaterial && (
        <MaterialCustomizeModal
          isOpen={isCustomizeModalOpen}
          onClose={() => setIsCustomizeModalOpen(false)}
          materialId={material.id}
          originalTitle={material.title}
          originalDescription={material.description}
          currentCustomTitle={
            userTierLevel === 'DESA'
              ? desaCustomization?.customTitle
              : kelompokCustomization?.customTitle
          }
          currentCustomDescription={
            userTierLevel === 'DESA'
              ? desaCustomization?.customDescription
              : kelompokCustomization?.customDescription
          }
          tierLevel={(userTierLevel as 'DESA' | 'KELOMPOK') || 'KELOMPOK'}
          organizationName={userOrganizationName || (userTierLevel === 'DESA' ? desaName : kelompokName)}
          onSuccess={() => {
            if (onRefresh) onRefresh();
            setActiveVersion(userTierLevel === 'DESA' ? 'DESA' : 'KELOMPOK');
          }}
        />
      )}
    </div>
  );
}
