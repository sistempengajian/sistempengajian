'use client';

import React, { useEffect, useState } from 'react';

const SPLASH_SESSION_KEY = 'sipanji_pwa_splash_shown';

/**
 * In-App Initial Launch Splash Screen (PWA Standalone Session)
 * - Tidak memblokir SSR HTML maupun refresh browser reguler sehingga konten SSR DashboardHero tampil instan
 * - Hanya tampil singkat (~500ms + fade 300ms) pada peluncuran pertama sesi mode PWA standalone
 */
export default function InitialAppSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
      if (isStandalone && !alreadyShown) {
        sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
      }
    } catch {
      alreadyShown = true;
    }

    if (!isStandalone || alreadyShown) {
      return;
    }

    setVisible(true);
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setFading(true);
      closeTimer = setTimeout(() => {
        setVisible(false);
      }, 300);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      id="app-initial-splash"
      aria-hidden="true"
      className={`fixed inset-0 z-[100000] flex items-center justify-center select-none overflow-hidden transition-opacity duration-300 ease-out ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        backgroundColor: '#1773ba',
      }}
    >
      <img
        src="/splash-screen.png"
        alt="Sistem Pengajian"
        className="w-full h-full object-cover max-w-lg mx-auto"
      />
    </div>
  );
}
