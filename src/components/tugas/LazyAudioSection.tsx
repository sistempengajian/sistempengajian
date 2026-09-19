'use client';

import React, { useState, useEffect } from 'react';
import { Volume2, Play, ChevronDown } from 'lucide-react';
import WaveformAudioPlayer from './WaveformAudioPlayer';

interface LazyAudioSectionProps {
  audioUrls: string[];
  titlePrefix?: string;
  themeColor?: 'teal' | 'indigo';
  defaultExpanded?: boolean;
  storageKey?: string;
}

// In-memory cache untuk navigasi SPA instan antar-halaman tanpa flicker
const memoryOpenedAudioCache = new Set<string>();

export default function LazyAudioSection({
  audioUrls,
  titlePrefix = 'Setoran Audio',
  themeColor = 'teal',
  defaultExpanded = false,
  storageKey,
}: LazyAudioSectionProps) {
  const resolvedKey = storageKey
    ? `opened_audio_${storageKey}`
    : `opened_audio_${(audioUrls || []).slice().sort().join(',')}`;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (defaultExpanded) return true;
    if (memoryOpenedAudioCache.has(resolvedKey)) return true;
    return false;
  });

  // Cek penyimpanan sementara (sessionStorage) saat komponen mount (misal kembali dari halaman lain)
  useEffect(() => {
    if (isExpanded) {
      memoryOpenedAudioCache.add(resolvedKey);
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const isSaved = sessionStorage.getItem(resolvedKey) === 'true';
        if (isSaved) {
          memoryOpenedAudioCache.add(resolvedKey);
          setIsExpanded(true);
        }
      }
    } catch {
      // Abaikan jika storage dinonaktifkan di browser
    }
  }, [resolvedKey, isExpanded]);

  if (!audioUrls || audioUrls.length === 0) return null;

  const isTeal = themeColor === 'teal';

  const handleOpenAudio = () => {
    setIsExpanded(true);
    memoryOpenedAudioCache.add(resolvedKey);

    try {
      if (typeof window !== 'undefined') {
        // 1. Simpan status buka ke penyimpanan sementara (sessionStorage)
        // sehingga saat kembali dari halaman lain tidak perlu klik buka lagi
        if (window.sessionStorage) {
          sessionStorage.setItem(resolvedKey, 'true');
        }

        // 2. Simpan response berkas audio ke Cache Storage peramban agar tidak perlu request ulang
        if ('caches' in window) {
          caches.open('tugas-audio-cache').then((cache) => {
            audioUrls.forEach((url) => {
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
      console.warn('Gagal menyimpan cache audio di penyimpanan sementara:', e);
    }
  };

  return (
    <div className="pt-1">
      {!isExpanded ? (
        <button
          type="button"
          onClick={handleOpenAudio}
          className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer shadow-2xs ${isTeal
            ? 'bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white border-teal-200/90 hover:border-teal-300 hover:shadow-xs'
            : 'bg-gradient-to-r from-indigo-50/90 via-sky-50/50 to-white border-indigo-200/90 hover:border-indigo-300 hover:shadow-xs'
            }`}
          title="Klik sekali untuk memuat dan memutar audio rekaman"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-xs ${isTeal ? 'bg-teal-600 group-hover:bg-teal-700' : 'bg-indigo-600 group-hover:bg-indigo-700'
                }`}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {titlePrefix} ({audioUrls.length} Berkas)
                </span>
              </div>
            </div>
          </div>

          <div
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border shrink-0 transition-colors ${isTeal
              ? 'bg-teal-600/10 text-teal-800 border-teal-200 group-hover:bg-teal-600 group-hover:text-white'
              : 'bg-indigo-600/10 text-indigo-800 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white'
              }`}
          >
            <span>Dengarkan</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </button>
      ) : (
        <div className="space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Volume2 className={`w-3.5 h-3.5 ${isTeal ? 'text-teal-600' : 'text-indigo-600'}`} />
              <span>{titlePrefix} ({audioUrls.length} Berkas):</span>
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${isTeal
                ? 'text-teal-700 bg-teal-50 border-teal-200/70'
                : 'text-indigo-700 bg-indigo-50 border-indigo-200/70'
                }`}
            >
              Tersimpan
            </span>
          </div>

          <div className="space-y-2">
            {audioUrls.map((audioUrl, idx) => (
              <WaveformAudioPlayer
                key={idx}
                audioUrl={audioUrl}
                title={`${titlePrefix} ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
