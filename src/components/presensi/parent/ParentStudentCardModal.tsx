'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, Info, Printer, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { ChildAttendanceSummary } from '../ParentAttendanceMonitor';

interface ParentStudentCardModalProps {
  student: ChildAttendanceSummary;
  onClose: () => void;
}

/**
 * Modal kartu identitas digital QR Santri (di-lazy-load agar `qrcode` hanya diunduh
 * saat orang tua membuka kartu digital anak).
 */
export default function ParentStudentCardModal({
  student,
  onClose,
}: ParentStudentCardModalProps) {
  const [mounted, setMounted] = useState(false);
  const [childQrDataUrl, setChildQrDataUrl] = useState<string | null>(null);
  const [isGeneratingCardImage, setIsGeneratingCardImage] = useState(false);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useFocusTrap(mounted, modalPanelRef, () => {
    if (!isGeneratingCardImage) onClose();
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const qrUrl = await QRCode.toDataURL(`santri:${student.id}`, {
          width: 360,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        });
        if (active) setChildQrDataUrl(qrUrl);
      } catch (err) {
        console.error('Gagal membuat QR santri:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [student.id]);

  const handleDownloadCardPng = async () => {
    if (!childQrDataUrl) return;
    setIsGeneratingCardImage(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 600;
      canvas.height = 850;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      ctx.fillStyle = '#059669';
      ctx.fillRect(16, 16, canvas.width - 32, 100);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEM PENGAJIAN', canvas.width / 2, 55);

      ctx.fillStyle = '#d1fae5';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('GENERASI PENERUS', canvas.width / 2, 85);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText(student.fullName, canvas.width / 2, 165);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Generasi: ${student.generationName || 'Santri'}`, canvas.width / 2, 200);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      const subInfo = `${student.className ? student.className + ' • ' : ''}${student.organizationName || 'Kelompok Binaan'}`;
      ctx.fillText(subInfo, canvas.width / 2, 225);

      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 245);
      ctx.lineTo(canvas.width - 60, 245);
      ctx.stroke();

      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.src = childQrDataUrl;

      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = (e) => reject(e);
      });

      const qrSize = 340;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 275;

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);
      ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`ID: ${student.id.slice(0, 18)}...`, canvas.width / 2, 665);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      ctx.fillText(
        'Kartu Presensi Resmi Santri • Simpan & Tunjukkan ke Pengajar',
        canvas.width / 2,
        750
      );

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `kartu-santri-${student.fullName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download card error:', err);
      toast.error('Gagal mengunduh kartu QR santri.');
    } finally {
      setIsGeneratingCardImage(false);
    }
  };

  const handlePrintCard = () => {
    if (!childQrDataUrl) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      toast.warning(
        'Popup diblokir oleh browser. Izinkan popup untuk mencetak kartu santri.'
      );
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak Kartu Santri - ${student.fullName}</title>
          <style>
            @page { size: 85mm 125mm; margin: 0; }
            @media print {
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #ffffff;
              margin: 0;
              padding: 16px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .card {
              width: 80mm;
              height: 118mm;
              border: 2px solid #cbd5e1;
              border-radius: 12px;
              overflow: hidden;
              background: #ffffff;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              text-align: center;
              position: relative;
            }
            .header { background: #059669; color: #ffffff; padding: 12px 8px; }
            .header h1 { margin: 0; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
            .header p { margin: 2px 0 0 0; font-size: 10px; opacity: 0.9; letter-spacing: 0.5px; }
            .body { padding: 10px 14px; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
            .name { font-size: 15px; font-weight: bold; color: #0f172a; margin: 4px 0 2px 0; line-height: 1.2; }
            .meta { font-size: 11px; color: #059669; font-weight: 600; margin: 0; }
            .submeta { font-size: 10px; color: #64748b; margin: 2px 0 8px 0; }
            .qr-container { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px; display: inline-block; }
            .qr-img { width: 160px; height: 160px; display: block; }
            .student-id { font-family: monospace; font-size: 9px; color: #475569; margin-top: 4px; }
            .footer { font-size: 9px; color: #64748b; margin-top: 6px; border-top: 1px dashed #e2e8f0; padding-top: 6px; width: 100%; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Sistem Pengajian</h1>
              <p>GENERASI PENERUS</p>
            </div>
            <div class="body">
              <div>
                <div class="name">${student.fullName}</div>
                <div class="meta">Generasi: ${student.generationName || 'Santri'}</div>
                <div class="submeta">${student.className ? student.className + ' • ' : ''}${student.organizationName || 'Kelompok Binaan'}</div>
              </div>
              <div>
                <div class="qr-container">
                  <img class="qr-img" src="${childQrDataUrl}" alt="QR Santri" />
                </div>
                <div class="student-id">ID: ${student.id.slice(0, 18)}...</div>
              </div>
              <div class="footer">
                Kartu Presensi Resmi Santri • Tunjukkan ke Pengajar Sesi
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Kartu QR Santri"
      className="!mt-0 fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGeneratingCardImage) onClose();
      }}
    >
      <div
        ref={modalPanelRef}
        className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Kartu QR Santri</h3>
              <p className="text-xs text-slate-500">Kartu identitas presensi santri</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kartu QR"
            className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 bg-slate-50 flex flex-col items-center">
          <div className="w-full max-w-[280px] bg-white rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden text-center flex flex-col">
            <div className="bg-emerald-600 text-white p-3">
              <h4 className="text-xs font-black tracking-wider uppercase">Sistem Pengajian</h4>
              <p className="text-xs text-emerald-100 font-semibold tracking-widest mt-0.5">
                GENERASI QUR&apos;ANI
              </p>
            </div>

            <div className="p-3 pb-2">
              <div className="w-11 h-11 mx-auto rounded-full bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center border-2 border-white shadow-2xs mb-2">
                {student.fullName.slice(0, 2).toUpperCase()}
              </div>
              <h5 className="font-extrabold text-sm text-slate-900 leading-tight">
                {student.fullName}
              </h5>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {student.generationName || 'Santri'}
              </p>
              <p className="text-xs text-slate-500">
                {student.className ? `${student.className} • ` : ''}
                {student.organizationName || 'Kelompok Binaan'}
              </p>
            </div>

            <div className="px-4 py-2 flex flex-col items-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 inline-block shadow-inner">
                {childQrDataUrl ? (
                  <img
                    src={childQrDataUrl}
                    alt="QR Santri"
                    className="w-40 h-40 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">
                ID: {student.id.slice(0, 16)}...
              </p>
            </div>

            <div className="py-2 px-3 border-t border-dashed border-slate-200 text-xs text-slate-600 bg-slate-50/50">
              Tunjukkan kartu ini kepada Ustadz pengampu
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-blue-900 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              Kartu ini dapat dicetak (standar ID card) atau disimpan di HP untuk di-scan oleh pengajar jika anak tidak membawa smartphone.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintCard}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kartu</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCardPng}
            disabled={isGeneratingCardImage}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isGeneratingCardImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isGeneratingCardImage ? 'Menyiapkan...' : 'Download PNG'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
