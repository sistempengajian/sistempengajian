'use client';

import React, { useState } from 'react';
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
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import { StudentClassData } from '../types';
import { formatWhatsAppUrl, displayPhoneNumber } from '@/lib/whatsapp';

interface StudentClassViewProps {
  data: StudentClassData;
  initialTab?: 'jadwal' | 'tugas' | 'teman';
}

export default function StudentClassView({ data, initialTab = 'jadwal' }: StudentClassViewProps) {
  const [activeTab, setActiveTab] = useState<'jadwal' | 'tugas' | 'teman'>(initialTab);
  const { student, classData, homeroomTeacher, classmates, schedules, assignments, attendanceSummary } = data;

  // Siapkan URL WhatsApp untuk menghubungi Wali Kelas
  const waGreeting = `Assalamu'alaikum Warahmatullahi Wabarakatuh Ustadz/Ustadzah ${homeroomTeacher?.fullName || 'Wali Kelas'
    }, saya ${student.fullName} dari ${classData?.name || 'kelas pengajian'}. Mohon izin bertanya...`;

  const waUrl = formatWhatsAppUrl(homeroomTeacher?.phoneNumber, waGreeting);

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

      {/* 3. TAB NAVIGASI KONTEN (JADWAL, TUGAS, TEMAN) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 overflow-x-auto tab-scrollbar touch-pan-x">
        <button
          onClick={() => setActiveTab('jadwal')}
          className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${activeTab === 'jadwal'
            ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200/50'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
        >
          <CalendarDays className="w-4 h-4 text-emerald-600" />
          <span>Jadwal Pengajian ({schedules.length})</span>
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

      {/* A. TAB JADWAL */}
      {activeTab === 'jadwal' && (
        <section className="space-y-3">
          {schedules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {schedules.map((sch) => {
                const isUpcoming = sch.status === 'SCHEDULED' || sch.status === 'ACTIVE';
                const startTime = new Date(sch.startTime);
                const endTime = new Date(sch.endTime);

                return (
                  <div
                    key={sch.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all bg-white shadow-xs ${sch.status === 'ACTIVE'
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                      : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${sch.status === 'ACTIVE'
                          ? 'bg-emerald-500 text-white animate-pulse'
                          : sch.status === 'SCHEDULED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600'
                          }`}
                      >
                        {sch.status === 'ACTIVE'
                          ? 'Sesi Berlangsung'
                          : sch.status === 'SCHEDULED'
                            ? 'Terjadwal'
                            : 'Selesai'}
                      </span>
                    </div>

                    <Link
                      href={`/jadwal/${sch.id}`}
                      className="group/title block mt-2"
                    >
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover/title:text-emerald-700 transition-colors line-clamp-1">
                        {sch.title}
                      </h3>
                    </Link>

                    <div className="space-y-1.5 mt-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {startTime.toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
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
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70 text-xs font-bold transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Presensi</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-white/70 rounded-2xl border border-slate-200/80 p-6">
              <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">Belum Ada Jadwal Pengajian</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Wali kelas atau pengurus wilayah belum menerbitkan jadwal pengajian untuk kelas ini.
              </p>
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
