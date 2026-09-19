'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Check,
  Users,
  Sparkles,
  UserCheck,
  Building2,
  Filter,
  User,
} from 'lucide-react';
import { UserRole } from '@prisma/client';

export interface GenerationOption {
  id: string;
  code?: string;
  name: string;
  minAge?: number;
  maxAge?: number;
  description?: string | null;
  studentCount?: number;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface StudentOption {
  id: string;
  fullName: string;
  generationId?: string | null;
  generationCode?: string | null;
  generationName?: string;
  organizationName?: string | null;
  avatarUrl?: string | null;
}

export interface TargetAudienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGenerations?: GenerationOption[];
  generations?: GenerationOption[];
  availableStudents?: StudentOption[];
  students?: StudentOption[];
  initialGenerationIds?: string[];
  initialSelectedGenerations?: string[];
  initialSelectedGenerationIds?: string[];
  initialStudentIds?: string[];
  initialSelectedStudents?: string[];
  initialSelectedStudentIds?: string[];
  onSave?: ((generationIds: string[], studentIds: string[]) => void) | ((result: { generationIds: string[]; studentIds: string[] }) => void);
  onApply?: (generationIds: string[], studentIds: string[]) => void;
  availableClasses?: GenerationOption[] | ClassOption[];
  classes?: GenerationOption[] | ClassOption[];
  initialClassIds?: string[];
}

