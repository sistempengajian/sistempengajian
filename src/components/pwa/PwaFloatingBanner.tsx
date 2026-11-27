'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { X, Download, ExternalLink, Sparkles } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import PwaInstallModal from './PwaInstallModal';

export default function PwaFloatingBanner() {
  const pathname = usePathname();
  const bannerRef = useRef<HTMLElement>(null);
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

  const isTutorialRoute = Boolean(pathname?.startsWith('/tutorial'));
  const isBannerVisible = !isTutorialRoute && !isStandalone && !isDismissed;

  // Publikasikan tinggi banner ke CSS custom property agar FAB mobile di halaman lain naik otomatis tanpa bertumpuk
  useEffect(() => {
    const root = document.documentElement;
    if (!isBannerVisible) {
      root.style.setProperty('--pwa-banner-clearance', '0px');
      return;
    }

    const updateClearance = () => {
      const height = bannerRef.current?.offsetHeight ?? 70;
      root.style.setProperty('--pwa-banner-clearance', `${height + 8}px`);
    };

    updateClearance();
    window.addEventListener('resize', updateClearance);
    return () => {
      window.removeEventListener('resize', updateClearance);
      root.style.setProperty('--pwa-banner-clearance', '0px');
    };
  }, [isBannerVisible]);

  // Jangan tampilkan banner di halaman tutorial / product tour
  if (isTutorialRoute) {
    return null;
  }

  // Deteksi rute publik/auth tanpa BottomNav agar banner hanya naik saat berada di rute protected
  const isAuthOrPublicRoute =
    pathname === '/' ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/izin') ||
    pathname?.startsWith('/badal') ||
    pathname?.startsWith('/evaluasi') ||
    pathname?.startsWith('/pengajar') ||
    pathname?.startsWith('/keluarga') ||
    pathname?.startsWith('/tugas/paraf');

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
        ref={bannerRef}
        aria-label="Pemasangan Aplikasi SiPanji"
        className={`fixed ${
          isAuthOrPublicRoute
            ? 'bottom-4 sm:bottom-6'
            : 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] sm:bottom-6'
        } inset-x-4 max-w-md mx-auto z-[35] select-none animate-slide-up`}
      >
        <div className="rounded-2xl bg-white/95 backdrop-blur-xl border border-emerald-200/90 shadow-[0_12px_36px_rgba(16,185,129,0.18)] p-3 sm:p-3.5 flex items-center justify-between gap-2.5 text-slate-800 transition-all">
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
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {isInstalled
                  ? 'Buka aplikasi terpasang'
                  : 'Akses cepat & hemat kuota'}
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Tombol Aksi & Tombol Tutup */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              title="Tutup pemberitahuan ini"
              aria-label="Tutup pemberitahuan pasang aplikasi"
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
