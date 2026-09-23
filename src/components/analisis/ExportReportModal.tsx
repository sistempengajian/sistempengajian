'use client';

import React from 'react';
import { AnalyticsDashboardData } from '@/app/(protected)/analisis/types';
import {
  X,
  Printer,
  FileSpreadsheet,
  Calendar,
  Building,
} from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AnalyticsDashboardData;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'No',
      'Nama Santri',
      'Kelas',
      'Kelompok',
      'Tingkat Kehadiran (%)',
      'Capaian Kurikulum (%)',
      'Skor Karakter & Adab',
      'Skor Komposit',
      'Status Pembinaan',
    ];

    const allStudents = [...data.topPerformers, ...data.atRiskStudents];
    // Remove duplicates if any
    const uniqueStudents = Array.from(new Map(allStudents.map((s) => [s.studentId, s])).values());

    const rows = uniqueStudents.map((s, idx) => [
      idx + 1,
      `"${s.fullName}"`,
      `"${s.className || '-'}"`,
      `"${s.organizationName || '-'}"`,
      s.attendanceRate,
      s.curriculumRate,
      s.characterScore,
      s.compositeScore,
      `"${s.compositeScore >= 80 ? 'Unggul' : s.compositeScore < 60 ? 'Perlu Intervensi' : 'Sedang'}"`,
    ]);

    const csvContent =
      '\uFEFF' +
      [
        `"LAPORAN EKSEKUTIF ANALISIS PEMBINAAN SANTRI"`,
        `"Unit/Lingkup:","${data.scopeInfo.name} (${data.scopeInfo.subtitle || ''})"`,
        `"Periode:","${data.scopeInfo.periodLabel} (${data.scopeInfo.dateRangeLabel})"`,
        `"Tanggal Unduh:","${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}"`,
        '',
        `"RINGKASAN KPI:"`,
        `"Total Santri Aktif",${data.summary.activeStudentsCount}`,
        `"Tingkat Kehadiran",${data.summary.attendanceRate}%`,
        `"Tepat Waktu",${data.summary.onTimeRate}%`,
        `"Terlambat",${data.summary.lateRate}%`,
        `"Alpa",${data.summary.absentRate}%`,
        `"Ketuntasan Kurikulum",${data.summary.curriculumMasteryRate}%`,
        `"Rata-rata Adab & Budi Pekerti",${data.summary.characterAverage}/100`,
        '',
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Analisis_${data.scopeInfo.name.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:bg-white print:p-0 print:static">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl text-slate-800 max-h-[90vh] flex flex-col print:border-none print:shadow-none print:max-h-none print:bg-white print:text-black">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-200/70 shadow-2xs">
              <Printer className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ekspor Laporan Eksekutif</h3>
              <p className="text-xs text-slate-500">Unduh format spreadsheet (Excel) atau cetak ringkasan resmi A4</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Report Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Official Letterhead */}
          <div className="border-b-2 border-slate-200 pb-4 text-center print:border-black">
            <h2 className="text-lg font-black tracking-wide uppercase text-slate-900 print:text-black">
              Laporan Analisis &amp; Evaluasi Pembinaan Santri
            </h2>
            <p className="text-xs text-slate-500 print:text-slate-700 mt-1 font-medium">
              Sistem Informasi Pembinaan Generasi Penerus &amp; Pengajian Terpadu
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600 print:text-slate-800">
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-teal-600 print:text-black" />
                <strong>Unit:</strong> {data.scopeInfo.name} ({data.scopeInfo.subtitle || '-'})
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-cyan-600 print:text-black" />
                <strong>Periode:</strong> {data.scopeInfo.periodLabel} ({data.scopeInfo.dateRangeLabel})
              </span>
            </div>
          </div>

          {/* KPI Summary Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-2">
              Ringkasan Capaian Utama (KPI)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Presensi</span>
                <span className="text-lg font-black text-emerald-700">{data.summary.attendanceRate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Tepat: {data.summary.onTimeRate}%</span>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Kurikulum</span>
                <span className="text-lg font-black text-cyan-700">{data.summary.curriculumMasteryRate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Target checklist</span>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Rata-rata Adab</span>
                <span className="text-lg font-black text-purple-700">{data.summary.characterAverage}/100</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Budi pekerti</span>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 print:border-slate-300 print:bg-slate-50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Santri Aktif</span>
                <span className="text-lg font-black text-indigo-700">{data.summary.activeStudentsCount}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Unggul: {data.summary.topPerformerCount}</span>
              </div>
            </div>
          </div>

          {/* Student Status Summary */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-2">
              Daftar Santri Prioritas Pembinaan
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 print:border-slate-300 shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold print:bg-slate-100 print:text-black">
                  <tr>
                    <th className="p-2.5 border-b border-slate-200 print:border-slate-300">Nama Santri</th>
                    <th className="p-2.5 border-b border-slate-200 print:border-slate-300 text-center">Presensi</th>
                    <th className="p-2.5 border-b border-slate-200 print:border-slate-300 text-center">Kurikulum</th>
                    <th className="p-2.5 border-b border-slate-200 print:border-slate-300 text-center">Adab</th>
                    <th className="p-2.5 border-b border-slate-200 print:border-slate-300 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-slate-300 text-slate-700">
                  {data.topPerformers.slice(0, 3).map((s) => (
                    <tr key={s.studentId}>
                      <td className="p-2.5 font-bold text-slate-900 print:text-black">⭐ {s.fullName}</td>
                      <td className="p-2.5 text-center text-emerald-700 font-bold">{s.attendanceRate}%</td>
                      <td className="p-2.5 text-center text-cyan-700 font-bold">{s.curriculumRate}%</td>
                      <td className="p-2.5 text-center text-purple-700 font-bold">{s.characterScore}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">Unggul</td>
                    </tr>
                  ))}
                  {data.atRiskStudents.slice(0, 5).map((s) => (
                    <tr key={s.studentId}>
                      <td className="p-2.5 font-bold text-slate-900 print:text-black">⚠️ {s.fullName}</td>
                      <td className="p-2.5 text-center text-rose-700 font-bold">{s.attendanceRate}%</td>
                      <td className="p-2.5 text-center text-rose-700 font-bold">{s.curriculumRate}%</td>
                      <td className="p-2.5 text-center text-rose-700 font-bold">{s.characterScore}</td>
                      <td className="p-2.5 text-right font-bold text-rose-700">Perlu Bina</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Line (Visible during print) */}
          <div className="hidden print:grid grid-cols-2 pt-10 text-center text-xs">
            <div>
              <p>Mengetahui,</p>
              <p className="mt-1 font-semibold">Penanggung Jawab / Dewan Guru</p>
              <div className="h-16" />
              <p className="font-bold underline">___________________________</p>
            </div>
            <div>
              <p>Dibuat Oleh,</p>
              <p className="mt-1 font-semibold">Wali Kelas / Tim Evaluasi</p>
              <div className="h-16" />
              <p className="font-bold underline">___________________________</p>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 p-4 print:hidden">
          <span className="text-xs font-semibold text-slate-500">
            {data.topPerformers.length + data.atRiskStudents.length} santri terangkum
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Unduh CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Ringkasan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportReportModal;
