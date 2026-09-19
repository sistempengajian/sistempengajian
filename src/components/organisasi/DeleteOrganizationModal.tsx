'use client';

import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { OrganizationWithStats } from './types';
import { deleteOrganization } from '@/app/(protected)/organisasi/actions';

interface DeleteOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  org: OrganizationWithStats | null;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteOrganizationModal({
  isOpen,
  onClose,
  org,
  onSuccess,
}: DeleteOrganizationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !org) return null;

  const hasRelations =
    org.childrenCount > 0 ||
    org.userCount > 0 ||
    org.classCount > 0 ||
    org.materialCount > 0 ||
    org.scheduleCount > 0;

  const handleDelete = async () => {
    if (hasRelations) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteOrganization(org.id);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsDeleting(false);
        return;
      }

      onSuccess(org.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat menghapus tingkatan wilayah.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden animate-scale-up">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-2xs">
              <Trash2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Hapus Tingkatan Wilayah
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 block">
              Konfirmasi Penghapusan:
            </span>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-slate-900">
                {org.name}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {org.type}
              </span>
            </div>
            {org.parentName && (
              <p className="text-xs text-slate-500">
                Induk Wilayah: <strong>{org.parentName}</strong>
              </p>
            )}
          </div>

          {/* Alert jika data memiliki relasi aktif */}
          {hasRelations ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tidak Dapat Dihapus (Safety Guard)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Tingkatan wilayah ini masih memiliki data yang terhubung dalam sistem:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] font-semibold text-amber-900 pl-1">
                {org.childrenCount > 0 && <li>{org.childrenCount} Sub-wilayah binaan</li>}
                {org.userCount > 0 && <li>{org.userCount} Santri / Pengguna terdaftar</li>}
                {org.classCount > 0 && <li>{org.classCount} Kelas binaan aktif</li>}
                {org.materialCount > 0 && <li>{org.materialCount} Modul kurikulum materi</li>}
                {org.scheduleCount > 0 && <li>{org.scheduleCount} Jadwal pengajian</li>}
              </ul>
              <p className="text-[10px] text-amber-700 italic pt-1">
                Silakan pindahkan santri, kelas, atau sub-wilayah terlebih dahulu sebelum menghapus tingkatan ini demi keutuhan data.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Aman untuk Dihapus</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Tingkatan wilayah ini kosong (tidak ada santri, kelas, kurikulum, maupun sub-wilayah yang tertaut). Apakah Anda yakin ingin menghapus data ini secara permanen?
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            disabled={hasRelations || isDeleting}
            onClick={handleDelete}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
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
