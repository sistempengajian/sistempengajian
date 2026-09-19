'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  Calendar,
  CheckSquare,
  Users,
} from 'lucide-react';
import { ClassWithRelations } from './types';
import { deleteClass } from '@/app/(protected)/kelas/actions';

interface DeleteClassModalProps {
  isOpen: boolean;
  classData: ClassWithRelations | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteClassModal({
  isOpen,
  classData,
  onClose,
  onSuccess,
}: DeleteClassModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !classData) return null;

  const hasSchedules = classData._count.schedules > 0;
  const hasAssignments = classData._count.assignments > 0;
  const hasDependencies = hasSchedules || hasAssignments;

  const handleDelete = async () => {
    if (hasDependencies) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteClass(classData.id);
      if (res.success) {
        onSuccess(classData.id);
        onClose();
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat menghapus kelas.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Hapus Kelas Pengajian?
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Apakah Anda yakin ingin menghapus kelas{' '}
            <strong className="text-slate-800 font-bold">&quot;{classData.name}&quot;</strong>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </div>

        {/* Info Ringkas Kelas */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Jenjang Usia:</span>
            <span className="font-bold text-slate-800">{classData.generation.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Wilayah Binaan:</span>
            <span className="font-bold text-slate-800">{classData.organization.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Tahun Ajaran:</span>
            <span className="font-bold text-slate-800">TP {classData.academicYear}</span>
          </div>
        </div>

        {/* Peringatan Ketergantungan Data */}
        {hasDependencies ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Kelas Tidak Dapat Dihapus</span>
            </div>
            <p className="leading-snug text-amber-700">
              Kelas ini masih memiliki aktivitas pembelajaran yang tertaut:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 font-medium pl-1">
              {hasSchedules && (
                <li>{classData._count.schedules} Jadwal sesi pengajian</li>
              )}
              {hasAssignments && (
                <li>{classData._count.assignments} Tugas santri</li>
              )}
            </ul>
            <p className="text-[11px] text-amber-600 italic">
              Silakan pindahkan atau hapus jadwal dan tugas di kelas ini terlebih dahulu sebelum menghapus kelas demi menjaga keutuhan data riwayat presensi & nilai santri.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Kelas ini bersih dari ketergantungan jadwal dan tugas aktif, sehingga aman dihapus.</span>
          </div>
        )}

        {/* Pesan Error jika Ada */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || hasDependencies}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Permanen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
