'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  CheckCircle2,
  ListFilter,
  Check,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export interface CurriculumMaterialItem {
  id: string;
  title: string;
  description?: string | null;
  targetGenerationId?: string | null;
  targetGenerationName?: string | null;
  targetGenerationCode?: string | null;
  checklistCount?: number;
}

export interface GenerationOption {
  id: string;
  code?: string;
  name: string;
}

export interface CurriculumMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: CurriculumMaterialItem[];
  generations?: GenerationOption[];
  selectedMaterialId?: string | null;
  onSelectMaterial?: (material: CurriculumMaterialItem | null) => void;
  onSelect?: (material: CurriculumMaterialItem | null) => void;
}

export default function CurriculumMaterialModal({
  isOpen,
  onClose,
  materials,
  generations = [],
  selectedMaterialId,
  onSelectMaterial,
  onSelect,
}: CurriculumMaterialModalProps) {
  const [search, setSearch] = useState('');
  const [selectedGenId, setSelectedGenId] = useState<string>('ALL');

  // List of unique generation options derived from materials or passed prop
  const generationTabs = useMemo(() => {
    const tabs: Array<{ id: string; name: string }> = [{ id: 'ALL', name: 'Semua Generasi' }];
    if (generations && generations.length > 0) {
      generations.forEach((g) => {
        if (!tabs.some((t) => t.id === g.id)) {
          tabs.push({ id: g.id, name: g.name.split(' ')[0] });
        }
      });
    } else {
      materials.forEach((m) => {
        if (m.targetGenerationId && m.targetGenerationName) {
          if (!tabs.some((t) => t.id === m.targetGenerationId)) {
            tabs.push({ id: m.targetGenerationId, name: m.targetGenerationName.split(' ')[0] });
          }
        }
      });
    }
    return tabs;
  }, [generations, materials]);

  // Filtered materials based on search & generation
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(search.toLowerCase()));

      const matchGen =
        selectedGenId === 'ALL' ||
        m.targetGenerationId === selectedGenId;

      return matchSearch && matchGen;
    });
  }, [materials, search, selectedGenId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Pilih Materi Kurikulum
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pautkan penugasan dengan materi ajar & capaian kurikulum
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul atau topik materi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Generation Tabs */}
          {generationTabs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {generationTabs.map((tab) => {
                const isActive = selectedGenId === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedGenId(tab.id)}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Materials List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[260px]">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Materi Tidak Ditemukan</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {search
                  ? `Tidak ada materi yang sesuai dengan kata kunci "${search}".`
                  : 'Belum ada materi kurikulum untuk filter generasi ini.'}
              </p>
            </div>
          ) : (
            filteredMaterials.map((item) => {
              const isSelected = selectedMaterialId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (onSelectMaterial) onSelectMaterial(item);
                    if (onSelect) onSelect(item);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-500 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-teal-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-slate-900 leading-tight">
                        {item.title}
                      </span>
                      {item.targetGenerationName && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.targetGenerationName}
                        </span>
                      )}
                      {item.checklistCount !== undefined && item.checklistCount > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                          {item.checklistCount} Capaian
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 pt-0.5">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-slate-300 hover:border-teal-500 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onSelectMaterial) onSelectMaterial(null);
              if (onSelect) onSelect(null);
              onClose();
            }}
            className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 transition-colors"
          >
            Hapus Pilihan Materi
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-700 hover:bg-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
