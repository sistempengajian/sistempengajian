'use client';

import React, { useEffect, useCallback } from 'react';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import { triggerHapticLight } from '@/lib/haptics';

export type ViewMode = 'card' | 'table' | 'grid' | 'CARD' | 'TABLE';

export interface ViewModeToggleProps {
  /** Mode tampilan saat ini */
  viewMode: ViewMode;
  /** Callback saat mode tampilan diubah */
  onChange: (mode: any) => void;
  /** Kunci localStorage opsional untuk menyimpan preferensi tampilan per halaman */
  storageKey?: string;
  /** Kelas CSS tambahan untuk kontainer */
  className?: string;
  /** Ukuran tombol: 'sm' atau 'md' (keduanya tetap memenuhi touch target >= 44x44px) */
  size?: 'sm' | 'md';
}

/**
 * Komponen Toggle Tampilan Reusable (Kartu vs Tabel)
 * Memenuhi spesifikasi touch target minimal 44x44px (SiPanji Design Tokens)
 * dan mendukung sinkronisasi preferensi ke localStorage secara otomatis.
 */
export default function ViewModeToggle({
  viewMode,
  onChange,
  storageKey,
  className = '',
  size = 'md',
}: ViewModeToggleProps) {
  const isCardActive = viewMode === 'card' || viewMode === 'CARD' || viewMode === 'grid';
  const isTableActive = viewMode === 'table' || viewMode === 'TABLE';

  // Sinkronisasi preferensi tersimpan di localStorage saat pertama kali dimuat
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const savedMode = localStorage.getItem(storageKey);
      if (savedMode && savedMode !== viewMode) {
        // Cocokkan casing dengan tipe mode yang sedang dipakai
        if (viewMode === 'CARD' || viewMode === 'TABLE') {
          onChange(savedMode.toUpperCase());
        } else if (viewMode === 'grid' && savedMode.toLowerCase() === 'card') {
          onChange('grid');
        } else {
          onChange(savedMode.toLowerCase());
        }
      }
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }, [storageKey, onChange, viewMode]);

  const handleSelect = useCallback(
    (targetMode: 'card' | 'table') => {
      triggerHapticLight();
      let modeToEmit: ViewMode = targetMode;

      if (viewMode === 'CARD' || viewMode === 'TABLE') {
        modeToEmit = targetMode.toUpperCase() as ViewMode;
      } else if (viewMode === 'grid' && targetMode === 'card') {
        modeToEmit = 'grid';
      }

      onChange(modeToEmit);

      if (storageKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, targetMode);
        } catch {
          // Abaikan jika quota localStorage penuh
        }
      }
    },
    [viewMode, onChange, storageKey]
  );

  return (
    <div
      role="group"
      aria-label="Pilihan Tampilan Data"
      className={`inline-flex items-center p-1 bg-slate-200/70 border border-slate-200/80 rounded-2xl shadow-2xs shrink-0 ${className}`}
    >
      {/* Tombol Kartu */}
      <button
        type="button"
        onClick={() => handleSelect('card')}
        aria-pressed={isCardActive}
        aria-label="Tampilan Kartu"
        title="Tampilan Kartu (Mobile-First)"
        className={`
          min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all
          flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95
          ${
            isCardActive
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }
        `}
      >
        <LayoutGrid className="w-4 h-4 shrink-0" />
        <span className={size === 'sm' ? 'hidden sm:inline text-[11px]' : 'text-xs'}>Kartu</span>
      </button>

      {/* Tombol Tabel */}
      <button
        type="button"
        onClick={() => handleSelect('table')}
        aria-pressed={isTableActive}
        aria-label="Tampilan Tabel"
        title="Tampilan Tabel Kompak"
        className={`
          min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all
          flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95
          ${
            isTableActive
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
          }
        `}
      >
        <TableIcon className="w-4 h-4 shrink-0" />
        <span className={size === 'sm' ? 'hidden sm:inline text-[11px]' : 'text-xs'}>Tabel</span>
      </button>
    </div>
  );
}
