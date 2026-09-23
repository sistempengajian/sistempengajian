'use client';

import React, { useState } from 'react';
import {
  AnalyticsFilterOptions,
  AnalyticsPeriod,
  AnalyticsScopeType,
  ScopeFilterOption,
} from '@/app/(protected)/analisis/types';
import {
  Calendar,
  Layers,
  Users,
  Presentation,
  Printer,
  Eye,
  EyeOff,
  Filter,
  Check,
  ChevronDown,
  Sparkles,
  Search,
  X,
  Building2,
  GraduationCap,
} from 'lucide-react';

interface AnalyticsFilterBarProps {
  filterOptions: AnalyticsFilterOptions;
  currentScopeType: AnalyticsScopeType;
  currentScopeId?: string;
  currentPeriod: AnalyticsPeriod;
  selectedStudentIds: string[];
  isPrivacyMode: boolean;
  onScopeChange: (type: AnalyticsScopeType, id?: string, studentIds?: string[]) => void;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onTogglePrivacyMode: () => void;
  onOpenPresentation: () => void;
  onOpenExportModal: () => void;
  isPending?: boolean;
}

const SCOPE_TYPE_LABELS: Record<AnalyticsScopeType, { label: string; icon: React.FC<{ className?: string }> }> = {
  CLASS: { label: 'Kelas', icon: GraduationCap },
  GENERATION: { label: 'Jenjang Generasi', icon: Layers },
  KELOMPOK: { label: 'Kelompok Pengajian', icon: Users },
  DESA: { label: 'Desa', icon: Building2 },
  DAERAH: { label: 'Daerah', icon: Building2 },
  CUSTOM: { label: 'Santri Terpilih', icon: Sparkles },
};

const PERIOD_OPTIONS: { id: AnalyticsPeriod; label: string }[] = [
  { id: 'THIS_MONTH', label: 'Bulan Ini' },
  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
  { id: 'THIS_SEMESTER', label: 'Semester Ini' },
  { id: 'ALL', label: 'Semua Periode' },
];

