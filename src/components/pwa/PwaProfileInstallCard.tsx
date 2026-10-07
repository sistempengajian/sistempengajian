'use client';

import React from 'react';
import {
  Smartphone,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Zap,
  WifiOff,
  Maximize2,
} from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import PwaInstallModal from './PwaInstallModal';

export default function PwaProfileInstallCard() {
  const {
    isStandalone,
    isInstalled,
    device,
    isModalOpen,
    handleInstallClick,
    closeModal,
  } = usePwaInstall();

  return (
    <>
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Header Card */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200/60">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900">Aplikasi SiPanji (PWA Mobile)</h3>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-2.5 h-2.5" />
                <span>PWA</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pasang pintasan aplikasi di Layar Utama HP untuk pengalaman terbaik
            </p>
          </div>
        </div>

        {/* Status Konten */}
        {isStandalone ? (
          /* Kasus 1: Sedang Berjalan di dalam PWA Standalone */
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-900">
                Aplikasi Aktif dalam Mode PWA Standalone
              </h4>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Anda sedang menggunakan SiPanji sebagai aplikasi terpasang di perangkat ini. Anda
                menikmati tampilan layar penuh, transisi instan, dan performa optimal.
              </p>
            </div>
          </div>
        ) : (
          /* Kasus 2: Membuka Lewat Browser Biasa */
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-150 flex items-center gap-2.5 text-slate-700">
                <Maximize2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-medium">Layar penuh tanpa bilah browser</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-150 flex items-center gap-2.5 text-slate-700">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-medium">Akses langsung dari ikon Home Screen</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-150 flex items-center gap-2.5 text-slate-700">
                <WifiOff className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-medium">Cache offline cerdas &amp; hemat kuota</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-500">
                {isInstalled
                  ? 'Aplikasi terdeteksi sudah terpasang di perangkat ini.'
                  : 'Pasang sekarang tanpa perlu mengunduh lewat Play Store / App Store.'}
              </div>

              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isInstalled ? (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka di Aplikasi SiPanji</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Pasang Aplikasi SiPanji (Install PWA)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

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
