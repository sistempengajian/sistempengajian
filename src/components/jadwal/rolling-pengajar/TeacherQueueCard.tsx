'use client';

import React from 'react';
import {
  Trash2,
  UserPlus,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserX,
  Shield,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { SelectedTeacherInfo } from './TeacherSelectModal';

export interface TeacherSlotState {
  teacher: SelectedTeacherInfo | null;
  substitute: SelectedTeacherInfo | null;
}

interface TeacherQueueCardProps {
  queueIndex: number; // 0-based
  totalQueues: number;
  teachersPerSession: number;
  queueTitle?: string;
  slots: TeacherSlotState[];
  onSlotClick: (queueIndex: number, slotIndex: number) => void;
  onSubstituteClick: (queueIndex: number, slotIndex: number) => void;
  onClearSubstitute: (queueIndex: number, slotIndex: number) => void;
  onBatchSelectClick: (queueIndex: number) => void;
  onRemoveQueue: (queueIndex: number) => void;
  onClearSlot: (queueIndex: number, slotIndex: number) => void;
}

export default function TeacherQueueCard({
  queueIndex,
  totalQueues,
  teachersPerSession,
  queueTitle,
  slots,
  onSlotClick,
  onSubstituteClick,
  onClearSubstitute,
  onBatchSelectClick,
  onRemoveQueue,
  onClearSlot,
}: TeacherQueueCardProps) {
  const stepNumber = queueIndex + 1;
  const canDelete = totalQueues > 2;

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

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white transition-all shadow-2xs space-y-3.5 relative group">
      {/* Header Kartu Antrean */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-800 font-extrabold text-xs flex items-center justify-center border border-sky-200/70 shadow-2xs">
            #{stepNumber}
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
              {queueTitle || `Antrean Ke-${stepNumber}`}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">
              Kapasitas: {teachersPerSession} pengajar per sesi
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tombol Pilih Sekaligus (Jika teachersPerSession > 1) */}
          {teachersPerSession > 1 && (
            <button
              type="button"
              onClick={() => onBatchSelectClick(queueIndex)}
              className="text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/60 px-2.5 py-1 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
              title="Pilih seluruh slot pengajar antrean ini sekaligus"
            >
              <Sparkles className="w-3 h-3 text-sky-600" />
              <span>Pilih Sekaligus</span>
            </button>
          )}

          {/* Tombol Hapus Antrean (Batas min 2) */}
          <button
            type="button"
            onClick={() => onRemoveQueue(queueIndex)}
            disabled={!canDelete}
            className={`p-1.5 rounded-xl text-slate-400 transition-colors ${
              canDelete
                ? 'hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-slate-300'
            }`}
            title={canDelete ? 'Hapus antrean ini' : 'Batas minimum 2 antrean rolling'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Daftar Slot Pengajar Sesuai teachersPerSession */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: teachersPerSession }).map((_, slotIdx) => {
          const slot = slots[slotIdx] || { teacher: null, substitute: null };
          const teacher = slot.teacher;
          const substitute = slot.substitute;

          if (teacher) {
            return (
              <div
                key={`slot-${slotIdx}`}
                className="p-3.5 rounded-xl border border-sky-200/80 bg-sky-50/30 hover:bg-sky-50/60 transition-all flex flex-col justify-between gap-3 text-left"
              >
                {/* Header Slot */}
                <div className="flex items-start justify-between gap-2 pb-1 border-b border-sky-100/80">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {slotIdx + 1}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                      Pengajar #{slotIdx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {getTierBadge(teacher.organization?.type)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearSlot(queueIndex, slotIdx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                      title="Kosongkan pengajar di slot ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Profil Pengajar Utama */}
                <div className="flex items-center gap-2.5">
                  {teacher.avatarUrl ? (
                    <img
                      src={teacher.avatarUrl}
                      alt={teacher.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-sky-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-800 font-extrabold text-xs flex items-center justify-center border border-sky-200/60 shrink-0 shadow-2xs">
                      {teacher.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <h5 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug truncate">
                      {teacher.fullName}
                    </h5>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 truncate">
                      <span className="truncate">{teacher.organization?.name || 'Pusat'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSlotClick(queueIndex, slotIdx)}
                    className="p-1.5 text-sky-700 hover:text-sky-800 bg-white hover:bg-sky-100/80 border border-sky-200/80 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                    title="Ganti Pengajar"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span className="text-[10px]">Ganti</span>
                  </button>
                </div>

                {/* Bagian Ustadz Badal / Cadangan */}
                <div className="pt-2 border-t border-sky-100">
                  {substitute ? (
                    <div className="p-2 rounded-lg bg-white/90 border border-amber-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                          Badal
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-[11px] text-slate-900 truncate">
                            {substitute.fullName}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">
                            {substitute.organization?.name || 'Pusat'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSubstituteClick(queueIndex, slotIdx)}
                          className="p-1 text-slate-400 hover:text-sky-600 rounded"
                          title="Ganti Badal"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onClearSubstitute(queueIndex, slotIdx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Hapus Badal"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSubstituteClick(queueIndex, slotIdx)}
                      className="w-full py-1 px-2 rounded-lg border border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/50 text-[10px] font-medium text-slate-500 hover:text-amber-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <UserCheck className="w-3 h-3 text-slate-400 group-hover:text-amber-600" />
                      <span>+ Tambah Badal Cadangan (Opsional)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Slot Kosong (Empty State)
          return (
            <button
              key={`empty-slot-${slotIdx}`}
              type="button"
              onClick={() => onSlotClick(queueIndex, slotIdx)}
              className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50/30 transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer group/slot min-h-[6.5rem]"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover/slot:bg-sky-100 text-slate-500 group-hover/slot:text-sky-700 flex items-center justify-center transition-colors">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover/slot:text-sky-900">
                Pilih Pengajar ke-{slotIdx + 1}
              </span>
              <span className="text-[10px] text-slate-400">Klik untuk memilih ustadz</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
