'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  MapPin,
  Map,
  Landmark,
  Users,
  Check,
  Building2,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { OrganizationType } from '@prisma/client';

export interface OrganizationSelectOption {
  id: string;
  name: string;
  type: OrganizationType;
  parentId?: string | null;
  parentName?: string | null;
}

export interface OrganizationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizations: OrganizationSelectOption[];
  selectedId?: string | null;
  onSelect: (org: OrganizationSelectOption | null) => void;
  title?: string;
  description?: string;
  allowClear?: boolean;
}

const TYPE_CONFIG: Record<
  OrganizationType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    iconBgClass: string;
    activeBorderClass: string;
    pillActiveClass: string;
  }
> = {
  DAERAH: {
    label: 'Daerah',
    icon: Map,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    iconBgClass: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    activeBorderClass: 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20',
    pillActiveClass: 'bg-indigo-600 text-white shadow-xs',
  },
  DESA: {
    label: 'Desa',
    icon: Landmark,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    iconBgClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    activeBorderClass: 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20',
    pillActiveClass: 'bg-emerald-600 text-white shadow-xs',
  },
  KELOMPOK: {
    label: 'Kelompok',
    icon: Users,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    iconBgClass: 'bg-sky-50 text-sky-600 border-sky-200',
    activeBorderClass: 'border-sky-500 bg-sky-50/30 ring-2 ring-sky-500/20',
    pillActiveClass: 'bg-sky-600 text-white shadow-xs',
  },
};

export default function OrganizationSelectModal({
  isOpen,
  onClose,
  organizations = [],
  selectedId,
  onSelect,
  title = 'Pilih Wilayah Binaan',
  description = 'Cari dan pilih tingkatan wilayah (Daerah, Desa, atau Kelompok)',
  allowClear = false,
}: OrganizationSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeTab, setSelectedTypeTab] = useState<'ALL' | OrganizationType>('ALL');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedTypeTab('ALL');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Detect which types are actually present in the list
  const availableTypes = useMemo(() => {
    const types = new Set<OrganizationType>();
    organizations.forEach((org) => types.add(org.type));
    return Array.from(types);
  }, [organizations]);

  // Counts for each type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: organizations.length,
      DAERAH: 0,
      DESA: 0,
      KELOMPOK: 0,
    };
    organizations.forEach((org) => {
      if (counts[org.type] !== undefined) {
        counts[org.type] += 1;
      }
    });
    return counts;
  }, [organizations]);

  // Filtered organizations by Search Query and Type Tab
  const filteredOrganizations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return organizations.filter((org) => {
      // 1. Type Tab Filter
      if (selectedTypeTab !== 'ALL' && org.type !== selectedTypeTab) {
        return false;
      }

      // 2. Search query filter (matches name, parentName, or type)
      if (query) {
        const matchName = org.name.toLowerCase().includes(query);
        const matchParent = org.parentName ? org.parentName.toLowerCase().includes(query) : false;
        const matchType = org.type.toLowerCase().includes(query);
        return matchName || matchParent || matchType;
      }

      return true;
    });
  }, [organizations, searchQuery, selectedTypeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-linear-to-r from-slate-50 via-white to-emerald-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search Input & Filter Tabs */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
          {/* Kolom Pencarian */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama wilayah binaan atau nama induk..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200/90 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 font-medium placeholder:text-slate-400 transition-all outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs Tingkatan (Hanya tampil jika ada lebih dari 1 jenis tingkatan) */}
          {availableTypes.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
              {/* Tab Semua */}
              <button
                type="button"
                onClick={() => setSelectedTypeTab('ALL')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedTypeTab === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Semua</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    selectedTypeTab === 'ALL'
                      ? 'bg-slate-700 text-slate-100'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {typeCounts.ALL}
                </span>
              </button>

              {/* Tab per Tipe yang Tersedia */}
              {(['DAERAH', 'DESA', 'KELOMPOK'] as OrganizationType[]).map((type) => {
                if (!availableTypes.includes(type)) return null;
                const config = TYPE_CONFIG[type];
                const IconComponent = config.icon;
                const isSelected = selectedTypeTab === type;
                const count = typeCounts[type] || 0;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedTypeTab(type)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? config.pillActiveClass
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent className="w-3 h-3" />
                    <span>{config.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* List Opsi Wilayah Binaan */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2">
          {filteredOrganizations.length > 0 ? (
            filteredOrganizations.map((org) => {
              const config = TYPE_CONFIG[org.type] || TYPE_CONFIG.KELOMPOK;
              const IconComponent = config.icon;
              const isSelected = org.id === selectedId;

              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    onSelect(org);
                    onClose();
                  }}
                  className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 group cursor-pointer ${
                    isSelected
                      ? config.activeBorderClass
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Icon Box */}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? config.iconBgClass
                          : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-slate-200/70'
                      } transition-colors`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {org.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${config.badgeClass}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      {/* Parent hierarchy info */}
                      {org.parentName ? (
                        <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5 flex items-center gap-1">
                          <span>Induk:</span>
                          <span className="text-slate-700 font-semibold">
                            {org.parentName}
                          </span>
                        </p>
                      ) : (
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                          Tingkat Pusat Wilayah
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 shadow-2xs">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Terpilih</span>
                      </span>
                    ) : (
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-slate-500 group-hover:bg-slate-100 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  Tidak Ada Wilayah Ditemukan
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {searchQuery
                    ? `Tidak ada wilayah binaan yang cocok dengan pencarian "${searchQuery}".`
                    : 'Belum ada data wilayah binaan yang tersedia dalam kategori ini.'}
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-slate-500">
            Menampilkan {filteredOrganizations.length} dari {organizations.length} wilayah
          </span>

          <div className="flex items-center gap-2">
            {allowClear && selectedId && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
              >
                Hapus Pilihan
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
