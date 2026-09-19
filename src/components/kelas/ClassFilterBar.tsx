'use client';

import React from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  X,
  Calendar,
  Layers,
  RotateCcw,
} from 'lucide-react';

interface GenerationFilterOption {
  id: string;
  name: string;
  code: string;
  color: string | null;
}

interface ClassFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedGenerationId: string;
  onGenerationChange: (id: string) => void;
  selectedTierLevel: string;
  onTierLevelChange: (tier: string) => void;
  selectedAcademicYear: string;
  onAcademicYearChange: (year: string) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
  generations: GenerationFilterOption[];
  academicYears: string[];
  totalResults: number;
  filteredResults: number;
}

export default function ClassFilterBar({
  searchQuery,
  onSearchChange,
  selectedGenerationId,
  onGenerationChange,
  selectedTierLevel,
  onTierLevelChange,
  selectedAcademicYear,
  onAcademicYearChange,
  viewMode,
  onViewModeChange,
  generations,
  academicYears,
  totalResults,
  filteredResults,
}: ClassFilterBarProps) {
  const hasActiveFilters =
    Boolean(selectedGenerationId && selectedGenerationId !== 'ALL') ||
    Boolean(selectedTierLevel && selectedTierLevel !== 'ALL') ||
    Boolean(selectedAcademicYear && selectedAcademicYear !== 'ALL') ||
    Boolean(searchQuery.trim());

  const handleResetFilters = () => {
    onSearchChange('');
    onGenerationChange('ALL');
    onTierLevelChange('ALL');
    onAcademicYearChange('ALL');
  };

  return (
    <div className="space-y-3">
      {/* 1. Baris Kontrol Atas: Pencarian, Filter Tingkatan Wilayah, Filter Tahun Ajaran, & View Switcher */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
        {/* Input Pencarian */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari kelas, wali kelas, wilayah..."
            className="w-full pl-10 pr-9 py-2 rounded-2xl bg-white/95 border border-slate-200/80 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters & Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Dropdown Tingkatan Wilayah */}
          <div className="relative flex-1 sm:flex-none min-w-[130px]">
            <select
              value={selectedTierLevel}
              onChange={(e) => onTierLevelChange(e.target.value)}
              className={`w-full sm:w-auto pl-8 pr-7 py-2 rounded-2xl border text-xs font-bold transition-all shadow-2xs cursor-pointer appearance-none ${
                selectedTierLevel !== 'ALL'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30'
                  : 'bg-white/95 text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="KELOMPOK">Tingkat Kelompok</option>
              <option value="DESA">Tingkat Desa</option>
              <option value="DAERAH">Tingkat Daerah</option>
            </select>
            <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Dropdown Tahun Ajaran */}
          <div className="relative flex-1 sm:flex-none min-w-[125px]">
            <select
              value={selectedAcademicYear}
              onChange={(e) => onAcademicYearChange(e.target.value)}
              className={`w-full sm:w-auto pl-8 pr-7 py-2 rounded-2xl border text-xs font-bold transition-all shadow-2xs cursor-pointer appearance-none ${
                selectedAcademicYear !== 'ALL'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/30'
                  : 'bg-white/95 text-slate-700 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <option value="ALL">Semua Tahun</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  TP {yr}
                </option>
              ))}
            </select>
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Reset Filter Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 h-9 px-2.5 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all text-xs font-semibold cursor-pointer shrink-0"
              title="Reset Semua Filter"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}

          {/* View Mode Switcher (Grid / Table) */}
          <div className="hidden md:inline-flex items-center p-0.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Kartu"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Chip Filter Jenjang Generasi (Scrollable Horizontal) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 flex-1">
          <button
            type="button"
            onClick={() => onGenerationChange('ALL')}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              selectedGenerationId === 'ALL'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-semibold'
                : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Jenjang
          </button>

          {generations.map((gen) => {
            const isSelected = selectedGenerationId === gen.id;
            return (
              <button
                key={gen.id}
                type="button"
                onClick={() => onGenerationChange(gen.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold shadow-xs ring-1 ring-emerald-400'
                    : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    gen.color === 'sky'
                      ? 'bg-sky-500'
                      : gen.color === 'purple'
                      ? 'bg-purple-500'
                      : gen.color === 'amber'
                      ? 'bg-amber-500'
                      : gen.color === 'rose'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>{gen.name}</span>
              </button>
            );
          })}
        </div>

        {/* Indikator Jumlah Hasil */}
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 hidden sm:inline">
          Menampilkan <strong className="text-slate-700">{filteredResults}</strong> dari{' '}
          <strong className="text-slate-700">{totalResults}</strong> kelas
        </span>
      </div>
    </div>
  );
}
