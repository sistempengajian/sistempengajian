'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  Info,
  Plus,
  Search,
  LayoutGrid,
  GitFork,
  Layers,
} from 'lucide-react';
import { OrganizationType } from '@prisma/client';
import {
  OrganizationsOverviewData,
  OrganizationWithStats,
} from './types';
import OrganizationMetricsOverview from './OrganizationMetricsOverview';
import OrganizationCard from './OrganizationCard';
import OrganizationTreeView from './OrganizationTreeView';
import DeleteOrganizationModal from './DeleteOrganizationModal';

interface OrganizationManagementViewProps {
  initialData: OrganizationsOverviewData;
}

export default function OrganizationManagementView({
  initialData,
}: OrganizationManagementViewProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>(
    initialData.organizations
  );
  const [tree, setTree] = useState(initialData.tree);
  const [metrics, setMetrics] = useState(initialData.metrics);

  const [activeTab, setActiveTab] = useState<'ALL' | OrganizationType>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TREE'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');

  const [orgToDelete, setOrgToDelete] = useState<OrganizationWithStats | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userPermissions = initialData.userPermissions;
  const { canEdit } = userPermissions;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenDelete = (org: OrganizationWithStats) => {
    setOrgToDelete(org);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setOrganizations((prev) => prev.filter((o) => o.id !== deletedId));
    showToast('Tingkatan wilayah berhasil dihapus dari sistem.');
  };

  // Filter organisasi berdasarkan Tab dan Pencarian
  const filteredOrganizations = organizations.filter((org) => {
    if (activeTab !== 'ALL' && org.type !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = org.name.toLowerCase().includes(q);
      const matchParent = org.parentName?.toLowerCase().includes(q);
      const matchType = org.type.toLowerCase().includes(q);
      return matchName || matchParent || matchType;
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-4 sm:right-8 z-50 rounded-2xl bg-emerald-700 text-white px-4 py-3 shadow-xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-semibold animate-slide-down">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman: Mobile-friendly Stack */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs shrink-0">
                <Landmark className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                Kelola Tingkatan &amp; Wilayah Binaan
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pengaturan hierarki wilayah pengajian: Daerah, Desa, dan Kelompok binaan.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {canEdit ? (
              <>
                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Akses Pengelola
                </span>

                {userPermissions.canCreateOrg !== false && (
                  <Link
                    href="/organisasi/tambah"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Tambah Wilayah</span>
                  </Link>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                Mode Panduan (Lihat)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ringkasan Metrik Global */}
      <OrganizationMetricsOverview
        totalDaerah={metrics.totalDaerah}
        totalDesa={metrics.totalDesa}
        totalKelompok={metrics.totalKelompok}
        totalUsers={metrics.totalUsers}
      />

      {/* Toolbar Kontrol: Filter Tabs, Search Bar, & View Mode Switcher */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Scrollable Tabs on Mobile */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Tingkatan
            </button>
            {organizations.some((o) => o.type === 'DAERAH') && (
              <button
                type="button"
                onClick={() => setActiveTab('DAERAH')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'DAERAH'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tingkat Daerah
              </button>
            )}
            {organizations.some((o) => o.type === 'DESA') && (
              <button
                type="button"
                onClick={() => setActiveTab('DESA')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'DESA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tingkat Desa
              </button>
            )}
            {organizations.some((o) => o.type === 'KELOMPOK') && (
              <button
                type="button"
                onClick={() => setActiveTab('KELOMPOK')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'KELOMPOK'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tingkat Kelompok
              </button>
            )}
          </div>

          {/* View Mode Switcher (Grid vs Tree) */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Tampilan Kartu Grid"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Kartu</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('TREE')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  viewMode === 'TREE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Tampilan Pohon Hierarki"
              >
                <GitFork className="w-4 h-4" />
                <span className="hidden sm:inline text-[11px]">Hierarki</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Result Count */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama wilayah atau induk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200/80 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 shadow-2xs transition-all"
            />
          </div>

          <span className="text-[11px] font-semibold text-slate-500 self-end sm:self-center">
            Menampilkan {filteredOrganizations.length} dari {organizations.length} tingkatan wilayah
          </span>
        </div>
      </div>

      {/* Main Content: Tree View OR Card Grid */}
      {viewMode === 'TREE' ? (
        <OrganizationTreeView
          tree={tree}
          canEdit={canEdit}
          editableOrgIds={userPermissions.editableOrgIds}
        />
      ) : (
        <>
          {filteredOrganizations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {filteredOrganizations.map((org) => (
                <OrganizationCard
                  key={org.id}
                  org={org}
                  canEdit={
                    userPermissions.editableOrgIds
                      ? userPermissions.editableOrgIds.includes(org.id)
                      : canEdit
                  }
                  canDelete={
                    userPermissions.deletableOrgIds
                      ? userPermissions.deletableOrgIds.includes(org.id)
                      : canEdit
                  }
                  onDelete={handleOpenDelete}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-white border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Tidak ada tingkatan wilayah yang cocok
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `Tidak ditemukan tingkatan wilayah dengan kata kunci "${searchQuery}".`
                  : 'Belum ada data tingkatan wilayah untuk kategori ini.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal Hapus Wilayah (Safety Guard Dialog) */}
      <DeleteOrganizationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOrgToDelete(null);
        }}
        org={orgToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
