'use client';

import React from 'react';
import {
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  X,
  MapPin,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { OrganizationOption, GenerationOption } from './types';
import OrganizationSelectModal from '@/components/organisasi/OrganizationSelectModal';
import OrganizationSelectTrigger from '@/components/organisasi/OrganizationSelectTrigger';

interface UserFilterBarProps {
  activeRoleTab: string;
  onRoleTabChange: (role: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedOrgId: string;
  onOrgChange: (id: string) => void;
  selectedGenId: string;
  onGenChange: (id: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  viewMode: 'CARD' | 'TABLE';
  onViewModeChange: (mode: 'CARD' | 'TABLE') => void;
  organizations: OrganizationOption[];
  generations: GenerationOption[];
  totalResults: number;
  manageableRoles?: string[];
}

const ROLE_TABS = [
  { id: 'ALL', label: 'Semua Pengguna' },
  { id: 'SANTRI', label: 'Santri' },
  { id: 'ORANG_TUA', label: 'Orang Tua' },
  { id: 'PENGAJAR', label: 'Pengajar' },
  { id: 'WALI_KELAS', label: 'Wali Kelas' },
  { id: 'PJ_KELOMPOK', label: 'PJ Kelompok' },
  { id: 'PJ_DESA', label: 'PJ Desa' },
  { id: 'PJ_DAERAH', label: 'PJ Daerah' },
  { id: 'ADMIN_MASTER', label: 'Admin' },
];

export default function UserFilterBar({
  activeRoleTab,
  onRoleTabChange,
  searchQuery,
  onSearchChange,
  selectedOrgId,
  onOrgChange,
  selectedGenId,
  onGenChange,
  selectedStatus,
  onStatusChange,
  viewMode,
  onViewModeChange,
  organizations,
  generations,
  totalResults,
  manageableRoles,
}: UserFilterBarProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = React.useState(false);

  const selectedOrg = React.useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );

  const visibleRoleTabs = ROLE_TABS.filter((tab) => {
    if (tab.id === 'ALL') return true;
    if (manageableRoles) {
      return manageableRoles.includes(tab.id);
    }
    return true;
  });

  const hasActiveFilters =
    Boolean(selectedOrgId) ||
    Boolean(selectedGenId) ||
    (Boolean(selectedStatus) && selectedStatus !== 'ALL');

  const handleResetFilters = () => {
    onOrgChange('');
    onGenChange('');
    onStatusChange('ALL');
  };

  return (
    <div className="space-y-3">
      {/* 1. Horizontal Scrollable Role Filter Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl overflow-x-auto no-scrollbar shrink-0 max-w-full">
          {visibleRoleTabs.map((tab) => {
            const isActive = activeRoleTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onRoleTabChange(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher (Card vs Table) */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => onViewModeChange('CARD')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'CARD'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Tampilan Kartu (Mobile-First)"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Kartu</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('TABLE')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'TABLE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Tampilan Tabel"
          >
            <TableIcon className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Tabel</span>
          </button>
        </div>
      </div>

      {/* 2. Search Bar, Quick Filters & Result Counter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama, username, email, no HP..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200/80 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Toggle Filter Lanjutan */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              hasActiveFilters || showAdvancedFilters
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
            <span>Filter Wilayah & Generasi</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          <span className="text-[11px] font-semibold text-slate-500 hidden md:inline-block">
            {totalResults} pengguna ditemukan
          </span>
        </div>
      </div>

      {/* 3. Advanced Filter Collapsible Tray */}
      {showAdvancedFilters && (
        <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-slide-down">
          {/* Filter Wilayah */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Wilayah Binaan:
            </label>
            <OrganizationSelectTrigger
              size="sm"
              selectedOrg={selectedOrg}
              onClick={() => setIsOrgModalOpen(true)}
              onClear={() => onOrgChange('')}
              allowClear={true}
              placeholder="Semua Wilayah"
            />
            <OrganizationSelectModal
              isOpen={isOrgModalOpen}
              onClose={() => setIsOrgModalOpen(false)}
              organizations={organizations}
              selectedId={selectedOrgId}
              onSelect={(org) => onOrgChange(org ? org.id : '')}
              allowClear={true}
              title="Pilih Filter Wilayah Binaan"
              description="Filter daftar pengguna berdasarkan wilayah binaan"
            />
          </div>

          {/* Filter Generasi */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600">
              Jenjang Generasi:
            </label>
            <select
              value={selectedGenId}
              onChange={(e) => onGenChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 font-semibold focus:border-emerald-500 transition-all cursor-pointer"
            >
              <option value="">Semua Generasi</option>
              {generations.map((gen) => (
                <option key={gen.id} value={gen.id}>
                  {gen.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status Akun & Reset Button */}
          <div className="space-y-1 flex flex-col justify-between">
            <label className="block text-[11px] font-bold text-slate-600">
              Status Akun:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 font-semibold focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
                <option value="SUSPENDED">Ditangguhkan</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer shrink-0"
                  title="Reset Filter"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
