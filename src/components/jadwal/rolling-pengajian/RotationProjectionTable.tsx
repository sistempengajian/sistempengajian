'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  User,
  Clock,
  Calendar,
  CalendarDays,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import type { RollingIntervalType } from '@prisma/client';

interface RotationProjectionTableProps {
  materialRolling?: any | null;
  teacherRolling?: any | null;
  projectionCount?: number;
}

export default function RotationProjectionTable({
  materialRolling,
  teacherRolling,
  projectionCount = 6,
}: RotationProjectionTableProps) {
  const [totalCount, setTotalCount] = useState<number>(projectionCount);

  if (!materialRolling || !teacherRolling) {
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1.5 text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Simulasi Proyeksi Rotasi Belum Tersedia</p>
        <p>Pilih template <strong>Rolling Materi</strong> dan <strong>Rolling Pengajar</strong> di atas untuk melihat simulasi perputaran jadwal.</p>
      </div>
    );
  }

  const matQueues = materialRolling.queues || [];
  const teachQueues = teacherRolling.queues || [];

  if (matQueues.length === 0 || teachQueues.length === 0) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-center text-xs text-amber-800">
        Salah satu template yang dipilih belum memiliki daftar antrean aktif.
      </div>
    );
  }

  // Format Interval Badge
  const renderIntervalBadge = (type: RollingIntervalType) => {
    switch (type) {
      case 'PER_PENGAJIAN':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/70 px-2 py-0.5 rounded-full">
            <Clock className="w-2.5 h-2.5" /> Per Pengajian
          </span>
        );
      case 'MINGGUAN':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-full">
            <CalendarDays className="w-2.5 h-2.5" /> Mingguan (7 Hari)
          </span>
        );
      case 'BULANAN':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
            <Calendar className="w-2.5 h-2.5" /> Bulanan
          </span>
        );
    }
  };

  // Generate baris proyeksi rotasi
  const projections = Array.from({ length: totalCount }).map((_, idx) => {
    const iterationNumber = idx + 1;

    // Matriks modulo antrean bergulir
    const matQueueIndex = idx % matQueues.length;
    const teachQueueIndex = idx % teachQueues.length;

    const currentMatQueue = matQueues[matQueueIndex];
    const currentTeachQueue = teachQueues[teachQueueIndex];

    return {
      iterationNumber,
      matQueue: currentMatQueue,
      teachQueue: currentTeachQueue,
    };
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/95 overflow-hidden shadow-2xs space-y-3 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>Simulasi Proyeksi Rotasi ({totalCount} Sesi / Siklus Pertama)</span>
          </h5>
          <p className="text-[11px] text-slate-400">
            Prakiraan perputaran otomatis pertemuan berikutnya berdasarkan template yang dipasangkan
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTotalCount(totalCount === 6 ? 12 : 6)}
            className="text-[11px] font-bold text-sky-700 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-xl border border-sky-200/80 transition-colors cursor-pointer"
          >
            {totalCount === 6 ? 'Tampilkan 12 Siklus' : 'Tampilkan 6 Siklus'}
          </button>
        </div>
      </div>

      {/* Ringkasan Konfigurasi Interval */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-teal-50/50 border border-teal-200/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-teal-800 uppercase block">
              Materi ({matQueues.length} Antrean)
            </span>
            <span className="font-bold text-slate-800 text-[11px] truncate block">
              {materialRolling.name}
            </span>
          </div>
          {renderIntervalBadge(materialRolling.rollingType)}
        </div>

        <div className="p-2.5 rounded-xl bg-sky-50/50 border border-sky-200/60 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-sky-800 uppercase block">
              Pengajar ({teachQueues.length} Antrean)
            </span>
            <span className="font-bold text-slate-800 text-[11px] truncate block">
              {teacherRolling.name}
            </span>
          </div>
          {renderIntervalBadge(teacherRolling.rollingType)}
        </div>
      </div>

      {/* Tabel Proyeksi */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-2 px-3 w-16 text-center">Siklus</th>
              <th className="py-2 px-3">Materi yang Dikaji</th>
              <th className="py-2 px-3 w-8 text-center text-slate-400">&times;</th>
              <th className="py-2 px-3">Pengajar yang Bertugas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projections.map((p) => {
              const matItems = p.matQueue?.items || [];
              const teachItems = p.teachQueue?.items || [];

              return (
                <tr key={`proj-${p.iterationNumber}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-extrabold text-slate-900 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-[10px]">
                      #{p.iterationNumber}
                    </span>
                  </td>

                  {/* Materi */}
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-teal-800">
                        <span className="px-1.5 py-0.2 rounded bg-teal-100">
                          {p.matQueue?.title || `Antrean #${p.matQueue?.stepOrder}`}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {matItems.map((m: any, mIdx: number) => (
                          <div key={m.id || mIdx} className="flex items-center gap-1.5 text-slate-800 text-[11px]">
                            <BookOpen className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="font-semibold line-clamp-1">
                              {m.material?.title || 'Materi Belum Terpilih'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* Separator */}
                  <td className="py-2.5 px-3 text-center text-slate-300 font-bold">
                    <ArrowRight className="w-3 h-3 mx-auto" />
                  </td>

                  {/* Pengajar */}
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-sky-800">
                        <span className="px-1.5 py-0.2 rounded bg-sky-100">
                          {p.teachQueue?.title || `Antrean #${p.teachQueue?.stepOrder}`}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {teachItems.map((t: any, tIdx: number) => (
                          <div key={t.id || tIdx} className="space-y-0.5 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                              <User className="w-3 h-3 text-sky-600 shrink-0" />
                              <span className="truncate">{t.teacher?.fullName || 'Pengajar Belum Terpilih'}</span>
                            </div>
                            {t.substituteTeacher && (
                              <div className="text-[10px] text-amber-700 pl-4">
                                <span>Badal: {t.substituteTeacher.fullName}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
