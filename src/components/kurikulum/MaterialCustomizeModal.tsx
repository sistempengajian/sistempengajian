'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Sparkles, CheckCircle2, RotateCcw, Building2, HelpCircle } from 'lucide-react';
import {
  saveMaterialCustomization,
  resetMaterialCustomization,
} from '@/app/(protected)/kurikulum/actions';

interface MaterialCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  originalTitle: string;
  originalDescription: string | null;
  currentCustomTitle?: string | null;
  currentCustomDescription?: string | null;
  tierLevel: 'DESA' | 'KELOMPOK';
  organizationName: string;
  onSuccess: () => void;
}

export default function MaterialCustomizeModal({
  isOpen,
  onClose,
  materialId,
  originalTitle,
  originalDescription,
  currentCustomTitle,
  currentCustomDescription,
  tierLevel,
  organizationName,
  onSuccess,
}: MaterialCustomizeModalProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tierLabel = tierLevel === 'DESA' ? 'Desa' : 'Kelompok';
  const hasCustomization = Boolean(currentCustomTitle || currentCustomDescription);

  useEffect(() => {
    if (isOpen) {
      setCustomTitle(currentCustomTitle || '');
      setCustomDescription(currentCustomDescription || '');
      setErrorMessage(null);
    }
  }, [isOpen, currentCustomTitle, currentCustomDescription]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('materialId', materialId);
    formData.append('customTitle', customTitle.trim());
    formData.append('customDescription', customDescription.trim());

    startTransition(async () => {
      const res = await saveMaterialCustomization(formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const handleReset = () => {
    if (!confirm(`Kembalikan materi ini ke versi asli? Seluruh judul dan catatan kustom untuk ${organizationName} akan dihapus.`)) {
      return;
    }

    startTransition(async () => {
      const res = await resetMaterialCustomization(materialId);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  const isPurple = tierLevel === 'DESA';

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-fade-in">
      {/* Header Modal Full Screen */}
      <div
        className={`border-b shrink-0 ${isPurple
          ? 'bg-purple-50/80 border-purple-100 text-purple-950'
          : 'bg-emerald-50/80 border-emerald-100 text-emerald-950'
          }`}
      >
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs shrink-0 ${isPurple
                ? 'bg-purple-100 text-purple-700 border-purple-200'
                : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold leading-tight">
                Kustomisasi Silabus
              </h3>
              <p className="text-xs opacity-75 mt-0.5">
                {tierLabel} {organizationName}
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

          {/* Rujukan Judul & Deskripsi Asli */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Materi Asli Daerah</span>
            </div>
            <p className="font-bold text-slate-900 text-sm">{originalTitle}</p>
            {originalDescription && (
              <p className="text-slate-600 text-xs leading-relaxed">
                {originalDescription}
              </p>
            )}
          </div>

          {/* Input Judul Kustom */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Judul Khusus Versi {tierLabel}</span>
              <span className="text-[11px] text-slate-400 font-normal">Opsional</span>
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={originalTitle}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Kosongkan jika tetap ingin memakai judul baku master.
            </p>
          </div>

          {/* Input Deskripsi Kustom */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Deskripsi & Catatan Pengajaran Lokal</span>
              <span className="text-[11px] text-slate-400 font-normal">Opsional</span>
            </label>
            <textarea
              rows={4}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Tambahkan catatan instruksi guru, target khusus santri, atau teknis pengajaran di masjid wilayah Anda..."
              className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors leading-relaxed"
            />
          </div>

          {/* Preview Watermark Samar */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>Pratinjau Tampilan Kartu Materi</span>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-white space-y-1.5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {customTitle.trim() || originalTitle}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {customDescription.trim() || originalDescription || 'Belum ada deskripsi khusus.'}
              </p>
              {(customTitle.trim() || customDescription.trim()) && (
                <p className="text-[11px] text-slate-400 italic pt-1">
                  * Versi {tierLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Modal Full Screen */}
        <div className="border-t border-slate-200 bg-slate-50/80 backdrop-blur-md shrink-0 py-4 px-4 sm:px-6 mb-2">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-end gap-2.5">
            {hasCustomization && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="px-3.5 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 mr-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Versi Ini</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200/70 text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 ${isPurple ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isPending ? 'Menyimpan...' : 'Simpan Penyesuaian'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
