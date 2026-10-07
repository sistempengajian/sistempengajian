'use client';

import React, { useEffect, useState } from 'react';

/**
 * In-App Initial Launch Splash Screen (Cold Start)
 * - Menampilkan karya artwork Canva '/splash-screen.png' secara utuh saat aplikasi pertama kali dibuka
 * - Menggunakan Session Guard (sessionStorage): hanya muncul pada sesi peluncuran baru
 * - Dilengkapi transisi fade-out halus (500ms) saat sistem siap
 */
export default function InitialAppSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    try {
      const alreadySeen = sessionStorage.getItem('sipanji_app_splash_seen');
      if (!alreadySeen) {
        setVisible(true);

        // Berikan waktu ~1.4 detik agar artwork Canva dinikmati secara anggun
        const timer = setTimeout(() => {
          setFading(true);
          const closeTimer = setTimeout(() => {
            setVisible(false);
            sessionStorage.setItem('sipanji_app_splash_seen', 'true');
          }, 500); // durasi fade-out 500ms

          return () => clearTimeout(closeTimer);
        }, 1400);

        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100000] flex flex-col items-center justify-between select-none overflow-hidden transition-opacity duration-500 ease-out bg-[#2B73C4] ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Background & Illustration Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Gambar Splash Canva */}
        <img
          src="/splash-screen.png"
          alt="Sistem Pengajian SiPanji"
          className="w-full h-full object-cover sm:object-contain max-w-md mx-auto drop-shadow-2xl"
          fetchPriority="high"
        />

        {/* Floating Indicator Mini di Bagian Bawah Layar */}
        <div className="absolute bottom-8 inset-x-0 mx-auto w-fit z-10 px-4">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 text-slate-800 shadow-2xl backdrop-blur-md border border-white/80 animate-pulse">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-slate-700">
              Memuat SiPanji...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
