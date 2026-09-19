'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, BookOpen, Lock, Sparkles, FileText, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react';
import { createMaterial, updateMaterial } from '@/app/(protected)/kurikulum/actions';
import { TierLevel } from '@prisma/client';

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialToEdit?: {
    id: string;
    title: string;
    description: string | null;
    fileUrl?: string | null;
    isMandatoryForTarget: boolean;
    creatorTierLevel?: string;
    organization?: {
      name?: string;
    } | null;
    targetGeneration?: {
      code: string;
    } | null;
  } | null;
  defaultGenCode: string;
  generations: { id: string; code: string; name: string }[];
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  onSuccess: () => void;
}

export default function MaterialFormModal({
  isOpen,
  onClose,
  materialToEdit,
  defaultGenCode,
  generations,
  userTierLevel,
  onSuccess,
}: MaterialFormModalProps) {
  const isEditMode = Boolean(materialToEdit);

  const TIER_RANK: Record<string, number> = {
    DAERAH: 3,
    DESA: 2,
    KELOMPOK: 1,
  };

  const currentTier = (materialToEdit?.creatorTierLevel as TierLevel) || TierLevel.KELOMPOK;
  const materialRank = TIER_RANK[currentTier] ?? 1;
  const userRank = userTierLevel ? (TIER_RANK[userTierLevel] ?? 0) : 0;
  const canUpgradeTier = isEditMode && userRank > materialRank;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [targetGenCode, setTargetGenCode] = useState<string>(defaultGenCode);
  const [isMandatory, setIsMandatory] = useState(false);
  const [upgradeTier, setUpgradeTier] = useState<TierLevel>(currentTier);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sinkronisasi data saat modal dibuka
  useEffect(() => {
    if (materialToEdit) {
      setTitle(materialToEdit.title || '');
      setDescription(materialToEdit.description || '');
      setFileUrl(materialToEdit.fileUrl || '');
      setTargetGenCode(materialToEdit.targetGeneration?.code || defaultGenCode);
      setIsMandatory(materialToEdit.isMandatoryForTarget);
      setUpgradeTier((materialToEdit.creatorTierLevel as TierLevel) || TierLevel.KELOMPOK);
    } else {
      setTitle('');
      setDescription('');
      setFileUrl('');
      setTargetGenCode(defaultGenCode);
      setIsMandatory(false);
      setUpgradeTier(TierLevel.KELOMPOK);
    }
    setErrorMessage(null);
  }, [materialToEdit, defaultGenCode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Judul materi wajib diisi.');
      return;
    }

    const formData = new FormData();
    if (materialToEdit) {
      formData.append('materialId', materialToEdit.id);
    }
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('fileUrl', fileUrl.trim());
    formData.append('targetGenerationCode', targetGenCode);
    formData.append('isMandatory', isMandatory ? 'true' : 'false');
    if (canUpgradeTier && upgradeTier && upgradeTier !== currentTier) {
      formData.append('upgradeTierLevel', upgradeTier);
    }

    startTransition(async () => {
      const res = isEditMode
        ? await updateMaterial(formData)
        : await createMaterial(formData);

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const currentTierLabel =
    currentTier === TierLevel.DESA ? 'Desa' : currentTier === TierLevel.DAERAH ? 'Daerah' : 'Kelompok';

  const upgradeOptions: {
    tier: TierLevel;
    label: string;
    isUpgrade: boolean;
    helperText: string;
  }[] = [];

  if (canUpgradeTier) {
    upgradeOptions.push({
      tier: currentTier,
      label: `${currentTierLabel} (Saat Ini)`,
      isUpgrade: false,
      helperText: `Materi tetap khusus pada tingkat ${currentTierLabel} asalnya.`,
    });

    if (currentTier === TierLevel.KELOMPOK && (userTierLevel === 'DESA' || userTierLevel === 'DAERAH')) {
      upgradeOptions.push({
        tier: TierLevel.DESA,
        label: 'Upgrade ke Tingkat Desa',
        isUpgrade: true,
        helperText: 'Dapat diakses dan digunakan oleh seluruh kelompok lain dalam naungan Desa ini.',
      });
    }

    if (userTierLevel === 'DAERAH' && currentTier !== TierLevel.DAERAH) {
      upgradeOptions.push({
        tier: TierLevel.DAERAH,
        label: 'Upgrade ke Tingkat Daerah (Master)',
        isUpgrade: true,
        helperText: 'Materi menjadi silabus baku Daerah dan dapat diakses semua Desa & Kelompok.',
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-fade-in">
      {/* Header Modal Full Screen */}
      <div className="border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isEditMode ? 'Edit Materi Kurikulum' : 'Tambah Materi Baru'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditMode
                  ? 'Perbarui rincian silabus dan target kurikulum'
                  : 'Daftarkan materi silabus untuk jenjang santri'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body Form Full Screen */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-8 space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-fade-in">
              {errorMessage}
            </div>
          )}

          {/* Judul Materi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Judul Materi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Tahsin Makhorijul Huruf & Tajwid Dasar"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Jenjang Generasi Sasaran */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Jenjang Generasi <span className="text-rose-500">*</span>
            </label>
            <select
              value={targetGenCode}
              onChange={(e) => setTargetGenCode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              {generations.map((gen) => (
                <option key={gen.id} value={gen.code}>
                  {gen.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deskripsi Materi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Deskripsi Silabus (Opsional)
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan ringkasan materi, target capaian hafalan, atau panduan pengajaran bagi ustadz..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Link URL Dokumen / E-Kitab */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Link Dokumen / E-Kitab PDF (Opsional)
            </label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/... atau link file materi"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tingkatan Materi
            </label>
          </div>

          {/* Fitur Upgrade Tingkatan Materi (Simple & Clean) */}
          {canUpgradeTier && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 animate-fade-in">
              {/* Segmented Buttons */}
              <div className="flex flex-wrap gap-2">
                {upgradeOptions.map((opt) => {
                  const isSelected = upgradeTier === opt.tier;
                  return (
                    <button
                      key={opt.tier}
                      type="button"
                      onClick={() => setUpgradeTier(opt.tier)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${isSelected
                        ? opt.isUpgrade
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-slate-800/20   border-slate-800/30 text-slate shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                    >
                      {opt.isUpgrade && (
                        <TrendingUp
                          className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'
                            }`}
                        />
                      )}
                      <span>{opt.label}</span>
                      {isSelected && (
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${opt.isUpgrade ? 'text-white' : 'text-slate'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {upgradeOptions.find((o) => o.tier === upgradeTier)?.helperText || ''}
              </p>
            </div>
          )}

          {/* Toggle Status Wajib Kelulusan */}
          <div
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer select-none"
            onClick={() => setIsMandatory(!isMandatory)}
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Materi Wajib Kelulusan Jenjang</span>
              </span>
              <span className="text-[11px] text-slate-500 block">
                Jika diaktifkan, seluruh santri pada jenjang ini wajib menuntaskan materi ini untuk lulus ke generasi berikutnya.
              </span>
            </div>
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="w-4 h-4 accent-teal-600 rounded cursor-pointer shrink-0"
            />
          </div>
        </div>

        {/* Footer Action Bar Full Screen */}
        <div className="border-t border-slate-200/80 bg-slate-50/90 backdrop-blur-md shrink-0">
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-end gap-3 mb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isPending
                  ? 'Menyimpan...'
                  : isEditMode
                    ? upgradeTier !== currentTier
                      ? 'Simpan & Upgrade Materi'
                      : 'Simpan Perubahan'
                    : 'Buat Materi Baru'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
