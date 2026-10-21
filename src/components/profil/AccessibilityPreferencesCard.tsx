'use client';

import React, { useState, useEffect } from 'react';
import { Type, Sun, Sparkles, Check, Eye } from 'lucide-react';
import { triggerHapticSuccess, triggerHapticLight } from '@/lib/haptics';
import { useToast } from '@/components/ui/Toast';

/**
 * Kartu Pengaturan Aksesibilitas & Keterbacaan Teks (Outdoor / Masjid Mode)
 * Memungkinkan pengguna memperbesar basis font seluruh modul secara proporsional
 * agar lebih mudah dibaca di bawah terik matahari atau saat membina di masjid.
 */
export default function AccessibilityPreferencesCard() {
  const toast = useToast();
  const [isLargeText, setIsLargeText] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isSavedLarge =
        localStorage.getItem('sipanji_large_text') === 'true' ||
        document.documentElement.getAttribute('data-text-scale') === 'large';
      setIsLargeText(isSavedLarge);
    } catch {
      // Fallback aman jika localStorage diblokir
    }
  }, []);

  const handleToggle = () => {
    const nextVal = !isLargeText;
    setIsLargeText(nextVal);

    try {
      if (nextVal) {
        document.documentElement.setAttribute('data-text-scale', 'large');
        localStorage.setItem('sipanji_large_text', 'true');
        triggerHapticSuccess();
        toast.success('Mode Teks Besar (Outdoor) diaktifkan (+10%).');
      } else {
        document.documentElement.removeAttribute('data-text-scale');
        localStorage.setItem('sipanji_large_text', 'false');
        triggerHapticLight();
        toast.info('Mode Teks Normal dipulihkan.');
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-200/60">
            <Type className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Aksesibilitas &amp; Ukuran Teks</h3>
            <p className="text-[11px] text-slate-500">
              Kenyamanan keterbacaan antarmuka di luar ruangan dan saat mengajar
            </p>
          </div>
        </div>

        {isLargeText && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-xl">
            <Sun className="w-3.5 h-3.5 text-amber-600" />
            Mode Outdoor Aktif
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Toggle Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900">Mode Teks Besar (Outdoor / Masjid)</h4>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                  +10% Skala
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Menaikkan ukuran teks antarmuka sebesar 10% agar lebih jelas terbaca di bawah sinar matahari saat di luar ruangan atau saat mengajar santri di masjid.
              </p>
            </div>
          </div>

          {/* Switch Button (Touch Target >= 44x44px) */}
          <button
            type="button"
            role="switch"
            aria-checked={isLargeText}
            aria-label="Aktifkan Mode Teks Besar"
            onClick={handleToggle}
            className={`
              relative min-h-[44px] min-w-[56px] inline-flex items-center p-1 rounded-full
              transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none shrink-0
              ${isLargeText ? 'bg-amber-500' : 'bg-slate-300'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-md
                transform ring-0 transition duration-200 ease-in-out flex items-center justify-center
                ${isLargeText ? 'translate-x-6' : 'translate-x-0'}
              `}
            >
              {isLargeText ? (
                <Check className="w-3.5 h-3.5 text-amber-600" strokeWidth={3} />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              )}
            </span>
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-200/50 flex items-start gap-2.5">
          <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Pratinjau Keterbacaan: </span>
            <span className="text-slate-600">
              &quot;Bismillah, presensi sesi halaqah santri dimulai pukul 18.00 WIB.&quot;
            </span>
            <p className="text-[10px] text-slate-400 mt-1">
              Perubahan ukuran berlaku instan di seluruh navigasi, kartu presensi, jadwal, dan kurikulum tanpa memicu muat ulang halaman.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
