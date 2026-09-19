'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, CheckCircle2, Lock, Target, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  resetChecklistItemOverride,
} from '@/app/(protected)/kurikulum/actions';
import { CompletionTierLevel } from '@prisma/client';

interface ChecklistItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  itemToEdit?: {
    id: string;
    itemTitle: string;
    description: string | null;
    completionTierLevel: string;
    pointsWeight: number;
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
  } | null;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  isLocalTarget?: boolean;
  isOwnerOfMaterial?: boolean;
  onSuccess: () => void;
}

export default function ChecklistItemModal({
  isOpen,
  onClose,
  materialId,
  itemToEdit,
  userTierLevel = 'KELOMPOK',
  isLocalTarget = false,
  isOwnerOfMaterial = false,
  onSuccess,
}: ChecklistItemModalProps) {
  const isEditMode = Boolean(itemToEdit);
  // Penyesuaian/override hanya berlaku jika user BUKAN pemilik materi asli dan item adalah item master
  const isCustomizingMaster = isEditMode && !isOwnerOfMaterial && itemToEdit?.organizationId === null;
  // Capaian tambahan lokal hanya berlaku jika materi BUKAN milik sendiri dan memang target lokal
  const isAddingLocal = !isEditMode && !isOwnerOfMaterial && Boolean(isLocalTarget);

  const [itemTitle, setItemTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsWeight, setPointsWeight] = useState('10');
  const [completionTierLevel, setCompletionTierLevel] = useState<CompletionTierLevel>(
    CompletionTierLevel.ANY_TIER
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isModifiedFromOriginal = Boolean(
    itemToEdit && (
      (itemToEdit.originalItemTitle && itemTitle !== itemToEdit.originalItemTitle) ||
      (itemToEdit.originalDescription !== undefined &&
        description !== (itemToEdit.originalDescription || '')) ||
      (itemToEdit.originalPointsWeight !== undefined &&
        pointsWeight !== String(itemToEdit.originalPointsWeight)) ||
      (itemToEdit.originalCompletionTierLevel &&
        completionTierLevel !== itemToEdit.originalCompletionTierLevel)
    )
  );

  const hasCustomization = Boolean(itemToEdit?.isOverridden || isModifiedFromOriginal);

  useEffect(() => {
    if (itemToEdit) {
      setItemTitle(itemToEdit.itemTitle || '');
      setDescription(itemToEdit.description || '');
      setPointsWeight(String(itemToEdit.pointsWeight || 10));
      setCompletionTierLevel(
        (itemToEdit.completionTierLevel as CompletionTierLevel) || CompletionTierLevel.ANY_TIER
      );
    } else {
      setItemTitle('');
      setDescription('');
      setPointsWeight('10');
      setCompletionTierLevel(CompletionTierLevel.ANY_TIER);
    }
    setErrorMessage(null);
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      setErrorMessage('Judul sub-capaian target wajib diisi.');
      return;
    }

    const formData = new FormData();
    if (isEditMode && itemToEdit) {
      formData.append('itemId', itemToEdit.id);
    }
    formData.append('materialId', materialId);
    formData.append('itemTitle', itemTitle.trim());
    formData.append('description', description.trim());
    formData.append('pointsWeight', pointsWeight);
    formData.append('completionTierLevel', completionTierLevel);
    if (isAddingLocal) {
      formData.append('isLocalItem', 'true');
    }

    startTransition(async () => {
      const res = isEditMode
        ? await updateChecklistItem(formData)
        : await createChecklistItem(formData);

      if ('error' in res && res.error) {
        setErrorMessage(String(res.error));
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const tierLabel = userTierLevel === 'DESA' ? 'Desa' : userTierLevel === 'KELOMPOK' ? 'Kelompok' : 'Daerah';

  const handleDeleteVersionItem = () => {
    if (!itemToEdit) return;

    const confirmMsg = itemToEdit.isNewLocal
      ? `Hapus capaian "${itemToEdit.itemTitle}"?`
      : `Hapus penyesuaian versi ${tierLabel} untuk capaian "${itemToEdit.itemTitle}"? Capaian akan kembali ke nilai asli.`;

    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res =
        itemToEdit.isNewLocal || (itemToEdit.organizationId && itemToEdit.organizationId !== null)
          ? await deleteChecklistItem(itemToEdit.id)
          : await resetChecklistItemOverride(materialId, itemToEdit.id);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const handleResetItem = () => {
    if (!itemToEdit) return;

    const origTitle = itemToEdit.originalItemTitle || itemToEdit.itemTitle || '';
    const origDesc =
      itemToEdit.originalDescription !== undefined
        ? itemToEdit.originalDescription || ''
        : itemToEdit.description || '';
    const origPts = String(itemToEdit.originalPointsWeight || itemToEdit.pointsWeight || 10);
    const origAuth =
      (itemToEdit.originalCompletionTierLevel as CompletionTierLevel) ||
      (itemToEdit.completionTierLevel as CompletionTierLevel) ||
      CompletionTierLevel.ANY_TIER;

    setItemTitle(origTitle);
    setDescription(origDesc);
    setPointsWeight(origPts);
    setCompletionTierLevel(origAuth);

    // Jika butir ini telah tersimpan sebagai override di database, tawarkan reset di database
    if (itemToEdit.isOverridden) {
      if (!window.confirm(`Kembalikan penyesuaian capaian "${itemToEdit.itemTitle}" ke versi asli?`)) return;

      startTransition(async () => {
        const res = await resetChecklistItemOverride(materialId, itemToEdit.id);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          onSuccess();
          onClose();
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-fade-in">
      {/* Header Modal Full Screen */}
      <div
        className={`border-b shrink-0 ${isAddingLocal || isCustomizingMaster
          ? userTierLevel === 'DESA'
            ? 'bg-purple-50/80 border-purple-100 text-purple-950'
            : 'bg-emerald-50/80 border-emerald-100 text-emerald-950'
          : 'bg-slate-50/90 border-slate-200/80 text-slate-900'
          }`}
      >
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs shrink-0 ${isAddingLocal || isCustomizingMaster
                ? userTierLevel === 'DESA'
                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-teal-50 text-teal-700 border-teal-200/60'
                }`}
            >
              {isAddingLocal || isCustomizingMaster ? (
                <Sparkles className="w-5 h-5" />
              ) : (
                <Target className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                {isCustomizingMaster
                  ? `Sesuaikan Target untuk Versi ${tierLabel}`
                  : isAddingLocal
                    ? `Capaian ${tierLabel}`
                    : isEditMode
                      ? 'Edit Target Sub-Capaian'
                      : 'Tambah Target Sub-Capaian'}
              </h3>
              <p className="text-xs opacity-75 mt-0.5">
                {isCustomizingMaster
                  ? `Penyesuaian berlaku khusus untuk ${tierLabel} Anda`
                  : isAddingLocal
                    ? `Capaian lokal khusus santri di ${tierLabel} Anda`
                    : 'Butir capaian kurikulum yang akan dinilai di jurnal presensi'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-black/5 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body Form Full Screen */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-fade-in">
              {errorMessage}
            </div>
          )}

          {/* Judul Sub-Capaian */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Judul Target Capaian <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder="Contoh: Makhraj Huruf Halqiyah (Surah Al-Fatihah)"
              className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Deskripsi Singkat */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Kriteria Kelulusan Target (Opsional)
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Pengucapan huruf Ain dan Ha murni tanpa desis..."
              className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Bobot Poin & Otoritas Penyelesaian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Bobot Poin Reward
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="100"
                  step="5"
                  value={pointsWeight}
                  onChange={(e) => setPointsWeight(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                <span className="absolute right-4 top-3 text-slate-400 text-sm font-medium pointer-events-none">
                  Poin
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Otoritas Pengujian
              </label>
              <select
                value={completionTierLevel}
                onChange={(e) => setCompletionTierLevel(e.target.value as CompletionTierLevel)}
                className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
              >
                <option value={CompletionTierLevel.ANY_TIER}>Semua Tingkat (Ustadz)</option>
                {(userTierLevel === 'DAERAH' ||
                  userTierLevel === 'DESA' ||
                  completionTierLevel === CompletionTierLevel.DESA_AND_ABOVE) && (
                    <option value={CompletionTierLevel.DESA_AND_ABOVE}>Khusus Desa ke Atas</option>
                  )}
                {(userTierLevel === 'DAERAH' ||
                  completionTierLevel === CompletionTierLevel.DAERAH_ONLY) && (
                    <option value={CompletionTierLevel.DAERAH_ONLY}>Khusus Daerah</option>
                  )}
              </select>
            </div>
          </div>

          {/* Info Otoritas */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 leading-relaxed">
            {completionTierLevel === CompletionTierLevel.DAERAH_ONLY ? (
              <span className="flex items-center gap-2 text-amber-800 font-medium">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Hanya Tim Penguji Tingkat Daerah yang dapat mengesahkan kelulusan target ini.</span>
              </span>
            ) : completionTierLevel === CompletionTierLevel.DESA_AND_ABOVE ? (
              <span className="flex items-center gap-2 text-purple-800 font-medium">
                <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Hanya Tim Penguji Tingkat Desa ke atas yang dapat mengesahkan kelulusan target ini.</span>
              </span>
            ) : (
              <span>Dapat diuji dan disahkan langsung oleh Ustadz/Pengajar di tingkat kelompok halaqah.</span>
            )}
          </div>
        </div>

        {/* Footer Modal Full Screen */}
        <div className="border-t border-slate-200 bg-slate-50/80 backdrop-blur-md shrink-0 py-4 px-4 sm:px-6 mb-2">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-end gap-2.5">
            {/* Sisi Kiri: Tombol Reset pada Versi Lain */}
            {isEditMode && !isOwnerOfMaterial && hasCustomization && (
              <button
                type="button"
                onClick={handleResetItem}
                disabled={isPending}
                className="px-3.5 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 mr-auto"
                title="Reset capaian ke nilai awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            {/* Sisi Kanan: Tombol Batal & Simpan */}
            < button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${userTierLevel === 'DESA'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-teal-600 hover:bg-teal-700'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isPending
                  ? 'Menyimpan...'
                  : isCustomizingMaster
                    ? 'Simpan Penyesuaian'
                    : isEditMode
                      ? 'Simpan Perubahan'
                      : isAddingLocal
                        ? 'Tambah Capaian Lokal'
                        : 'Tambah Capaian'}
              </span>
            </button>
          </div>
        </div>
      </form >
    </div >
  );
}
