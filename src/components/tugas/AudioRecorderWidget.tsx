'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Check, Volume2, AlertCircle } from 'lucide-react';
import WaveformAudioPlayer from './WaveformAudioPlayer';

interface AudioRecorderWidgetProps {
  onAudioRecorded: (base64AudioUrl: string | null) => void;
  maxDurationSeconds?: number;
  initialAudioUrl?: string | null;
}

export default function AudioRecorderWidget({
  onAudioRecorded,
  maxDurationSeconds = 180, // Default 3 menit
  initialAudioUrl = null,
}: AudioRecorderWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(initialAudioUrl);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  // Helper untuk menghentikan seluruh track mikrofon agar indikator rekam device mati seketika
  const stopAllMicrophoneTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Gagal menghentikan track mikrofon:', e);
        }
      });
      streamRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 1. Bersihkan timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // 2. Hentikan media recorder jika masih aktif agar chunk terakhir diflush
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      // 3. Matikan hardware mikrofon di perangkat
      stopAllMicrophoneTracks();
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          // Simpan jika minimal ada data audio (size > 2000 byte untuk memfilter noise klik kosong)
          if (audioBlob.size > 2000) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              if (isMountedRef.current) {
                setRecordedAudioUrl(base64data);
              }
              onAudioRecorded(base64data);
            };
            reader.readAsDataURL(audioBlob);
          }
        }

        // Hentikan seluruh track mikrofon agar indikator rekaman di browser mati
        stopAllMicrophoneTracks();
      };

      mediaRecorder.start(250); // potong per 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= maxDurationSeconds - 1) {
            stopRecording();
            return maxDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Gagal mengakses mikrofon:', err);
      setHasPermission(false);
      setErrorMessage(
        'Izin akses mikrofon ditolak atau tidak didukung di perangkat ini. Pastikan Anda mengizinkan akses mikrofon di browser.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAllMicrophoneTracks();
  };

  const resetRecording = () => {
    stopAllMicrophoneTracks();
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    onAudioRecorded(null);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Jika belum ada rekaman: Tombol Mulai Rekam & Live Timer */}
      {!recordedAudioUrl ? (
        <div className="text-center py-4 space-y-4">
          <div className="relative inline-flex items-center justify-center">
            {/* Animasi pulse radar saat sedang merekam */}
            {isRecording && (
              <span className="absolute w-24 h-24 rounded-full bg-rose-400/30 animate-ping" />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md transition-all active:scale-95 cursor-pointer ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-teal-600 hover:bg-teal-700 hover:scale-105'
              }`}
              title={isRecording ? 'Klik untuk Menghentikan Rekaman' : 'Klik untuk Memulai Rekam Suara'}
            >
              {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-7 h-7" />}
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-900 flex items-center justify-center gap-2">
              {isRecording ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-rose-600 font-mono tracking-wider text-base">
                    {formatTimer(recordingSeconds)} / {formatTimer(maxDurationSeconds)}
                  </span>
                </>
              ) : (
                <span>Klik Mikrofon untuk Mulai Merekam</span>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {isRecording
                ? 'Bicaralah / lantunkan hafalan dengan jelas. Klik tombol kotak merah jika sudah selesai.'
                : `Maksimal durasi rekaman adalah ${Math.round(maxDurationSeconds / 60)} menit.`}
            </p>
          </div>
        </div>
      ) : (
        /* Jika sudah selesai merekam: Tampilkan preview pemutar rekaman + Opsi rekam ulang */
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Rekaman Hafalan Siap Dikumpulkan</span>
            </span>
            <button
              type="button"
              onClick={resetRecording}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Rekam Ulang</span>
            </button>
          </div>

          <WaveformAudioPlayer audioUrl={recordedAudioUrl} title="Hasil Rekaman Anda" />
        </div>
      )}
    </div>
  );
}
