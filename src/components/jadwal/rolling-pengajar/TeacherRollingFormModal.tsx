'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  X,
  Users,
  Plus,
  Sparkles,
  Info,
  Calendar,
  Clock,
  CalendarDays,
  AlertCircle,
  Save,
  CheckCircle2,
  FileText
} from 'lucide-react';
import type { RollingIntervalType } from '@prisma/client';
import StepperInput from '../rolling-materi/StepperInput';
import TeacherQueueCard, { TeacherSlotState } from './TeacherQueueCard';
import TeacherSelectModal, { SelectedTeacherInfo } from './TeacherSelectModal';
import {
  createTeacherRolling,
  updateTeacherRolling,
  TeacherRollingInput
} from '@/app/(protected)/jadwal/rolling-pengajar/actions';

interface TeacherRollingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollingToEdit?: any | null;
  onSuccess: () => void;
}

interface QueueState {
  stepOrder: number;
  title: string;
  slots: TeacherSlotState[];
}

export default function TeacherRollingFormModal({
  isOpen,
  onClose,
  rollingToEdit,
  onSuccess,
}: TeacherRollingFormModalProps) {
  const isEditMode = Boolean(rollingToEdit);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rollingType, setRollingType] = useState<RollingIntervalType>('PER_PENGAJIAN');
  const [teachersPerSession, setTeachersPerSession] = useState<number>(1);
  const [queues, setQueues] = useState<QueueState[]>([
    { stepOrder: 1, title: 'Antrean #1', slots: [{ teacher: null, substitute: null }] },
    { stepOrder: 2, title: 'Antrean #2', slots: [{ teacher: null, substitute: null }] },
  ]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal Pilih Pengajar State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState<{
    queueIndex: number;
    slotIndex?: number;
    isSubstitute?: boolean;
    isBatch?: boolean;
  } | null>(null);

  // Inisialisasi saat modal dibuka / mode edit
  useEffect(() => {
    if (!isOpen) return;

    if (rollingToEdit) {
      setName(rollingToEdit.name || '');
      setDescription(rollingToEdit.description || '');
      setRollingType(rollingToEdit.rollingType || 'PER_PENGAJIAN');
      const teacherCount = rollingToEdit.teachersPerSession || 1;
      setTeachersPerSession(teacherCount);

      if (rollingToEdit.queues && rollingToEdit.queues.length >= 2) {
        const mappedQueues: QueueState[] = rollingToEdit.queues.map(
          (q: any, qIdx: number) => {
            const slots: TeacherSlotState[] = Array.from({ length: teacherCount }, () => ({
              teacher: null,
              substitute: null,
            }));

            q.items?.forEach((it: any) => {
              if (it.slotIndex < teacherCount && it.teacher) {
                slots[it.slotIndex] = {
                  teacher: {
                    id: it.teacher.id,
                    fullName: it.teacher.fullName,
                    avatarUrl: it.teacher.avatarUrl,
                    gender: it.teacher.gender,
                    phoneNumber: it.teacher.phoneNumber,
                    organization: it.teacher.organization,
                    roles: it.teacher.roles,
                  },
                  substitute: it.substituteTeacher
                    ? {
                      id: it.substituteTeacher.id,
                      fullName: it.substituteTeacher.fullName,
                      avatarUrl: it.substituteTeacher.avatarUrl,
                      gender: it.substituteTeacher.gender,
                      phoneNumber: it.substituteTeacher.phoneNumber,
                      organization: it.substituteTeacher.organization,
                      roles: it.substituteTeacher.roles,
                    }
                    : null,
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
          {
            stepOrder: 1,
            title: 'Antrean #1',
            slots: Array.from({ length: teacherCount }, () => ({ teacher: null, substitute: null })),
          },
          {
            stepOrder: 2,
            title: 'Antrean #2',
            slots: Array.from({ length: teacherCount }, () => ({ teacher: null, substitute: null })),
          },
        ]);
      }
    } else {
      // Form baru default
      setName('');
      setDescription('');
      setRollingType('PER_PENGAJIAN');
      setTeachersPerSession(1);
      setQueues([
        { stepOrder: 1, title: 'Antrean #1', slots: [{ teacher: null, substitute: null }] },
        { stepOrder: 2, title: 'Antrean #2', slots: [{ teacher: null, substitute: null }] },
      ]);
    }

    setErrorMessage(null);
  }, [isOpen, rollingToEdit]);

  // Handler saat teachersPerSession berubah
  const handleTeachersPerSessionChange = (newCount: number) => {
    setTeachersPerSession(newCount);
    setQueues((prevQueues) =>
      prevQueues.map((q) => {
        const newSlots = [...q.slots];
        if (newCount > newSlots.length) {
          while (newSlots.length < newCount) {
            newSlots.push({ teacher: null, substitute: null });
          }
        } else if (newCount < newSlots.length) {
          newSlots.splice(newCount);
        }
        return { ...q, slots: newSlots };
      })
    );
  };

  // Tambah antrean baru
  const handleAddQueue = () => {
    setQueues((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        title: `Antrean #${prev.length + 1}`,
        slots: Array.from({ length: teachersPerSession }, () => ({
          teacher: null,
          substitute: null,
        })),
      },
    ]);
  };

  // Hapus antrean (batas min 2)
  const handleRemoveQueue = (queueIdx: number) => {
    if (queues.length <= 2) return;
    setQueues((prev) => {
      const filtered = prev.filter((_, idx) => idx !== queueIdx);
      return filtered.map((q, idx) => ({
        ...q,
        stepOrder: idx + 1,
        title: q.title.startsWith('Antrean #') ? `Antrean #${idx + 1}` : q.title,
      }));
    });
  };

  // Buka modal untuk memilih pengajar utama di slot tertentu
  const handleOpenTeacherModal = (queueIdx: number, slotIdx: number) => {
    setModalContext({
      queueIndex: queueIdx,
      slotIndex: slotIdx,
      isSubstitute: false,
      isBatch: false,
    });
    setIsTeacherModalOpen(true);
  };

  // Buka modal untuk memilih badal cadangan
  const handleOpenSubstituteModal = (queueIdx: number, slotIdx: number) => {
    setModalContext({
      queueIndex: queueIdx,
      slotIndex: slotIdx,
      isSubstitute: true,
      isBatch: false,
    });
    setIsTeacherModalOpen(true);
  };

  // Buka modal untuk batch select seluruh slot dalam 1 antrean
  const handleOpenBatchSelectModal = (queueIdx: number) => {
    setModalContext({
      queueIndex: queueIdx,
      isSubstitute: false,
      isBatch: true,
    });
    setIsTeacherModalOpen(true);
  };

  // Kosongkan slot pengajar utama
  const handleClearSlot = (queueIdx: number, slotIdx: number) => {
    setQueues((prev) =>
      prev.map((q, qI) => {
        if (qI !== queueIdx) return q;
        const newSlots = [...q.slots];
        newSlots[slotIdx] = { teacher: null, substitute: null };
        return { ...q, slots: newSlots };
      })
    );
  };

  // Hapus badal saja
  const handleClearSubstitute = (queueIdx: number, slotIdx: number) => {
    setQueues((prev) =>
      prev.map((q, qI) => {
        if (qI !== queueIdx) return q;
        const newSlots = [...q.slots];
        if (newSlots[slotIdx]) {
          newSlots[slotIdx] = {
            ...newSlots[slotIdx],
            substitute: null,
          };
        }
        return { ...q, slots: newSlots };
      })
    );
  };

  // Konfirmasi pemilihan dari modal TeacherSelectModal
  const handleConfirmTeachers = (selected: SelectedTeacherInfo[]) => {
    if (!modalContext) return;
    const { queueIndex, slotIndex, isSubstitute, isBatch } = modalContext;

    setQueues((prev) =>
      prev.map((q, qI) => {
        if (qI !== queueIndex) return q;
        const newSlots = [...q.slots];

        if (isBatch) {
          // Isi slot dari index 0 hingga terpilih
          for (let s = 0; s < teachersPerSession; s++) {
            if (s < selected.length) {
              newSlots[s] = {
                teacher: selected[s],
                substitute: newSlots[s]?.substitute || null,
              };
            }
          }
        } else if (slotIndex !== undefined) {
          if (isSubstitute) {
            newSlots[slotIndex] = {
              teacher: newSlots[slotIndex]?.teacher || null,
              substitute: selected[0] || null,
            };
          } else {
            newSlots[slotIndex] = {
              teacher: selected[0] || null,
              substitute: newSlots[slotIndex]?.substitute || null,
            };
          }
        }

        return { ...q, slots: newSlots };
      })
    );
  };

  // Simpan Rolling Pengajar
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validasi
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Nama rolling pengajar wajib diisi.');
      return;
    }

    if (queues.length < 2) {
      setErrorMessage('Rolling pengajar minimal harus memiliki 2 antrean.');
      return;
    }

    // Validasi kelengkapan ustadz di setiap slot
    for (let qIdx = 0; qIdx < queues.length; qIdx++) {
      const q = queues[qIdx];
      for (let sIdx = 0; sIdx < teachersPerSession; sIdx++) {
        const slot = q.slots[sIdx];
        if (!slot || !slot.teacher) {
          setErrorMessage(
            `Antrean ke-${qIdx + 1} (Pengajar #${sIdx + 1}) belum memilih pengajar.`
          );
          return;
        }
      }
    }

    // Format payload
    const payload: TeacherRollingInput = {
      name: trimmedName,
      description: description.trim() || null,
      rollingType,
      teachersPerSession,
      queues: queues.map((q, qIdx) => ({
        stepOrder: qIdx + 1,
        title: q.title,
        items: q.slots
          .map((s, sIdx) => ({
            slotIndex: sIdx,
            teacherId: s.teacher!.id,
            substituteTeacherId: s.substitute?.id || null,
          }))
          .filter((it) => !!it.teacherId),
      })),
    };

    startTransition(async () => {
      let res;
      if (isEditMode) {
        res = await updateTeacherRolling(rollingToEdit.id, payload);
      } else {
        res = await createTeacherRolling(payload);
      }

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-150">
        {/* Header Modal Fullscreen */}
        <div className="border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md shrink-0">
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/80 shadow-2xs shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                  {isEditMode ? 'Edit Rolling Pengajar' : 'Buat Rolling Pengajar Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tahap 2: Atur rotasi dewan pengajar/ustadz untuk sesi pengajian binaan
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Modal: Scrollable Form */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50/40">
          <form id="teacher-rolling-form" onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
            {/* Alert Error */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-rose-800 text-xs shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 font-semibold">{errorMessage}</div>
              </div>
            )}

            {/* Card 1: Konfigurasi Dasar */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>1. Identitas &amp; Aturan Perputaran Pengajar</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Rolling */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Nama Rolling Pengajar</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Rotasi Ustadz Pengajian Remaja Desa Sukamaju"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
                    required
                  />
                </div>

                {/* Keterangan Tambahan (Opsional) */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Keterangan / Catatan Rotasi (Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Catatan tambahan seputar giliran dakwah atau pengasuhan kelas"
                    className="w-full px-4 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>

                {/* Tipe Rolling */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tipe Perputaran Rolling</span>
                  </label>
                  <select
                    value={rollingType}
                    onChange={(e) => setRollingType(e.target.value as RollingIntervalType)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-semibold text-slate-800"
                  >
                    <option value="PER_PENGAJIAN">Per Pengajian (Tiap Sesi Pengajian)</option>
                    <option value="MINGGUAN">Mingguan (Tiap 7 Hari / Pekan Kalender)</option>
                    <option value="BULANAN">Bulanan (Tiap 1 Bulan Kalender)</option>
                  </select>
                </div>

                {/* Stepper Jumlah Pengajar per Sesi */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Jumlah Pengajar per Sesi
                  </label>
                  <div className="pt-0.5">
                    <StepperInput
                      value={teachersPerSession}
                      min={1}
                      max={4}
                      onChange={handleTeachersPerSessionChange}
                      suffix="Pengajar"
                    />
                  </div>
                </div>
              </div>

              {/* Info Card Penjelasan Tipe Rolling */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/80 flex items-start gap-2.5 text-xs text-sky-900">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  {rollingType === 'PER_PENGAJIAN' && (
                    <p>
                      <strong>Mode Per Pengajian:</strong> Pengajar akan berganti ke antrean berikutnya
                      pada setiap sesi pengajian yang diselenggarakan.
                    </p>
                  )}
                  {rollingType === 'MINGGUAN' && (
                    <p>
                      <strong>Mode Mingguan:</strong> Pengajar bertugas selama 1 pekan penuh (7 hari
                      kalender) untuk seluruh pengajian di pekan tersebut, lalu baru berganti di pekan baru.
                    </p>
                  )}
                  {rollingType === 'BULANAN' && (
                    <p>
                      <strong>Mode Bulanan:</strong> Pengajar bertugas selama 1 bulan kalender penuh,
                      dan baru berganti ke antrean ustadz berikutnya saat memasuki bulan kalender baru.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Daftar Antrean Pengajar */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-600" />
                    <span>2. Susunan Antrean Ustadz Pengajar</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Minimal 2 Antrean
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pengajar akan berotasi secara otomatis dari antrean #1 hingga #{queues.length}, lalu berputar kembali.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddQueue}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Antrean</span>
                </button>
              </div>

              {/* List Kartu Antrean */}
              <div className="space-y-3">
                {queues.map((q, qIdx) => (
                  <TeacherQueueCard
                    key={`queue-${qIdx}`}
                    queueIndex={qIdx}
                    totalQueues={queues.length}
                    teachersPerSession={teachersPerSession}
                    queueTitle={q.title}
                    slots={q.slots}
                    onSlotClick={handleOpenTeacherModal}
                    onSubstituteClick={handleOpenSubstituteModal}
                    onClearSubstitute={handleClearSubstitute}
                    onBatchSelectClick={handleOpenBatchSelectModal}
                    onRemoveQueue={handleRemoveQueue}
                    onClearSlot={handleClearSlot}
                  />
                ))}
              </div>

              {/* Tombol Tambah Antrean di Bawah */}
              <button
                type="button"
                onClick={handleAddQueue}
                className="w-full py-3 border-2 border-dashed border-sky-200/80 hover:border-sky-400 rounded-2xl text-xs font-bold text-sky-700 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Antrean Baru (Antrean #{queues.length + 1})</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer Modal Action Bar */}
        <div className="border-t border-slate-200/80 bg-white px-4 sm:px-6 py-3.5 shrink-0 shadow-xs mb-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              Batal
            </button>

            <button
              type="submit"
              form="teacher-rolling-form"
              disabled={isPending}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditMode ? 'Perbarui Rolling Pengajar' : 'Simpan Rolling Pengajar'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Pilih Pengajar / Badal */}
      <TeacherSelectModal
        isOpen={isTeacherModalOpen}
        onClose={() => {
          setIsTeacherModalOpen(false);
          setModalContext(null);
        }}
        maxSelectCount={modalContext?.isBatch ? teachersPerSession : 1}
        title={
          modalContext?.isSubstitute
            ? 'Pilih Ustadz Badal / Cadangan'
            : modalContext?.isBatch
              ? `Pilih ${teachersPerSession} Pengajar Sekaligus`
              : 'Pilih Pengajar Sesi'
        }
        subtitle={
          modalContext?.isSubstitute
            ? 'Pilih ustadz yang akan menggantikan jika pengajar utama berhalangan hadir'
            : undefined
        }
        initialSelectedIds={
          modalContext && modalContext.queueIndex !== undefined
            ? modalContext.isSubstitute && modalContext.slotIndex !== undefined
              ? queues[modalContext.queueIndex]?.slots[modalContext.slotIndex]?.substitute?.id
                ? [queues[modalContext.queueIndex].slots[modalContext.slotIndex].substitute!.id]
                : []
              : modalContext.slotIndex !== undefined
                ? queues[modalContext.queueIndex]?.slots[modalContext.slotIndex]?.teacher?.id
                  ? [queues[modalContext.queueIndex].slots[modalContext.slotIndex].teacher!.id]
                  : []
                : []
            : []
        }
        onConfirm={handleConfirmTeachers}
      />
    </>
  );
}
