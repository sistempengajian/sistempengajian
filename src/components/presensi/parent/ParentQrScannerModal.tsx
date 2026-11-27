'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { Calendar, Camera, Clock, AlertCircle, Info, Loader2 } from 'lucide-react';
import { submitParentQrScan } from '@/app/(protected)/presensi/actions';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  trackQrScanClientOutcome,
  triggerMicroCsatPrompt,
} from '@/lib/telemetry-client';
import type { ChildAttendanceSummary } from '../ParentAttendanceMonitor';

export interface ParentQrScanSuccessPayload {
  studentId: string;
  studentName: string;
  scheduleTitle: string;
  points: number;
  time: string;
}

interface ParentQrScannerModalProps {
  scanningChild: ChildAttendanceSummary;
  onClose: () => void;
  onScanSuccess: (payload: ParentQrScanSuccessPayload) => void;
}

/**
 * Modal kamera pemindai QR presensi sesi untuk Orang Tua (di-lazy-load agar `html5-qrcode`
 * hanya diunduh saat orang tua benar-benar membuka kamera scanner).
 */
export default function ParentQrScannerModal({
  scanningChild,
  onClose,
  onScanSuccess,
}: ParentQrScannerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  const modalPanelRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const isScanCooldownRef = useRef(false);
  const isScanStartingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopScanner = async () => {
    setIsScanningCamera(false);
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // Abaikan error teardown kamera
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const handleClose = async () => {
    if (isProcessingScan) return;
    await stopScanner();
    onClose();
  };

  useFocusTrap(mounted, modalPanelRef, () => {
    void handleClose();
  });

  const handleParentScanSuccess = async (decodedText: string) => {
    if (isScanCooldownRef.current || isProcessingScan || !scanningChild.todaySchedule) return;

    isScanCooldownRef.current = true;
    setIsProcessingScan(true);
    setScanErrorMessage(null);

    try {
      const res = await submitParentQrScan(
        decodedText,
        scanningChild.todaySchedule.scheduleId,
        scanningChild.id
      );

      if (res.success) {
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        await stopScanner();
        onScanSuccess({
          studentId: scanningChild.id,
          studentName: scanningChild.fullName,
          scheduleTitle: scanningChild.todaySchedule.scheduleTitle,
          points: res.pointsEarned || 10,
          time: res.checkInTime || nowTimeStr,
        });
        triggerMicroCsatPrompt('parent_qr_scan');
      } else {
        setScanErrorMessage(res.message || 'QR code tidak valid atau sesi belum aktif.');
        setTimeout(() => {
          isScanCooldownRef.current = false;
        }, 2500);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setScanErrorMessage(error.message || 'Gagal memproses kode QR presensi.');
      setTimeout(() => {
        isScanCooldownRef.current = false;
      }, 2500);
    } finally {
      setIsProcessingScan(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      if (isCancelled || isScanStartingRef.current || !scanningChild) return;
      const container = document.getElementById('parent-camera-reader');
      if (!container) return;

      try {
        isScanStartingRef.current = true;
        setScanErrorMessage(null);

        const { Html5Qrcode } = await import('html5-qrcode');
        if (isCancelled) return;

        const scanner = new Html5Qrcode('parent-camera-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.max(140, Math.min(250, Math.floor(minEdge * 0.75)));
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
            videoConstraints: {
              facingMode: 'environment',
              aspectRatio: 1.0,
            },
          },
          handleParentScanSuccess,
          () => {}
        );

        if (isCancelled) {
          await stopScanner();
          return;
        }
        setIsScanningCamera(true);
      } catch (err: unknown) {
        console.error('Parent camera start error:', err);
        if (!isCancelled) {
          trackQrScanClientOutcome('FAILED', 'PARENT', 'CAMERA_ERROR');
          setScanErrorMessage(
            'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser Anda.'
          );
          setIsScanningCamera(false);
        }
      } finally {
        isScanStartingRef.current = false;
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      void stopScanner();
    };
  }, [mounted, scanningChild]);

  if (!mounted || !scanningChild.todaySchedule) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR Presensi Sesi"
      className="!mt-0 fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessingScan) void handleClose();
      }}
    >
      <div
        ref={modalPanelRef}
        className="bg-white border border-slate-200/90 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70 shadow-2xs">
              <Camera className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Scan QR Presensi Sesi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Untuk ananda: <span className="font-bold text-emerald-700">{scanningChild.fullName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={isProcessingScan}
            className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-50 transition-colors"
            aria-label="Tutup kamera"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100/70 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate font-bold text-slate-800">
              {scanningChild.todaySchedule.scheduleTitle}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200/70 shadow-2xs shrink-0">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>
              {scanningChild.todaySchedule.startTime} - {scanningChild.todaySchedule.endTime} WIB
            </span>
          </div>
        </div>

        <div className="p-5 bg-slate-50/50 flex flex-col items-center">
          <div className="relative w-full aspect-square max-w-[300px] rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-200 shadow-md flex items-center justify-center">
            <div
              id="parent-camera-reader"
              className="w-full h-full overflow-hidden flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-3xl"
            />

            {isScanningCamera && !isProcessingScan && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl relative overflow-hidden shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]">
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-bounce" />
                </div>
              </div>
            )}

            {isProcessingScan && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                  <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    Memverifikasi Kode Presensi...
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mohon tunggu, mencatat kehadiran ananda
                  </p>
                </div>
              </div>
            )}
          </div>

          {scanErrorMessage && (
            <div className="mt-3.5 w-full p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{scanErrorMessage}</div>
            </div>
          )}

          <div className="mt-3.5 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 text-xs text-indigo-900 flex items-center gap-2.5 w-full">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <p className="leading-relaxed">
              Arahkan kamera ke layar ustadz yang menampilkan Dynamic QR Code presensi pengajian.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
          <button
            type="button"
            onClick={() => void handleClose()}
            disabled={isProcessingScan}
            className="w-full min-h-[44px] py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-[0.99]"
          >
            Tutup Kamera
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
