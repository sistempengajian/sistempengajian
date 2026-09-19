'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  Layers,
  Plus,
  Sparkles,
  Info,
  Calendar,
  Clock,
  CalendarDays,
  AlertCircle,
  Save,
  CheckCircle2,
} from 'lucide-react';
import type { RollingIntervalType, TierLevel } from '@prisma/client';
import StepperInput from './StepperInput';
import MaterialQueueCard from './MaterialQueueCard';
import MaterialSelectModal, { SelectedMaterialInfo } from './MaterialSelectModal';
import {
  createMaterialRolling,
  updateMaterialRolling,
  MaterialRollingInput
} from '@/app/(protected)/jadwal/rolling-materi/actions';

interface GenerationOption {
  id: string;
  name: string;
  code: string;
}

interface MaterialRollingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollingToEdit?: any | null;
  generations?: GenerationOption[];
  onSuccess: () => void;
}

interface QueueState {
  stepOrder: number;
  title: string;
  slots: (SelectedMaterialInfo | null)[];
}

export default function MaterialRollingFormModal({
  isOpen,
  onClose,
  rollingToEdit,
  generations = [],
  onSuccess,
}: MaterialRollingFormModalProps) {
  const isEditMode = Boolean(rollingToEdit);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState('');
  const [rollingType, setRollingType] = useState<RollingIntervalType>('PER_PENGAJIAN');
  const [itemsPerSession, setItemsPerSession] = useState<number>(1);
  const [targetGenerationId, setTargetGenerationId] = useState<string>('');
  const [queues, setQueues] = useState<QueueState[]>([
    { stepOrder: 1, title: 'Antrean #1', slots: [null] },
    { stepOrder: 2, title: 'Antrean #2', slots: [null] },
  ]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Pilih Materi State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<{
    queueIndex: number;
    slotIndex?: number;
    isBatch: boolean;
  } | null>(null);

  // Inisialisasi saat modal dibuka / mode edit
  useEffect(() => {
    if (!isOpen) return;

    if (rollingToEdit) {
      setName(rollingToEdit.name || '');
      setRollingType(rollingToEdit.rollingType || 'PER_PENGAJIAN');
      const itemsCount = rollingToEdit.itemsPerSession || 1;
      setItemsPerSession(itemsCount);
      setTargetGenerationId(rollingToEdit.targetGenerationId || '');

      if (rollingToEdit.queues && rollingToEdit.queues.length >= 2) {
        const mappedQueues: QueueState[] = rollingToEdit.queues.map(
          (q: any, qIdx: number) => {
            const slots: (SelectedMaterialInfo | null)[] = Array(itemsCount).fill(null);
            q.items?.forEach((it: any) => {
              if (it.slotIndex < itemsCount && it.material) {
                slots[it.slotIndex] = {
                  id: it.material.id,
                  title: it.material.title,
                  creatorTierLevel: it.material.creatorTierLevel,
                  targetGeneration: it.material.targetGeneration,
                };
              }
            });
            return {
              stepOrder: q.stepOrder || qIdx + 1,
              title: q.title || `Antrean #${qIdx + 1}`,
              slots,
            };
          }
        );
        setQueues(mappedQueues);
      } else {
        setQueues([
          { stepOrder: 1, title: 'Antrean #1', slots: Array(itemsCount).fill(null) },
          { stepOrder: 2, title: 'Antrean #2', slots: Array(itemsCount).fill(null) },
        ]);
      }
    } else {
      // Default new
      setName('');
      setRollingType('PER_PENGAJIAN');
      setItemsPerSession(1);
      setTargetGenerationId('');
      setQueues([
        { stepOrder: 1, title: 'Antrean #1', slots: [null] },
        { stepOrder: 2, title: 'Antrean #2', slots: [null] },
      ]);
    }

    setErrorMessage(null);
  }, [isOpen, rollingToEdit]);

  // Handler saat itemsPerSession berubah (menyesuaikan slot di tiap antrean)
  const handleItemsPerSessionChange = (newCount: number) => {
    setItemsPerSession(newCount);
    setQueues((prevQueues) =>
      prevQueues.map((q) => {
        const newSlots = [...q.slots];
        if (newCount > newSlots.length) {
          // Tambah slot kosong
          while (newSlots.length < newCount) {
            newSlots.push(null);
          }
        } else if (newCount < newSlots.length) {
          // Potong slot berlebih
          newSlots.length = newCount;
        }
        return { ...q, slots: newSlots };
      })
    );
  };

  // Handler tambah antrean baru (minimal 2 antrean default)
  const handleAddQueue = () => {
    const nextStep = queues.length + 1;
    setQueues([
      ...queues,
      {
        stepOrder: nextStep,
        title: `Antrean #${nextStep}`,
        slots: Array(itemsPerSession).fill(null),
      },
    ]);
  };

  // Handler hapus antrean (menjaga batas minimal 2)
  const handleRemoveQueue = (queueIdx: number) => {
    if (queues.length <= 2) {
      alert('Daftar antrean minimal harus memiliki 2 antrean rolling.');
      return;
    }
    const updated = queues
      .filter((_, idx) => idx !== queueIdx)
      .map((q, idx) => ({
        ...q,
        stepOrder: idx + 1,
        title: `Antrean #${idx + 1}`,
      }));
    setQueues(updated);
  };

  // Buka modal pilih materi untuk 1 slot spesifik
  const handleSlotClick = (queueIndex: number, slotIndex: number) => {
    setModalMode({
      queueIndex,
      slotIndex,
      isBatch: false,
    });
    setIsMaterialModalOpen(true);
  };

  // Buka modal pilih materi sekaligus untuk seluruh slot pada 1 antrean
  const handleBatchSelectClick = (queueIndex: number) => {
    setModalMode({
      queueIndex,
      isBatch: true,
    });
    setIsMaterialModalOpen(true);
  };

  // Kosongkan 1 slot materi
  const handleClearSlot = (queueIndex: number, slotIndex: number) => {
    setQueues((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== queueIndex) return q;
        const newSlots = [...q.slots];
        newSlots[slotIndex] = null;
        return { ...q, slots: newSlots };
      })
    );
  };

  // Konfirmasi materi yang dipilih dari modal
  const handleConfirmMaterialSelection = (selectedMaterials: SelectedMaterialInfo[]) => {
    if (!modalMode) return;

    const { queueIndex, slotIndex, isBatch } = modalMode;

    setQueues((prev) =>
      prev.map((q, qIdx) => {
        if (qIdx !== queueIndex) return q;
        const newSlots = [...q.slots];

        if (isBatch) {
          // Isi slot-slot secara berurutan sesuai hasil pilihan
          for (let i = 0; i < itemsPerSession; i++) {
            newSlots[i] = selectedMaterials[i] || null;
          }
        } else if (slotIndex !== undefined) {
          newSlots[slotIndex] = selectedMaterials[0] || null;
        }

        return { ...q, slots: newSlots };
      })
    );
  };

  // Submit form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Nama rolling materi wajib diisi.');
      return;
    }

    if (queues.length < 2) {
      setErrorMessage('Daftar antrean minimal harus memiliki 2 antrean.');
      return;
    }

    // Periksa apakah setiap antrean sudah memiliki minimal 1 materi terisi
    for (let i = 0; i < queues.length; i++) {
      const q = queues[i];
      const hasAnyMaterial = q.slots.some((s) => s !== null);
      if (!hasAnyMaterial) {
        setErrorMessage(`Antrean #${i + 1} belum memiliki materi yang dipilih.`);
        return;
      }
    }

    // Siapkan payload
    const payload: MaterialRollingInput = {
      name: trimmedName,
      rollingType,
      itemsPerSession,
      targetGenerationId: targetGenerationId || null,
      queues: queues.map((q, qIdx) => ({
        stepOrder: qIdx + 1,
        title: q.title,
        items: q.slots
          .map((s, slotIdx) => (s ? { slotIndex: slotIdx, materialId: s.id } : null))
          .filter(Boolean) as any[],
      })),
    };

    startTransition(async () => {
      let res;
      if (isEditMode) {
        res = await updateMaterialRolling(rollingToEdit.id, payload);
      } else {
        res = await createMaterialRolling(payload);
      }

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  // Deskripsi penjelasan tipe rolling
  const getRollingTypeExplanation = () => {
    switch (rollingType) {
      case 'PER_PENGAJIAN':
        return 'Materi akan berganti ke nomor antrean berikutnya pada setiap sesi pengajian yang diselenggarakan.';
      case 'MINGGUAN':
        return 'Materi akan berganti setiap 7 hari (minggu baru). Semua sesi pengajian dalam minggu tersebut akan memakai materi yang sama.';
      case 'BULANAN':
        return 'Materi akan berganti setiap pergantian bulan kalender. Semua sesi dalam bulan tersebut akan memakai materi yang sama.';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-in fade-in">
      {/* Header Modal Fullscreen */}
      <div className="border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isEditMode ? 'Edit Konfigurasi Rolling Materi' : 'Buat Rolling Materi Baru'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tahap 1: Susun antrean materi bergulir per pengajian, mingguan, atau bulanan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body Modal: Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50/40">
        <form id="rolling-form" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200/70 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Card 1: Informasi Pokok Rolling */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>1. Identitas &amp; Aturan Perputaran</span>
            </div>

            {/* Nama Rolling */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Nama Rolling Materi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Rolling Materi Pembinaan Caberawit Desa, Halaqah Remaja..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Dropdown Tipe Rolling */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Tipe Perputaran (Rolling)</label>
                <select
                  value={rollingType}
                  onChange={(e) => setRollingType(e.target.value as RollingIntervalType)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900 font-semibold"
                >
                  <option value="PER_PENGAJIAN">
                    Per Pengajian (Tiap Sesi)
                  </option>
                  <option value="MINGGUAN">
                    Mingguan (Tiap 7 Hari / Pekan)
                  </option>
                  <option value="BULANAN">
                    Bulanan (Tiap Bulan Kalender)
                  </option>
                </select>

                {/* Kotak Penjelasan Tipe */}
                <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/60 text-[11px] text-teal-900 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{getRollingTypeExplanation()}</p>
                </div>
              </div>

              {/* Stepper Jumlah Materi per Pengajian */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-700 block">
                    Jumlah Materi per Pengajian
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tentukan berapa materi yang disampaikan dalam setiap sesi pertemuan
                  </p>
                </div>

                <div className="pt-2">
                  <StepperInput
                    value={itemsPerSession}
                    min={1}
                    max={5}
                    onChange={handleItemsPerSessionChange}
                    suffix="Materi / Sesi"
                  />
                </div>
              </div>
            </div>

            {/* Target Generasi (Opsional) */}
            {generations.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">
                  Target Jenjang Usia / Generasi (Opsional)
                </label>
                <select
                  value={targetGenerationId}
                  onChange={(e) => setTargetGenerationId(e.target.value)}
                  className="w-full sm:w-1/2 px-3.5 py-2 text-xs bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900 font-medium"
                >
                  <option value="">-- Semua Jenjang Usia --</option>
                  {generations.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Card 2: Daftar Antrean Materi (Minimal 2 Antrean) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Daftar Antrean Materi ({queues.length} Antrean Bergulir)
                </h4>
                <p className="text-xs text-slate-500">
                  Urutan materi yang akan berputar otomatis. Batas minimum 2 daftar antrean.
                </p>
              </div>
            </div>

            {/* List Kartu Antrean */}
            <div className="space-y-3">
              {queues.map((q, idx) => (
                <MaterialQueueCard
                  key={`queue-${idx}`}
                  queueIndex={idx}
                  totalQueues={queues.length}
                  itemsPerSession={itemsPerSession}
                  queueTitle={q.title}
                  slots={q.slots}
                  onSlotClick={handleSlotClick}
                  onBatchSelectClick={handleBatchSelectClick}
                  onRemoveQueue={handleRemoveQueue}
                  onClearSlot={handleClearSlot}
                />
              ))}
            </div>

            {/* Tombol Tambah Antrean Baru di Bagian Bawah */}
            <button
              type="button"
              onClick={handleAddQueue}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-teal-300 hover:border-teal-500 hover:bg-teal-50/40 text-teal-800 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 text-teal-600" />
              <span>Tambah Daftar Antrean (Antrean #{queues.length + 1})</span>
            </button>
          </div>
        </form>
      </div>

      {/* Footer Modal Action Bar */}
      <div className="border-t border-slate-200/80 bg-white px-4 sm:px-6 py-4 shrink-0 shadow-xs mb-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            form="rolling-form"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-2xs cursor-pointer"
          >
            {isPending ? (
              <span>Menyimpan...</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Konfigurasi Rolling Materi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Pilih Materi */}
      <MaterialSelectModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        maxSelectCount={modalMode?.isBatch ? itemsPerSession : 1}
        targetGenerationId={targetGenerationId}
        onConfirm={handleConfirmMaterialSelection}
      />
    </div>
  );
}
