'use client';

import React from 'react';
import { BookOpen, Sparkles, Trash2 } from 'lucide-react';
import type { AvailableMaterial } from '../InteractiveCalendar';

interface ScheduleMaterialsSectionProps {
  availableMaterials: AvailableMaterial[];
  selectedMaterialIds: string[];
  onAddMaterial: (materialId: string) => void;
  onRemoveMaterial: (materialId: string) => void;
}

export default function ScheduleMaterialsSection({
  availableMaterials,
  selectedMaterialIds,
  onAddMaterial,
  onRemoveMaterial,
}: ScheduleMaterialsSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-teal-600" />
          <span>3. Materi Umum / Tambahan Sesi (Opsional)</span>
        </div>
        <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/80">
          {selectedMaterialIds.length} / 3 Materi Tambahan
        </span>
      </div>

      <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/70 text-xs text-teal-900 leading-relaxed flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">
            Kurikulum Bulanan Otomatis Aktif:
          </span>{' '}
          Materi baku bulanan tiap jenjang santri (misal Remaja &amp; Mandiri) akan otomatis muncul di jurnal pengajar sesuai kalender bulan sesi ini.
          <br />
          <span className="text-slate-600 font-normal">
            Pilih materi di sini{' '}
            <strong>hanya jika ada materi umum/insidental tambahan</strong>{' '}
            yang ingin diajarkan khusus pada sesi pengajian ini.
          </span>
        </div>
      </div>

      {selectedMaterialIds.length > 0 && (
        <div className="space-y-2">
          {selectedMaterialIds.map((matId, idx) => {
            const matObj = availableMaterials.find((m) => m.id === matId);
            return (
              <div
                key={matId}
                className="p-2.5 rounded-xl border border-teal-200/80 bg-teal-50/50 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[11px] font-bold shrink-0">
                    {idx === 0
                      ? 'Materi Tambahan 1'
                      : `Materi Tambahan #${idx + 1}`}
                  </span>
                  <span className="font-semibold text-slate-900 truncate">
                    {matObj?.title || 'Materi Terpilih'}
                  </span>
                  {matObj?.targetGeneration?.name && (
                    <span className="text-xs text-slate-500 shrink-0">
                      ({matObj.targetGeneration.name})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(matId)}
                  className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Hapus materi ini"
                  aria-label="Hapus materi tambahan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedMaterialIds.length < 3 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">
            + Tambah Materi Umum ke Sesi (Slot #
            {selectedMaterialIds.length + 1}):
          </label>
          <select
            value=""
            onChange={(e) => onAddMaterial(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
          >
            <option value="">
              -- Tambah Materi Umum / Insidental (Opsional) --
            </option>
            {availableMaterials
              .filter((m) => !selectedMaterialIds.includes(m.id))
              .map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.title}{' '}
                  {mat.targetGeneration?.name
                    ? `(${mat.targetGeneration.name})`
                    : ''}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  );
}
