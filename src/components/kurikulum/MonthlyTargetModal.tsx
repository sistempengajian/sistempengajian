'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  Calendar,
  CalendarCheck,
  BookOpen,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getMonthlyCurriculumTargets,
  addMaterialToMonthlyTarget,
  removeMaterialFromMonthlyTarget,
  setMonthlyCurriculumTargets,
  getAvailableMaterialsForMonthSelection,
  MonthlyTargetWithMaterial,
} from '@/app/(protected)/kurikulum/actions';
import { useConfirm } from '@/components/ui/ConfirmModal';
import CustomSelect from '@/components/ui/CustomSelect';

interface GenerationItem {
  id: string;
  code: string;
  name: string;
}

interface MonthlyTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  generations: GenerationItem[];
  defaultGenCode?: string;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  userOrganizationId?: string | null;
  onUpdated?: () => void;
}

const MONTHS = [
  { num: 1, name: 'Januari', short: 'Jan' },
  { num: 2, name: 'Februari', short: 'Feb' },
  { num: 3, name: 'Maret', short: 'Mar' },
  { num: 4, name: 'April', short: 'Apr' },
  { num: 5, name: 'Mei', short: 'Mei' },
  { num: 6, name: 'Juni', short: 'Jun' },
  { num: 7, name: 'Juli', short: 'Jul' },
  { num: 8, name: 'Agustus', short: 'Ags' },
  { num: 9, name: 'September', short: 'Sep' },
  { num: 10, name: 'Oktober', short: 'Okt' },
  { num: 11, name: 'November', short: 'Nov' },
  { num: 12, name: 'Desember', short: 'Des' },
];

