'use client';

import React from 'react';
import {
  Trash2,
  BookOpen,
  Plus,
  RefreshCw,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { TierLevel } from '@prisma/client';
import { SelectedMaterialInfo } from './MaterialSelectModal';

interface MaterialQueueCardProps {
  queueIndex: number; // 0-based
  totalQueues: number;
  itemsPerSession: number;
  queueTitle?: string;
  slots: (SelectedMaterialInfo | null)[];
  onSlotClick: (queueIndex: number, slotIndex: number) => void;
  onBatchSelectClick: (queueIndex: number) => void;
  onRemoveQueue: (queueIndex: number) => void;
  onClearSlot: (queueIndex: number, slotIndex: number) => void;
}

export default function MaterialQueueCard({
  queueIndex,
  totalQueues,
  itemsPerSession,
  queueTitle,
  slots,
  onSlotClick,
  onBatchSelectClick,
  onRemoveQueue,
  onClearSlot,
}: MaterialQueueCardProps) {
  const stepNumber = queueIndex + 1;
  const canDelete = totalQueues > 2;

  // Helper badge warna wilayah yang selaras
  const getTierBadge = (tier: TierLevel) => {
    switch (tier) {
      case 'DAERAH':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
            Daerah
          </span>
        );
      case 'DESA':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            Desa
          </span>
        );
      case 'KELOMPOK':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            Kelompok
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white transition-all shadow-2xs space-y-3.5 relative group">
      {/* Header Kartu Antrean */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-800 font-extrabold text-xs flex items-center justify-center border border-teal-200/70 shadow-2xs">
            #{stepNumber}
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
              {queueTitle || `Antrean Ke-${stepNumber}`}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">
              Kapasitas: {itemsPerSession} materi per pengajian
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tombol Pilih Sekaligus (Jika itemsPerSession > 1) */}
          {itemsPerSession > 1 && (
            <button
              type="button"
              onClick={() => onBatchSelectClick(queueIndex)}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 px-2.5 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              title="Pilih seluruh slot materi sekaligus"
            >
              <Sparkles className="w-3 h-3 text-teal-600" />
              <span>Pilih Sekaligus</span>
            </button>
          )}

          {/* Tombol Hapus Antrean (Batas min 2) */}
          <button
            type="button"
            onClick={() => onRemoveQueue(queueIndex)}
            disabled={!canDelete}
            className={`p-1.5 rounded-xl text-slate-400 transition-colors ${
              canDelete
                ? 'hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-slate-300'
            }`}
            title={canDelete ? 'Hapus antrean ini' : 'Batas minimum 2 antrean rolling'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Daftar Slot Materi Sesuai itemsPerSession */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {Array.from({ length: itemsPerSession }).map((_, slotIdx) => {
          const material = slots[slotIdx];

          if (material) {
            return (
              <div
                key={`slot-${slotIdx}`}
                className="p-3 rounded-xl border border-teal-200/80 bg-teal-50/40 hover:bg-teal-50/70 transition-all flex flex-col justify-between gap-2 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {slotIdx + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Materi #{slotIdx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {getTierBadge(material.creatorTierLevel)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearSlot(queueIndex, slotIdx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                      title="Kosongkan slot ini"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => onSlotClick(queueIndex, slotIdx)}
                  className="cursor-pointer space-y-1"
                  title="Klik untuk mengganti materi"
                >
                  <h5 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                    {material.title}
                  </h5>

                  <div className="flex items-center justify-between text-[10px] text-teal-700 font-medium pt-1">
                    <span>{material.targetGeneration?.name || 'Semua Usia'}</span>
                    <span className="inline-flex items-center gap-0.5 hover:underline">
                      <RefreshCw className="w-2.5 h-2.5" /> Ganti
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // Slot Kosong (Empty State)
          return (
            <button
              key={`empty-slot-${slotIdx}`}
              type="button"
              onClick={() => onSlotClick(queueIndex, slotIdx)}
              className="p-3.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer group/slot min-h-[5.5rem]"
            >
              <div className="w-7 h-7 rounded-xl bg-slate-100 group-hover/slot:bg-teal-100 text-slate-500 group-hover/slot:text-teal-700 flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-600 group-hover/slot:text-teal-900">
                Pilih Materi ke-{slotIdx + 1}
              </span>
              <span className="text-[10px] text-slate-400">Klik untuk membuka katalog</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
