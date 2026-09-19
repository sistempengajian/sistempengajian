'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  CheckCircle2,
  Filter,
  Sparkles,
  Loader2,
  AlertCircle,
  User,
  Shield,
  MapPin,
  Phone
} from 'lucide-react';
import type { TierLevel } from '@prisma/client';
import { getAvailableTeachersForRolling } from '@/app/(protected)/jadwal/rolling-pengajar/actions';

export interface SelectedTeacherInfo {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  gender?: string;
  phoneNumber?: string | null;
  organization?: {
    id: string;
    name: string;
    type: string;
  } | null;
  roles?: {
    role: string;
  }[];
}

interface TeacherSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxSelectCount?: number;
  initialSelectedIds?: string[];
  onConfirm: (selectedTeachers: SelectedTeacherInfo[]) => void;
  title?: string;
  subtitle?: string;
}

export default function TeacherSelectModal({
  isOpen,
  onClose,
  maxSelectCount = 1,
  initialSelectedIds,
  onConfirm,
  title = 'Pilih Pengajar / Ustadz',
  subtitle,
}: TeacherSelectModalProps) {
  const [teachers, setTeachers] = useState<SelectedTeacherInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'ALL' | TierLevel>('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedIds(initialSelectedIds || []);
    setSearchQuery('');
    setSelectedTierFilter('ALL');
    setSelectedRoleFilter('ALL');

    setIsLoading(true);
    getAvailableTeachersForRolling()
      .then((res) => {
        if (res.data) {
          setTeachers(res.data as SelectedTeacherInfo[]);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  // Filter pengajar berdasarkan pencarian, tingkatan wilayah, dan peran
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      // Filter teks nama & nomor telepon
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = teacher.fullName.toLowerCase().includes(q);
        const matchPhone = teacher.phoneNumber?.toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }

      // Filter tier level wilayah organisasi
      if (selectedTierFilter !== 'ALL') {
        if (teacher.organization?.type !== selectedTierFilter) return false;
      }

      // Filter peran
      if (selectedRoleFilter !== 'ALL') {
        const hasRole = teacher.roles?.some((r) => {
          if (selectedRoleFilter === 'PJ_WILAYAH') {
            return ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH'].includes(r.role);
          }
          return r.role === selectedRoleFilter;
        });
        if (!hasRole) return false;
      }

      return true;
    });
  }, [teachers, searchQuery, selectedTierFilter, selectedRoleFilter]);

  // Handle pemilihan ustadz
  const handleToggleSelect = (teacher: SelectedTeacherInfo) => {
    if (maxSelectCount === 1) {
      setSelectedIds([teacher.id]);
      return;
    }

    if (selectedIds.includes(teacher.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== teacher.id));
    } else {
      if (selectedIds.length < maxSelectCount) {
        setSelectedIds((prev) => [...prev, teacher.id]);
      }
    }
  };

  const handleConfirm = () => {
    const selectedList = teachers.filter((t) => selectedIds.includes(t.id));
    // Sort agar sesuai urutan pemilihan
    const ordered = selectedIds
      .map((id) => selectedList.find((t) => t.id === id))
      .filter((t): t is SelectedTeacherInfo => !!t);

    onConfirm(ordered);
    onClose();
  };

  const getTierBadge = (tier?: string) => {
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

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'PENGAJAR':
        return 'Pengajar';
      case 'WALI_KELAS':
        return 'Wali Kelas';
      case 'PJ_KELOMPOK':
        return 'PJ Kelompok';
      case 'PJ_DESA':
        return 'PJ Desa';
      case 'PJ_DAERAH':
        return 'PJ Daerah';
      default:
        return role;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/70">
                <User className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">{title}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {subtitle || `Pilih hingga ${maxSelectCount} ustadz/pengajar untuk sesi pengajian`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama ustadz atau nomor HP..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Wilayah */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Wilayah:
              </span>
              {(['ALL', 'KELOMPOK', 'DESA', 'DAERAH'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTierFilter(tier)}
                  className={`px-2 py-0.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${selectedTierFilter === tier
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {tier === 'ALL' ? 'Semua' : tier === 'KELOMPOK' ? 'Kelompok' : tier === 'DESA' ? 'Desa' : 'Daerah'}
                </button>
              ))}
            </div>

            {/* Filter Peran */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Peran:
              </span>
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'PENGAJAR', label: 'Pengajar' },
                { id: 'WALI_KELAS', label: 'Wali Kelas' },
                { id: 'PJ_WILAYAH', label: 'PJ Wilayah' },
              ].map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleFilter(role.id)}
                  className={`px-2 py-0.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${selectedRoleFilter === role.id
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Konten Daftar Ustadz */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
              <p className="text-xs">Memuat daftar dewan pengajar...</p>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-700">Tidak ada pengajar yang cocok</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Coba sesuaikan kata kunci pencarian atau ganti filter wilayah/peran di atas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredTeachers.map((teacher) => {
                const isSelected = selectedIds.includes(teacher.id);
                const selectionIndex = selectedIds.indexOf(teacher.id);

                return (
                  <div
                    key={teacher.id}
                    onClick={() => handleToggleSelect(teacher)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left relative ${isSelected
                      ? 'border-sky-500 bg-sky-50/60 shadow-xs ring-1 ring-sky-500/20'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar / Inisial */}
                      <div className="relative shrink-0">
                        {teacher.avatarUrl ? (
                          <img
                            src={teacher.avatarUrl}
                            alt={teacher.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-800 font-extrabold text-sm flex items-center justify-center border border-sky-200/60 shadow-2xs">
                            {teacher.fullName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {isSelected && maxSelectCount > 1 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                            {selectionIndex + 1}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                          {teacher.fullName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {getTierBadge(teacher.organization?.type)}
                          <span className="text-slate-500 truncate max-w-[120px]">
                            {teacher.organization?.name || 'Pusat'}
                          </span>
                        </div>

                        {teacher.roles && teacher.roles.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {teacher.roles.slice(0, 2).map((r) => (
                              <span
                                key={r.role}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-semibold"
                              >
                                {formatRoleLabel(r.role)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${isSelected
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'border-slate-300 bg-white text-transparent'
                          }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Konfirmasi */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {maxSelectCount > 1 ? (
              <span>
                <strong className="text-slate-900 font-bold">{selectedIds.length}</strong> dari{' '}
                <strong className="text-slate-900 font-bold">{maxSelectCount}</strong> slot ustadz terpilih
              </span>
            ) : (
              <span>
                {selectedIds.length > 0 ? (
                  <span className="text-sky-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1 Ustadz dipilih
                  </span>
                ) : (
                  'Belum ada ustadz yang dipilih'
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan Pilihan ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