export default function MonthlyTargetModal({
  isOpen,
  onClose,
  generations,
  defaultGenCode,
  userTierLevel,
  userOrganizationId,
  onUpdated,
}: MonthlyTargetModalProps) {
  const currentCalDate = new Date();
  const currentMonthNum = currentCalDate.getMonth() + 1; // 1-12
  const currentYearNum = currentCalDate.getFullYear();

  const [selectedGenId, setSelectedGenId] = useState<string>(() => {
    const matched = generations.find((g) => g.code === defaultGenCode);
    return matched ? matched.id : generations[0]?.id || '';
  });

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [targets, setTargets] = useState<MonthlyTargetWithMaterial[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Picker modal state
  const [isPickerOpen, setIsPickerOpen] = useState<boolean>(false);
  const [pickerSearch, setPickerSearch] = useState<string>('');
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [isLoadingPicker, setIsLoadingPicker] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const { open: openConfirm, ConfirmModalComponent } = useConfirm();

  // Update selectedGenId saat modal dibuka atau defaultGenCode berubah
  useEffect(() => {
    if (defaultGenCode && generations.length > 0) {
      const matched = generations.find((g) => g.code === defaultGenCode);
      if (matched) setSelectedGenId(matched.id);
    }
  }, [defaultGenCode, generations, isOpen]);

  // Muat data target saat jenjang, tahun, atau bulan berganti
  const fetchTargets = async () => {
    if (!selectedGenId) return;
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await getMonthlyCurriculumTargets({
        generationId: selectedGenId,
        year: selectedYear,
        month: selectedMonth,
        organizationId: userOrganizationId,
      });

      if (res.success) {
        setTargets(res.data);
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Gagal memuat target bulanan.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedGenId) {
      fetchTargets();
    }
  }, [isOpen, selectedGenId, selectedYear, selectedMonth]);

  // Muat materi yang tersedia saat picker dibuka
  const fetchAvailableMaterials = async () => {
    if (!selectedGenId) return;
    setIsLoadingPicker(true);
    try {
      const res = await getAvailableMaterialsForMonthSelection({
        generationId: selectedGenId,
        search: pickerSearch,
        organizationId: userOrganizationId,
      });
      if (res.success) {
        // Filter materi yang sudah ada di bulan ini
        const existingIds = new Set(targets.map((t) => t.materialId));
        setAvailableMaterials(res.data.filter((m) => !existingIds.has(m.id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPicker(false);
    }
  };

  useEffect(() => {
    if (isPickerOpen) {
      const t = setTimeout(() => {
        fetchAvailableMaterials();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isPickerOpen, pickerSearch, targets]);

  const handleAddMaterial = (materialId: string) => {
    startTransition(async () => {
      const res = await addMaterialToMonthlyTarget({
        generationId: selectedGenId,
        year: selectedYear,
        month: selectedMonth,
        materialId,
        organizationId: userOrganizationId,
      });

      if (res.success) {
        setActionMessage({ type: 'success', text: 'Materi berhasil ditambahkan ke target bulan ini!' });
        fetchTargets();
        setIsPickerOpen(false);
        setPickerSearch('');
        onUpdated?.();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Gagal menambahkan materi.' });
      }
    });
  };

  const handleRemoveTarget = (targetId: string, title: string) => {
    openConfirm(
      {
        title: 'Hapus Target Bulanan?',
        description: `Hapus "${title}" dari target bulan ini?`,
        variant: 'danger',
        confirmText: 'Ya, Hapus',
        cancelText: 'Batal',
      },
      () => {
        startTransition(async () => {
          const res = await removeMaterialFromMonthlyTarget(targetId);
          if (res.success) {
            setActionMessage({ type: 'success', text: 'Materi dihapus dari target bulan ini.' });
            fetchTargets();
            onUpdated?.();
          } else {
            setActionMessage({ type: 'error', text: res.error || 'Gagal menghapus materi.' });
          }
        });
      }
    );
  };

  const handleMoveOrder = (index: number, direction: 'UP' | 'DOWN') => {
    const newIndex = direction === 'UP' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= targets.length) return;

    const newTargets = [...targets];
    const temp = newTargets[index];
    newTargets[index] = newTargets[newIndex];
    newTargets[newIndex] = temp;

    setTargets(newTargets);

    startTransition(async () => {
      const res = await setMonthlyCurriculumTargets({
        generationId: selectedGenId,
        year: selectedYear,
        month: selectedMonth,
        materialIds: newTargets.map((t) => t.materialId),
        organizationId: userOrganizationId,
      });

      if (res.success) {
        onUpdated?.();
      } else {
        fetchTargets(); // Rollback jika gagal
      }
    });
  };

  if (!isOpen) return null;

  const currentGenName = generations.find((g) => g.id === selectedGenId)?.name || 'Jenjang';
  const selectedMonthName = MONTHS.find((m) => m.num === selectedMonth)?.name || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-teal-50/40 to-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
              <CalendarCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
                <span>Target Kurikulum Bulanan</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  {userTierLevel || 'Wilayah'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur materi silabus wajib per bulan kalender untuk tiap jenjang santri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifikasi feedback */}
        {actionMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between shrink-0 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter Controls: Jenjang & Tahun */}
        <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Selector Jenjang Santri */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-semibold text-slate-600 shrink-0">Jenjang:</span>
            <div className="flex-1 sm:max-w-xs">
              <CustomSelect
                value={selectedGenId}
                onChange={(val) => setSelectedGenId(val as string)}
                options={generations.map((g) => ({
                  value: g.id,
                  label: `${g.name} (${g.code})`,
                }))}
                size="sm"
                placeholder="Pilih Jenjang"
              />
            </div>
          </div>

          {/* Selector Tahun Kalender */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-600">Tahun:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              {[2026, 2027].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Month Navigation Bar */}
        <div className="p-2 sm:p-3 bg-white border-b border-slate-200/70 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {MONTHS.map((m) => {
            const isCurrentMonth = m.num === selectedMonth;
            return (
              <button
                key={m.num}
                type="button"
                onClick={() => setSelectedMonth(m.num)}
                className={`flex-1 min-w-[62px] py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isCurrentMonth
                    ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-600/30'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100/80 border border-slate-200/60'
                }`}
              >
                <span>{m.short}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body / List Target Materi */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>
                  Target {selectedMonthName} {selectedYear}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60">
                  {targets.length} Materi
                </span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Materi di bawah otomatis tampil di Jurnal Presensi pengajian jenjang{' '}
                <strong className="text-slate-700">{currentGenName}</strong> pada bulan ini.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tambah Materi</span>
            </button>
          </div>

          {/* List Kartu Materi Terjadwal di Bulan Ini */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Memuat target materi bulanan...</span>
            </div>
          ) : targets.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2 bg-slate-50/50">
              <BookOpen className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">Belum ada target materi di bulan ini</p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                Klik tombol <strong>Tambah Materi</strong> untuk memasangkan materi silabus jenjang {currentGenName}{' '}
                ke bulan {selectedMonthName} {selectedYear}.
              </p>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-teal-700 font-bold text-xs shadow-2xs hover:bg-teal-50 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pilih dari Silabus</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {targets.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-teal-200/80 transition-all"
                >
                  {/* Urutan & Info Materi */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-800 font-black text-xs flex items-center justify-center shrink-0 border border-teal-200/60 mt-0.5">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                        {item.material.title}
                      </h5>
                      {item.material.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.material.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                        {item.material.isMandatoryForTarget && (
                          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                            Wajib
                          </span>
                        )}
                        <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-md">
                          {item.material.checklistItems.length} Poin Capaian
                        </span>
                        <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                          {item.material.creatorTierLevel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Reorder & Hapus */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0 || isPending}
                      onClick={() => handleMoveOrder(idx, 'UP')}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Geser ke Atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === targets.length - 1 || isPending}
                      onClick={() => handleMoveOrder(idx, 'DOWN')}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Geser ke Bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemoveTarget(item.id, item.material.title)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                      title="Hapus dari Bulan Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Picker Tambah Materi dari Silabus */}
        {isPickerOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-5 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Pilih Materi Silabus</h4>
                    <p className="text-[11px] text-slate-500">
                      Silabus jenjang {currentGenName} yang belum ada di target {selectedMonthName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Field */}
              <div className="p-3 border-b border-slate-200 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Cari materi silabus..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* List Available Materials */}
              <div className="p-3 overflow-y-auto flex-1 space-y-2">
                {isLoadingPicker ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-1.5 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span className="text-xs">Mencari materi...</span>
                  </div>
                ) : availableMaterials.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada materi silabus yang cocok.
                  </div>
                ) : (
                  availableMaterials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/20 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <h6 className="text-xs font-bold text-slate-900 truncate">{mat.title}</h6>
                        {mat.description && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {mat.description}
                          </p>
                        )}
                        <span className="text-[9px] text-slate-500 font-medium mt-1 inline-block">
                          {mat.checklistCount} Poin Capaian
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAddMaterial(mat.id)}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        Pilih
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Modal */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Perubahan target langsung aktif secara otomatis di jadwal dan presensi.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
      {ConfirmModalComponent()}
    </div>
  );
}
