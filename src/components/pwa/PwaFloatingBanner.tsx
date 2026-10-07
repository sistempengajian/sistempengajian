'use client';

import React from 'react';
import { X, Download, ExternalLink, Sparkles } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import PwaInstallModal from './PwaInstallModal';

export default function PwaFloatingBanner() {
  const {
    isStandalone,
    isInstalled,
    device,
    isModalOpen,
    isDismissed,
    handleInstallClick,
    dismissBanner,
    closeModal,
  } = usePwaInstall();

  // Jika sudah di dalam mode PWA Standalone atau banner ditutup oleh user, jangan tampilkan banner
  if (isStandalone || isDismissed) {
    return (
      <PwaInstallModal
        isOpen={isModalOpen}
        onClose={closeModal}
        device={device}
        isInstalled={isInstalled}
      />
    );
  }

  return (
    <>
      <aside
        aria-label="Pemasangan Aplikasi SiPanji"
        className="fixed bottom-4 sm:bottom-6 inset-x-4 max-w-md mx-auto z-[9990] select-none animate-slide-up"
      >
        <div className="rounded-2xl bg-white/95 backdrop-blur-xl border border-emerald-200/90 shadow-[0_12px_36px_rgba(16,185,129,0.18)] p-3 sm:p-3.5 flex items-center justify-between gap-3 text-slate-800 transition-all">
          {/* Sisi Kiri: Ikon & Teks Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center p-1 shadow-2xs shrink-0">
              <img
                src="/icons/icon-192x192.svg"
                alt="Logo SiPanji"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight truncate">
                  {isInstalled ? 'Aplikasi SiPanji' : 'Pasang SiPanji'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {isInstalled
                  ? 'Buka di aplikasi yang sudah terpasang'
                  : 'Akses cepat di layar HP & hemat kuota'}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Tombol Aksi & Tombol Tutup */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isInstalled ? (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={dismissBanner}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              title="Tutup pemberitahuan ini"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Modal Petunjuk Instalasi */}
      <PwaInstallModal
        isOpen={isModalOpen}
        onClose={closeModal}
        device={device}
        isInstalled={isInstalled}
      />
    </>
  );
}
