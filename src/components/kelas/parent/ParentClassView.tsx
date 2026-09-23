'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  School,
  Users,
  CalendarDays,
  CheckSquare,
  MessageCircle,
  Phone,
  Clock,
  MapPin,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Heart,
  Check,
  X,
} from 'lucide-react';
import { ParentClassData } from '../types';
import { formatWhatsAppUrl, displayPhoneNumber } from '@/lib/whatsapp';

interface ParentClassViewProps {
  data: ParentClassData;
}

export default function ParentClassView({ data }: ParentClassViewProps) {
  const {
    children,
    selectedChildId,
    selectedChildClass,
    homeroomTeacher,
    pendingVerifications,
    schedules,
    attendanceSummary,
    childrenDataMap,
  } = data;

  const [currentChildId, setCurrentChildId] = useState(selectedChildId || children[0]?.id || '');
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sinkronkan state jika selectedChildId dari server berubah
  useEffect(() => {
    if (selectedChildId && selectedChildId !== currentChildId) {
      setCurrentChildId(selectedChildId);
    }
  }, [selectedChildId]);

  // Lock scroll background saat bottom sheet terbuka & handle escape
  useEffect(() => {
    if (isChildModalOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsChildModalOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isChildModalOpen]);

  const activeChild = children.find((c) => c.id === currentChildId) || children[0] || null;

  // Ambil data detail anak aktif secara instan dari childrenDataMap (preloaded di server)
  const activeOverview =
    currentChildId && childrenDataMap ? childrenDataMap[currentChildId] : null;

  const currentChildClass = activeOverview ? activeOverview.selectedChildClass : selectedChildClass;
  const currentHomeroomTeacher = activeOverview ? activeOverview.homeroomTeacher : homeroomTeacher;
  const currentPendingVerifications = activeOverview
    ? activeOverview.pendingVerifications
    : pendingVerifications;
  const currentSchedules = activeOverview ? activeOverview.schedules : schedules;
  const currentAttendanceSummary = activeOverview
    ? activeOverview.attendanceSummary
    : attendanceSummary;

  // Ganti ananda secara seketika (0 ms) tanpa memicu server roundtrip delay
  const handleSelectChild = (childId: string) => {
    setCurrentChildId(childId);
    setIsChildModalOpen(false);

    // Update query params secara non-blocking di background
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('childId', childId);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // Pre-filled WhatsApp message to homeroom teacher
  const teacherWaGreeting = `Assalamu'alaikum Warahmatullahi Wabarakatuh Ustadz/Ustadzah ${currentHomeroomTeacher?.fullName || 'Wali Kelas'
    }, saya orang tua dari ananda ${activeChild?.fullName || 'santri'} di ${currentChildClass?.name || 'kelas pengajian'
    }. Mohon izin koordinasi mengenai ananda...`;

  const teacherWaUrl = formatWhatsAppUrl(currentHomeroomTeacher?.phoneNumber, teacherWaGreeting);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. TOP HEADER */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Heart className="w-3.5 h-3.5 fill-indigo-200 text-indigo-600" />
            Portal Orang Tua
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Kelas Buah Hati
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Pantau ruang kelas, jadwal pengajian, dan komunikasi aktif dengan wali kelas ananda
        </p>
      </div>

      {children.length > 0 ? (
        <>
          {/* 2. TRIGGER MODAL BAWAH GANTI KELAS ANAK (Jika ananda > 1) */}
          {children.length > 1 && (
            <div className="flex items-center justify-between bg-white/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-indigo-200 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-sm shadow-2xs">
                  {activeChild?.fullName ? activeChild.fullName.slice(0, 2).toUpperCase() : 'AN'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {activeChild?.fullName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChildModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 p-2 min-[401px]:px-3.5 min-[401px]:py-2 rounded-xl bg-teal-50 hover:bg-teal-100 active:scale-95 text-teal-700 text-xs font-bold transition-all border border-teal-200/70 shrink-0 cursor-pointer shadow-2xs"
              >
                <span className="max-[400px]:hidden">Ganti Anak</span>
                <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
              </button>
            </div>
          )}

          {/* 3. HERO BANNER: KELAS ANANDA */}
          <section className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (children.length > 1) setIsChildModalOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70 transition-all ${children.length > 1
                    ? 'hover:bg-indigo-100 cursor-pointer active:scale-95'
                    : ''
                    }`}
                  title={children.length > 1 ? 'Klik untuk ganti ananda' : undefined}
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{activeChild?.fullName}</span>
                </button>
                {activeChild?.generation && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                    {activeChild.generation.name}
                  </span>
                )}
              </div>

              <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                TP {currentChildClass?.academicYear || '2026/2027'}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {currentChildClass?.name || `Kelas ${activeChild?.generation?.name || 'Santri'}`}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{activeChild?.organization?.name || 'Kelompok Binaan'}</span>
              </p>
            </div>

            {/* Ringkasan Statistik Ananda */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Kehadiran</span>
                <span className="text-lg sm:text-xl font-extrabold text-indigo-700">
                  {currentAttendanceSummary.percentage}%
                </span>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Hadir / Sesi</span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {currentAttendanceSummary.attendedCount} / {currentAttendanceSummary.totalSessions}
                </span>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Izin / Sakit</span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {currentAttendanceSummary.permissionCount}
                </span>
              </div>
            </div>

            {/* Tombol Akses Cepat ke Laporan Perkembangan Lengkap */}
            <div className="pt-1">
              <Link
                href={`/laporan?childId=${currentChildId}`}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-800 text-white font-bold text-xs flex items-center justify-between shadow-xs hover:shadow-md transition-all group active:scale-98"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-extrabold text-xs sm:text-sm truncate">
                      Laporan Perkembangan &amp; Rapor Ananda
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-teal-100 font-normal truncate">
                      Rekap presensi, penguasaan materi, karakter &amp; cetak PDF
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
              </Link>
            </div>
          </section>

          {/* 4. KARTU WALI KELAS ANANDA */}
          <section className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-lg sm:text-xl font-extrabold shrink-0 shadow-2xs">
                  {currentHomeroomTeacher ? (
                    currentHomeroomTeacher.fullName.charAt(0).toUpperCase()
                  ) : (
                    <School className="w-6 h-6 text-indigo-600" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                      Wali Kelas {activeChild?.fullName}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {currentHomeroomTeacher?.fullName || 'Belum Ditugaskan'}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {currentHomeroomTeacher?.phoneNumber
                      ? displayPhoneNumber(currentHomeroomTeacher.phoneNumber)
                      : 'Kontak belum tersedia'}
                  </p>
                </div>
              </div>

              {/* Tombol Hubungi Wali Kelas via WhatsApp */}
              {teacherWaUrl ? (
                <a
                  href={teacherWaUrl}
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
                  <span>Kontak Belum Ada</span>
                </button>
              )}
            </div>
          </section>

          {/* 5. PERLU VERIFIKASI ORANG TUA (JIKA ADA) */}
          {currentPendingVerifications.length > 0 && (
            <section className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-amber-900">
                  Perlu Verifikasi Orang Tua ({currentPendingVerifications.length} Tugas)
                </h3>
              </div>
              <p className="text-xs text-amber-800/80">
                Ananda telah mengumpulkan laporan tugas amalan/hafalan mandiri di rumah dan membutuhkan paraf/persetujuan dari Bapak/Ibu.
              </p>

              <div className="space-y-2 pt-1">
                {currentPendingVerifications.map((item) => (
                  <div
                    key={item.submissionId}
                    className="bg-white rounded-xl p-3 border border-amber-200/60 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        {item.taskTitle}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Diserahkan: {new Date(item.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <Link
                      href={`/tugas`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verifikasi</span>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6. JADWAL PENGAJIAN ANANDA */}
          <section className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Jadwal Mengaji {activeChild?.fullName}
                </h3>
              </div>
              <Link
                href="/jadwal"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {currentSchedules.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentSchedules.map((sch) => {
                  const startTime = new Date(sch.startTime);
                  const endTime = new Date(sch.endTime);

                  return (
                    <div
                      key={sch.id}
                      className="p-3.5 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 hover:border-indigo-300 transition-all flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sch.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : sch.status === 'COMPLETED'
                                  ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}
                            >
                              {sch.status === 'ACTIVE'
                                ? 'Hari Ini'
                                : sch.status === 'COMPLETED'
                                  ? 'Selesai'
                                  : 'Terjadwal'}
                            </span>
                            {sch.isCombined && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Users className="w-2.5 h-2.5 text-amber-600" />
                                <span>Pengajian Gabungan</span>
                              </span>
                            )}
                          </div>
                          {sch.className && !sch.isCombined && (
                            <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]">
                              {sch.className}
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/jadwal/${sch.id}`}
                          className="group/title block"
                        >
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover/title:text-indigo-700 transition-colors line-clamp-1">
                            {sch.title}
                          </h4>
                        </Link>

                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>
                              {startTime.toLocaleDateString('id-ID', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                              , {startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span className="truncate">{sch.venuePlaceName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tombol Akses Capaian Ananda */}
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <Link
                          href={`/jadwal/${sch.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Lihat Capaian Ananda</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">
                Belum ada agenda jadwal pengajian khusus yang terbit pekan ini.
              </p>
            )}
          </section>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Belum Ada Data Ananda Terhubung</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Akun orang tua Anda belum terhubung dengan akun santri buah hati. Silakan hubungi Pengurus Kelompok (PJ Kelompok) pengajian agar ananda dihubungkan ke profil Anda.
          </p>
        </div>
      )}

      {/* 7. BOTTOM SHEET MODAL — GANTI DATA KELAS ANAK */}
      {mounted && isChildModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsChildModalOpen(false);
          }}
        >
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
            {/* Drag Handle (Mobile) */}
            <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Header Bottom Sheet */}
            <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Ganti Data Kelas Anak</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pilih ananda untuk melihat ruang kelas, jadwal & tugas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChildModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer transition-colors"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Daftar Ananda */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {children.map((child) => {
                const isSelected = child.id === activeChild?.id;
                const childGen = child.generation?.name;
                const childOrg = child.organization?.name;
                const overview = childrenDataMap?.[child.id];
                const childClass =
                  overview?.selectedChildClass?.name ||
                  (childGen ? `Kelas ${childGen}` : 'Kelas Santri');

                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => handleSelectChild(child.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xs'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0 border ${isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}
                      >
                        {child.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {child.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {childClass} {childOrg ? `• ${childOrg}` : ''}
                        </p>
                        {childGen && (
                          <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/60 mt-1">
                            {childGen}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-slate-300 bg-white'
                        }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer Bottom Sheet */}
            <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 safe-area-inset-bottom">
              <button
                type="button"
                onClick={() => setIsChildModalOpen(false)}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

