'use client';

import React, { useEffect, useState } from 'react';

/**
 * In-App Initial Launch Splash Screen (Cold Start)
 * - Menampilkan karya artwork '/splash-screen.png' secara utuh & langsung saat aplikasi dibuka
 * - Dirender langsung dalam SSR HTML awal tanpa jeda kosong / tanpa komponen null
 * - Menghilangkan teks/logo bawaan di bawah agar murni menampilkan gambar splash-screen
 * - Dilengkapi transisi fade-out halus (500ms) setelah durasi tayang ~1.2 detik
 */
export default function InitialAppSplash() {
  const [dismissed, setDismissed] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Berikan waktu ~1.2 detik agar artwork splash-screen tampil utuh dan anggun
    const timer = setTimeout(() => {
      setFading(true);
      const closeTimer = setTimeout(() => {
        setDismissed(true);
      }, 500); // durasi fade-out 500ms

      return () => clearTimeout(closeTimer);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <div
      id="app-initial-splash"
      aria-hidden="true"
      className={`fixed inset-0 z-[100000] flex items-center justify-center select-none overflow-hidden transition-opacity duration-500 ease-out ${
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
        fetchPriority="high"
      />
    </div>
  );
}
