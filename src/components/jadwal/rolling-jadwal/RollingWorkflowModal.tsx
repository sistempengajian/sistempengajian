'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  Sparkles,
  Layers,
  Users,
  CalendarCheck,
  History,
  CheckCircle2,
  ChevronRight,
  Wand2,
  ArrowUpRight,
} from 'lucide-react';
import { getRoleRollingTheme } from '@/lib/theme';

interface RollingWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGenerator: () => void;
  roleCodes?: string[];
}

export default function RollingWorkflowModal({
  isOpen,
  onClose,
  onOpenGenerator,
  roleCodes = [],
}: RollingWorkflowModalProps) {
  const router = useRouter();

  // Prefetch semua sub-halaman rolling agar transisi berpindah halaman instan tanpa jeda
  useEffect(() => {
    if (isOpen) {
      router.prefetch('/jadwal/rolling-materi');
      router.prefetch('/jadwal/rolling-pengajar');
      router.prefetch('/jadwal/rolling-pengajian');
      router.prefetch('/jadwal/rolling-jadwal');
    }
  }, [isOpen, router]);

  if (!isOpen) return null;

  const theme = getRoleRollingTheme(roleCodes);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white/95 backdrop-blur-xl animate-fade-in flex flex-col justify-between">
      {/* Container Utama */}
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10 flex-1 flex flex-col justify-between space-y-8">
        {/* ── Top Header Navigation Bar ── */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <div></div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  Alur Otomatisasi Jadwal Rolling
                </h2>

              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Sistem penjadwalan terstruktur otomatis dari silabus materi hingga generasi sesi kalender konkret.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/jadwal/rolling-jadwal"
              prefetch={true}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all"
            >
              <History className={`w-3.5 h-3.5 ${theme.modalHeaderIconColor}`} />
              <span className="hidden sm:inline">Riwayat Batch</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-2xs"
              aria-label="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 4 Stages Interactive Cards Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 flex-1">
          {/* TAHAP 1: Rolling Materi */}
          <div className="group flex flex-col justify-between p-5 rounded-2xl bg-white border border-teal-200/80 hover:border-teal-400 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200">
                  <Layers className="w-5 h-5" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                  Rolling Materi
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Susun daftar antrean silabus kurikulum dan urutan materi yang akan bergulir otomatis.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Multi-slot materi per sesi</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Rotasi per pengajian / mingguan / bulanan</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/jadwal/rolling-materi"
                prefetch={true}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-800 border border-teal-200 hover:border-teal-300 text-xs font-bold transition-all active:scale-95 shadow-2xs"
              >
                <span>Kelola Rolling Materi</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* TAHAP 2: Rolling Pengajar */}
          <div className="group flex flex-col justify-between p-5 rounded-2xl bg-white border border-sky-200/80 hover:border-sky-400 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  Rolling Pengajar
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tentukan dewan pengajar, urutan rotasi asatidz utama, serta penugasan guru badal.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Asatidz utama & cadangan (badal)</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>Distribusi pengajar berkeadilan</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/jadwal/rolling-pengajar"
                prefetch={true}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-800 border border-sky-200 hover:border-sky-300 text-xs font-bold transition-all active:scale-95 shadow-2xs"
              >
                <span>Kelola Rolling Pengajar</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* TAHAP 3: Pengajian Rolling */}
          <div className="group flex flex-col justify-between p-5 rounded-2xl bg-white border border-indigo-200/80 hover:border-indigo-400 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <CalendarCheck className="w-5 h-5" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  Pengajian Rolling
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Padukan template materi dan pengajar ke sasaran multi-kelas, generasi, atau wilayah.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Multi-kelas & sasaran se-wilayah</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Penetapan masjid & tempat bawaan</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/jadwal/rolling-pengajian"
                prefetch={true}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 text-xs font-bold transition-all active:scale-95 shadow-2xs"
              >
                <span>Kelola Blueprint Kegiatan</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* TAHAP 4: Generate Jadwal Rolling (Actionable Generator) */}
          <div className={`group relative flex flex-col justify-between p-5 rounded-2xl border border-blue-200/80 hover:border-blue-400 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl ${theme.card4IconBg} text-white flex items-center justify-center shadow-md`}>
                  <Sparkles className={`w-5 h-5 ${theme.card4IconColor}`} />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 transition-colors flex items-center gap-1.5">
                  <span>Generate Jadwal</span>
                  <Wand2 className={`w-4 h-4 ${theme.modalHeaderIconColor}`} />
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Pilih blueprint, tentukan hari rutin, jam, rentang periode tanggal, lalu generate sesi kalender.
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${theme.modalHeaderIconColor} shrink-0`} />
                  <span>Kalender picker rentang tanggal</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-700">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${theme.modalHeaderIconColor} shrink-0`} />
                  <span>Simulasi / Dry-run preview sesi</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGenerator();
                }}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${theme.card4Button} text-xs font-black tracking-wide transition-all active:scale-95 shadow-md ${theme.card4ButtonShadow} border ${theme.card4ButtonBorder} cursor-pointer`}
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Buka Generator Jadwal</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer Info & Action ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500 text-center sm:text-left">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Semua data terintegrasi ke kalender pengajian wilayah Anda secara otomatis.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all border border-slate-300 cursor-pointer shadow-2xs"
          >
            Tutup & Kembali ke Kalender
          </button>
        </div>
      </div>
    </div>
  );
}

