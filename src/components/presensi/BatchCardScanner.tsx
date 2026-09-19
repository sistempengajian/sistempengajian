'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sparkles,
  RefreshCw,
  Users,
  Volume2
} from 'lucide-react';
import { recordBatchCardScan } from '@/app/(protected)/presensi/actions';

interface BatchCardScannerProps {
  sessionId: string;
  onScanSuccess?: () => void;
}

interface ScannedHistoryItem {
  id: string;
  name: string;
  time: string;
}

export default function BatchCardScanner({ sessionId, onScanSuccess }: BatchCardScannerProps) {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scannedList, setScannedList] = useState<ScannedHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);

  // Audio tone helper sederhana saat scan berhasil (Web Audio API)
  const playBeep = () => {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 tone
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      }
    } catch {
      // Ignore audio failure
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (isCooldownRef.current || isProcessing) return;

    // Cooldown 1.5s agar tidak scan berulang kartu yang sama
    isCooldownRef.current = true;
    setTimeout(() => {
      isCooldownRef.current = false;
    }, 1500);

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await recordBatchCardScan(sessionId, decodedText);
      if (res.success) {
        playBeep();
        setLastScanned(res.message);
        setScannedList((prev) => [
          {
            id: decodedText,
            name: res.studentName || 'Santri',
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.slice(0, 9), // Simpan 10 riwayat terakhir
        ]);
        onScanSuccess?.();
      } else {
        setErrorMessage(res.message || 'Kartu santri tidak valid.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMessage('Terjadi kesalahan saat memverifikasi kartu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopScanner = async () => {
    setIsScanning(false);
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // Abaikan error internal html5-qrcode
      }
    }
  };

  const startScanner = async () => {
    if (isStartingRef.current || isScanning) return;

    try {
      setErrorMessage(null);
      isStartingRef.current = true;

      // Hentikan instance scanner sebelumnya jika masih ada
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // Abaikan
        }
      }

      const scanner = new Html5Qrcode('batch-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            // Sediakan margin proporsional (70% viewport), dengan batas min 140px & max 240px
            // Mencegah nilai negatif pada border qr-shaded-region saat layar kecil
            const size = Math.max(140, Math.min(240, Math.floor(minEdge * 0.7)));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: 'environment',
            aspectRatio: 1.0,
          },
        },
        handleScanSuccess,
        () => {
          // Frame scanner error (no QR in frame) - ignore
        }
      );

      if (isUnmountedRef.current) {
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
          scanner.clear();
        } catch {
          // Abaikan
        }
        return;
      }

      setIsScanning(true);
    } catch (err) {
      if (!isUnmountedRef.current) {
        console.error('Failed to start camera:', err);
        setErrorMessage('Izin kamera ditolak atau kamera tidak ditemukan.');
        setIsScanning(false);
      }
    } finally {
      isStartingRef.current = false;
    }
  };

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            scanner.stop().then(() => scanner.clear()).catch(() => {});
          } else {
            scanner.clear();
          }
        } catch {
          // Abaikan
        }
      }
    };
  }, []);

  return (
    <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xs p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs">
              <Camera className="w-5 h-5 text-teal-600" />
            </div>
            <span>Mode Batch Scan QR Code</span>
          </h3>

        </div>

      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* Frame Kamera Scanner */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[310px] sm:max-w-[350px] aspect-square rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-md flex items-center justify-center">
            <div
              id="batch-reader"
              className="w-full h-full overflow-hidden flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-3xl [&_#qr-shaded-region]:!border-slate-950/60"
            />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3 bg-slate-900/95 backdrop-blur-xs z-10">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-teal-400 border border-slate-700 shadow-sm">
                  <QrCode className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200">Kamera Belum Aktif</p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[220px]">
                    Klik tombol &quot;Mulai Scan QR Code&quot; untuk menyalakan kamera pemindai.
                  </p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-teal-950/75 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs font-bold gap-2 animate-fade-in z-20">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
                <span>Memproses kartu santri...</span>
              </div>
            )}
          </div>

          {/* Pesan Notifikasi Sukses / Error */}
          {lastScanned && (
            <div className="mt-3 w-full max-w-[310px] sm:max-w-[350px] p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{lastScanned}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 w-full max-w-[310px] sm:max-w-[350px] p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={isScanning ? stopScanner : startScanner}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 ${isScanning
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isScanning ? 'Hentikan Kamera' : 'Mulai Scan QR Code'}</span>
          </button>
        </div>


        {/* Live Feed Riwayat Scan Terbaru */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Baru Saja Diabsen ({scannedList.length})</span>
            </h4>
            {scannedList.length > 0 && (
              <button
                type="button"
                onClick={() => setScannedList([])}
                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer font-medium"
              >
                Bersihkan Riwayat
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 max-h-[290px] overflow-y-auto bg-white">
            {scannedList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada kartu santri yang dipindai pada sesi ini.
              </div>
            ) : (
              scannedList.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 font-bold text-[11px] flex items-center justify-center border border-teal-200/80">
                      ✓
                    </div>
                    <span className="font-bold text-slate-900">{item.name}</span>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
