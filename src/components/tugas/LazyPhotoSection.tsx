'use client';

import React, { useState, useEffect } from 'react';
import { Camera, ExternalLink, ChevronDown } from 'lucide-react';

interface LazyPhotoSectionProps {
  photoUrls: string[];
  titlePrefix?: string;
  onPreviewImage?: (url: string) => void;
  defaultExpanded?: boolean;
  storageKey?: string;
}

// In-memory cache untuk navigasi SPA instan antar-halaman tanpa flicker
const memoryOpenedCache = new Set<string>();

export default function LazyPhotoSection({
  photoUrls,
  titlePrefix = 'Foto Lembar Kerja',
  onPreviewImage,
  defaultExpanded = false,
  storageKey,
}: LazyPhotoSectionProps) {
  // Buat key unik berbasis URL atau storageKey
  const resolvedKey = storageKey
    ? `opened_photo_${storageKey}`
    : `opened_photo_${(photoUrls || []).slice().sort().join(',')}`;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (defaultExpanded) return true;
    if (memoryOpenedCache.has(resolvedKey)) return true;
    return false;
  });

  // Cek penyimpanan sementara (sessionStorage) saat komponen mount (misal kembali dari halaman lain)
  useEffect(() => {
    if (isExpanded) {
      memoryOpenedCache.add(resolvedKey);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const isSaved = sessionStorage.getItem(resolvedKey) === 'true';
        if (isSaved) {
          memoryOpenedCache.add(resolvedKey);
          setIsExpanded(true);
        }
      }
    } catch {
      // Abaikan jika storage dinonaktifkan di browser
    }
  }, [resolvedKey, isExpanded]);

  if (!photoUrls || photoUrls.length === 0) return null;

  const handleOpenPhotos = () => {
    setIsExpanded(true);
    memoryOpenedCache.add(resolvedKey);

    try {
      if (typeof window !== 'undefined') {
        // 1. Simpan status buka ke penyimpanan sementara (sessionStorage)
        // sehingga saat kembali dari halaman lain tidak perlu klik buka lagi
        if (window.sessionStorage) {
          sessionStorage.setItem(resolvedKey, 'true');
        }

        // 2. Simpan response berkas gambar ke Cache Storage peramban agar tidak perlu request ulang
        if ('caches' in window) {
          caches.open('tugas-photos-cache').then((cache) => {
            photoUrls.forEach((url) => {
              if (url && !url.startsWith('data:')) {
                fetch(url, { mode: 'no-cors' })
                  .then((res) => cache.put(url, res))
                  .catch(() => { });
              }
            });
          });
        }
      }
    } catch (e) {
      console.warn('Gagal menyimpan cache foto di penyimpanan sementara:', e);
    }
  };

  return (
    <div className="space-y-2">
      {!isExpanded ? (
        <button
          type="button"
          onClick={handleOpenPhotos}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-sky-50/90 via-blue-50/40 to-white border border-sky-200/90 hover:border-sky-300 hover:shadow-xs transition-all text-left group cursor-pointer shadow-2xs"
          title="Klik sekali untuk memuat dan melihat berkas foto lembar kerja"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 group-hover:bg-sky-700 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {titlePrefix} ({photoUrls.length} Foto)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-sky-600/10 text-sky-800 border border-sky-200 group-hover:bg-sky-600 group-hover:text-white transition-colors shrink-0">
            <span>Lihat</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </button>
      ) : (
        <div className="space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-sky-600" />
              <span>{titlePrefix} ({photoUrls.length} Foto):</span>
            </span>
            <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/70 px-2 py-0.5 rounded-md flex items-center gap-1">
              <span>Tersimpan</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {photoUrls.map((photoUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onPreviewImage && onPreviewImage(photoUrl)}
                className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs block cursor-pointer hover:border-sky-400 transition-all text-left aspect-video sm:aspect-4/3"
              >
                <img
                  src={photoUrl}
                  alt={`Foto ${idx + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-900/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                  <ExternalLink className="w-4 h-4" />
                  <span>Lihat Foto {idx + 1}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
