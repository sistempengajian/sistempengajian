'use client';

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, X, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  CSAT_ELIGIBLE_EVENT,
  CsatReason,
  sendUiTelemetry,
} from '@/lib/telemetry-client';

interface MicroCsatPromptProps {
  userId?: string;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const FRICTION_OPTIONS: Array<{ value: CsatReason; label: string }> = [
  { value: 'SMALL_TEXT', label: 'Tulisan kekecilan' },
  { value: 'SMALL_BUTTON', label: 'Tombol susah diklik' },
  { value: 'HARD_TO_FIND', label: 'Bingung cari menu' },
  { value: 'SLOW', label: 'Lambat / Macet' },
];

/**
 * Prompt Micro-CSAT non-intrusif pasca-aksi penting (presensi / paraf tugas)
 * dengan cooldown 14 hari per pengguna agar bebas spam dan hemat kuota.
 */
export default function MicroCsatPrompt({ userId }: MicroCsatPromptProps) {
  const [step, setStep] = useState<'HIDDEN' | 'ASK' | 'REASON' | 'THANKS'>('HIDDEN');
  const [triggerAction, setTriggerAction] = useState<string>('general');
  const storageKey = `sipanji_csat_last_at_${userId || 'guest'}`;

  useEffect(() => {
    const handleEligible = (event: Event) => {
      const customEvent = event as CustomEvent<{ triggerAction?: string }>;
      try {
        const lastShownRaw = window.localStorage.getItem(storageKey);
        if (lastShownRaw) {
          const lastShown = Number(lastShownRaw);
          if (Number.isFinite(lastShown) && Date.now() - lastShown < FOURTEEN_DAYS_MS) {
            return;
          }
        }
      } catch {
        // Fallback jika localStorage diblokir mode private
      }

      // Jangan timpa dialog/sheet lain yang sedang terbuka
      if (document.body.classList.contains('modal-open')) {
        setTimeout(() => {
          if (!document.body.classList.contains('modal-open')) {
            setTriggerAction(customEvent.detail?.triggerAction || 'action');
            setStep('ASK');
          }
        }, 1200);
        return;
      }

      setTriggerAction(customEvent.detail?.triggerAction || 'action');
      setStep('ASK');
    };

    window.addEventListener(CSAT_ELIGIBLE_EVENT, handleEligible);
    return () => window.removeEventListener(CSAT_ELIGIBLE_EVENT, handleEligible);
  }, [storageKey]);

  const markCooldown = () => {
    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // Abaikan jika storage penuh
    }
  };

  const handleDismiss = () => {
    if (step === 'REASON') {
      sendUiTelemetry({
        type: 'CSAT_FEEDBACK',
        rating: 'DOWN',
        triggerAction,
      });
    }
    markCooldown();
    setStep('HIDDEN');
  };

  const handleThumbsUp = () => {
    sendUiTelemetry({
      type: 'CSAT_FEEDBACK',
      rating: 'UP',
      triggerAction,
    });
    markCooldown();
    setStep('THANKS');
    setTimeout(() => setStep('HIDDEN'), 2200);
  };

  const handleSelectReason = (reason: CsatReason) => {
    sendUiTelemetry({
      type: 'CSAT_FEEDBACK',
      rating: 'DOWN',
      reason,
      triggerAction,
    });
    markCooldown();
    setStep('THANKS');
    setTimeout(() => setStep('HIDDEN'), 2400);
  };

  if (step === 'HIDDEN') return null;

  return (
    <aside
      aria-label="Survei singkat kemudahan tampilan"
      role="region"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom)+var(--pwa-banner-clearance,0px))] sm:bottom-6 inset-x-4 max-w-md mx-auto z-[36] animate-slide-up"
    >
      <div className="rounded-2xl bg-white/95 backdrop-blur-xl border border-teal-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.14)] p-3.5 sm:p-4 space-y-3 text-slate-800">
        {step === 'THANKS' ? (
          <div className="flex items-center gap-2.5 text-emerald-800 py-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">
              Jazakumullahu khairan! Masukan Anda membantu peningkatan SiPanji.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/70 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {step === 'ASK'
                      ? 'Apakah tampilan halaman ini mudah digunakan di HP?'
                      : 'Kendala utama yang Anda rasakan?'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {step === 'ASK'
                      ? 'Umpan balik 1-ketukan (muncul maks. 1× per 2 pekan)'
                      : 'Pilih salah satu agar segera kami perbaiki'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Tutup pertanyaan masukan"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 'ASK' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleThumbsUp}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <ThumbsUp className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Lancar &amp; Jelas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('REASON')}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-800 hover:text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <ThumbsDown className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Sulit / Kekecilan</span>
                </button>
              </div>
            )}

            {step === 'REASON' && (
              <div className="grid grid-cols-2 gap-2">
                {FRICTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectReason(opt.value)}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-800 hover:text-rose-900 text-xs font-semibold text-center transition-all active:scale-95 cursor-pointer"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
