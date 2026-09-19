'use client';

import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { GenerationWithStats } from './types';
import { deleteGeneration } from '@/app/(protected)/generasi/actions';

interface DeleteGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  generation: GenerationWithStats | null;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteGenerationModal({
  isOpen,
  onClose,
  generation,
  onSuccess,
}: DeleteGenerationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !generation) return null;

  const hasRelations =
    generation.studentCount > 0 ||
    generation.classCount > 0 ||
    generation.materialCount > 0;

  const handleDelete = async () => {
    if (hasRelations) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteGeneration(generation.id);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsDeleting(false);
        return;
      }

      onSuccess(generation.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus jenjang generasi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transition-all transform animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-6 py-4.5 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2 text-rose-700">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">
              Hapus Jenjang Generasi
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {hasRelations ? (
            /* Safety Guard Warning: Tidak bisa dihapus */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <span className="font-bold block text-amber-950">
                    Jenjang Tidak Dapat Dihapus
                  </span>
                  <p>
                    Jenjang <strong>&quot;{generation.name}&quot;</strong> masih memiliki data aktif yang terhubung pada sistem:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 pt-1 text-amber-900 font-medium">
                    {generation.studentCount > 0 && (
                      <li>{generation.studentCount} Santri Terdaftar</li>
                    )}
                    {generation.classCount > 0 && (
                      <li>{generation.classCount} Kelas Aktif</li>
                    )}
                    {generation.materialCount > 0 && (
                      <li>{generation.materialCount} Modul Materi Kurikulum</li>
                    )}
                  </ul>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Untuk menjaga integritas data sistem, silakan pindahkan data santri dan kelas ke jenjang lain, atau hapus materi kurikulum terkait terlebih dahulu sebelum menghapus jenjang ini.
              </p>
            </div>
          ) : (
            /* Konfirmasi Hapus Aman (0 relasi) */
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus jenjang generasi{' '}
                <strong className="text-slate-900">&quot;{generation.name}&quot;</strong> ({generation.code})?
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                Jenjang ini belum memiliki santri, kelas, atau modul kurikulum yang tertaut, sehingga aman untuk dihapus secara permanen.
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {hasRelations ? 'Tutup' : 'Batal'}
            </button>

            {!hasRelations && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Ya, Hapus Jenjang
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
