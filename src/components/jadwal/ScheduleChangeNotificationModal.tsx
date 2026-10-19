'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  BellOff,
  Send,
  Loader2,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { confirmAndDispatchScheduleChangeNotification } from '@/app/(protected)/jadwal/actions';

export interface ScheduleNotificationData {
  scheduleId: string;
  scheduleTitle: string;
  organizationName: string;
  changeDescription: string;
  previewMessage: string;
  dayDateStr: string;
  timeRangeStr: string;
  venueName: string;
  teacherNames: string;
  estimatedRecipientsCount: number;
  isUrgentShortNotice?: boolean;
  warningMessage?: string;
}

interface ScheduleChangeNotificationModalProps {
  isOpen: boolean;
  data: ScheduleNotificationData | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ScheduleChangeNotificationModal({
  isOpen,
  data,
  onClose,
  onSuccess,
}: ScheduleChangeNotificationModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  if (!isOpen || !data) return null;

  const handleMute = () => {
    setStatusFeedback({
      type: 'info',
      message: 'Notifikasi dibisukan. Pesan perubahan tidak dikirim ke pengguna.',
    });
    setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleSend = async () => {
    setIsSending(true);
    setStatusFeedback(null);

    try {
      const res = await confirmAndDispatchScheduleChangeNotification({
        scheduleId: data.scheduleId,
        changeDescription: data.changeDescription,
      });

      if ('error' in res && res.error) {
        setStatusFeedback({
          type: 'error',
          message: String(res.error),
        });
        setIsSending(false);
      } else {
        const successMsg =
          'message' in res && typeof res.message === 'string'
            ? res.message
            : 'Notifikasi perubahan jadwal berhasil dikirimkan.';
        setStatusFeedback({
          type: 'success',
          message: successMsg,
        });
        setIsSending(false);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat mengirim notifikasi.',
      });
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs border border-emerald-200/80">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Konfirmasi Notifikasi WhatsApp
              </h3>
              <p className="text-xs text-slate-500">
                Perubahan jadwal tersimpan. Konfirmasi pengiriman pesan ke peserta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleMute}
            disabled={isSending}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors disabled:opacity-50"
            title="Tutup / Bisukan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Status Feedback Toast/Banner jika ada */}
          {statusFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2.5 transition-all ${
                statusFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusFeedback.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {statusFeedback.type === 'success' ? (
                <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusFeedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-slate-600 shrink-0" />
              )}
              <span>{statusFeedback.message}</span>
            </div>
          )}

          {/* Soft-Warning Banner untuk Perubahan Mendadak (< 5 Jam) */}
          {data.isUrgentShortNotice && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300/80 text-amber-900 flex items-start gap-3 shadow-2xs animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold flex items-center gap-1.5 text-amber-950">
                  Peringatan: Perubahan Mendadak (&lt; 5 Jam)
                </span>
                <p className="text-amber-800/90 text-[11px] leading-relaxed">
                  {data.warningMessage ||
                    'Perubahan jadwal dilakukan kurang dari 5 jam sebelum waktu pelaksanaan. Kirimkan pesan WhatsApp hanya jika bersifat mendesak/darurat bagi peserta, atau pilih Bisukan jika tidak ingin mengirim pesan WA.'}
                </p>
              </div>
            </div>
          )}

          {/* Target Audience Pill & Auto-Revoke Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold block">Estimasi Penerima:</span>
                <span className="text-slate-500">
                  ~{data.estimatedRecipientsCount} Peserta (Guru, Ortu, Santri)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-emerald-800">
              <CheckCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-semibold block">Penarikan Pesan Lama:</span>
                <span className="text-emerald-700/80">
                  Pesan H-1 / H-2 lama otomatis ditarik jika ada
                </span>
              </div>
            </div>
          </div>

          {/* WhatsApp Chat Preview Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Preview Pesan WhatsApp yang Akan Dikirim:
              </span>
              <span className="text-[11px] text-slate-400">Template Resmi Sistem</span>
            </div>

            <div className="bg-[#EFEAE2] dark:bg-slate-900/90 rounded-xl p-3 border border-slate-200 shadow-inner max-h-64 overflow-y-auto">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-xs border border-slate-200/60 max-w-[95%] space-y-2">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between border-b border-slate-100 pb-1">
                  <span>Sistem Pengajian {data.organizationName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Hari-H Alert</span>
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {data.previewMessage}
                </div>
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                  <span>Sekarang</span>
                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Schedule Reference */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {data.dayDateStr}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {data.timeRangeStr}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {data.venueName}
            </span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleMute}
            disabled={isSending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <BellOff className="w-4 h-4 text-slate-500" />
            <span>Bisukan (Jangan Kirim)</span>
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
              data.isUrgentShortNotice
                ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-md shadow-amber-600/25'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/20'
            }`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengirimkan Pesan...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{data.isUrgentShortNotice ? 'Kirim Pesan Darurat' : 'Kirimkan Pesan'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
