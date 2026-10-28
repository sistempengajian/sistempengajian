'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Copy,
  Check,
  Send,
  ExternalLink,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { PerformerStudentItem } from '@/app/(protected)/analisis/types';
import {
  getStudentEvaluationLinkAction,
  sendEvaluationViaWahaAction,
} from '@/app/(protected)/analisis/actions';

interface ShareEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: PerformerStudentItem | null;
  isPrivacyMode: boolean;
}

export default function ShareEvaluationModal({
  isOpen,
  onClose,
  student,
  isPrivacyMode,
}: ShareEvaluationModalProps) {
  const [loading, setLoading] = useState(false);
  const [evaluationUrl, setEvaluationUrl] = useState('');
  const [messageText, setMessageText] = useState('');
  const [parentPhone, setParentPhone] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [wahaSending, setWahaSending] = useState(false);
  const [wahaStatus, setWahaStatus] = useState<{
    sent: boolean;
    success?: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && student) {
      setLoading(true);
      setWahaStatus(null);
      setIsCopied(false);

      getStudentEvaluationLinkAction(student.studentId)
        .then((res) => {
          if (res.success && res.url) {
            setEvaluationUrl(res.url);
            setMessageText(res.messageText || '');
            setParentPhone(res.parentPhone || student.parentPhone || null);
          }
        })
        .catch((err) => {
          console.error('Error fetching evaluation link:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setEvaluationUrl('');
      setMessageText('');
      setWahaStatus(null);
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const displayName = isPrivacyMode
    ? student.fullName.replace(/(?<=.).(?=.)/g, '*')
    : student.fullName;

  const handleCopy = async () => {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!parentPhone) return;
    const formattedPhone = parentPhone.startsWith('0') ? '62' + parentPhone.slice(1) : parentPhone;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendViaWaha = async () => {
    setWahaSending(true);
    setWahaStatus(null);

    try {
      const res = await sendEvaluationViaWahaAction(student.studentId);
      if (res.success) {
        setWahaStatus({ sent: true, success: true });
      } else {
        setWahaStatus({ sent: true, success: false, error: res.error || 'Gagal mengirim pesan WAHA.' });
      }
    } catch (err: any) {
      setWahaStatus({
        sent: true,
        success: false,
        error: err.message || 'Terjadi kesalahan saat memicu gateway WAHA.',
      });
    } finally {
      setWahaSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200/60">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Kirim Lembar Evaluasi via WhatsApp
              </h3>
              <p className="text-[11px] text-slate-500">
                Santri: <strong className="text-slate-700">{displayName}</strong>
                {student.className ? ` (${student.className})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Isi Modal: Preview Teks Pesan & Link */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs font-medium">Membuat tautan evaluasi zero-login...</span>
            </div>
          ) : (
            <>
              {/* Preview Box Pesan */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Format Pesan Siap Kirim (Dilengkapi Tautan Zero-Login):
                </span>
                <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-200/70 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all">
                  {messageText || 'Memuat pesan...'}
                </div>
              </div>

              {/* Status WAHA Feedback */}
              {wahaStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    wahaStatus.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {wahaStatus.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Berhasil dikirim ke nomor WhatsApp orang tua melalui WAHA!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{wahaStatus.error}</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2 rounded-b-3xl">
          <div className="w-full sm:w-auto flex items-center gap-2">
            {/* Tombol Salin Pesan */}
            <button
              type="button"
              disabled={loading || !messageText}
              onClick={handleCopy}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Pesan</span>
                </>
              )}
            </button>

            {/* Tombol Buka Lembar Evaluasi Langsung */}
            {evaluationUrl && (
              <a
                href={evaluationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all"
                title="Buka pratinjau lembar evaluasi di tab baru"
              >
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Pratinjau Lembar</span>
              </a>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {/* Tombol Kirim via WAHA Gateway */}
            <button
              type="button"
              disabled={loading || wahaSending || !parentPhone}
              onClick={handleSendViaWaha}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {wahaSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Kirim via WAHA</span>
            </button>

            {/* Tombol Buka WhatsApp Web / App */}
            {parentPhone && (
              <button
                type="button"
                disabled={loading || !messageText}
                onClick={handleOpenWhatsApp}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
