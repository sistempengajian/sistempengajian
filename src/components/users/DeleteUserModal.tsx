'use client';

import React, { useState } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { UserWithRelations } from './types';
import { deleteUser, toggleUserStatus } from '@/app/(protected)/users/actions';

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserWithRelations | null;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteUserModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: DeleteUserModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !user) return null;

  const hasHistory =
    user.stats.attendancesCount > 0 ||
    user.stats.submissionsCount > 0 ||
    user.stats.assignmentsCount > 0 ||
    user.stats.classesCount > 0;

  const handleDelete = async () => {
    if (hasHistory) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteUser(user.id);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsDeleting(false);
        return;
      }

      onSuccess(user.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Terjadi kesalahan sistem saat menghapus akun pengguna.'
      );
      setIsDeleting(false);
    }
  };

  const handleSuspend = async () => {
    setIsSuspending(true);
    setErrorMessage(null);

    try {
      const newStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      const res = await toggleUserStatus(user.id, newStatus);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsSuspending(false);
        return;
      }

      onSuccess(user.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Gagal mengubah status akun pengguna.'
      );
      setIsSuspending(false);
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
              Kelola Status / Hapus Akun
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
              Pengguna yang dipilih:
            </span>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-slate-900 truncate">
                {user.fullName}
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              Peran:{' '}
              <strong>{user.roles.map((r) => r.role).join(', ')}</strong>
            </p>
          </div>

          {/* Alert jika pengguna memiliki riwayat historis */}
          {hasHistory ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Akun Memiliki Riwayat Historis Aktif</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Akun ini tidak disarankan untuk dihapus permanen karena memiliki data historis pengajian:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] font-semibold text-amber-900 pl-1">
                {user.stats.attendancesCount > 0 && (
                  <li>{user.stats.attendancesCount} Rekam data presensi</li>
                )}
                {user.stats.submissionsCount > 0 && (
                  <li>{user.stats.submissionsCount} Riwayat pengumpulan tugas</li>
                )}
                {user.stats.assignmentsCount > 0 && (
                  <li>{user.stats.assignmentsCount} Tugas kurikulum yang diterbitkan</li>
                )}
                {user.stats.classesCount > 0 && (
                  <li>{user.stats.classesCount} Penugasan wali kelas binaan</li>
                )}
              </ul>
              <p className="text-[11px] text-amber-900 font-bold pt-1">
                Rekomendasi Aman: Nonaktifkan atau Tangguhkan akun agar data statistik dan nilai santri tetap utuh.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Aman untuk Dihapus</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Akun ini belum memiliki riwayat presensi atau pengerjaan tugas. Apakah Anda yakin ingin menghapus akun ini secara permanen?
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
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer text-center"
          >
            Batal
          </button>

          {hasHistory ? (
            <button
              type="button"
              disabled={isSuspending}
              onClick={handleSuspend}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSuspending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memperbarui Status...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>
                    {user.status === 'SUSPENDED'
                      ? 'Aktifkan Kembali Akun'
                      : 'Tangguhkan Akun (Suspend)'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Akun Permanen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
