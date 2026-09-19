'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  Camera,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Award,
  Clock,
  MapPin,
  RefreshCw,
  X,
  Share2
} from 'lucide-react';
import { submitStudentQrScan } from '@/app/(protected)/presensi/actions';

interface StudentQrScannerProps {
  studentId: string;
  studentName: string;
  generationName?: string;
  organizationName?: string;
  activeSchedule?: {
    id: string;
    title: string;
    venuePlaceName?: string;
    startTime: string;
    endTime: string;
  } | null;
  isAlreadyPresent?: boolean;
  checkInTime?: string | null;
}

type SantriTab = 'SCAN_SESSION' | 'MY_QR_CARD';

export default function StudentQrScanner({
  studentId,
  studentName,
  generationName = 'Santri',
  organizationName = 'Kelompok Binaan',
  activeSchedule,
  isAlreadyPresent: initialPresent = false,
  checkInTime: initialCheckIn = null,
}: StudentQrScannerProps) {
  const [activeTab, setActiveTab] = useState<SantriTab>('SCAN_SESSION');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    message: string;
    checkInTime: string;
    pointsEarned: number;
  } | null>(null);

  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(initialPresent);
  const [checkInTimeStr, setCheckInTimeStr] = useState<string | null>(initialCheckIn);

  // State untuk Kartu QR Saya
  const [studentQrDataUrl, setStudentQrDataUrl] = useState<string>('');
  const [isGeneratingCard, setIsGeneratingCard] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef<boolean>(false);
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);

  // Generate QR Code santri (format: santri:<studentId>)
  useEffect(() => {
    QRCode.toDataURL(`santri:${studentId}`, {
      width: 360,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setStudentQrDataUrl(url))
      .catch((err) => console.error('Gagal membuat QR santri:', err));
  }, [studentId]);

  // Haptic feedback vibration (jika didukung perangkat seluler)
  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  // Callback scan berhasil
  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (isCooldownRef.current || isProcessing) return;
      if (!activeSchedule) {
        setErrorMessage('Tidak ada jadwal pengajian aktif yang dapat diabsen saat ini.');
        return;
      }

      isCooldownRef.current = true;
      setIsProcessing(true);
      setErrorMessage(null);

      try {
        const res = await submitStudentQrScan(decodedText, activeSchedule.id);
        if (res.success) {
          triggerHaptic();
          setSuccessData({
            message: res.message || 'Presensi berhasil dicatat!',
            checkInTime: res.checkInTime || '',
            pointsEarned: res.pointsEarned || 10,
          });
          setHasCheckedIn(true);
          setCheckInTimeStr(res.checkInTime || null);

          // Hentikan scanner setelah berhasil
          if (scannerRef.current) {
            await scannerRef.current.stop();
            setIsScanning(false);
          }
        } else {
          setErrorMessage(res.message || 'Kode QR tidak cocok atau telah diperbarui.');
          // Beri jeda 2 detik sebelum scan berikutnya jika gagal
          setTimeout(() => {
            isCooldownRef.current = false;
          }, 2000);
        }
      } catch (err) {
        console.error('Gagal memproses QR:', err);
        setErrorMessage('Gagal menghubungi server untuk verifikasi.');
        setTimeout(() => {
          isCooldownRef.current = false;
        }, 2000);
      } finally {
        setIsProcessing(false);
      }
    },
    [activeSchedule, isProcessing]
  );

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

      // Hentikan instance scanner sebelumnya jika masih aktif
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

      const scanner = new Html5Qrcode('student-camera-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
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
        () => { }
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
        console.error('Camera start error:', err);
        setErrorMessage('Izin kamera ditolak atau kamera tidak ditemukan pada perangkat ini.');
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

  // Handler Download Template Kartu Santri (Clean, Simple & Rapi)
  const handleDownloadQrCard = async () => {
    if (!studentQrDataUrl) return;
    setIsGeneratingCard(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dimensi Kartu HD (600 x 850 px)
      canvas.width = 600;
      canvas.height = 850;

      // 1. Background Kartu (Putih Bersih dengan Border Halus)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border luar kartu
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Aksen Header Warna Hijau Emerald
      ctx.fillStyle = '#059669';
      ctx.fillRect(16, 16, canvas.width - 32, 100);

      // 2. Teks Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEM PENGAJIAN', canvas.width / 2, 55);

      ctx.fillStyle = '#d1fae5';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText("GENERASI QUR'ANI", canvas.width / 2, 85);

      // 3. Nama Santri
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText(studentName, canvas.width / 2, 165);

      // 4. Badge Generasi & Kelompok
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Generasi: ${generationName}`, canvas.width / 2, 200);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Kelompok: ${organizationName}`, canvas.width / 2, 225);

      // Garis Pemisah Halus
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 245);
      ctx.lineTo(canvas.width - 60, 245);
      ctx.stroke();

      // 5. Gambar QR Code
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.src = studentQrDataUrl;

      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = (e) => reject(e);
      });

      const qrSize = 340;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 275;

      // Kotak latar QR
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);
      ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // 6. ID Unik di bawah QR
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`ID: ${studentId.slice(0, 18)}...`, canvas.width / 2, 665);

      // 7. Footer Kartu
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('Kartu Presensi Resmi Santri • Simpan & Tunjukkan ke Pengajar', canvas.width / 2, 750);

      // Trigger Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `kartu-santri-${studentName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download card error:', err);
      alert('Gagal mengunduh kartu QR santri.');
    } finally {
      setIsGeneratingCard(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* Segmented Control 2 Tab: Scan QR Sesi vs Kartu QR Saya */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-center gap-2 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab('SCAN_SESSION');
            stopScanner();
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'SCAN_SESSION'
            ? 'bg-emerald-800 text-white shadow-xs'
            : 'text-emerald-600 hover:text-slate-900 bg-transparent'
            }`}
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>Scan QR</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('MY_QR_CARD');
            stopScanner();
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'MY_QR_CARD'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
        >
          <QrCode className="w-4 h-4 text-teal-400" />
          <span>Kartu QR</span>
        </button>
      </div>

      {/* TAB 1: SCAN QR SESI KELAS */}
      {activeTab === 'SCAN_SESSION' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 max-w-md mx-auto space-y-5 text-center">
          {/* Status Sesi Pengajian */}
          {activeSchedule ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-left">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Sesi Pengajian Hari Ini
                </span>
                {hasCheckedIn ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                    SUDAH HADIR ✓
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    BELUM HADIR
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-900">{activeSchedule.title}</h4>
              <div className="flex-col items-center gap-1 text-xs text-slate-600 font-medium mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {activeSchedule.startTime} - {activeSchedule.endTime} WIB
                </span>
                {activeSchedule.venuePlaceName && (
                  <span className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {activeSchedule.venuePlaceName}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium">
              Tidak ada sesi pengajian aktif saat ini. Presensi dibuka saat pengajar memulai sesi di kelas.
            </div>
          )}

          {/* Jendela Kamera Pemindai */}
          <div className="relative w-full aspect-square max-w-[300px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center">
            <div
              id="student-camera-reader"
              className="w-full h-full overflow-hidden flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-3xl"
            />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3 bg-slate-900/90 backdrop-blur-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Kamera Pemindai Siap</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Arahkan kamera ke layar QR dinamis ustadz di depan kelas.
                  </p>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-emerald-950/70 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold animate-pulse">
                Memverifikasi kode QR kelas...
              </div>
            )}
          </div>

          {/* Pesan Error */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tombol Mulai / Stop Kamera */}
          <div>
            <button
              type="button"
              onClick={isScanning ? stopScanner : startScanner}
              disabled={!activeSchedule || isProcessing}
              className={`w-full py-3 rounded-2xl text-xs font-bold shadow-sm transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${isScanning
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                } disabled:opacity-50`}
            >
              <Camera className="w-4 h-4" />
              <span>{isScanning ? 'Hentikan Pemindai' : 'Nyalakan Kamera Scan QR'}</span>
            </button>
            <p className="text-[11px] text-slate-400 font-medium mt-2">
              Pastikan memberi izin akses kamera pada peramban/browser Anda.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: KARTU QR SAYA & DOWNLOAD KARTU */}
      {activeTab === 'MY_QR_CARD' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-7 max-w-md mx-auto space-y-5 text-center">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Kartu Identitas Digital Santri
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Tunjukkan kode QR ini ke pengajar jika menggunakan absensi scan kartu fisik.
            </p>
          </div>

          {/* Template Visual Kartu Santri (Clean & Simple) */}
          <div className="p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-md shadow-slate-900/5 space-y-4">
            {/* Header Kartu */}
            <div className="p-3 rounded-2xl bg-emerald-600 text-white">
              <span className="text-[11px] uppercase tracking-wider font-bold block">
                Sistem Pengajian
              </span>
              <span className="text-xs font-bold text-emerald-100">
                Generasi Qur&apos;ani
              </span>
            </div>

            {/* Nama & Generasi */}
            <div>
              <h4 className="text-lg font-black text-slate-900 tracking-tight">
                {studentName}
              </h4>
            </div>

            {/* Visual QR Code */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 inline-block shadow-inner">
              {studentQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={studentQrDataUrl}
                  alt={`QR Code ${studentName}`}
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg mx-auto"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              )}

            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                {generationName} {'   '}{'   '} {organizationName}
              </span>
            </div>
          </div>

          {/* Tombol Download Kartu */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDownloadQrCard}
              disabled={isGeneratingCard || !studentQrDataUrl}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingCard ? 'Menyiapkan Gambar Kartu...' : 'Download Kartu QR Santri (PNG)'}</span>
            </button>
            <p className="text-[11px] text-slate-400 font-medium">
              Kartu dapat dicetak atau disimpan di galeri ponsel orang tua.
            </p>
          </div>
        </div>
      )}

      {/* Modal Dialog Berhasil Hadir */}
      {successData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 max-w-sm w-full text-center space-y-4 shadow-2xl animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                Presensi Berhasil
              </span>
              <h3 className="text-lg font-black text-slate-900">
                Alhamdulillah, Hadir Tepat Waktu!
              </h3>
              <p className="text-xs text-slate-500 mt-1">{successData.message}</p>
            </div>

            {/* Poin Bonus */}
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>+{successData.pointsEarned} Poin Istiqomah Diperoleh</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccessData(null)}
              className="w-full py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-sm hover:bg-slate-800 transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
