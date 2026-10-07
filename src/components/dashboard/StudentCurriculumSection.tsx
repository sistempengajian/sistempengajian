import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import ProgressCircle from '@/components/dashboard/ProgressCircle';

interface StudentCurriculumSectionProps {
  generationName?: string | null;
  theme: {
    accentColor: string;
    accentBorder: string;
    [key: string]: any;
  };
  studentMetrics: any;
}

export default function StudentCurriculumSection({
  generationName,
  theme,
  studentMetrics,
}: StudentCurriculumSectionProps) {
  return (
    <section className={COMMON_THEME.cardClassPadded}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={COMMON_THEME.sectionTitleClass}>
                Capaian Kurikulum &amp; Rapor Belajar {generationName || 'Caberawit'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              Rekapitulasi target silabus &amp; standar kompetensi kelulusan santri
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-start gap-3 mb-4">
        <Link
          href="/laporan"
          prefetch={true}
          className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 self-start sm:self-center shrink-0 cursor-pointer`}
        >
          <span>Buka Rapor Lengkap</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {/* Item 1: Kurikulum Wajib (Syarat Kelulusan) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Kurikulum Wajib (Syarat Kelulusan)
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  (studentMetrics?.mandatory.percentage ?? 0) >= 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                    : 'bg-amber-50 text-amber-700 border-amber-200/70'
                }`}
              >
                {studentMetrics?.mandatory.percentage ?? 0}% Selesai
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {studentMetrics?.mandatory.completed ?? 0} dari{' '}
              {studentMetrics?.mandatory.total ?? 0} checklist standar kelulusan materi baku telah terpenuhi
            </p>
          </div>

          <ProgressCircle
            percentage={studentMetrics?.mandatory.percentage ?? 0}
            size={48}
          />
        </div>

        {/* Item 2: Modul Tambahan & Pengayaan */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Modul Tambahan &amp; Pengayaan
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  (studentMetrics?.enrichment.percentage ?? 0) >= 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                    : 'bg-amber-50 text-amber-700 border-amber-200/70'
                }`}
              >
                {studentMetrics?.enrichment.percentage ?? 0}% Selesai
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {studentMetrics?.enrichment.completed ?? 0} dari{' '}
              {studentMetrics?.enrichment.total ?? 0} checklist materi pilihan &amp; pengayaan halaqah
            </p>
          </div>

          <ProgressCircle
            percentage={studentMetrics?.enrichment.percentage ?? 0}
            size={48}
          />
        </div>

        {/* Item 3: Adab & Pembiasaan Harian */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                Adab &amp; Pembiasaan Harian
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  (studentMetrics?.adab.percentage ?? 100) >= 100
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                    : 'bg-amber-50 text-amber-700 border-amber-200/70'
                }`}
              >
                {studentMetrics?.adab.percentage ?? 100}% Tuntas
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500">
              {studentMetrics?.adab.completed ?? 0} dari{' '}
              {studentMetrics?.adab.total ?? 0} target kehadiran &amp; kedisiplinan adab halaqah
            </p>
          </div>

          <ProgressCircle
            percentage={studentMetrics?.adab.percentage ?? 100}
            size={48}
          />
        </div>
      </div>
    </section>
  );
}
