'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  Plus,
  Search,
  MapPin,
  Clock,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  Layers,
  Users,
  Building2,
  Calendar,
  CalendarDays,
  Shield,
  ArrowRight
} from 'lucide-react';
import type { RollingIntervalType, RollingTargetScope, TierLevel } from '@prisma/client';
import RollingPengajianFormModal from './RollingPengajianFormModal';
import RotationProjectionTable from './RotationProjectionTable';
import { deleteRollingPengajian } from '@/app/(protected)/jadwal/rolling-pengajian/actions';

interface RollingPengajianListViewProps {
  initialList: any[];
  referenceData: any;
  canManage?: boolean;
}

export default function RollingPengajianListView({
  initialList = [],
  referenceData,
  canManage = true,
}: RollingPengajianListViewProps) {
  const router = useRouter();
  const [list, setList] = useState<any[]>(initialList);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState('ALL');
  const [selectedTierFilter, setSelectedTierFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any | null>(null);
  const [expandedProjectionId, setExpandedProjectionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Prefetch rute kembali ke kalender agar navigasi kembali instan
  useEffect(() => {
    router.prefetch('/jadwal');
  }, [router]);

  // Filter list
  const filteredList = list.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchVenue = item.venuePlaceName?.toLowerCase().includes(q);
      const matchMat = item.materialRolling?.name?.toLowerCase().includes(q);
      const matchTeach = item.teacherRolling?.name?.toLowerCase().includes(q);
      const matchClass = item.targetClasses?.some((tc: any) =>
        tc.class?.name?.toLowerCase().includes(q)
      );
      const matchGen = item.targetGenerations?.some((tg: any) =>
        tg.generation?.name?.toLowerCase().includes(q)
      );

      if (!matchName && !matchVenue && !matchMat && !matchTeach && !matchClass && !matchGen) {
        return false;
      }
    }

    if (selectedScopeFilter !== 'ALL' && item.targetScope !== selectedScopeFilter) {
      return false;
    }

    if (selectedTierFilter !== 'ALL' && item.tierLevel !== selectedTierFilter) {
      return false;
    }

    return true;
  });

  const handleOpenCreateModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengajian rolling "${name}"?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteRollingPengajian(id);
      if (res.error) {
        alert(res.error);
      } else {
        setList((prev) => prev.filter((item) => item.id !== id));
      }
    });
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  const getTierBadge = (tier: TierLevel) => {
    switch (tier) {
      case 'DAERAH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
            Daerah
          </span>
        );
      case 'DESA':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            Desa
          </span>
        );
      case 'KELOMPOK':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            Kelompok
          </span>
        );
    }
  };

  const renderScopeBadge = (item: any) => {
    switch (item.targetScope) {
      case 'KELAS':
        const classNames = item.targetClasses?.map((tc: any) => tc.class?.name).filter(Boolean) || [];
        return (
          <span className="flex flex-row text-[11px] font-semibold items-center gap-2">
            <Users className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <div className='flex flex-col'>
              {classNames.length > 0 ? `${classNames.join(', ')}` : 'Khusus Kelas'}
            </div>
          </span >
        );
      case 'GENERASI':
        const genNames = item.targetGenerations?.map((tg: any) => tg.generation?.name).filter(Boolean) || [];
        return (
          <span className="flex flex-row text-[11px] font-semibold items-center gap-2">
            <Users className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            {genNames.length > 0 ? `Jenjang: ${genNames.join(', ')}` : 'Khusus Jenjang Usia'}
          </span>
        );
      case 'WILAYAH_UMUM':
      default:
        return (
          <span className="flex flex-row text-[11px] font-semibold items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            Umum Se-Wilayah
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Navigation Breadcrumb / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/jadwal"
            prefetch={true}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Kembali ke Kalender Jadwal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
              Kelola Pengajian Rolling
            </h2>

          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengajian Rolling Baru</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pengajian, masjid, kelas, atau materi..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center items-start gap-2">
          <select
            value={selectedScopeFilter}
            onChange={(e) => setSelectedScopeFilter(e.target.value)}
            className="px-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium shrink-0"
          >
            <option value="ALL">Semua Sasaran Peserta</option>
            <option value="KELAS">Berdasarkan Kelas</option>
            <option value="GENERASI">Berdasarkan Jenjang Usia</option>
            <option value="WILAYAH_UMUM">Umum Se-Wilayah</option>
          </select>

          <select
            value={selectedTierFilter}
            onChange={(e) => setSelectedTierFilter(e.target.value)}
            className="px-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium shrink-0"
          >
            <option value="ALL">Semua Tingkatan Wilayah</option>
            <option value="KELOMPOK">Tingkat Kelompok</option>
            <option value="DESA">Tingkat Desa</option>
            <option value="DAERAH">Tingkat Daerah</option>
          </select>
        </div>
      </div>

      {/* Daftar Pengajian Rolling Cards */}
      <div className="space-y-4">
        {filteredList.map((item) => {
          const isExpanded = expandedProjectionId === item.id;

          return (
            <div
              key={item.id}
              className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition-all space-y-4"
            >
              {/* Header Card */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getTierBadge(item.tierLevel)}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                      {item.organization?.name || 'Wilayah'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-base text-slate-900 leading-snug break-words">
                    {item.name}
                  </h3>

                  {item.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-600 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-semibold">{item.venuePlaceName}</span>
                    <span className="text-[10px] text-slate-400">({item.venueType || 'MASJID'})</span>
                  </div>
                  {renderScopeBadge(item)}
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Edit Pengajian Rolling"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus Pengajian Rolling"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Grid Template Terpasang (Materi x Pengajar) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {/* Kolom Kiri: Template Materi */}
                <div className="p-3.5 rounded-xl border border-teal-200/80 bg-teal-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-teal-800 uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      Silabus Materi (Tahap 1)
                    </span>
                    <span className="px-2 py-0.2 rounded-md bg-teal-100 text-teal-800 font-bold text-[10px]">
                      {item.materialRolling?.rollingType}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {item.materialRolling?.name || 'Materi Belum Terpasang'}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.materialRolling?.itemsPerSession} materi per pengajian &bull; {item.materialRolling?.queues?.length || 0} antrean bergulir
                    </p>
                  </div>
                </div>

                {/* Kolom Kanan: Template Pengajar */}
                <div className="p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-sky-600" />
                      Dewan Pengajar (Tahap 2)
                    </span>
                    <span className="px-2 py-0.2 rounded-md bg-sky-100 text-sky-800 font-bold text-[10px]">
                      {item.teacherRolling?.rollingType}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {item.teacherRolling?.name || 'Pengajar Belum Terpasang'}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.teacherRolling?.teachersPerSession} ustadz per sesi &bull; {item.teacherRolling?.queues?.length || 0} antrean bergulir
                    </p>
                  </div>
                </div>
              </div>

              {/* Collapsible Preview Simulasi Proyeksi Rotasi */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExpandedProjectionId(isExpanded ? null : item.id)}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {isExpanded
                      ? 'Tutup Simulasi Proyeksi Rotasi'
                      : 'Lihat Simulasi Proyeksi Rotasi (Materi × Ustadz)'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 animate-in fade-in">
                    <RotationProjectionTable
                      materialRolling={item.materialRolling}
                      teacherRolling={item.teacherRolling}
                      projectionCount={6}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredList.length === 0 && (
          <div className="text-center py-14 px-4 bg-white/80 backdrop-blur-md rounded-2xl border border-dashed border-slate-200/90 flex flex-col items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60 shadow-2xs">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm sm:text-base text-slate-800">
              Belum Ada Blueprint Pengajian Rolling
            </h4>
            <p className="text-xs text-slate-500 max-w-md text-center leading-relaxed">
              Kombinasikan template silabus materi (Tahap 1) dan antrean ustadz (Tahap 2) menjadi blueprint
              kegiatan pengajian yang siap dijadwalkan secara teratur di kalender.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Mulai Buat Pengajian Rolling</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Form */}
      <RollingPengajianFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rollingPengajianToEdit={itemToEdit}
        referenceData={referenceData}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
