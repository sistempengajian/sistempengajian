'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Check,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { TierLevel } from '@prisma/client';
import { getAvailableMaterialsForRolling } from '@/app/(protected)/jadwal/rolling-materi/actions';

export interface SelectedMaterialInfo {
  id: string;
  title: string;
  creatorTierLevel: TierLevel;
  activeVersion?: string;
  versionLabel?: string;
  targetGeneration?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface MaterialSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxSelectCount: number; // Berapa materi yang bisa dipilih (1 atau sesuai itemsPerSession)
  initialSelectedIds?: string[];
  targetGenerationId?: string | null;
  onConfirm: (selectedMaterials: SelectedMaterialInfo[]) => void;
  title?: string;
}

export default function MaterialSelectModal({
  isOpen,
  onClose,
  maxSelectCount = 1,
  initialSelectedIds,
  targetGenerationId,
  onConfirm,
  title = 'Pilih Materi Pengajian',
}: MaterialSelectModalProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'ALL' | TierLevel>('ALL');
  const [selectedGenFilter, setSelectedGenFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Muat data materi saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    setSelectedIds(initialSelectedIds || []);
    setSelectedGenFilter(targetGenerationId || 'ALL');
    setSearchQuery('');
    setSelectedTierFilter('ALL');

    setIsLoading(true);
    getAvailableMaterialsForRolling()
      .then((res) => {
        if (res.data) {
          setMaterials(res.data);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  // Ekstrak daftar generasi unik dari data materi
  const availableGenerations = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    materials.forEach((m) => {
      if (m.targetGeneration) {
        map.set(m.targetGeneration.id, {
          id: m.targetGeneration.id,
          name: m.targetGeneration.name,
        });
      }
    });
    return Array.from(map.values());
  }, [materials]);

  // Filter materi berdasarkan pencarian, generasi, dan tingkatan wilayah
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t = (item.resolvedTitle || item.rawTitle || '').toLowerCase();
        if (!t.includes(q)) return false;
      }

      // Filter tingkatan wilayah
      if (selectedTierFilter !== 'ALL' && item.creatorTierLevel !== selectedTierFilter) {
        return false;
      }

      // Filter generasi
      if (selectedGenFilter !== 'ALL' && item.targetGenerationId !== selectedGenFilter) {
        return false;
      }

      return true;
    });
  }, [materials, searchQuery, selectedTierFilter, selectedGenFilter]);

  // Toggle seleksi materi
  const handleToggleSelect = (item: any) => {
    const exists = selectedIds.includes(item.id);
    if (exists) {
      setSelectedIds(selectedIds.filter((id) => id !== item.id));
    } else {
      if (maxSelectCount === 1) {
        setSelectedIds([item.id]);
      } else {
        if (selectedIds.length >= maxSelectCount) {
          // Ganti yang terakhir jika sudah penuh atau cegah
          alert(`Maksimal ${maxSelectCount} materi dapat dipilih sekaligus.`);
          return;
        }
        setSelectedIds([...selectedIds, item.id]);
      }
    }
  };

  const handleConfirm = () => {
    const chosenList = selectedIds
      .map((id) => materials.find((m) => m.id === id))
      .filter(Boolean)
      .map((m) => ({
        id: m.id,
        title: m.resolvedTitle || m.rawTitle,
        creatorTierLevel: m.creatorTierLevel,
        activeVersion: m.activeVersion,
        versionLabel: m.versionLabel,
        targetGeneration: m.targetGeneration,
      }));

    onConfirm(chosenList);
    onClose();
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-xl border border-slate-200/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">
                Pilih hingga {maxSelectCount} materi untuk slot antrean ini
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul materi kurikulum..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Filter Dropdowns: Generasi & Tingkatan Wilayah */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Generasi */}
            <div className="flex-1 min-w-[130px]">
              <select
                value={selectedGenFilter}
                onChange={(e) => setSelectedGenFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium"
              >
                <option value="ALL">Semua Generasi</option>
                {availableGenerations.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Tingkatan Wilayah */}
            <div className="flex-1 min-w-[130px]">
              <select
                value={selectedTierFilter}
                onChange={(e) => setSelectedTierFilter(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800 font-medium"
              >
                <option value="ALL">Semua Tingkat Wilayah</option>
                <option value="KELOMPOK">Tingkat Kelompok</option>
                <option value="DESA">Tingkat Desa</option>
                <option value="DAERAH">Tingkat Daerah</option>
              </select>
            </div>
          </div>
        </div>

        {/* Material Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Memuat katalog materi...</span>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-2xl">
              <AlertCircle className="w-6 h-6 text-slate-300" />
              <span>Tidak ada materi yang sesuai dengan filter.</span>
            </div>
          ) : (
            filteredMaterials.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const selectionIndex = selectedIds.indexOf(item.id) + 1;

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleSelect(item)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-500 shadow-2xs ring-1 ring-teal-500/30'
                      : 'bg-white hover:bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getTierBadge(item.creatorTierLevel)}
                      {item.targetGeneration && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                          {item.targetGeneration.name}
                        </span>
                      )}
                      {item.isCustomized && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70">
                          {item.versionLabel || 'Versi Khusus'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug break-words">
                      {item.resolvedTitle || item.rawTitle}
                    </h4>
                  </div>

                  <div className="shrink-0">
                    {maxSelectCount > 1 ? (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : 'border-2 border-slate-300 bg-white text-transparent'
                        }`}
                      >
                        {isSelected ? selectionIndex : ''}
                      </div>
                    ) : (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-600">
            Terpilih:{' '}
            <strong className="text-slate-900 font-bold">
              {selectedIds.length} / {maxSelectCount}
            </strong>{' '}
            materi
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-2xs"
            >
              Simpan Pilihan ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
