'use client';

import React, { useState } from 'react';
import {
  StudentEvaluationData,
  WeeklyTrendItem,
  ThobiatLuhurItem,
} from './actions';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  Printer,
  Calendar,
  User,
  Check,
  AlertCircle,
  TrendingUp,
  MessageCircle,
  Building,
  GraduationCap,
  Sparkles,
  LayoutGrid,
  Smartphone,
  ShieldCheck,
  FileText,
  UserCheck,
} from 'lucide-react';

interface EvaluationSheetClientProps {
  studentsData: StudentEvaluationData[];
}

export default function EvaluationSheetClient({ studentsData }: EvaluationSheetClientProps) {
  const [activeStudentIndex, setActiveStudentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'CARD' | 'LANDSCAPE'>('CARD');

  const currentData = studentsData[activeStudentIndex] || studentsData[0];
  if (!currentData) return null;

  const { student, period, attendance, curriculum, character, gamification } = currentData;

  const handlePrint = () => {
    window.print();
  };

  const getWaConfirmationUrl = () => {
    const teacherPhone = student.homeroomTeacher?.phoneNumber;
    if (!teacherPhone) return null;

    const cleanPhone = teacherPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    const text = encodeURIComponent(
      `Assalamu'alaikum Warahmatullahi Wabarakatuh Ustadz/Ustadzah ${
        student.homeroomTeacher?.fullName || 'Wali Kelas'
      }. Alhamdulillah kami telah menerima dan meninjau Lembar Evaluasi Ananda ${
        student.fullName
      } untuk periode ${period.monthName}. Terima kasih atas bimbingan dan pembinaannya selama ini. Jazakumullahu khairan.`
    );

    return `https://wa.me/${formattedPhone}?text=${text}`;
  };

  const waUrl = getWaConfirmationUrl();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      {/* Global Print & Page Styling */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-sheet {
            max-width: 100% !important;
            padding: 12px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 1. TOP STICKY BAR: Brand, Multi-Child Tabs & Action Controls (print:hidden) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs print-hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Logo & Periode Laporan */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span>Lembar Evaluasi Santri</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                    Resmi
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  {period.monthName} • Sistem Pengajian SiPanji
                </p>
              </div>
            </div>

            {/* Tombol Cetak / PDF Cepat di Mobile */}
            <button
              type="button"
              onClick={handlePrint}
              className="sm:hidden inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-2xs active:scale-95 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
          </div>

          {/* Switcher Multi-Anak (Jika > 1 Anak) */}
          {studentsData.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider shrink-0 hidden md:inline">
                Pilih Ananda:
              </span>
              {studentsData.map((data, idx) => {
                const isSelected = idx === activeStudentIndex;
                return (
                  <button
                    key={data.student.id}
                    type="button"
                    onClick={() => setActiveStudentIndex(idx)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-white text-emerald-800 shadow-2xs border border-emerald-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <User className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>{data.student.fullName.split(' ')[0]}</span>
                    {data.student.className && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({data.student.className})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tombol Aksi Desktop: Toggle Mode Tampilan & Cetak PDF */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('CARD')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'CARD'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mode Kartu HP</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('LANDSCAPE')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'LANDSCAPE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Pratinjau Lanskap</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. LEMBAR DOKUMEN EVALUASI RESMI (Printable Sheet) */}
      <main
        className={`mx-auto p-3 sm:p-6 transition-all ${
          viewMode === 'LANDSCAPE' ? 'max-w-6xl' : 'max-w-4xl'
        }`}
      >
        <div className="print-sheet bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden border-t-4 border-t-emerald-600">
          {/* A. KOP DOKUMEN INSTITUSIONAL & IDENTITAS LEMBAGA */}
          <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                  {student.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      {student.organizationName}
                    </span>
                    
                  </div>
                  <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                    {student.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium flex flex-col items-start gap-1.5 mt-0.5">
                    <span>{student.generationName}</span>
                    <span>Wali Kelas: <strong className="text-slate-700 font-semibold">{student.homeroomTeacher?.fullName || 'Pengajar Binaan'}</strong></span>
                  </p>
                </div>
              </div>

              {/* Status Periode & Tanggal Terbit */}
              <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Periode Evaluasi Bulanan
                </span>
                <span className="text-sm font-black text-slate-900 block mt-0.5">
                  {period.monthName}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Rentang: {period.formattedRangeDate}
                </span>
              </div>
            </div>
          </div>

          {/* B. BENTO GRID SYSTEM: 4 ZONA METRIK & CAPAIAN */}
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            {/* ZONA 1: DUAL CIRCULAR PROGRESS GAUGE (KEHADIRAN & CAPAIAN KURIKULUM) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Gauge Kehadiran Bulanan */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
                <CircularGauge
                  percentage={attendance.percentage}
                  color={
                    attendance.statusColor === 'emerald'
                      ? '#059669'
                      : attendance.statusColor === 'amber'
                      ? '#d97706'
                      : '#e11d48'
                  }
                  label="Kehadiran"
                  sublabel={`${attendance.attended}/${attendance.totalSessions} Sesi`}
                />

                <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Disiplin Presensi Pengajian
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {attendance.totalSessions} sesi terlaksana pada {period.monthName}
                      </p>
                    </div>
                    {attendance.streakDays > 0 && (
                      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Streak {attendance.streakDays} Sesi</span>
                      </span>
                    )}
                  </div>

                  {/* Rincian Status Hadir, Izin, Sakit, Alpa */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-1.5 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Tepat</span>
                      <span className="block text-xs sm:text-sm font-black text-emerald-700">
                        {attendance.onTime}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Lambat</span>
                      <span className="block text-xs sm:text-sm font-black text-amber-700">
                        {attendance.late}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Izin/Sakit</span>
                      <span className="block text-xs sm:text-sm font-black text-slate-700">
                        {attendance.permission + attendance.sick}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Alpa</span>
                      <span className="block text-xs sm:text-sm font-black text-rose-700">
                        {attendance.absent}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Gauge Ketuntasan Kurikulum Materi Bulan Ini */}
              <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
                <CircularGauge
                  percentage={curriculum.masteryPercentage}
                  color="#0d9488"
                  label="Materi Tuntas"
                  sublabel={`${curriculum.completedChecklistItems}/${curriculum.totalChecklistItems} Butir`}
                />

                <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
                  <div className="flex items-center justify-start">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Target Kurikulum Bulan Ini
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {curriculum.totalTargetMaterials} Materi Pokok Silabus
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      <Award className="w-3 h-3 text-teal-600" />
                      <span>{curriculum.predicate}</span>
                    </span>
                  </div>

                  {/* Ringkasan Rasio Ketuntasan */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Materi Tuntas</span>
                      <span className="block text-xs sm:text-sm font-black text-teal-800">
                        {curriculum.completedTargetMaterials} dari {curriculum.totalTargetMaterials}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200/70">
                      <span className="block text-[10px] font-bold text-slate-400">Sub-Target Tercapai</span>
                      <span className="block text-xs sm:text-sm font-black text-slate-800">
                        {curriculum.completedChecklistItems} dari {curriculum.totalChecklistItems}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ZONA 2: GRAFIK TREN PEKANAN & INDIKATOR 6 THOBIAT LUHUR */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Kiri (7 Kolom): Native SVG Line Chart Tren Kehadiran & Adab Pekanan */}
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Tren Kehadiran &amp; Adab Pekanan
                    </h3>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span>Kehadiran</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span>Adab/Akhlak</span>
                    </span>
                  </div>
                </div>

                {/* Canvas Native SVG Line Chart */}
                <NativeWeeklyLineChart trendData={attendance.weeklyTrend} />

                <p className="text-[10px] text-slate-400 italic">
                  * Garis menunjukkan kestabilan kehadiran dan evaluasi adab santri pada setiap pekan di bulan {period.monthName}.
                </p>
              </div>

              {/* Kanan (5 Kolom): Indikator 6 Thobiat Luhur (Karakter Islami) */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Evaluasi 6 Thobiat Luhur
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                    Predikat {character.predicate}
                  </span>
                </div>

                <div className="space-y-2">
                  {character.thobiatLuhur.map((item) => (
                    <ThobiatProgressBar key={item.key} item={item} />
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Rata-rata Skor Karakter:</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {character.compositeScore} / 100
                  </span>
                </div>
              </div>
            </div>

            {/* ZONA 3: CHECKLIST KURIKULUM & MATERI BULANAN */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Rincian Materi Silabus {period.monthName}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Capaian pembelajaran ananda sesuai kurikulum baku jenjang {student.generationName}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/70">
                  {curriculum.completedTargetMaterials} dari {curriculum.totalTargetMaterials} Materi Tuntas
                </span>
              </div>

              {/* Tabel / Grid Materi */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {curriculum.materials.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Belum ada data materi terjadwal spesifik pada periode ini.
                  </div>
                ) : (
                  curriculum.materials.map((mat, idx) => (
                    <div
                      key={mat.id}
                      className="p-3 sm:p-3.5 bg-white hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {mat.category}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {idx + 1}. {mat.title}
                          </span>
                        </div>
                        {/* Sub-checklists */}
                        {mat.checklistItems.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            {mat.checklistItems.map((chk) => (
                              <span
                                key={chk.id}
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  chk.isCompleted
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                {chk.isCompleted ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Clock className="w-3 h-3 text-slate-400" />
                                )}
                                <span>{chk.itemTitle}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {mat.isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tuntas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/80">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Dalam Pembinaan</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ZONA 4: CATATAN WALI KELAS, TANDA TANGAN DIGITAL & MICRO-ACTION WHATSAPP */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              {/* Catatan Pembinaan Wali Kelas (8 Kolom) */}
              <div className="md:col-span-8 p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>Catatan &amp; Arahan Wali Kelas</span>
                  </h4>
                  <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-medium mt-2 italic bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                    &ldquo;{character.teacherNote}&rdquo;
                  </p>
                </div>

                {/* Tombol Micro-Action Konfirmasi ke WA Guru (print:hidden) */}
                {waUrl && (
                  <div className="pt-2 print-hidden">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Kirim Apresiasi / Balas ke Wali Kelas</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Tanda Tangan Digital & Cap Lembaga (4 Kolom) */}
              <div className="md:col-span-4 p-4 rounded-2xl bg-white border border-slate-200/80 flex flex-col items-center justify-between text-center space-y-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Diterbitkan Pada
                  </span>
                  <span className="text-xs font-bold text-slate-800 block">
                    {period.issueDate}
                  </span>
                </div>

                {/* Stempel & Garis Tanda Tangan Institusional */}
                <div className="py-2 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-emerald-300 text-emerald-700 flex flex-col items-center justify-center p-1 font-bold text-[9px] uppercase tracking-tighter opacity-80 select-none">
                    <CheckCircle2 className="w-4 h-4 mb-0.5 text-emerald-600" />
                    <span>Terverifikasi</span>
                    <span className="text-[7px] text-slate-500 font-normal">SiPanji Sistem</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-200 w-full">
                  <span className="text-xs font-black text-slate-900 block truncate">
                    {student.homeroomTeacher?.fullName || 'Wali Kelas / Pembina'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Wali Kelas {student.className || student.generationName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* C. FOOTER DOKUMEN RESMI */}
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-1.5 text-center sm:text-left">
            <span>
              Dokumen ini dihasilkan secara otomatis oleh <strong>Sistem Pengajian Terpadu SiPanji</strong>.
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              No. Dokumen: EVAL-{period.year}{String(period.month).padStart(2, '0')}-{student.id.slice(0, 6).toUpperCase()}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Native SVG Circular Gauge Component
 */
function CircularGauge({
  percentage,
  color,
  label,
  sublabel,
}: {
  percentage: number;
  color: string;
  label: string;
  sublabel: string;
}) {
  const size = 110;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center shrink-0">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      {/* Center Labels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
          {safePercentage}%
        </span>
        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{label}</span>
      </div>
      <span className="text-[10px] font-medium text-slate-500 mt-1">{sublabel}</span>
    </div>
  );
}

/**
 * Native SVG Line Chart Component (No heavy external charting library)
 */
function NativeWeeklyLineChart({ trendData }: { trendData: WeeklyTrendItem[] }) {
  if (!trendData || trendData.length === 0) return null;

  const width = 460;
  const height = 150;
  const paddingLeft = 40;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => {
    if (trendData.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (trendData.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const safeVal = Math.min(100, Math.max(0, val));
    return paddingTop + chartHeight - (safeVal / 100) * chartHeight;
  };

  // Generate SVG path for Attendance Rate (Emerald)
  const attendancePoints = trendData.map((d, i) => ({ x: getX(i), y: getY(d.attendanceRate) }));
  const attendancePath = attendancePoints.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  // Gradient area path under attendance line
  const areaPath = `${attendancePath} L ${attendancePoints[attendancePoints.length - 1].x} ${
    paddingTop + chartHeight
  } L ${attendancePoints[0].x} ${paddingTop + chartHeight} Z`;

  // Generate SVG path for Adab Score (Teal)
  const adabPoints = trendData.map((d, i) => ({ x: getX(i), y: getY(d.adabScore) }));
  const adabPath = adabPoints.reduce(
    (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[170px] select-none">
        <defs>
          <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[100, 75, 50, 25].map((level) => {
          const y = getY(level);
          return (
            <g key={level}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono font-medium"
              >
                {level}
              </text>
            </g>
          );
        })}

        {/* Gradient Area under Attendance */}
        <path d={areaPath} fill="url(#emeraldAreaGrad)" />

        {/* Lines */}
        <path d={attendancePath} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
        <path d={adabPath} fill="none" stroke="#0d9488" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />

        {/* Points & Labels */}
        {trendData.map((d, i) => {
          const x = getX(i);
          const yAtt = getY(d.attendanceRate);
          const yAdab = getY(d.adabScore);

          return (
            <g key={d.weekLabel}>
              {/* Bottom Week Label */}
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="text-[10px] font-bold fill-slate-500"
              >
                {d.weekLabel}
              </text>

              {/* Attendance Point Circle */}
              <circle cx={x} cy={yAtt} r="4" fill="#059669" stroke="#ffffff" strokeWidth="2" />
              <text
                x={x}
                y={yAtt - 7}
                textAnchor="middle"
                className="text-[9px] font-black fill-emerald-800"
              >
                {d.attendanceRate}%
              </text>

              {/* Adab Point Circle */}
              <circle cx={x} cy={yAdab} r="3" fill="#0d9488" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Thobiat Luhur Bar Component
 */
function ThobiatProgressBar({ item }: { item: ThobiatLuhurItem }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-800">{item.label}</span>
        <span className="font-semibold text-slate-500 text-[11px]">{item.score}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
          style={{ width: `${item.score}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 block truncate">{item.description}</span>
    </div>
  );
}
