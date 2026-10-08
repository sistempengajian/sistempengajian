'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  School,
  CalendarDays,
  CheckSquare,
  Users,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Award,
  ChevronRight,
  Sparkles,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  QrCode,
  ExternalLink,
  Filter,
  Calendar,
  XCircle,
  FileText,
} from 'lucide-react';
import { StudentClassData } from '../types';
import { formatWhatsAppUrl, displayPhoneNumber } from '@/lib/whatsapp';

interface StudentClassViewProps {
  data: StudentClassData;
  initialTab?: 'jadwal' | 'tugas' | 'teman';
}

export default function StudentClassView({ data, initialTab = 'jadwal' }: StudentClassViewProps) {
  const [activeTab, setActiveTab] = useState<'jadwal' | 'tugas' | 'teman'>(initialTab);
  const [periodFilter, setPeriodFilter] = useState<'THIS_MONTH' | 'THIS_WEEK' | 'LAST_MONTH' | 'ALL'>('THIS_MONTH');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const { student, classData, homeroomTeacher, classmates, schedules, assignments, attendanceSummary } = data;

  const now = useMemo(() => new Date(), []);

  // Filter jadwal berdasarkan periode
  const filteredByPeriod = useMemo(() => {
    return schedules.filter((sch) => {
      const sDate = new Date(sch.startTime);
      if (periodFilter === 'THIS_MONTH') {
        return (
          sDate.getFullYear() === now.getFullYear() &&
          sDate.getMonth() === now.getMonth()
        );
      }
      if (periodFilter === 'THIS_WEEK') {
        const dayOfWeek = (now.getDay() + 6) % 7; // Senin = 0, Minggu = 6
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 6, 23, 59, 59, 999);
        return sDate >= startOfWeek && sDate <= endOfWeek;
      }
      if (periodFilter === 'LAST_MONTH') {
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        return (
          sDate.getFullYear() === lastMonthYear &&
          sDate.getMonth() === lastMonth
        );
      }
      return true; // ALL
    });
  }, [schedules, periodFilter, now]);

  // Pisahkan Sesi Mendatang (asc) vs Terlewat / Selesai (desc)
  const upcomingSchedules = useMemo(() => {
    return filteredByPeriod
      .filter((sch) => sch.status !== 'COMPLETED' && new Date(sch.endTime) >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [filteredByPeriod, now]);

  const pastSchedules = useMemo(() => {
    return filteredByPeriod
      .filter((sch) => sch.status === 'COMPLETED' || new Date(sch.endTime) < now)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [filteredByPeriod, now]);

  // Siapkan URL WhatsApp untuk menghubungi Wali Kelas
  const waGreeting = `Assalamu'alaikum Warahmatullahi Wabarakatuh Ustadz/Ustadzah ${homeroomTeacher?.fullName || 'Wali Kelas'
    }, saya ${student.fullName} dari ${classData?.name || 'kelas pengajian'}. Mohon izin bertanya...`;

  const waUrl = formatWhatsAppUrl(homeroomTeacher?.phoneNumber, waGreeting);

  // Render card sesi pengajian individual
  const renderScheduleCard = (sch: (typeof schedules)[0]) => {
    const isPast = sch.status === 'COMPLETED' || new Date(sch.endTime) < now;
    const isOngoing = sch.status === 'ACTIVE';
    const isUpcoming = !isPast;
    const startTime = new Date(sch.startTime);
    const endTime = new Date(sch.endTime);

    return (
      <div
        key={sch.id}
        className={`rounded-2xl border p-4 sm:p-5 transition-all bg-white shadow-xs flex flex-col justify-between ${
          isOngoing
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
            : isPast
            ? 'border-slate-200/80 hover:border-slate-300'
            : 'border-slate-200/90 hover:border-emerald-200 hover:shadow-sm'
        }`}
      >
        <div>
          {/* Header Card: Status Sesi & Status Presensi Santri */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Status Sesi Pengajian */}
              <span
                className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                  isOngoing
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : sch.status === 'SCHEDULED'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isOngoing
                  ? 'Sesi Berlangsung'
                  : sch.status === 'SCHEDULED'
                  ? 'Terjadwal'
                  : 'Selesai'}
              </span>

              {/* Status Presensi Santri (Ditampilkan pada sesi terlewat/selesai atau bila santri sudah presensi) */}
              {(isPast || sch.attendanceStatus) && (
                sch.attendanceStatus === 'HADIR' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Hadir
                  </span>
                ) : sch.attendanceStatus === 'TERLAMBAT' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Terlambat
                  </span>
                ) : sch.attendanceStatus === 'IZIN' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                    <FileText className="w-3 h-3 text-indigo-600" />
                    Izin
                  </span>
                ) : sch.attendanceStatus === 'SAKIT' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                    <AlertCircle className="w-3 h-3 text-blue-600" />
                    Sakit
                  </span>
                ) : sch.attendanceStatus === 'ALPA' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80">
                    <XCircle className="w-3 h-3 text-rose-600" />
                    Tidak Hadir (Alpa)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200/80">
                    <HelpCircle className="w-3 h-3 text-slate-400" />
                    Belum Presensi
                  </span>
                )
              )}
            </div>

            {sch.scheduleType && (
              <span className="text-[10px] text-slate-400 font-medium">
                {sch.scheduleType}
              </span>
            )}
          </div>

          <Link
            href={`/jadwal/${sch.id}`}
            className="group/title block mt-1"
          >
            <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover/title:text-emerald-700 transition-colors line-clamp-1">
              {sch.title}
            </h3>
          </Link>

          <div className="space-y-1.5 mt-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {startTime.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: startTime.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                })}
                ,{' '}
                {startTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -{' '}
                {endTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                WIB
              </span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="line-clamp-1">{sch.venuePlaceName}</span>
            </div>

            {sch.teacherName && (
              <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Pengajar: {sch.teacherName}</span>
              </div>
            )}

            {/* Presensi Check-in Timestamp & Method */}
            {sch.checkInTime && (
              <div className="mt-1.5 text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200/60 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>
                  Presensi dicatat pk.{' '}
                  {new Date(sch.checkInTime).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  WIB
                  {sch.attendanceMethod === 'QR_CODE'
                    ? ' (Scan QR)'
                    : sch.attendanceMethod === 'MANUAL_TEACHER'
                    ? ' (Oleh Guru)'
                    : ''}
                </span>
              </div>
            )}

            {sch.attendanceNotes && (
              <p className="text-[11px] text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                Catatan: {sch.attendanceNotes}
              </p>
            )}
          </div>
        </div>

        {/* Action Bar: Akses Detail Sesi & Presensi */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <Link
            href={`/jadwal/${sch.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Rincian & Capaian Sesi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          {isUpcoming && (
            <Link
              href={`/presensi?scheduleId=${sch.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Presensi</span>
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. HERO BANNER: IDENTITAS KELAS SAYA */}
      <section className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <School className="w-3.5 h-3.5 text-emerald-600" />
              Ruang Kelas Santri
            </span>
            {classData?.generation?.name && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                {classData.generation.name}
              </span>
            )}
          </div>

          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
            TP {classData?.academicYear || '2026/2027'}
          </span>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {classData?.name || `Kelas ${student.generation?.name || 'Santri'} Binaan`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {student.organization?.name || 'Kelompok Binaan'}
            </span>
            {student.organization?.parent && (
              <span className="text-slate-400 text-xs">
                • Tingkat {student.organization.parent.name}
              </span>
            )}
          </p>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
            <span className="block text-[11px] text-slate-500 font-medium">Presensi</span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-700">
              {attendanceSummary.percentage}%
            </span>
          </div>
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
            <span className="block text-[11px] text-slate-500 font-medium">Tugas Aktif</span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {assignments.length}
            </span>
          </div>
          <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
            <span className="block text-[11px] text-slate-500 font-medium">Teman Kelas</span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {classmates.length + 1}
            </span>
          </div>
        </div>
      </section>

      {/* BANNER RAPOR PERKEMBANGAN BELAJAR SANTRI */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 rounded-2xl p-4 border border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Laporan Perkembangan &amp; Rapor Belajar
            </h4>
            <p className="text-xs text-slate-600">
              Pantau rekap kehadiran, capaian materi kurikulum, evaluasi adab, dan tugas
            </p>
          </div>
        </div>
        <Link
          href="/laporan"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 shrink-0"
        >
          <span>Buka Rapor Saya</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 2. KARTU WALI KELAS PENGAMPU */}
      <section className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center text-lg sm:text-xl font-extrabold shrink-0 shadow-2xs">
              {homeroomTeacher ? (
                homeroomTeacher.fullName.charAt(0).toUpperCase()
              ) : (
                <School className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  Wali Kelas Pengampu
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {homeroomTeacher?.fullName || 'Belum Ditugaskan'}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {homeroomTeacher?.phoneNumber
                  ? displayPhoneNumber(homeroomTeacher.phoneNumber)
                  : 'Kontak belum tersedia'}
              </p>
            </div>
          </div>

          {/* Tombol Hubungi Wali Kelas via WhatsApp */}
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer select-none shrink-0"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Chat WhatsApp Wali Kelas</span>
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs sm:text-sm font-semibold cursor-not-allowed select-none shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kontak Tidak Tersedia</span>
            </button>
          )}
        </div>
      </section>

      {/* 3. TAB NAVIGASI KONTEN (SESI PENGAJIAN, TUGAS, TEMAN) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 overflow-x-auto tab-scrollbar touch-pan-x">
        <button
          onClick={() => setActiveTab('jadwal')}
          className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'jadwal'
            ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200/50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <CalendarDays className="w-4 h-4 text-emerald-600" />
          <span>Sesi Pengajian ({schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tugas')}
          className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'tugas'
            ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200/50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <CheckSquare className="w-4 h-4 text-emerald-600" />
          <span>Tugas Kelas ({assignments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('teman')}
          className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'teman'
            ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200/50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Teman Sekelas ({classmates.length})</span>
        </button>
      </div>

      {/* 4. KONTEN TAB */}

      {/* A. TAB SESI PENGAJIAN */}
      {activeTab === 'jadwal' && (
        <section className="space-y-4">
          {/* Filter Bar: Periode & Scope Tampilan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-xs p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            {/* Filter Periode */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <Filter className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 shrink-0">Periode:</span>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as any)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="THIS_MONTH">
                    Bulan Ini ({now.toLocaleDateString('id-ID', { month: 'short' })})
                  </option>
                  <option value="THIS_WEEK">Pekan Ini</option>
                  <option value="LAST_MONTH">
                    Bulan Lalu ({new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('id-ID', { month: 'short' })})
                  </option>
                  <option value="ALL">Semua Periode ({schedules.length})</option>
                </select>
              </div>
            </div>

            {/* Scope Filter Pills: Semua, Mendatang, Terlewat */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 overflow-x-auto">
              <button
                type="button"
                onClick={() => setScopeFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  scopeFilter === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({filteredByPeriod.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('UPCOMING')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  scopeFilter === 'UPCOMING'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mendatang ({upcomingSchedules.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('PAST')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  scopeFilter === 'PAST'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Terlewat ({pastSchedules.length})
              </button>
            </div>
          </div>

          {/* List Sesi Pengajian */}
          {filteredByPeriod.length > 0 ? (
            <div className="space-y-6">
              {/* Tampilan SEMUA: Tampilkan Mendatang lalu Terlewat */}
              {scopeFilter === 'ALL' && (
                <>
                  {upcomingSchedules.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide">
                          Sesi Mendatang ({upcomingSchedules.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {upcomingSchedules.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}

                  {pastSchedules.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <h3 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wide">
                          Sesi Terlewat / Selesai ({pastSchedules.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {pastSchedules.map(renderScheduleCard)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Tampilan MENDATANG SAJA */}
              {scopeFilter === 'UPCOMING' && (
                upcomingSchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {upcomingSchedules.map(renderScheduleCard)}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/70 rounded-2xl border border-slate-200/80 p-6">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">Tidak Ada Sesi Mendatang</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Belum ada sesi pengajian mendatang untuk filter periode yang dipilih.
                    </p>
                  </div>
                )
              )}

              {/* Tampilan TERLEWAT SAJA */}
              {scopeFilter === 'PAST' && (
                pastSchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {pastSchedules.map(renderScheduleCard)}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white/70 rounded-2xl border border-slate-200/80 p-6">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-sm font-bold text-slate-700">Tidak Ada Sesi Terlewat</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Belum ada catatan riwayat sesi pengajian terlewat untuk periode yang dipilih.
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-10 bg-white/70 rounded-2xl border border-slate-200/80 p-6 space-y-3">
              <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-700">Tidak Ada Sesi Pengajian</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Tidak ditemukan sesi pengajian pada filter periode yang dipilih.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPeriodFilter('ALL');
                  setScopeFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200/80 transition-all cursor-pointer"
              >
                <span>Tampilkan Semua Sesi ({schedules.length})</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* B. TAB TUGAS KELAS */}
      {activeTab === 'tugas' && (
        <section className="space-y-3">
          {assignments.length > 0 ? (
            <div className="space-y-3">
              {assignments.map((task) => {
                const isDone = task.submission && task.submission.status !== 'PENDING';
                const needsParent =
                  task.requiresParentVerification &&
                  task.submission &&
                  !task.submission.isVerifiedByParent;

                return (
                  <div
                    key={task.id}
                    className="bg-white/95 rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {task.taskType === 'AUDIO_MEMORIZATION'
                              ? 'Setoran Hafalan'
                              : task.taskType === 'DAILY_HABIT'
                                ? 'Amalan Harian'
                                : task.taskType === 'QUIZ_ONLINE'
                                  ? 'Kuis Online'
                                  : 'Tugas Tertulis'}
                          </span>

                          {task.requiresParentVerification && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Verifikasi Orang Tua
                            </span>
                          )}

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                            +{task.pointsReward} Poin
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {task.title}
                        </h3>

                        {task.dueDate && (
                          <p className="text-xs text-slate-400">
                            Batas: {new Date(task.dueDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>

                      {/* Status Pengumpulan & Aksi */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isDone ? (
                          <div className="text-left sm:text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {task.submission?.status === 'GRADED'
                                ? `Dinilai: ${task.submission.score}/100`
                                : needsParent
                                  ? 'Menunggu Paraf Ortu'
                                  : 'Sudah Dikumpulkan'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Belum Dikerjakan
                          </span>
                        )}

                        <Link
                          href={`/tugas`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold active:scale-95 transition-all shrink-0"
                        >
                          <span>Buka</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white/70 rounded-2xl border border-slate-200/80 p-6">
              <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Tidak Ada Tugas Tertunda</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Alhamdulillah! Semua tugas kelas telah diselesaikan atau belum ada tugas baru yang diberikan.
              </p>
            </div>
          )}
        </section>
      )}

      {/* C. TAB TEMAN SEKELAS */}
      {activeTab === 'teman' && (
        <section className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Daftar Teman Mengaji ({classmates.length} Santri)
            </h3>
            <span className="text-xs text-slate-400">Jenjang yang sama</span>
          </div>

          {classmates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {classmates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                    {c.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.fullName}</p>
                    <span className="text-[10px] text-slate-400">
                      {c.gender === 'MALE' ? 'Ikhwan' : 'Akhwat'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              Belum ada santri lain yang terdaftar di kelompok & jenjang ini.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
