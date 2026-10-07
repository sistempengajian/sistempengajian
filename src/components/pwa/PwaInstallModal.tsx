'use client';

import React from 'react';
import {
  X,
  Share,
  PlusSquare,
  MoreVertical,
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { DeviceType } from '@/hooks/usePwaInstall';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: DeviceType;
  isInstalled: boolean;
}

export default function PwaInstallModal({
  isOpen,
  onClose,
  device,
  isInstalled,
}: PwaInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100001] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white border border-emerald-100 shadow-2xl p-5 sm:p-6 space-y-4 text-slate-800 animate-slide-up select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center p-1.5 shadow-2xs shrink-0">
              <img
                src="/icons/icon-192x192.svg"
                alt="Logo SiPanji"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                {isInstalled ? 'Buka Aplikasi SiPanji' : 'Pasang Aplikasi SiPanji'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isInstalled
                  ? 'Aplikasi sudah terpasang di perangkat Anda'
                  : 'Akses cepat & hemat kuota di layar HP Anda'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Khusus Jika Sudah Terpasang */}
        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Aplikasi SiPanji Sudah Tersedia</span>
            </div>
            <p className="text-xs text-emerald-900/90 leading-relaxed">
              Anda sedang membuka SiPanji lewat peramban (*browser*). Untuk pengalaman layar penuh
              tanpa bilah browser, silakan cari dan buka ikon <strong>SiPanji</strong> di Layar
              Utama (*Home Screen*) HP Anda.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs active:scale-95 cursor-pointer mt-1"
            >
              Saya Mengerti
            </button>
          </div>
        ) : (
          /* Konten Panduan Instalasi Sesuai Jenis Device */
          <div className="space-y-3.5">
            {/* 1. Panduan Khusus iOS (iPhone / iPad) */}
            {device === 'ios' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Petunjuk Pasang di iPhone / iPad (Safari):</span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <span>Ketuk tombol <strong>Bagikan (Share)</strong></span>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-0.5">
                        <Share className="w-3.5 h-3.5" />
                        <span>Ikon kotak dengan panah atas di bilah bawah Safari</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <span>Gulir ke bawah, lalu pilih menu:</span>
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold mt-0.5">
                        <PlusSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tambahkan ke Layar Utama</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <span>Ketuk <strong>Tambah</strong> di pojok kanan atas. Ikon SiPanji akan muncul di layar HP Anda!</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Panduan Khusus Android */}
            {device === 'android' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Petunjuk Pasang di HP Android (Chrome):</span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <span>Ketuk tombol <strong>menu titik tiga (⋮)</strong> di pojok kanan atas browser Chrome.</span>
                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-0.5">
                        <MoreVertical className="w-3.5 h-3.5" />
                        <span>Menu opsi browser</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <span>Pilih menu:</span>
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold mt-0.5">
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Install Aplikasi / Tambahkan ke Layar Utama</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <span>Tekan konfirmasi <strong>Pasang / Install</strong>. Aplikasi SiPanji akan terpasang di menu aplikasi Anda.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Panduan Khusus Desktop / Laptop */}
            {device === 'desktop' && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Laptop className="w-4 h-4 text-emerald-600" />
                  <span>Petunjuk Pasang di Komputer / Laptop:</span>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <span>Periksa bilah alamat web (*address bar*) di bagian atas browser Anda.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-150">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <span>Klik ikon <strong>Pasang / Install</strong> (ikon komputer dengan tanda panah ke bawah) di ujung kanan bilah URL.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tombol Aksi Bawah */}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs active:scale-95 cursor-pointer mt-2"
            >
              Tutup Petunjuk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
