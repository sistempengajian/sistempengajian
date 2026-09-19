'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  ShieldCheck,
  StopCircle,
  Sparkles,
  AlertCircle,
  Lock,
  CheckCircle2,
  Play,
  Pause,
  QrCode,
} from 'lucide-react';
import {
  closeAttendanceSession,
  reopenAttendanceSession,
} from '@/app/(protected)/presensi/actions';
import { TOTP_STEP_SECONDS } from '@/lib/totp';

export interface InitialQrPayload {
  qrContent: string;
  token: string;
  remainingSeconds: number;
}

interface DynamicQrDisplayProps {
  sessionId: string;
  scheduleTitle: string;
  venueName?: string;
  isActive?: boolean;
  closedAt?: string | null;
  initialQrPayload?: InitialQrPayload | null;
  isStarted?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onSessionClosed?: () => void;
  onSessionReopened?: () => void;
}

export default function DynamicQrDisplay({
  sessionId,
  scheduleTitle,
  venueName,
  isActive = true,
  closedAt,
  initialQrPayload,
  isStarted: externalIsStarted,
  onStart,
  onPause,
  onSessionClosed,
  onSessionReopened,
}: DynamicQrDisplayProps) {
  const [internalIsStarted, setInternalIsStarted] = useState<boolean>(false);
  const isStarted = externalIsStarted !== undefined ? externalIsStarted : internalIsStarted;

  const handleStart = () => {
    if (onStart) {
      onStart();
    } else {
      setInternalIsStarted(true);
    }
  };

  const handlePause = () => {
    if (onPause) {
      onPause();
    } else {
      setInternalIsStarted(false);
    }
  };

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialQrPayload?.remainingSeconds ?? TOTP_STEP_SECONDS
  );
  const [tokenText, setTokenText] = useState<string>(
    initialQrPayload?.token ?? '--------'
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isReopening, setIsReopening] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Render QR code instan dari initial payload tanpa tunggu network saat isStarted aktif
  useEffect(() => {
    if (!initialQrPayload?.qrContent || !isStarted) return;
    if (qrDataUrl) return;

    let isMounted = true;
    QRCode.toDataURL(initialQrPayload.qrContent, {
      width: 420,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error generating initial QR code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialQrPayload?.qrContent, isStarted, qrDataUrl]);

  // Fetch token baru dari Route Handler (/api/presensi/qr-token)
  // Menghindari Server Action yang memicu update React Router saat rendering
  const fetchToken = useCallback(async () => {
    if (!isActive || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      setIsLoading(true);

      const res = await fetch(
        `/api/presensi/qr-token?sessionId=${encodeURIComponent(sessionId)}`,
        { cache: 'no-store' }
      );

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.message || 'Gagal memuat token sesi.');
        return;
      }

      const url = await QRCode.toDataURL(data.qrContent, {
        width: 420,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      setQrDataUrl(url);
      setTokenText(data.token || '--------');
      setRemainingSeconds(data.remainingSeconds || TOTP_STEP_SECONDS);
      setErrorMsg(null);
    } catch (err) {
      console.error('Error fetching live QR token:', err);
      setErrorMsg('Gagal terhubung ke server untuk memperbarui QR.');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [sessionId, isActive]);

  // Interval hitung mundur per detik murni (hanya decrement state saat isStarted aktif)
  useEffect(() => {
    if (!isActive || !isStarted) {
      setIsLoading(false);
      return;
    }

    // Jika belum ada QR dari props initial dan belum ada data url, fetch pertama kali
    if (!initialQrPayload?.qrContent && !qrDataUrl) {
      fetchToken();
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isActive, isStarted, initialQrPayload?.qrContent, qrDataUrl, fetchToken]);

  // Trigger fetchToken terisolasi saat countdown mencapai 0
  useEffect(() => {
    if (!isActive || !isStarted) return;
    if (remainingSeconds === 0) {
      fetchToken();
    }
  }, [remainingSeconds, isActive, isStarted, fetchToken]);

  // Toggle layar penuh (berguna untuk proyektor kelas atau tablet ustadz)
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Fullscreen request failed:', err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleCloseSession = async () => {
    if (!confirm('Apakah Anda yakin ingin menutup sesi presensi ini? Santri tidak akan dapat memindai QR lagi.')) {
      return;
    }
    try {
      setIsClosing(true);
      await closeAttendanceSession(sessionId);
      if (onSessionClosed) onSessionClosed();
    } catch (err) {
      console.error('Failed to close session:', err);
      alert('Gagal menutup sesi presensi.');
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopenSession = async () => {
    if (!confirm('Buka kembali sesi presensi untuk jadwal ini? Kode QR aktif akan kembali dihasilkan.')) {
      return;
    }
    try {
      setIsReopening(true);
      await reopenAttendanceSession(sessionId);
      if (onSessionReopened) onSessionReopened();
    } catch (err) {
      console.error('Failed to reopen session:', err);
      alert('Gagal membuka kembali sesi presensi.');
    } finally {
      setIsReopening(false);
    }
  };

  const progressPercent = ((TOTP_STEP_SECONDS - remainingSeconds) / TOTP_STEP_SECONDS) * 100;

  // 1. Tampilan jika sesi presensi telah ditutup / selesai
  if (!isActive) {
    return (
      <div
        ref={containerRef}
        className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto animate-fade-in"
      >
        <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shadow-inner">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Sesi Presensi Telah Ditutup
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Sesi pengajian ini telah selesai atau ditutup. Kode QR presensi otomatis dinonaktifkan untuk mencegah absensi di luar waktu.
          </p>
        </div>

        {closedAt && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Ditutup: {new Date(closedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </div>
        )}

        <div className="pt-2 w-full max-w-xs">
          <button
            type="button"
            onClick={handleReopenSession}
            disabled={isReopening}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReopening ? 'animate-spin' : ''}`} />
            <span>{isReopening ? 'Membuka Sesi...' : 'Buka Kembali Sesi Presensi'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Tampilan standby sebelum tombol "Mulai Tampilkan QR Code" ditekan agar load halaman lebih cepat
  if (!isStarted) {
    return (
      <div
        className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto animate-fade-in"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500/10 via-teal-500/20 to-emerald-500/10 border border-teal-200/80 flex items-center justify-center text-teal-700 shadow-sm">
            <QrCode className="w-10 h-10 text-teal-600" />
          </div>
          <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
            Siap
          </span>
        </div>

        <div className="space-y-2 max-w-sm">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Dynamic QR Code Presensi
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Kode QR dinamis berbasis waktu (TOTP) yang berganti setiap 15 detik untuk keamanan tinggi tanpa titip presensi. Tekan tombol di bawah saat santri siap memindai.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <button
            type="button"
            onClick={handleStart}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Mulai Tampilkan QR Code</span>
          </button>

          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-medium pt-1">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Anti-Titip Presensi</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Refresh 15s</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Tampilan sesi aktif (Live TOTP QR Code)
  return (
    <div
      ref={containerRef}
      className={`bg-white/75 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xs p-5 sm:p-7 flex flex-col items-center justify-center text-center transition-all ${isFullscreen ? 'fixed inset-0 z-50 rounded-none p-10 flex items-center justify-center bg-white' : ''
        }`}
    >
      {/* Header Info Sesi */}
      <div className="max-w-md w-full mb-3">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
          {scheduleTitle}
        </h3>
      </div>

      {/* Frame QR Code Display */}
      <div className="relative p-3.5 sm:p-4 rounded-3xl bg-white border border-teal-200/70 shadow-sm group">
        {isLoading && !qrDataUrl && (
          <div className="w-60 h-60 sm:w-68 sm:h-68 flex flex-col items-center justify-center gap-2.5 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-teal-600" />
            <span className="text-xs font-semibold">Menyiapkan kode QR aman...</span>
          </div>
        )}

        {errorMsg ? (
          <div className="w-60 h-60 sm:w-68 sm:h-68 flex flex-col items-center justify-center gap-2 text-rose-600 p-4">
            <AlertCircle className="w-7 h-7" />
            <span className="text-xs font-bold">{errorMsg}</span>
            <button
              onClick={fetchToken}
              className="mt-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          qrDataUrl && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="Dynamic QR Code Sesi Presensi"
                className={`w-60 h-60 sm:w-68 sm:h-68 object-contain rounded-2xl transition-opacity duration-300 ${isLoading ? 'opacity-85' : 'opacity-100'
                  }`}
              />
            </div>
          )
        )}
      </div>

      {/* Countdown Timer Progress Indicator */}
      <div className="mt-5 max-w-xs w-full space-y-2">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>Refresh Kode Otomatis:</span>
          </span>
          <span className="font-mono font-bold text-teal-800 bg-teal-50/90 px-2 py-0.5 rounded-lg border border-teal-200/80 text-xs">
            {remainingSeconds}s
          </span>
        </div>

        {/* Bar Countdown */}
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${100 - progressPercent}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400 font-medium leading-tight">
          Arahkan santri memindai QR code ini melalui kamera aplikasi.
        </p>
      </div>

      {/* Unified Action Toolbar */}
      <div className="mt-5 pt-4 border-t border-slate-100 w-full max-w-md flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer border border-slate-200/80 shadow-2xs active:scale-95"
          title={isFullscreen ? 'Keluar Layar Penuh' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{isFullscreen ? 'Keluar' : 'Fullscreen'}</span>
        </button>

        <button
          type="button"
          onClick={fetchToken}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-teal-50/70 text-teal-700 font-semibold text-xs transition-all cursor-pointer border border-teal-200/80 shadow-2xs active:scale-95 disabled:opacity-50"
          title="Segarkan QR Sekarang"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>

        <button
          type="button"
          onClick={handlePause}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer border border-slate-200/80 shadow-2xs active:scale-95"
          title="Jeda / Sembunyikan QR Code"
        >
          <Pause className="w-3.5 h-3.5 text-slate-500" />
          <span>Jeda QR</span>
        </button>

        <button
          type="button"
          onClick={handleCloseSession}
          disabled={isClosing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50/80 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-all cursor-pointer border border-rose-200/80 shadow-2xs active:scale-95 disabled:opacity-50"
          title="Tutup Sesi Presensi Kelas"
        >
          <StopCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>{isClosing ? 'Menutup...' : 'Tutup Sesi'}</span>
        </button>
      </div>
    </div>
  );
}
