'use client';

import React, { useState } from 'react';
import { PerformerStudentItem } from '@/app/(protected)/analisis/types';
import {
  Trophy,
  AlertTriangle,
  Send,
  UserCheck,
  ChevronRight,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';
import Link from 'next/link';

interface TopAndAtRiskPerformersProps {
  topPerformers: PerformerStudentItem[];
  atRiskStudents: PerformerStudentItem[];
  onSelectStudent?: (studentId: string) => void;
}

export const TopAndAtRiskPerformers: React.FC<TopAndAtRiskPerformersProps> = ({
  topPerformers,
  atRiskStudents,
}) => {
  const [activeTab, setActiveTab] = useState<'top' | 'atRisk'>('top');

  const currentList = activeTab === 'top' ? topPerformers : atRiskStudents;

  const handleWhatsAppContact = (student: PerformerStudentItem) => {
    if (!student.parentPhone) return;
    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    const message = encodeURIComponent(
      `Assalamu'alaikum Wr. Wb. Bapak/Ibu ${student.parentName || 'Wali Santri'} dari ${student.fullName}. Terkait perkembangan kegiatan pengajian santri, kami ingin menginformasikan evaluasi pembinaan saat ini (Kehadiran: ${student.attendanceRate}%, Capaian Materi: ${student.curriculumRate}%). Mohon dukungannya agar santri tetap semangat dan istiqomah. Jazakumullahu khaira.`
    );

    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Segmentasi &amp; Evaluasi Santri</h3>
          <p className="text-xs text-slate-500 mt-0.5">Identifikasi santri berprestasi unggul serta santri yang butuh pendampingan</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-2xl bg-slate-100 p-1 border border-slate-200/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('top')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'top'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span>Santri Unggul ({topPerformers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('atRisk')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'atRisk'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-rose-200" />
            <span>Perlu Bina ({atRiskStudents.length})</span>
          </button>
        </div>
      </div>

      {/* Student List */}
      <div className="mt-4 space-y-3">
        {currentList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-semibold text-slate-400">
            Tidak ada santri dalam kategori ini pada periode terpilih.
          </div>
        ) : (
          currentList.map((student, idx) => {
            const isTop = activeTab === 'top';

            return (
              <div
                key={student.studentId}
                className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all shadow-2xs ${
                  isTop
                    ? 'bg-emerald-50/20 border-emerald-200/70 hover:border-emerald-400 hover:bg-emerald-50/40'
                    : 'bg-rose-50/20 border-rose-200/70 hover:border-rose-400 hover:bg-rose-50/40'
                }`}
              >
                {/* Left info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black text-sm shadow-2xs ${
                      isTop
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {student.fullName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                        {student.className || student.organizationName || 'Santri'}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {student.reasons && student.reasons.length > 0 ? (
                        student.reasons.map((r, rIdx) => (
                          <span
                            key={rIdx}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isTop
                                ? 'bg-emerald-100/70 text-emerald-800'
                                : 'bg-rose-100/70 text-rose-800'
                            }`}
                          >
                            {r}
                          </span>
                        ))
                      ) : (
                        <span>Keaktifan terpantau konsisten</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right metrics & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <div className="text-right">
                      <span className="text-[10px] font-medium text-slate-400 block">Presensi</span>
                      <span className={student.attendanceRate >= 80 ? 'text-emerald-700' : 'text-rose-700'}>
                        {student.attendanceRate}%
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-medium text-slate-400 block">Kurikulum</span>
                      <span className="text-cyan-700">{student.curriculumRate}%</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-medium text-slate-400 block">Skor</span>
                      <span className="text-purple-700">{student.compositeScore}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {student.parentPhone && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppContact(student)}
                        title="Hubungi Wali Santri via WhatsApp"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </button>
                    )}

                    <Link
                      href={`/laporan?studentId=${student.studentId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition cursor-pointer"
                      title="Buka Rapor Santri"
                    >
                      <span>Rapor</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default TopAndAtRiskPerformers;
