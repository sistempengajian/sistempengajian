'use client';

import { useState, useEffect } from 'react';

export type DeviceType = 'ios' | 'android' | 'desktop';

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true sampai client dicek

  useEffect(() => {
    // 1. Deteksi apakah sedang berjalan di dalam PWA (Standalone mode)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    // 2. Deteksi Device (iOS, Android, Desktop)
    const userAgent = window.navigator.userAgent || '';
    const isIosDevice = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /Android/i.test(userAgent);

    if (isIosDevice) {
      setDevice('ios');
    } else if (isAndroidDevice) {
      setDevice('android');
    } else {
      setDevice('desktop');
    }

    // 3. Deteksi apakah sudah pernah terinstal sebelumnya
    const savedInstalled = localStorage.getItem('sipanji_pwa_installed') === 'true';
    setIsInstalled(savedInstalled);

    // Cek getInstalledRelatedApps jika didukung browser Chrome
    if ('getInstalledRelatedApps' in navigator) {
      (navigator as any)
        .getInstalledRelatedApps()
        .then((apps: any[]) => {
          if (apps && apps.length > 0) {
            setIsInstalled(true);
            localStorage.setItem('sipanji_pwa_installed', 'true');
          }
        })
        .catch(() => {
          // ignore
        });
    }

    // 4. Periksa apakah banner ditutup sementara (misal 3 hari)
    const dismissedUntil = localStorage.getItem('sipanji_banner_dismissed_until');
    if (dismissedUntil) {
      const expiry = parseInt(dismissedUntil, 10);
      if (Date.now() < expiry) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } else {
      setIsDismissed(false);
    }

    // 5. Tangkap event 'beforeinstallprompt' dari browser Chrome/Edge/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Browser mendeteksi PWA belum terpasang
      setIsInstalled(false);
    };

    // 6. Tangkap event 'appinstalled' jika instalasi berhasil
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('sipanji_pwa_installed', 'true');
      setIsModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handler saat tombol Install / Buka diklik
  const handleInstallClick = async () => {
    // Jika sudah di dalam PWA, tidak perlu aksi tambahan
    if (isStandalone) return;

    // Jika sudah terinstal tapi membuka lewat browser:
    if (isInstalled) {
      // Coba luncurkan / beri tahu pengguna untuk membuka dari ikon Home Screen
      if (device === 'android') {
        // Pada Android, membuka start_url dengan target _blank seringkali otomatis memicu webview standalone
        window.location.href = '/dashboard';
      }
      setIsModalOpen(true);
      return;
    }

    // Jika native prompt tersedia (Android Chrome / Desktop Chrome)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          localStorage.setItem('sipanji_pwa_installed', 'true');
        }
        setDeferredPrompt(null);
      } catch {
        // Fallback jika prompt gagal
        setIsModalOpen(true);
      }
    } else {
      // Fallback untuk iOS Safari / browser tanpa native prompt API
      setIsModalOpen(true);
    }
  };

  // Tutup banner selama 3 hari
  const dismissBanner = () => {
    setIsDismissed(true);
    const threeDaysLater = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem('sipanji_banner_dismissed_until', threeDaysLater.toString());
  };

  return {
    isStandalone,
    isInstalled,
    device,
    isModalOpen,
    isDismissed,
    canPromptNative: Boolean(deferredPrompt),
    handleInstallClick,
    dismissBanner,
    openModal: () => setIsModalOpen(true),
    closeModal: () => setIsModalOpen(false),
  };
}
