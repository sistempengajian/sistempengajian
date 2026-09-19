'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Plus,
  Search,
  Calendar,
  Clock,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Sparkles,
  CalendarDays,
  UserCheck,
  MapPin,
  Shield
} from 'lucide-react';
import type { RollingIntervalType, TierLevel } from '@prisma/client';
import TeacherRollingFormModal from './TeacherRollingFormModal';
import { deleteTeacherRolling } from '@/app/(protected)/jadwal/rolling-pengajar/actions';

interface TeacherRollingListViewProps {
  initialRollings: any[];
  canManage?: boolean;
}

export default function TeacherRollingListView({
  initialRollings = [],
  canManage = true,
}: TeacherRollingListViewProps) {
  const router = useRouter();
  const [rollings, setRollings] = useState<any[]>(initialRollings);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rollingToEdit, setRollingToEdit] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Prefetch rute kembali ke kalender agar navigasi kembali instan
  useEffect(() => {
    router.prefetch('/jadwal');
  }, [router]);

  // Filter rollings berdasarkan query pencarian dan tier wilayah
  const filteredRollings = rollings.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchDesc = r.description?.toLowerCase().includes(q);
      const matchTeacher = r.queues?.some((queue: any) =>
        queue.items?.some(
          (it: any) =>
            it.teacher?.fullName?.toLowerCase().includes(q) ||
            it.substituteTeacher?.fullName?.toLowerCase().includes(q)
        )
      );
      if (!matchName && !matchDesc && !matchTeacher) return false;
    }

    if (selectedTierFilter !== 'ALL' && r.tierLevel !== selectedTierFilter) {
      return false;
    }

    return true;
  });

  const handleOpenCreateModal = () => {
    setRollingToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rolling: any) => {
    setRollingToEdit(rolling);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus rolling pengajar "${name}"?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteTeacherRolling(id);
      if (res.error) {
        alert(res.error);
      } else {
        setRollings((prev) => prev.filter((r) => r.id !== id));
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

  const getRollingTypeBadge = (type: RollingIntervalType) => {
    switch (type) {
      case 'PER_PENGAJIAN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200/80 flex items-center gap-1">
            <Clock className="w-3 h-3 text-sky-600" />
            Per Pengajian
          </span>
        );
      case 'MINGGUAN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-blue-600" />
            Mingguan (7 Hari)
          </span>
        );
      case 'BULANAN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/80 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-indigo-600" />
            Bulanan
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
              Kelola Rolling Pengajar
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tahap 2: Master antrean ustadz/dewan pengajar bergulir per pengajian, mingguan, atau bulanan
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Rolling Pengajar Baru</span>
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
            placeholder="Cari nama rolling pengajar atau nama ustadz..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-800 font-medium placeholder:text-slate-400"
          />
        </div>

        <select
          value={selectedTierFilter}
          onChange={(e) => setSelectedTierFilter(e.target.value)}
          className="px-3.5 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-800 font-medium shrink-0"
        >
          <option value="ALL">Semua Tingkatan Wilayah</option>
          <option value="KELOMPOK">Tingkat Kelompok</option>
          <option value="DESA">Tingkat Desa</option>
          <option value="DAERAH">Tingkat Daerah</option>
        </select>
      </div>

      {/* Daftar Rolling Cards */}
      <div className="space-y-3.5">
        {filteredRollings.map((rolling) => {
          const isExpanded = expandedId === rolling.id;
          const queuesCount = rolling.queues?.length || 0;

          return (
            <div
              key={rolling.id}
              className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all space-y-3.5"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {getTierBadge(rolling.tierLevel)}
                    {getRollingTypeBadge(rolling.rollingType)}
                  </div>

                  <h3 className="font-bold text-base text-slate-900 leading-snug break-words">
                    {rolling.name}
                  </h3>

                  {rolling.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{rolling.description}</p>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                    <span>
                      Kapasitas:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {rolling.teachersPerSession} Pengajar / Sesi
                      </strong>
                    </span>
                    <span>
                      Panjang Antrean:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {queuesCount} Antrean Bergulir
                      </strong>
                    </span>
                    <span>Wilayah: {rolling.organization?.name}</span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(rolling)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-sky-50 transition-colors cursor-pointer"
                      title="Edit Rolling Pengajar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rolling.id, rolling.name)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus Rolling Pengajar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Collapsible Preview Antrean */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rolling.id)}
                  className="text-xs font-bold text-sky-700 hover:text-sky-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    {isExpanded ? 'Sembunyikan Urutan Pengajar' : 'Lihat Susunan Urutan Pengajar'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in">
                    {rolling.queues?.map((q: any) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-800 border-b border-slate-200/60 pb-1.5">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 text-[10px] flex items-center justify-center font-bold">
                              #{q.stepOrder}
                            </span>
                            <span>{q.title || `Antrean #${q.stepOrder}`}</span>
                          </span>
                        </div>

                        <div className="space-y-2">
                          {q.items?.map((it: any, sIdx: number) => (
                            <div
                              key={it.id}
                              className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900 truncate">
                                  {it.teacher?.fullName || 'Pengajar Belum Terpilih'}
                                </span>
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                                  Slot {sIdx + 1}
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-400 truncate">
                                {it.teacher?.organization?.name || 'Pusat'}
                              </p>

                              {it.substituteTeacher && (
                                <div className="pt-1 mt-1 border-t border-slate-100 flex items-center gap-1 text-[10px] text-amber-800">
                                  <span className="px-1 py-0.2 rounded bg-amber-100 font-semibold text-[9px]">
                                    Badal:
                                  </span>
                                  <span className="truncate">{it.substituteTeacher.fullName}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredRollings.length === 0 && (
          <div className="text-center py-14 px-4 bg-white/80 backdrop-blur-md rounded-2xl border border-dashed border-slate-200/90 flex flex-col items-center justify-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/60 shadow-2xs">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm sm:text-base text-slate-800">
              Belum Ada Konfigurasi Rolling Pengajar
            </h4>
            <p className="text-xs text-slate-500 max-w-md text-center leading-relaxed">
              Buat konfigurasi rotasi pengajar/ustadz untuk pemerataan dakwah dan pengasuhan santri
              secara bergiliran per sesi, per minggu, atau per bulan.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Mulai Buat Rolling Pengajar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Form Tambah / Edit Rolling */}
      <TeacherRollingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rollingToEdit={rollingToEdit}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
