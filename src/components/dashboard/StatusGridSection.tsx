'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Award,
  Users,
  UserCheck,
  Calendar,
  GraduationCap,
  Shield,
  Inbox,
  Activity,
  X,
  Clock,
  MapPin,
  Sparkles,
  Flame,
  ChevronRight,
  Check,
} from 'lucide-react';
import { RoleTheme } from '@/lib/theme';
import ProgressCircle from './ProgressCircle';

export interface StatusData {
  fullName: string;
  generationName?: string;
  gamification?: {
    level: number;
    totalPoints: number;
    currentStreakDays: number;
  } | null;
  childrenList?: Array<{
    id: string;
    fullName: string;
    generationName?: string;
    points?: number;
    relationshipType?: string;
  }>;
  homeroomClassesCount?: number;
  pendingApprovalsCount?: number;
  nextScheduleTitle?: string;
  nextScheduleTime?: string;
  nextScheduleVenue?: string;
}

interface StatusGridSectionProps {
  roleKey: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' | 'ADMIN_MASTER';
  theme: RoleTheme;
  data: StatusData;
}

interface StatusItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass: string;
  iconBgClass: string;
  modalTitle: string;
  modalBadge: string;
}

export default function StatusGridSection({
  roleKey,
  theme,
  data,
}: StatusGridSectionProps) {
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActiveModalId(null);
      }
    }
    if (activeModalId) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [activeModalId]);

  // Determine the 3 minimalist status items based on role
  const getStatusItems = (): StatusItem[] => {
    if (roleKey === 'SANTRI') {
      return [
        {
          id: 'hafalan',
          title: 'Hafalan',
          icon: BookOpen,
          iconColorClass: 'text-emerald-700',
          iconBgClass: 'bg-emerald-50 border border-emerald-200/80',
          modalTitle: 'Detail Capaian & Target Hafalan',
          modalBadge: 'Talaqqi Aktif',
        },
        {
          id: 'keaktifan',
          title: 'Keaktifan',
          icon: CheckCircle2,
          iconColorClass: 'text-teal-700',
          iconBgClass: 'bg-teal-50 border border-teal-200/80',
          modalTitle: 'Detail Keaktifan & Kehadiran',
          modalBadge: 'Presensi Terpenuhi',
        },
        {
          id: 'prestasi',
          title: 'Prestasi',
          icon: Award,
          iconColorClass: 'text-amber-700',
          iconBgClass: 'bg-amber-50 border border-amber-200/80',
          modalTitle: 'Detail Prestasi & Level Gamifikasi',
          modalBadge: 'Generasi Unggul',
        },
      ];
    }

    if (roleKey === 'PENGAJAR') {
      return [
        {
          id: 'halaqah',
          title: 'Halaqah Kelas',
          icon: Users,
          iconColorClass: 'text-teal-700',
          iconBgClass: 'bg-teal-50 border border-teal-200/80',
          modalTitle: 'Detail Halaqah & Kelas Binaan',
          modalBadge: 'Pembina Aktif',
        },
        {
          id: 'keaktifan_guru',
          title: 'Keaktifan Guru',
          icon: UserCheck,
          iconColorClass: 'text-emerald-700',
          iconBgClass: 'bg-emerald-50 border border-emerald-200/80',
          modalTitle: 'Status Kesiapan & Keaktifan Pengajar',
          modalBadge: 'Siap Mengajar',
        },
        {
          id: 'jadwal_pekan_ini',
          title: 'Jadwal Pekan Ini',
          icon: Calendar,
          iconColorClass: 'text-sky-700',
          iconBgClass: 'bg-sky-50 border border-sky-200/80',
          modalTitle: 'Sesi Pengajian Terjadwal Pekan Ini',
          modalBadge: 'Presensi Realtime',
        },
      ];
    }

    if (roleKey === 'ORANG_TUA') {
      return [
        {
          id: 'ananda',
          title: 'Ananda Binaan',
          icon: Users,
          iconColorClass: 'text-indigo-700',
          iconBgClass: 'bg-indigo-50 border border-indigo-200/80',
          modalTitle: 'Daftar Ananda dalam Binaan',
          modalBadge: 'Keluarga Qurani',
        },
        {
          id: 'keaktifan_ananda',
          title: 'Keaktifan Ananda',
          icon: CheckCircle2,
          iconColorClass: 'text-emerald-700',
          iconBgClass: 'bg-emerald-50 border border-emerald-200/80',
          modalTitle: 'Rekap Presensi & Kehadiran Ananda',
          modalBadge: 'Disiplin Waktu',
        },
        {
          id: 'progres_belajar',
          title: 'Progres Belajar',
          icon: GraduationCap,
          iconColorClass: 'text-purple-700',
          iconBgClass: 'bg-purple-50 border border-purple-200/80',
          modalTitle: 'Progres Pembelajaran & Rapor Digital',
          modalBadge: 'Tersinkronisasi',
        },
      ];
    }

    // Default: PJ & ADMIN
    return [
      {
        id: 'wilayah',
        title: 'Wilayah Binaan',
        icon: Shield,
        iconColorClass: 'text-blue-700',
        iconBgClass: 'bg-blue-50 border border-blue-200/80',
        modalTitle: 'Metrik & Tata Kelola Wilayah',
        modalBadge: 'Otoritas Wilayah',
      },
      {
        id: 'approval',
        title: 'Antrean Approval',
        icon: Inbox,
        iconColorClass: 'text-rose-700',
        iconBgClass: 'bg-rose-50 border border-rose-200/80',
        modalTitle: 'Antrean Verifikasi Jadwal Private & Remedial',
        modalBadge: `${data.pendingApprovalsCount || 0} Menunggu`,
      },
      {
        id: 'sistem',
        title: 'Status Sistem',
        icon: Activity,
        iconColorClass: 'text-emerald-700',
        iconBgClass: 'bg-emerald-50 border border-emerald-200/80',
        modalTitle: 'Integritas & Status Sistem Terpusat',
        modalBadge: 'Operasional Normal',
      },
    ];
  };

  const statusItems = getStatusItems();
  const activeItem = statusItems.find((item) => item.id === activeModalId);

  return (
    <>
      {/* 2. Unified Status Section: Card Transparan Berisi Grid 3 Status (Icon & Title Lebih Ringkas, Tanpa Teks Detail) */}
      <section className="rounded-2xl bg-white/30 backdrop-blur-md border border-slate-200/40 shadow-2xs p-2 sm:p-2.5">
        <div className="grid grid-cols-3 divide-x divide-slate-200/40">
          {statusItems.map((item) => {
            const IconComp = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModalId(item.id)}
                className="group flex flex-col items-center justify-center px-1 sm:px-2 py-1 text-center transition-all duration-150 active:scale-95 cursor-pointer"
                title={`Buka detail ${item.title}`}
              >
                {/* Icon di atas (lebih kecil & compact) */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${item.iconBgClass} ${item.iconColorClass} flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 shadow-2xs mb-1`}
                >
                  <IconComp className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2]" />
                </div>
                {/* Title di bawah icon (lebih kecil, tanpa teks detail) */}
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors leading-tight">
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Detail Modal Dialog */}
      {activeModalId && activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveModalId(null)}
        >
          <div
            className="w-full max-w-md bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${activeItem.iconBgClass} ${activeItem.iconColorClass} flex items-center justify-center shrink-0`}
                >
                  <activeItem.icon className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {activeItem.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {activeItem.modalBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeItem.modalTitle}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Detail Content per Item */}
            <div className="space-y-3 py-1">
              {/* Santri: Hafalan */}
              {activeModalId === 'hafalan' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 text-xs">
                        Target Kurikulum Jenjang {data.generationName || 'Caberawit'}
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        Fokus saat ini adalah memantapkan makharijul huruf, tajwid dasar, serta hafalan surat Al-Mulk dan surat-surat pendek Juz 30.
                      </p>
                    </div>
                    <ProgressCircle percentage={78} size={46} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="p-2.5 rounded-xl border border-slate-200/60 bg-white flex items-center justify-between">
                      <span className="font-medium text-slate-700">Surat Al-Mulk (Ayat 1-15)</span>
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Lulus
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200/60 bg-white flex items-center justify-between">
                      <span className="font-medium text-slate-700">Surat Al-Mulk (Ayat 16-30)</span>
                      <span className="text-[11px] font-semibold text-amber-700">Sedang Berjalan</span>
                    </div>
                  </div>

                  <Link
                    href="/kurikulum"
                    onClick={() => setActiveModalId(null)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Buka Silabus Kurikulum</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Santri: Keaktifan */}
              {activeModalId === 'keaktifan' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-100">
                      <div className="text-lg font-bold text-teal-800">
                        {data.gamification && data.gamification.currentStreakDays > 0
                          ? `${data.gamification.currentStreakDays} Hari`
                          : '100%'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Kehadiran Rutin</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                      <div className="text-lg font-bold text-slate-800">0</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Alpa / Tanpa Keterangan</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      <span>Presensi QR Terverifikasi</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Kehadiran pengajian dicatat otomatis melalui pemindaian Dynamic QR TOTP di layar kelas oleh ustadz pengampu.
                    </p>
                  </div>
                </div>
              )}

              {/* Santri: Prestasi */}
              {activeModalId === 'prestasi' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        Lv.{data.gamification?.level || 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {data.gamification?.totalPoints || 0} Poin Gamifikasi
                        </div>
                        <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                          Tingkat: Santri Teladan
                        </div>
                      </div>
                    </div>
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-800 text-[11px] block">Lencana Penghargaan:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl border border-slate-200/70 bg-white flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">Streak 7 Hari</span>
                      </div>
                      <div className="p-2.5 rounded-xl border border-slate-200/70 bg-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">Hafiz Cilik</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pengajar: Halaqah */}
              {activeModalId === 'halaqah' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {data.homeroomClassesCount || 1} Kelas Binaan Aktif
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Bertanggung jawab memonitor kehadiran, evaluasi hafalan, serta jurnal penilaian santri di halaqah masing-masing.
                    </p>
                  </div>
                  <Link
                    href="/kurikulum"
                    onClick={() => setActiveModalId(null)}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Buka Jurnal Nilai & Santri</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Pengajar: Keaktifan Guru */}
              {activeModalId === 'keaktifan_guru' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Status Pembina</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Aktif Bertugas
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      QR Presensi dan jurnal kurikulum siap ditampilkan pada sesi pengajian terjadwal.
                    </p>
                  </div>
                </div>
              )}

              {/* Pengajar: Jadwal Pekan Ini */}
              {activeModalId === 'jadwal_pekan_ini' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-1.5">
                    <div className="font-bold text-slate-900">
                      {data.nextScheduleTitle || 'Sesi Pengajian Rutin Terjadwal'}
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{data.nextScheduleTime || 'Rabu • 16:30 WIB'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{data.nextScheduleVenue || 'Masjid Baitul Makmur'}</span>
                    </div>
                  </div>
                  <Link
                    href="/jadwal"
                    onClick={() => setActiveModalId(null)}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Buka Kalender Pengajian</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* Orang Tua: Ananda Binaan */}
              {activeModalId === 'ananda' && (
                <div className="space-y-3 text-xs">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.childrenList && data.childrenList.length > 0 ? (
                      data.childrenList.map((child) => (
                        <div
                          key={child.id}
                          className="p-3 rounded-xl border border-slate-200/70 bg-white flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900">{child.fullName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {child.generationName || 'Caberawit'} &bull; {child.relationshipType || 'Santri'}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Aktif
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-center py-4">Belum ada data ananda binaan.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Orang Tua: Keaktifan Ananda */}
              {activeModalId === 'keaktifan_ananda' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">Disiplin & Hadir Rutin</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Ananda mengikuti sesi pembinaan halaqah secara konsisten tanpa catatan absen tanpa keterangan.
                    </p>
                  </div>
                </div>
              )}

              {/* Orang Tua: Progres Belajar */}
              {activeModalId === 'progres_belajar' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">Rapor Belajar Digital</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Evaluasi materi hafalan dan adab ananda telah disinkronkan secara realtime oleh wali kelas.
                    </p>
                  </div>
                  <Link
                    href="/laporan"
                    onClick={() => setActiveModalId(null)}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Lihat Rapor Capaian Anak</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* PJ / Admin: Wilayah */}
              {activeModalId === 'wilayah' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">{theme.roleTitle}</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Memonitor pelaksanaan kurikulum berjenjang, presensi jamaah, dan koordinasi antar dewan guru wilayah.
                    </p>
                  </div>
                </div>
              )}

              {/* PJ / Admin: Approval */}
              {activeModalId === 'approval' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">
                      {data.pendingApprovalsCount || 0} Pengajuan Menunggu
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Pengajuan pengajian private remedial dari pengajar memerlukan verifikasi dan persetujuan pengurus.
                    </p>
                  </div>
                  <Link
                    href="/private-remedial"
                    onClick={() => setActiveModalId(null)}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Buka Antrean Approval</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}

              {/* PJ / Admin: Sistem */}
              {activeModalId === 'sistem' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1.5">
                    <div className="font-bold text-slate-900 text-sm">Sistem Berjalan Normal</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Database PostgreSQL, Row Level Security, koneksi Supabase, serta sinkronisasi data online/offline beroperasi normal.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setActiveModalId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