export default function TargetAudienceModal({
  isOpen,
  onClose,
  availableGenerations = [],
  generations = [],
  availableStudents = [],
  students = [],
  initialGenerationIds = [],
  initialSelectedGenerations,
  initialSelectedGenerationIds,
  initialStudentIds = [],
  initialSelectedStudents,
  initialSelectedStudentIds,
  onSave,
  onApply,
  availableClasses,
  classes,
  initialClassIds,
}: TargetAudienceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'GENERATIONS' | 'STUDENTS'>('GENERATIONS');

  const genList = availableGenerations.length > 0
    ? availableGenerations
    : (generations.length > 0 ? generations : []);
  const classList = (availableClasses || classes || []) as GenerationOption[];
  const effectiveGenerations = genList.length > 0 ? genList : classList;
  const effectiveStudents = availableStudents.length > 0 ? availableStudents : students;

  const startingGenerationIds = useMemo(() => {
    if (initialGenerationIds && initialGenerationIds.length > 0) return initialGenerationIds;
    if (initialSelectedGenerations && initialSelectedGenerations.length > 0) return initialSelectedGenerations;
    if (initialSelectedGenerationIds && initialSelectedGenerationIds.length > 0) return initialSelectedGenerationIds;
    if (initialClassIds && initialClassIds.length > 0) return initialClassIds;
    return [];
  }, [
    initialGenerationIds?.join(','),
    initialSelectedGenerations?.join(','),
    initialSelectedGenerationIds?.join(','),
    initialClassIds?.join(','),
  ]);

  const startingStudentIds = useMemo(() => {
    if (initialStudentIds && initialStudentIds.length > 0) return initialStudentIds;
    if (initialSelectedStudents && initialSelectedStudents.length > 0) return initialSelectedStudents;
    if (initialSelectedStudentIds && initialSelectedStudentIds.length > 0) return initialSelectedStudentIds;
    return [];
  }, [
    initialStudentIds?.join(','),
    initialSelectedStudents?.join(','),
    initialSelectedStudentIds?.join(','),
  ]);

  const [selectedGenerationIds, setSelectedGenerationIds] = useState<string[]>(startingGenerationIds);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(startingStudentIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenFilter, setSelectedGenFilter] = useState<string | 'ALL'>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard shortcut Escape untuk menutup modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Sinkronisasi state awal saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSelectedGenerationIds(startingGenerationIds);
      setSelectedStudentIds(startingStudentIds);
      setSearchQuery('');
      setSelectedGenFilter('ALL');
    }
  }, [isOpen]);

  // Filter santri berdasarkan filter tab generasi & query pencarian
  const filteredStudents = useMemo(() => {
    return effectiveStudents.filter((s) => {
      // 1. Filter tombol jenjang generasi
      if (selectedGenFilter !== 'ALL' && s.generationId !== selectedGenFilter) {
        return false;
      }
      // 2. Filter input pencarian teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.fullName.toLowerCase().includes(q);
        const matchGen = s.generationName?.toLowerCase().includes(q);
        const matchOrg = s.organizationName?.toLowerCase().includes(q);
        return matchName || matchGen || matchOrg;
      }
      return true;
    });
  }, [effectiveStudents, selectedGenFilter, searchQuery]);

  if (!isOpen) return null;

  const toggleGeneration = (id: string) => {
    setSelectedGenerationIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllGenerations = () => {
    if (selectedGenerationIds.length === effectiveGenerations.length) {
      setSelectedGenerationIds([]);
    } else {
      setSelectedGenerationIds(effectiveGenerations.map((g) => g.id));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectFilteredStudents = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    const allFilteredSelected = filteredIds.every((id) => selectedStudentIds.includes(id));

    if (allFilteredSelected) {
      // Deselect yang ada di filter saat ini
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Tambahkan semua yang ada di filter saat ini
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleApply = () => {
    if (onSave) {
      try {
        (onSave as any)({ generationIds: selectedGenerationIds, studentIds: selectedStudentIds });
      } catch {}
      try {
        (onSave as any)(selectedGenerationIds, selectedStudentIds);
      } catch {}
    }
    if (onApply) {
      onApply(selectedGenerationIds, selectedStudentIds);
    }
    onClose();
  };

  // Ringkasan label footer
  const getFooterSummary = () => {
    const parts: string[] = [];
    if (selectedGenerationIds.length > 0) {
      if (effectiveGenerations.length > 0 && selectedGenerationIds.length === effectiveGenerations.length) {
        parts.push('Semua Generasi');
      } else {
        const names = effectiveGenerations
          .filter((g) => selectedGenerationIds.includes(g.id))
          .map((g) => g.name.split(' ')[0]);
        parts.push(`${names.join(', ')}`);
      }
    }
    if (selectedStudentIds.length > 0) {
      parts.push(`${selectedStudentIds.length} Santri Khusus`);
    }
    if (parts.length === 0) {
      return 'Sasaran: Terbuka untuk seluruh santri';
    }
    return `Sasaran: ${parts.join(' • ')}`;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col relative z-[81]">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-teal-50/80 border-b border-teal-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Pilih Sasaran Penugasan
              </h3>
              <p className="text-[11px] text-slate-500">
                Pilih jenjang generasi otomatis atau tentukan santri spesifik
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 flex items-center justify-center border border-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigasi: Pilih Generasi VS Santri Spesifik */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/70 p-1.5 shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('GENERATIONS')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'GENERATIONS'
              ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Users className="w-4 h-4 text-teal-600" />
            <span>Pilih Generasi ({selectedGenerationIds.length}/{effectiveGenerations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STUDENTS')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${activeTab === 'STUDENTS'
              ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/80'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>Santri Khusus ({selectedStudentIds.length})</span>
          </button>
        </div>

        {/* Isi Konten Tab */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'GENERATIONS' ? (
            /* TAB 1: PILIH GENERASI (SELURUH SANTRI DALAM GENERASI LANGSUNG) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="text-slate-500 font-medium">
                  {selectedGenerationIds.length === 0
                    ? 'Belum ada generasi dipilih'
                    : `${selectedGenerationIds.length} Generasi Dipilih`}
                </span>
                {effectiveGenerations.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllGenerations}
                    className="text-teal-700 font-bold hover:underline cursor-pointer"
                  >
                    {selectedGenerationIds.length === effectiveGenerations.length
                      ? 'Kosongkan Pilihan'
                      : 'Pilih Semua Generasi'}
                  </button>
                )}
              </div>

              {effectiveGenerations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada master generasi yang terdaftar di sistem.
                </div>
              ) : (
                <div className="space-y-2">
                  {effectiveGenerations.map((gen) => {
                    const isSelected = selectedGenerationIds.includes(gen.id);
                    return (
                      <div
                        key={gen.id}
                        onClick={() => toggleGeneration(gen.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${isSelected
                          ? 'bg-teal-50/90 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500/20'
                          : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${isSelected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 bg-white group-hover:border-teal-400'
                              }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold truncate">
                                {gen.name}
                              </span>
                              {gen.minAge !== undefined && gen.maxAge !== undefined && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                                  {gen.minAge}-{gen.maxAge} Thn
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Indikator Jumlah Santri di Wilayah Ini */}
                        <div className="shrink-0 ml-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors ${isSelected
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                          >
                            {gen.studentCount ?? 0} Santri
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: SANTRI SPESIFIK (DENGAN FILTER GENERASI & PENCARIAN CEPAT) */
            <div className="space-y-3">
              {/* TOMBOL FILTER GENERASI (PILL CHIPS) */}
              <div className="space-y-1.5">

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 tab-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedGenFilter('ALL')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${selectedGenFilter === 'ALL'
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/70'
                      }`}
                  >
                    Semua ({availableStudents.length})
                  </button>
                  {effectiveGenerations.map((g) => {
                    const count = g.studentCount ?? availableStudents.filter((s) => s.generationId === g.id).length;
                    const isActive = selectedGenFilter === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGenFilter(g.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${isActive
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200/70'
                          }`}
                      >
                        {g.name.split(' ')[0]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Pencarian Santri */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama santri atau kelompok..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Action Bar Sub Santri */}
              <div className="flex items-center justify-between text-xs pb-0.5">
                <span className="text-slate-500 font-medium">
                  {selectedStudentIds.length === 0
                    ? 'Belum ada santri yang dipilih'
                    : `${selectedStudentIds.length} Santri Spesifik Dipilih`}
                </span>
                {filteredStudents.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectFilteredStudents}
                    className="text-teal-700 font-bold hover:underline cursor-pointer"
                  >
                    {filteredStudents.every((s) => selectedStudentIds.includes(s.id))
                      ? 'Kosongkan Hasil'
                      : 'Pilih Semua'}
                  </button>
                )}
              </div>

              {/* Daftar Santri */}
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  {searchQuery || selectedGenFilter !== 'ALL'
                    ? 'Tidak ada santri yang cocok dengan filter atau pencarian saat ini.'
                    : 'Belum ada data santri di unit organisasi Anda.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-1">
                  {filteredStudents.map((s) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isSelected
                          ? 'bg-teal-50/80 border-teal-500 text-teal-950 font-bold ring-1 ring-teal-500/20'
                          : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0 ${isSelected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 bg-white'
                              }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {s.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold truncate text-slate-800">
                              {s.fullName}
                            </h5>
                            <div className="flex items-center gap-2 mt-0.5">
                              {s.generationName && (
                                <span className="text-[10px] text-teal-700 font-medium bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60 truncate">
                                  {s.generationName}
                                </span>
                              )}
                              {s.organizationName && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-0.5 truncate">
                                  <Building2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>{s.organizationName}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pl-3 sm:p-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-700 font-medium truncate mr-2">
            {getFooterSummary()}
          </div>
          <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
              >
                Terapkan Sasaran
              </button>
            </div>
          </div>
        </div>
      </div>
    </div >
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