export const AnalyticsFilterBar: React.FC<AnalyticsFilterBarProps> = ({
  filterOptions,
  currentScopeType,
  currentScopeId,
  currentPeriod,
  selectedStudentIds,
  isPrivacyMode,
  onScopeChange,
  onPeriodChange,
  onTogglePrivacyMode,
  onOpenPresentation,
  onOpenExportModal,
  isPending = false,
}) => {
  const [isCustomStudentModalOpen, setIsCustomStudentModalOpen] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [tempSelectedStudentIds, setTempSelectedStudentIds] = useState<string[]>(selectedStudentIds);

  // Get active items according to selected scope type
  const getScopeItems = (): ScopeFilterOption[] => {
    switch (currentScopeType) {
      case 'CLASS':
        return filterOptions.classes;
      case 'GENERATION':
        return filterOptions.generations;
      case 'KELOMPOK':
        return filterOptions.kelompoks;
      case 'DESA':
        return filterOptions.desas;
      case 'DAERAH':
        return filterOptions.daerahs;
      default:
        return [];
    }
  };

  const currentItems = getScopeItems();
  const activeItem = currentItems.find((i) => i.id === currentScopeId) || currentItems[0];

  const handleScopeTypeSelect = (type: AnalyticsScopeType) => {
    if (type === 'CUSTOM') {
      setTempSelectedStudentIds(selectedStudentIds);
      setIsCustomStudentModalOpen(true);
      return;
    }

    let defaultId: string | undefined;
    if (type === 'CLASS' && filterOptions.classes[0]) defaultId = filterOptions.classes[0].id;
    else if (type === 'GENERATION' && filterOptions.generations[0]) defaultId = filterOptions.generations[0].id;
    else if (type === 'KELOMPOK' && filterOptions.kelompoks[0]) defaultId = filterOptions.kelompoks[0].id;
    else if (type === 'DESA' && filterOptions.desas[0]) defaultId = filterOptions.desas[0].id;
    else if (type === 'DAERAH' && filterOptions.daerahs[0]) defaultId = filterOptions.daerahs[0].id;

    onScopeChange(type, defaultId);
  };

  const handleEntitySelect = (id: string) => {
    onScopeChange(currentScopeType, id);
  };

  const toggleStudentSelection = (studentId: string) => {
    setTempSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleApplyCustomStudents = () => {
    if (tempSelectedStudentIds.length === 0) {
      alert('Pilih setidaknya 1 santri untuk cohort komparasi.');
      return;
    }
    setIsCustomStudentModalOpen(false);
    onScopeChange('CUSTOM', undefined, tempSelectedStudentIds);
  };

  const filteredCustomStudents = filterOptions.availableStudents.filter(
    (s) =>
      s.fullName.toLowerCase().includes(customSearchQuery.toLowerCase()) ||
      s.className.toLowerCase().includes(customSearchQuery.toLowerCase()) ||
      s.organizationName.toLowerCase().includes(customSearchQuery.toLowerCase())
  );

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col gap-4">
        {/* Row 1: Scope Tabs & Entity Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Scope Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 lg:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline-flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-teal-600" />
              Lingkup:
            </span>
            {filterOptions.allowedScopeTypes.map((scopeType) => {
              const meta = SCOPE_TYPE_LABELS[scopeType] || { label: scopeType, icon: Filter };
              const Icon = meta.icon;
              const isActive = currentScopeType === scopeType;

              return (
                <button
                  key={scopeType}
                  type="button"
                  onClick={() => handleScopeTypeSelect(scopeType)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${isActive
                    ? 'bg-teal-600 text-white shadow-2xs ring-1 ring-teal-500'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{meta.label}</span>
                  {scopeType === 'CUSTOM' && selectedStudentIds.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-teal-800 px-1.5 py-0.2 text-[10px] text-teal-100 font-mono">
                      {selectedStudentIds.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Entity Dropdown Selector (if not custom) */}
          {currentScopeType !== 'CUSTOM' && currentItems.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <select
                  value={currentScopeId || activeItem?.id}
                  onChange={(e) => handleEntitySelect(e.target.value)}
                  disabled={isPending}
                  aria-label="Pilih Unit Analisis"
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 pr-9 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-100/70 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  {currentItems.map((item) => (
                    <option key={item.id} value={item.id} className="bg-white text-slate-800">
                      {item.name} {item.subtitle ? `(${item.subtitle})` : ''} {item.count ? `• ${item.count} Santri` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>
          )}

          {/* If custom, button to re-select cohort */}
          {currentScopeType === 'CUSTOM' && (
            <button
              type="button"
              onClick={() => {
                setTempSelectedStudentIds(selectedStudentIds);
                setIsCustomStudentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Pilih Ulang Santri ({selectedStudentIds.length})</span>
            </button>
          )}
        </div>

        {/* Row 2: Period & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Period Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-slate-400 mr-1 hidden md:inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              Periode:
            </span>
            {PERIOD_OPTIONS.map((periodOpt) => {
              const isSelected = currentPeriod === periodOpt.id;
              return (
                <button
                  key={periodOpt.id}
                  type="button"
                  onClick={() => onPeriodChange(periodOpt.id)}
                  disabled={isPending}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${isSelected
                    ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600'
                    }`}
                >
                  {periodOpt.label}
                </button>
              );
            })}
          </div>

          {/* Action Tools: Privacy Mode, Fullscreen Presentation, Export Modal */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Privacy Mode Toggle */}
            <button
              type="button"
              onClick={onTogglePrivacyMode}
              title={isPrivacyMode ? 'Matikan Sensor Privasi' : 'Aktifkan Sensor Privasi (Samarkan Nama Santri)'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${isPrivacyMode
                ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs ring-1 ring-amber-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                }`}
            >
              {isPrivacyMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>Privasi Aktif</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sensor Nama</span>
                </>
              )}
            </button>

            {/* Mode Presentasi / Rapat */}
            <button
              type="button"
              onClick={onOpenPresentation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Mode Rapat</span>
            </button>

            {/* Ekspor & Cetak Ringkasan */}
            <button
              type="button"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor &amp; Cetak</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Multi-Student Selector Modal */}
      {isCustomStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-slate-900 text-base">Pilih Santri untuk Analisis Cohort</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomStudentModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari santri berdasarkan nama / kelas..."
                  value={customSearchQuery}
                  onChange={(e) => setCustomSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1 py-1 border-b border-slate-100 mb-2">
              <span>
                Terpilih: <strong className="text-teal-700 font-bold">{tempSelectedStudentIds.length}</strong> santri
              </span>
              <div className="flex gap-2 font-semibold">
                <button
                  type="button"
                  onClick={() => setTempSelectedStudentIds(filterOptions.availableStudents.map((s) => s.id))}
                  className="text-teal-600 hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setTempSelectedStudentIds([])}
                  className="text-slate-500 hover:underline cursor-pointer"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[360px] scrollbar-thin scrollbar-thumb-slate-200">
              {filteredCustomStudents.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">Santri tidak ditemukan.</p>
              ) : (
                filteredCustomStudents.map((s) => {
                  const isChecked = tempSelectedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudentSelection(s.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${isChecked
                        ? 'bg-teal-50/70 border-teal-300 text-teal-950 font-medium'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs text-slate-900 truncate">{s.fullName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {s.className} • {s.organizationName}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-2">
              <button
                type="button"
                onClick={() => setIsCustomStudentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyCustomStudents}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-2xs cursor-pointer"
              >
                Terapkan Filter ({tempSelectedStudentIds.length} Santri)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AnalyticsFilterBar;
