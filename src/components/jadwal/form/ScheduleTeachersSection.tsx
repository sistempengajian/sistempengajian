'use client';

import React from 'react';
import { User, UserCheck, X } from 'lucide-react';
import type { AvailableTeacher } from '../InteractiveCalendar';

interface ScheduleTeachersSectionProps {
  availableTeachers: AvailableTeacher[];
  selectedTeacherIds: string[];
  primaryTeacherId: string;
  setPrimaryTeacherId: (id: string) => void;
  substituteTeacherId: string;
  setSubstituteTeacherId: (id: string) => void;
  onAddTeacher: (teacherId: string) => void;
  onRemoveTeacher: (teacherId: string) => void;
}

export default function ScheduleTeachersSection({
  availableTeachers,
  selectedTeacherIds,
  primaryTeacherId,
  setPrimaryTeacherId,
  substituteTeacherId,
  setSubstituteTeacherId,
  onAddTeacher,
  onRemoveTeacher,
}: ScheduleTeachersSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
          <User className="w-4 h-4 text-teal-600" />
          <span>4. Pengajar &amp; Badal</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700">
          Ustadz Pengajar Bertugas <span className="text-rose-500">*</span>:
        </label>

        <div className="space-y-2">
          {selectedTeacherIds.map((tId) => {
            const teacher = availableTeachers.find((t) => t.id === tId);
            const isPrimary = tId === primaryTeacherId;
            return (
              <div
                key={tId}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  isPrimary
                    ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/20'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-teal-700 font-bold shrink-0">
                    {teacher?.fullName.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">
                      {teacher?.fullName || 'Ustadz'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPrimary ? 'Pengampu Utama' : 'Pengampu Pendamping'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimaryTeacherId(tId)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded-lg hover:bg-teal-100/60 transition-colors cursor-pointer"
                    >
                      Jadikan Utama
                    </button>
                  )}
                  {isPrimary && (
                    <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-[11px]">
                      Ustadz Utama
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveTeacher(tId)}
                    disabled={selectedTeacherIds.length <= 1}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    title="Hapus dari tim"
                    aria-label="Hapus pengajar dari tim"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-1">
          <select
            value=""
            onChange={(e) => onAddTeacher(e.target.value)}
            className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-700 font-medium"
          >
            <option value="">
              + Tambah Pengajar Lain ke Sesi Pengajian...
            </option>
            {availableTeachers
              .filter((t) => !selectedTeacherIds.includes(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-amber-600" />
          <span>Ustadz Badal (Delegasi Pengganti - Opsional)</span>
        </label>
        <select
          value={substituteTeacherId}
          onChange={(e) => setSubstituteTeacherId(e.target.value)}
          className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 font-medium"
        >
          <option value="">
            -- Tidak Ada Badal (Dikelola Saat Diperlukan) --
          </option>
          {availableTeachers
            .filter((t) => !selectedTeacherIds.includes(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
