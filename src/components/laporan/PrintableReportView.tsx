'use client';

import React from 'react';
import { ChildDevelopmentReport } from '@/app/(protected)/laporan/types';

interface PrintableReportViewProps {
  report: ChildDevelopmentReport;
}

export default function PrintableReportView({ report }: PrintableReportViewProps) {
  const { student, attendance, curriculum, character, assignments, gamification } = report;

  const getPeriodLabel = (p?: string) => {
    switch (p) {
      case 'THIS_MONTH':
        return 'Bulan Ini';
      case 'LAST_MONTH':
        return 'Bulan Lalu';
      case 'LAST_3_MONTHS':
        return '3 Bulan Terakhir';
      case 'THIS_SEMESTER':
        return 'Semester Berjalan';
      default:
        return 'Semua Periode';
    }
  };

  return (
    <div className="printable-report bg-white text-slate-900 p-8 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Kop Laporan Resmi */}
      <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
        <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
          {student.organizationName}
        </h1>
        <h2 className="text-sm font-bold text-slate-700 tracking-wide">
          LAPORAN PERKEMBANGAN &amp; HASIL BELAJAR SANTRI
        </h2>
        <p className="text-xs text-slate-500">
          Sistem Pengajian Terpadu • Periode Laporan: {getPeriodLabel(report.period)}
        </p>
      </div>

      {/* Informasi Identitas Santri */}
      <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="space-y-1">
          <div className="flex">
            <span className="w-28 text-slate-500">Nama Santri:</span>
            <span className="font-bold text-slate-900">{student.fullName}</span>
          </div>
          <div className="flex">
            <span className="w-28 text-slate-500">Jenjang Generasi:</span>
            <span className="font-semibold text-slate-800">{student.generationName}</span>
          </div>
          <div className="flex">
            <span className="w-28 text-slate-500">Kelas Pengajian:</span>
            <span className="font-semibold text-slate-800">{student.className || 'Kelas Reguler'}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex">
            <span className="w-28 text-slate-500">Wali Kelas:</span>
            <span className="font-semibold text-slate-800">
              {student.homeroomTeacher?.fullName || 'Ustadz / Pembina'}
            </span>
          </div>
          <div className="flex">
            <span className="w-28 text-slate-500">Poin Gamifikasi:</span>
            <span className="font-semibold text-slate-800">
              {gamification.points} Poin (Level {gamification.level})
            </span>
          </div>
          <div className="flex">
            <span className="w-28 text-slate-500">Tanggal Cetak:</span>
            <span className="text-slate-800">
              {new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Rekapitulasi Presensi Kehadiran */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          I. Rekapitulasi Kehadiran &amp; Kedisiplinan
        </h3>
        <table className="w-full text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 p-2 text-center">Total Sesi</th>
              <th className="border border-slate-300 p-2 text-center">Hadir</th>
              <th className="border border-slate-300 p-2 text-center">Terlambat</th>
              <th className="border border-slate-300 p-2 text-center">Izin</th>
              <th className="border border-slate-300 p-2 text-center">Sakit</th>
              <th className="border border-slate-300 p-2 text-center">Alpa</th>
              <th className="border border-slate-300 p-2 text-center font-bold">Persentase</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center font-medium">
              <td className="border border-slate-300 p-2">{attendance.totalSessions}</td>
              <td className="border border-slate-300 p-2 text-emerald-700 font-bold">{attendance.onTime}</td>
              <td className="border border-slate-300 p-2">{attendance.late}</td>
              <td className="border border-slate-300 p-2">{attendance.permission}</td>
              <td className="border border-slate-300 p-2">{attendance.sick}</td>
              <td className="border border-slate-300 p-2 text-rose-700">{attendance.absent}</td>
              <td className="border border-slate-300 p-2 font-bold text-teal-800 bg-teal-50/50">
                {attendance.percentage}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 2. Penguasaan Materi Kurikulum */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          II. Capaian Penguasaan Materi &amp; Kurikulum
        </h3>
        <table className="w-full text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 p-2 text-left">Bidang Studi / Kategori</th>
              <th className="border border-slate-300 p-2 text-center">Target</th>
              <th className="border border-slate-300 p-2 text-center">Tuntas</th>
              <th className="border border-slate-300 p-2 text-center">Persentase</th>
              <th className="border border-slate-300 p-2 text-center">Predikat</th>
            </tr>
          </thead>
          <tbody>
            {curriculum.categories.map((cat) => (
              <tr key={cat.name}>
                <td className="border border-slate-300 p-2 font-medium">
                  <div>{cat.name}</div>
                  {cat.materials && cat.materials.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-0.5 font-normal leading-relaxed">
                      Materi terjadwal: {cat.materials.map((m) => m.title).join(', ')}
                    </div>
                  )}
                </td>
                <td className="border border-slate-300 p-2 text-center">{cat.total}</td>
                <td className="border border-slate-300 p-2 text-center font-bold text-teal-800">
                  {cat.completed}
                </td>
                <td className="border border-slate-300 p-2 text-center">{cat.percentage}%</td>
                <td className="border border-slate-300 p-2 text-center font-bold">
                  {cat.percentage >= 85
                    ? 'Sangat Baik (A)'
                    : cat.percentage >= 70
                    ? 'Baik (B)'
                    : cat.percentage >= 50
                    ? 'Cukup (C)'
                    : 'Perlu Latihan (D)'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Evaluasi Karakter & Adab */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
          III. Penilaian Karakter, Adab &amp; Portofolio Tugas
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-slate-300 rounded-lg">
            <span className="text-slate-500 block">Nilai Rata-rata Adab &amp; Akhlaq:</span>
            <span className="text-lg font-bold text-slate-900">{character.averageAdab} / 100</span>
          </div>
          <div className="p-3 border border-slate-300 rounded-lg">
            <span className="text-slate-500 block">Nilai Keaktifan &amp; Tartil:</span>
            <span className="text-lg font-bold text-slate-900">{character.averageKeaktifan} / 100</span>
          </div>
        </div>
      </div>

      {/* 4. Catatan Wali Kelas & Pembina */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-slate-900">Catatan Wali Kelas / Pembina:</h4>
        <div className="p-3 border border-slate-300 rounded-lg text-xs italic bg-slate-50 min-h-16">
          {character.teacherNotesFeed[0]?.note ||
            'Alhamdulillah ananda mengikuti kegiatan belajar mengajar dengan tertib, berakhlaqul karimah, dan bersemangat dalam mempelajari Al-Qur\'an dan Hadits.'}
        </div>
      </div>

      {/* Kolom Tanda Tangan */}
      <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center">
        <div className="space-y-16">
          <p className="text-slate-600">Mengetahui,<br />Orang Tua / Wali Santri</p>
          <p className="font-bold border-t border-slate-400 pt-1 w-48 mx-auto">( ........................................ )</p>
        </div>
        <div className="space-y-16">
          <p className="text-slate-600">
            Wali Kelas / Pembina
          </p>
          <p className="font-bold border-t border-slate-400 pt-1 w-48 mx-auto">
            ( {student.homeroomTeacher?.fullName || 'Ustadz / Pembina'} )
          </p>
        </div>
      </div>
    </div>
  );
}
