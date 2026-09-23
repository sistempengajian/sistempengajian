'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Award,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookMarked,
  HeartHandshake,
  Calendar,
  Clock,
  ListChecks,
  X,
  History,
} from 'lucide-react';
import { CurriculumMasteryAnalytics } from '@/app/(protected)/laporan/types';

interface CurriculumMasteryCardProps {
  curriculum: CurriculumMasteryAnalytics;
}

export default function CurriculumMasteryCard({ curriculum }: CurriculumMasteryCardProps) {
  const [activeTab, setActiveTab] = useState<'KATEGORI' | 'MILESTONE' | 'PENDAMPINGAN'>('KATEGORI');
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<Set<string>>(new Set());
  const [activeScheduleTooltipId, setActiveScheduleTooltipId] = useState<string | null>(null);

  const toggleScheduleTooltip = (id: string) => {
    setActiveScheduleTooltipId((prev) => (prev === id ? null : id));
  };

  const toggleMaterialExpand = (id: string) => {
    setExpandedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalScheduledMaterials = curriculum.categories.reduce(
    (acc, c) => acc + (c.materials?.length || 0),
    0
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Penguasaan Materi &amp; Kurikulum
            </h3>
            <p className="text-xs text-slate-500">
              Capaian target hafalan, pemahaman materi, dan kompetensi santri
            </p>
          </div>
        </div>

        {/* Persentase Keseluruhan */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-bold text-slate-600">Total Capaian:</span>
          <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs">
            {curriculum.completedItems} / {curriculum.totalChecklistItems} Tuntas ({curriculum.masteryPercentage}%)
          </span>
        </div>
      </div>

      {/* Baris Progress Keseluruhan */}
      <div className="space-y-1.5">
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
          <div
            className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 rounded-full transition-all duration-700 shadow-2xs"
            style={{ width: `${curriculum.masteryPercentage}%` }}
          />
        </div>
      </div>

      {/* Tab Navigasi Sub-Fitur */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('KATEGORI')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${activeTab === 'KATEGORI'
            ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Peta Bidang Studi ({curriculum.categories.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('MILESTONE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${activeTab === 'MILESTONE'
            ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          Capaian Terbaru ({curriculum.recentMilestones.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PENDAMPINGAN')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${activeTab === 'PENDAMPINGAN'
            ? 'bg-white text-amber-900 shadow-2xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <span>Perlu Pendampingan</span>
          {curriculum.needsAttentionItems.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center">
              {curriculum.needsAttentionItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Konten Tab 1: Peta Bidang Studi (Categories & Scheduled Materials) */}
      {activeTab === 'KATEGORI' && (
        <div className="space-y-4 animate-fade-in">
          {/* Info Banner Sinkronisasi Jadwal */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-teal-50/70 border border-teal-100 text-xs">
            <div className="flex items-center gap-2 text-teal-950 font-medium">
              <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Materi pembelajaran disinkronkan dengan <strong>jadwal pengajian santri</strong> pada rentang waktu terpilih.
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-white text-teal-800 border border-teal-200/80 shadow-2xs">
                {totalScheduledMaterials} Judul Materi Terdaftar
              </span>
            </div>
          </div>

          {curriculum.categories.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-slate-100">
              Belum ada materi atau kurikulum yang tercatat pada jadwal santri untuk periode ini.
            </div>
          ) : (
            curriculum.categories.map((cat) => (
              <div
                key={cat.name}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3"
              >
                {/* Header Kategori */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{cat.name}</span>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        {cat.materials?.length || 0} Materi
                      </span>
                    </div>
                    <span className="font-bold text-teal-800">
                      {cat.completed} / {cat.total} Target ({cat.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar Kategori */}
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>

                {/* Daftar Judul Materi yang Terdaftar di Jadwal */}
                {cat.materials && cat.materials.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {cat.materials.map((mat) => {
                      const isExpanded = expandedMaterialIds.has(mat.id);
                      return (
                        <div
                          key={mat.id}
                          className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-3 space-y-2.5 transition-all"
                        >
                          {/* Judul Materi & Status Tuntas */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 border border-teal-100">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                  {mat.title}
                                </h4>
                              </div>
                            </div>

                            {/* Status Persentase Materi */}
                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                              {mat.percentage === 100 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Tuntas 100%</span>
                                </span>
                              ) : mat.completedItems > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60">
                                  <span>
                                    {mat.completedItems} / {mat.totalItems} Tuntas ({mat.percentage}%)
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                  <span>0 / {mat.totalItems} Tuntas</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tombol Riwayat Jadwal & Tooltip */}
                          {mat.schedules && mat.schedules.length > 0 ? (
                            <div className="relative inline-block pt-0.5">
                              <button
                                type="button"
                                onClick={() => toggleScheduleTooltip(mat.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/70 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
                              >
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Riwayat Jadwal</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-bold">
                                  {mat.schedules.length}
                                </span>
                                <ChevronDown
                                  className={`w-3 h-3 text-emerald-600 transition-transform duration-200 ${activeScheduleTooltipId === mat.id ? 'rotate-180' : ''
                                    }`}
                                />
                              </button>

                              {/* Tooltip Popover Daftar Pengajian */}
                              {activeScheduleTooltipId === mat.id && (
                                <>
                                  {/* Backdrop transparan untuk menutup saat klik di luar */}
                                  <div
                                    className="fixed inset-0 z-30 cursor-default"
                                    onClick={() => setActiveScheduleTooltipId(null)}
                                  />
                                  <div className="absolute left-0 top-full mt-1.5 z-40 w-72 sm:w-80 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 p-3 space-y-2 animate-in fade-in zoom-in-95">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                          <Calendar className="w-3 h-3" />
                                        </div>
                                        <div>
                                          <h5 className="text-xs font-bold text-slate-900 leading-none">
                                            Daftar Jadwal Pengajian
                                          </h5>
                                          <span className="text-[10px] text-slate-500">
                                            {mat.schedules.length} sesi terhubung periode ini
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setActiveScheduleTooltipId(null)}
                                        className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
                                      {mat.schedules.map((s, idx) => (
                                        <div
                                          key={idx}
                                          className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-0.5 hover:bg-emerald-50/40 hover:border-emerald-200 transition-colors"
                                        >
                                          <div className="font-semibold text-slate-800 leading-tight">
                                            {s.scheduleTitle}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                            <span className="text-emerald-700 font-semibold">{s.date}</span>
                                            {s.time && (
                                              <>
                                                <span>•</span>
                                                <span>{s.time}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 italic">
                              <Clock className="w-3 h-3" />
                              <span>Silabus jenjang (Belum ada jadwal sesi di rentang waktu ini)</span>
                            </div>
                          )}

                          {/* Progress Bar Materi */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${mat.percentage}%` }}
                            />
                          </div>

                          {/* Tombol Rincian Target Sub-Capaian */}
                          {mat.checklistItems && mat.checklistItems.length > 0 && (
                            <div className="pt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => toggleMaterialExpand(mat.id)}
                                className="flex items-center justify-between w-full text-[11px] font-bold text-teal-700 hover:text-teal-800 cursor-pointer transition-colors"
                              >
                                <span className="flex items-center gap-1.5">
                                  <ListChecks className="w-3.5 h-3.5 text-teal-600" />
                                  <span>
                                    {isExpanded
                                      ? 'Sembunyikan Rincian Target'
                                      : `Lihat Rincian Target`}
                                  </span>
                                </span>
                                <span className="flex items-center gap-0.5 text-slate-400 font-medium text-[10px]">
                                  {isExpanded ? (
                                    <>Tutup <ChevronUp className="w-3 h-3" /></>
                                  ) : (
                                    <>Buka <ChevronDown className="w-3 h-3" /></>
                                  )}
                                </span>
                              </button>

                              {/* Daftar Item Checklist (Accordion Expanded) */}
                              {isExpanded && (
                                <div className="mt-2 space-y-1.5 pl-2 sm:pl-3 border-l-2 border-teal-200">
                                  {mat.checklistItems.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`p-2 rounded-lg flex items-start justify-between gap-2 text-xs transition-colors ${item.isCompleted
                                        ? 'bg-emerald-50/60 text-emerald-950'
                                        : 'bg-slate-50 text-slate-600'
                                        }`}
                                    >
                                      <div className="flex items-start gap-2 min-w-0">
                                        {item.isCompleted ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        ) : (
                                          <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0 mt-0.5" />
                                        )}
                                        <div className="min-w-0">
                                          <span className="font-semibold text-slate-800 leading-tight">
                                            {item.itemTitle}
                                          </span>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-500 font-medium">
                                              {item.targetType || 'Target'} ({item.pointsWeight} poin)
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        {item.isCompleted ? (
                                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                            Tuntas {item.score !== null ? `(${item.score})` : ''}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            Belum Diuji
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    Belum ada materi pembelajaran yang terdaftar di jadwal untuk bidang studi ini.
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Konten Tab 2: Capaian Terbaru (Recent Milestones) */}
      {activeTab === 'MILESTONE' && (
        <div className="space-y-2.5 animate-fade-in">
          {curriculum.recentMilestones.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Belum ada target capaian yang disahkan tuntas dalam periode ini.
            </div>
          ) : (
            curriculum.recentMilestones.map((ms) => (
              <div
                key={ms.id}
                className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {ms.itemTitle}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {ms.materialTitle}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {ms.score ? (
                    <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-lg border border-emerald-200/60 block">
                      Nilai: {ms.score}
                    </span>
                  ) : (
                    <span className="font-semibold text-[10px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg block">
                      Tuntas
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {ms.evaluatedAt}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Konten Tab 3: Perlu Pendampingan di Rumah (Teacher Feedback) */}
      {activeTab === 'PENDAMPINGAN' && (
        <div className="space-y-2.5 animate-fade-in">
          {curriculum.needsAttentionItems.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
              <Sparkles className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-emerald-900">
                Alhamdulillah, Tidak Ada Catatan Remedial
              </p>
              <p className="text-[11px] text-emerald-700">
                Semua materi berjalan lancar tanpa kendala khusus dari ustadz/ustadzah.
              </p>
            </div>
          ) : (
            curriculum.needsAttentionItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-950 truncate">
                    {item.itemTitle}
                  </span>
                  <span className="text-[10px] text-amber-700 shrink-0 font-medium">
                    {item.evaluatedAt}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Materi: <span className="font-semibold text-slate-800">{item.materialTitle}</span>
                </p>
                <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed italic">
                    &quot;{item.teacherFeedback}&quot;
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
