'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  School,
  Users,
  CalendarDays,
  CheckSquare,
  Search,
  MessageCircle,
  Phone,
  QrCode,
  Plus,
  ChevronRight,
  Shield,
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { HomeroomTeacherClassData } from '../types';
import { formatWhatsAppUrl, displayPhoneNumber } from '@/lib/whatsapp';

interface HomeroomClassViewProps {
  data: HomeroomTeacherClassData;
  initialTab?: 'santri' | 'jadwal' | 'tugas';
}

export default function HomeroomClassView({ data, initialTab = 'santri' }: HomeroomClassViewProps) {
  const { assignedClasses, canSwitchToManageMode, teacherInfo } = data;
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'santri' | 'jadwal' | 'tugas'>(initialTab);

  const activeClass = assignedClasses[selectedClassIndex] || assignedClasses[0] || null;

  // Filter santri di kelas aktif berdasarkan pencarian
  const filteredStudents = (activeClass?.students || []).filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchStudent = s.fullName.toLowerCase().includes(q);
    const matchParent = s.parents.some((p) => p.parent.fullName.toLowerCase().includes(q));
    return matchStudent || matchParent;
  });

  // Hitung rata-rata kehadiran kelas aktif
  const avgAttendance =
    activeClass && activeClass.students.length > 0
      ? Math.round(
          activeClass.students.reduce((acc, s) => acc + s.attendancePercentage, 0) /
            activeClass.students.length
        )
      : 100;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5 sm:space-y-6 animate-fade-in">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <School className="w-3.5 h-3.5" />
              Wali Kelas Pengampu
            </span>
            <span className="text-xs text-slate-400">• {teacherInfo.fullName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Kelas Binaan Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoring perkembangan santri, presensi pengajian, dan komunikasi dengan orang tua
          </p>
        </div>

        {/* Switcher Mode Kelola jika guru juga merangkap Pengurus Wilayah/PJ */}
        {canSwitchToManageMode && (
          <Link
            href="/kelas?role=manage"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold active:scale-95 transition-all select-none self-start sm:self-auto border border-slate-200/80"
          >
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Mode Kelola Wilayah</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        )}
      </div>

      {assignedClasses.length > 0 ? (
        <>
          {/* 2. CLASS SWITCHER (Jika mengampu > 1 kelas) */}
          {assignedClasses.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto tab-scrollbar touch-pan-x pb-1.5">
              {assignedClasses.map((cls, idx) => (
                <button
                  key={cls.id}
                  onClick={() => {
                    setSelectedClassIndex(idx);
                    setSearchQuery('');
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none border ${
                    selectedClassIndex === idx
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs scale-[1.01]'
                      : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>{cls.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      selectedClassIndex === idx ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cls.students.length} Santri
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 3. HERO BANNER KELAS AKTIF */}
          {activeClass && (
            <section className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/70">
                    <School className="w-3.5 h-3.5 text-teal-600" />
                    {activeClass.generation.name}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                    Tingkat {activeClass.tierLevel}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60">
                  TP {activeClass.academicYear}
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {activeClass.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{activeClass.organization.name}</span>
                  {activeClass.organization.parent && (
                    <span className="text-slate-400 text-xs">
                      • Tingkat {activeClass.organization.parent.name}
                    </span>
                  )}
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                  <span className="block text-[11px] text-slate-500 font-medium">Total Santri</span>
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {activeClass.students.length}
                  </span>
                </div>
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                  <span className="block text-[11px] text-slate-500 font-medium">Rata-rata Presensi</span>
                  <span className="text-lg sm:text-xl font-extrabold text-teal-700">
                    {avgAttendance}%
                  </span>
                </div>
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 text-center">
                  <span className="block text-[11px] text-slate-500 font-medium">Tugas Aktif</span>
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900">
                    {activeClass.assignments.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('jadwal')}
                  className="bg-slate-50/80 hover:bg-teal-50/60 rounded-2xl p-3 border border-slate-200/60 hover:border-teal-300 text-center transition-all cursor-pointer group"
                  title="Buka Tab Jadwal Kelas"
                >
                  <span className="block text-[11px] text-slate-500 group-hover:text-teal-700 font-medium transition-colors">Jadwal Kelas</span>
                  <span className="text-lg sm:text-xl font-extrabold text-slate-900 group-hover:text-teal-800 transition-colors">
                    {activeClass.schedules.length}
                  </span>
                </button>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-3 border-t border-slate-200/60">
                <Link
                  href="/presensi"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Sesi Presensi QR</span>
                </Link>

                <Link
                  href="/tugas"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200/80 transition-all active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Beri Tugas Baru</span>
                </Link>

                <Link
                  href={`/kelas/${activeClass.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200/80 transition-all active:scale-95 sm:ml-auto shrink-0"
                >
                  <span>Detail Ruang Kelas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </section>
          )}

          {/* 4. TAB CONTROLS (SANTRI, JADWAL, TUGAS) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 overflow-x-auto tab-scrollbar touch-pan-x">
            <button
              onClick={() => setActiveTab('santri')}
              className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'santri'
                  ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4 text-teal-600" />
              <span>Santri Binaan ({activeClass?.students.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('jadwal')}
              className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'jadwal'
                  ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CalendarDays className="w-4 h-4 text-teal-600" />
              <span>Jadwal Pengajian ({activeClass?.schedules.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('tugas')}
              className={`flex items-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'tugas'
                  ? 'bg-white text-teal-800 shadow-2xs border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-teal-600" />
              <span>Tugas Kelas ({activeClass?.assignments.length || 0})</span>
            </button>
          </div>

          {/* 5. TAB CONTENT */}

          {/* A. TAB SANTRI BINAAN */}
          {activeTab === 'santri' && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama santri atau orang tua..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              {filteredStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredStudents.map((student) => {
                    const primaryParent = student.parents[0]?.parent || null;
                    const relationType = student.parents[0]?.relationshipType || 'WALI';

                    // WhatsApp links
                    const studentWaUrl = formatWhatsAppUrl(
                      student.phoneNumber,
                      `Assalamu'alaikum ${student.fullName}, ananda santri di ${activeClass?.name}...`
                    );

                    const parentWaUrl = formatWhatsAppUrl(
                      primaryParent?.phoneNumber,
                      `Assalamu'alaikum Warahmatullahi Wabarakatuh Bpk/Ibu ${
                        primaryParent?.fullName || 'Wali Santri'
                      }, saya ${teacherInfo.fullName} wali kelas ananda ${student.fullName} di ${
                        activeClass?.name
                      }. Mohon izin koordinasi mengenai perkembangan ananda...`
                    );

                    return (
                      <div
                        key={student.id}
                        className="bg-white/95 rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
                              {student.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                                {student.fullName}
                              </h3>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {student.gender === 'MALE' ? 'Ikhwan' : 'Akhwat'}
                              </span>
                            </div>
                          </div>

                          {/* Attendance badge */}
                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                student.attendancePercentage >= 80
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : student.attendancePercentage >= 60
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {student.attendancePercentage}% Hadir
                            </span>
                          </div>
                        </div>

                        {/* Info Orang Tua */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">
                              Orang Tua / Wali:
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">
                              {relationType}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800">
                            {primaryParent?.fullName || 'Belum Terhubung'}
                          </p>
                        </div>

                        {/* Direct WhatsApp Contact Buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                          {parentWaUrl ? (
                            <a
                              href={parentWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5 fill-white" />
                              <span>WA Orang Tua</span>
                            </a>
                          ) : (
                            <button
                              disabled
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium cursor-not-allowed"
                            >
                              <span>WA Ortu (-)</span>
                            </button>
                          )}

                          {studentWaUrl ? (
                            <a
                              href={studentWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold transition-all border border-slate-200/70"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>Santri</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6">
                  <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Tidak ditemukan santri yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* B. TAB JADWAL KELAS */}
          {activeTab === 'jadwal' && (
            <div className="space-y-3">
              {activeClass && activeClass.schedules.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeClass.schedules.map((sch) => {
                    const startTime = new Date(sch.startTime);
                    const endTime = new Date(sch.endTime);

                    return (
                      <div
                        key={sch.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              sch.status === 'ACTIVE'
                                ? 'bg-emerald-500 text-white animate-pulse'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {sch.status === 'ACTIVE' ? 'Sesi Berlangsung' : 'Terjadwal'}
                          </span>
                          <span className="text-xs text-slate-400">{sch.scheduleType}</span>
                        </div>

                        <Link
                          href={`/jadwal/${sch.id}`}
                          className="group/title block"
                        >
                          <h3 className="text-sm font-bold text-slate-900 group-hover/title:text-teal-700 transition-colors line-clamp-1">
                            {sch.title}
                          </h3>
                        </Link>

                        <div className="space-y-1 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>
                              {startTime.toLocaleDateString('id-ID', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                              , {startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{sch.venuePlaceName}</span>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={`/jadwal/${sch.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
                          >
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span>Rincian & Capaian Sesi</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>

                          <Link
                            href={`/presensi?scheduleId=${sch.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200/70 text-xs font-bold text-teal-800 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Cockpit Presensi</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6">
                  <CalendarDays className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Belum ada jadwal khusus yang ditugaskan untuk kelas ini.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* C. TAB TUGAS KELAS */}
          {activeTab === 'tugas' && (
            <div className="space-y-3">
              {activeClass && activeClass.assignments.length > 0 ? (
                <div className="space-y-3">
                  {activeClass.assignments.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {task.taskType}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                        <p className="text-xs text-slate-400">
                          Reward: +{task.pointsReward} Poin • Batas:{' '}
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : 'Tidak ada batas'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-bold text-slate-700">
                            {task.submissionsCount} / {task.totalStudentsCount} Mengumpulkan
                          </span>
                        </div>
                        <Link
                          href={`/tugas`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold active:scale-95 transition-all"
                        >
                          <span>Review</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6">
                  <CheckSquare className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Belum ada tugas yang dibuat untuk kelas ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Belum Ada Penugasan Wali Kelas</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda belum ditunjuk sebagai wali kelas di kelompok atau desa binaan manapun. Hubungi Pengurus Wilayah (PJ Kelompok / Desa) untuk menghubungkan akun Anda dengan ruang kelas aktif.
          </p>
        </div>
      )}
    </div>
  );
}
