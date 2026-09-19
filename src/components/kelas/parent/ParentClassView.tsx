'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Heart,
} from 'lucide-react';
import { ParentClassData } from '../types';
import { formatWhatsAppUrl, displayPhoneNumber } from '@/lib/whatsapp';

interface ParentClassViewProps {
  data: ParentClassData;
}

export default function ParentClassView({ data }: ParentClassViewProps) {
  const router = useRouter();
  const {
    children,
    selectedChildId,
    selectedChildClass,
    homeroomTeacher,
    pendingVerifications,
    schedules,
    attendanceSummary,
  } = data;

  const [currentChildId, setCurrentChildId] = useState(selectedChildId);

  const activeChild = children.find((c) => c.id === currentChildId) || children[0] || null;

  const handleSelectChild = (childId: string) => {
    setCurrentChildId(childId);
    router.push(`/kelas?role=parent&childId=${childId}`);
  };

  // Pre-filled WhatsApp message to homeroom teacher
  const teacherWaGreeting = `Assalamu'alaikum Warahmatullahi Wabarakatuh Ustadz/Ustadzah ${
    homeroomTeacher?.fullName || 'Wali Kelas'
  }, saya orang tua dari ananda ${activeChild?.fullName || 'santri'} di ${
    selectedChildClass?.name || 'kelas pengajian'
  }. Mohon izin koordinasi mengenai ananda...`;

  const teacherWaUrl = formatWhatsAppUrl(homeroomTeacher?.phoneNumber, teacherWaGreeting);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. TOP HEADER */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Heart className="w-3.5 h-3.5 fill-indigo-200 text-indigo-600" />
            Portal Orang Tua
          </span>
          <span className="text-xs text-slate-400">• Pendampingan Generasi Qur&apos;ani</span>
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
          {/* 2. CHILD SELECTOR TABS (Bila punya > 1 anak) */}
          {children.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto tab-scrollbar touch-pan-x pb-1.5">
              {children.map((child) => {
                const isSelected = child.id === activeChild?.id;
                return (
                  <button
                    key={child.id}
                    onClick={() => handleSelectChild(child.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs scale-[1.01]'
                        : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {child.fullName.charAt(0).toUpperCase()}
                    </div>
                    <span>{child.fullName}</span>
                    {child.generation && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {child.generation.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3. HERO BANNER: KELAS ANANDA */}
          <section className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Ananda: {activeChild?.fullName}
                </span>
                {activeChild?.generation && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                    {activeChild.generation.name}
                  </span>
                )}
              </div>

              <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                TP {selectedChildClass?.academicYear || '2026/2027'}
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {selectedChildClass?.name || `Kelas ${activeChild?.generation?.name || 'Santri'}`}
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
                  {attendanceSummary.percentage}%
                </span>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Hadir / Sesi</span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {attendanceSummary.attendedCount} / {attendanceSummary.totalSessions}
                </span>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                <span className="block text-[11px] text-slate-500 font-medium">Izin / Sakit</span>
                <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {attendanceSummary.permissionCount}
                </span>
              </div>
            </div>
          </section>

          {/* 4. KARTU WALI KELAS ANANDA */}
          <section className="bg-white/85 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/70 flex items-center justify-center text-lg sm:text-xl font-extrabold shrink-0 shadow-2xs">
                  {homeroomTeacher ? (
                    homeroomTeacher.fullName.charAt(0).toUpperCase()
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
                    {homeroomTeacher?.fullName || 'Belum Ditugaskan'}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {homeroomTeacher?.phoneNumber
                      ? displayPhoneNumber(homeroomTeacher.phoneNumber)
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
          {pendingVerifications.length > 0 && (
            <section className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-sm font-bold text-amber-900">
                  Perlu Verifikasi Orang Tua ({pendingVerifications.length} Tugas)
                </h3>
              </div>
              <p className="text-xs text-amber-800/80">
                Ananda telah mengumpulkan laporan tugas amalan/hafalan mandiri di rumah dan membutuhkan paraf/persetujuan dari Bapak/Ibu.
              </p>

              <div className="space-y-2 pt-1">
                {pendingVerifications.map((item) => (
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

            {schedules.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schedules.map((sch) => {
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
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sch.status === 'ACTIVE'
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
    </div>
  );
}
