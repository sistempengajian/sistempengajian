'use client';

import React, { useState } from 'react';
import {
  CalendarDays,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AttendanceAnalytics, AttendanceHeatmapDay } from '@/app/(protected)/laporan/types';

interface AttendanceHeatmapCardProps {
  attendance: AttendanceAnalytics;
  currentPeriod?: string;
}

const DAYS_HEADER = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function AttendanceHeatmapCard({ attendance, currentPeriod }: AttendanceHeatmapCardProps) {
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [activeDayDetail, setActiveDayDetail] = useState<AttendanceHeatmapDay | null>(null);

  // Sesuaikan tampilan bulan kalender jika filter periode berubah
  React.useEffect(() => {
    if (currentPeriod === 'LAST_MONTH') {
      setCurrentMonthOffset(-1);
    } else if (currentPeriod === 'THIS_MONTH' || !currentPeriod) {
      setCurrentMonthOffset(0);
    }
  }, [currentPeriod]);

  // Hitung bulan yang sedang ditampilkan
  const displayDate = new Date();
  displayDate.setMonth(displayDate.getMonth() + currentMonthOffset);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const monthName = displayDate.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  // Hitung hari pertama dan jumlah hari dalam bulan ini
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Index data heatmap berdasarkan tanggal YYYY-MM-DD
  const heatmapMap: Record<string, AttendanceHeatmapDay> = {};
  attendance.heatmapDays.forEach((d) => {
    heatmapMap[d.date] = d;
  });

  // Helper untuk warna status kehadiran
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'HADIR':
        return 'bg-emerald-500 text-white font-bold shadow-2xs hover:bg-emerald-600';
      case 'TERLAMBAT':
        return 'bg-amber-500 text-white font-bold shadow-2xs hover:bg-amber-600';
      case 'IZIN':
        return 'bg-sky-500 text-white font-bold shadow-2xs hover:bg-sky-600';
      case 'SAKIT':
        return 'bg-indigo-500 text-white font-bold shadow-2xs hover:bg-indigo-600';
      case 'ALPA':
        return 'bg-rose-500 text-white font-bold shadow-2xs hover:bg-rose-600';
      default:
        return 'bg-slate-50 text-slate-400 hover:bg-slate-100';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Rekapitulasi Kehadiran &amp; Presensi
            </h3>
            <p className="text-xs text-slate-500">
              Pola kedisiplinan dan rekap presensi per sesi pengajian
            </p>
          </div>
        </div>

        {/* Streak Kehadiran Badge */}
        {attendance.currentStreak > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-bold self-start sm:self-auto shadow-2xs">
            <Flame className="w-4 h-4 text-amber-600 fill-amber-500" />
            <span>{attendance.currentStreak} Sesi Berturut-turut Hadir</span>
          </div>
        )}
      </div>

      {/* Grid Metrik Ringkas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Persentase Kehadiran */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Tingkat Kehadiran
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-950">
              {attendance.percentage}%
            </span>
          </div>
          <span className="text-[10px] text-emerald-700 font-medium block">
            {attendance.attended} dari {attendance.totalSessions} sesi hadir
          </span>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/70 space-y-1">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
            Tepat Waktu
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-teal-950">
              {attendance.onTime}
            </span>
            <span className="text-xs font-semibold text-teal-700">kali</span>
          </div>
          <span className="text-[10px] text-teal-700 font-medium block">
            {attendance.late > 0 ? `${attendance.late}x terlambat` : 'Tanpa terlambat'}
          </span>
        </div>

        {/* Izin / Sakit */}
        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/70 space-y-1">
          <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
            Izin &amp; Sakit
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-sky-950">
              {attendance.permission + attendance.sick}
            </span>
            <span className="text-xs font-semibold text-sky-700">kali</span>
          </div>
          <span className="text-[10px] text-sky-700 font-medium block">
            {attendance.permission} Izin, {attendance.sick} Sakit
          </span>
        </div>

        {/* Rata-rata Jam Masuk */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 space-y-1">
          <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
            Rata-rata Masuk
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-black text-indigo-950 truncate">
              {attendance.averageCheckInTime || '—'}
            </span>
          </div>
          <span className="text-[10px] text-indigo-700 font-medium flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-600" />
            <span>Sesuai jam ajar</span>
          </span>
        </div>
      </div>

      {/* Mini Calendar Heatmap */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 capitalize">
              {monthName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((prev) => prev - 1)}
              className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer"
              title="Bulan sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonthOffset(0)}
              className="px-2 py-1 text-[11px] font-bold rounded-lg hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((prev) => prev + 1)}
              disabled={currentMonthOffset >= 0}
              className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title="Bulan berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7 Hari Header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
          {DAYS_HEADER.map((day) => (
            <div
              key={day}
              className="text-[10px] font-bold text-slate-400 py-1 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid Tanggal */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Padding hari sebelum tanggal 1 */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9 sm:h-11" />
          ))}

          {/* Tanggal 1 s.d. akhir bulan */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const record = heatmapMap[dateStr];
            const hasRecord = Boolean(record);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => {
                  if (hasRecord) setActiveDayDetail(record);
                }}
                disabled={!hasRecord}
                className={`h-9 sm:h-11 rounded-xl flex flex-col items-center justify-center relative transition-all select-none ${hasRecord
                  ? `${getStatusColor(record.status)} cursor-pointer active:scale-95`
                  : 'bg-white border border-slate-100 text-slate-400 opacity-60 cursor-default'
                  }`}
              >
                <span className="text-[11px] sm:text-xs font-semibold">{dayNum}</span>
                {hasRecord && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {record.sessions && record.sessions.length > 1 ? (
                      <span className="text-[9px] font-black bg-white/30 text-white px-1 rounded-full leading-none">
                        {record.sessions.length}
                      </span>
                    ) : record.status === 'HADIR' ? (
                      <span className="w-1 h-1 rounded-full bg-white" />
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend Warna */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 pt-2 border-t border-slate-200/60 text-[10px] sm:text-[11px] text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Hadir ({attendance.onTime})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Terlambat ({attendance.late})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>Izin ({attendance.permission})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span>Sakit ({attendance.sick})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Alpa ({attendance.absent})</span>
          </div>
        </div>

        {/* Popover Detail Tanggal yang Diklik */}
        {activeDayDetail && (
          <div className="mt-3 p-3.5 rounded-2xl bg-white border border-teal-200/80 shadow-sm space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">
                  {new Date(activeDayDetail.date).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {activeDayDetail.sessions && activeDayDetail.sessions.length > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                    {activeDayDetail.sessions.length} Sesi
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded-md cursor-pointer ml-auto"
              >
                ✕
              </button>
            </div>

            {activeDayDetail.sessions && activeDayDetail.sessions.length > 1 ? (
              <div className="space-y-1.5">
                {activeDayDetail.sessions.map((ses, idx) => (
                  <div
                    key={ses.id || idx}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-50/80 p-2 rounded-xl border border-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-[11px] truncate">
                        {ses.sessionTitle}
                      </p>
                      {ses.checkInTime && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-2.5 h-2.5 text-slate-400" />
                          <span>Masuk: {ses.checkInTime}</span>
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${
                        ses.status === 'HADIR'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ses.status === 'TERLAMBAT'
                            ? 'bg-amber-100 text-amber-800'
                            : ses.status === 'IZIN'
                              ? 'bg-sky-100 text-sky-800'
                              : ses.status === 'SAKIT'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {ses.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">
                    {activeDayDetail.sessionTitle || 'Sesi Pengajian'}
                  </p>
                  {activeDayDetail.checkInTime && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Masuk: {activeDayDetail.checkInTime}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                    activeDayDetail.status === 'HADIR'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeDayDetail.status === 'TERLAMBAT'
                        ? 'bg-amber-100 text-amber-800'
                        : activeDayDetail.status === 'IZIN'
                          ? 'bg-sky-100 text-sky-800'
                          : activeDayDetail.status === 'SAKIT'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {activeDayDetail.status}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Riwayat Ketidakhadiran & Surat Izin */}
      {attendance.absenceHistory.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Catatan Ketidakhadiran</span>
          </h4>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
            {attendance.absenceHistory.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] ${item.status === 'IZIN'
                        ? 'bg-sky-100 text-sky-800'
                        : item.status === 'SAKIT'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-rose-100 text-rose-800'
                        }`}
                    >
                      {item.status}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {item.sessionTitle}
                    </span>
                  </div>
                  {item.reason && (
                    <p className="text-[11px] text-slate-500 mt-0.5 italic">
                      &quot;{item.reason}&quot;
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(item.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
