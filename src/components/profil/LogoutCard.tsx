'use client';

import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/(auth)/actions';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface LogoutCardProps {
  userName?: string;
  userEmail?: string | null;
}

export default function LogoutCard({ userName }: LogoutCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);
    try {
      await logout();
    } catch {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-rose-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Keluar dari Sesi Aplikasi
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md">
                Mengakhiri sesi akun Anda pada perangkat ini. Anda dapat masuk kembali kapan saja menggunakan nomor WhatsApp terdaftar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/20 hover:shadow-lg hover:shadow-rose-600/30 transition-all cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isModalOpen}
        title="Konfirmasi Keluar Sesi?"
        description={`Apakah Anda yakin ingin keluar dari akun ${userName || 'Pengguna'}? Sesi aktif pada browser ini akan dihapus.`}
        variant="danger"
        confirmText="Ya, Keluar"
        cancelText="Batal"
        isPending={isPending}
        onConfirm={handleLogout}
        onCancel={() => setIsModalOpen(false)}
      />
    </>
  );
}
