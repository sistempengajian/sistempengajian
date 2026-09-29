'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone,
  ShieldCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import {
  requestPhoneChangeOtp,
  verifyPhoneChangeOtp,
} from '@/app/(protected)/profil/actions';
import { displayPhoneNumber } from '@/lib/whatsapp/utils';

interface EditPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhone: string | null;
  onSuccess?: (newPhone: string) => void;
}

export default function EditPhoneModal({
  isOpen,
  onClose,
  currentPhone,
  onSuccess,
}: EditPhoneModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [targetPhoneFormatted, setTargetPhoneFormatted] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Timer cooldown countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus on OTP input when entering step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    }
  }, [step]);

  if (!mounted || !isOpen) return null;

  const handleResetModal = () => {
    setStep(1);
    setNewPhoneInput('');
    setOtpInput('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const clean = newPhoneInput.trim().replace(/\D/g, '');
    if (clean.length < 9) {
      setErrorMsg('Nomor WhatsApp baru minimal 9 digit angka.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestPhoneChangeOtp(newPhoneInput);
      if (!res.success) {
        setErrorMsg(res.error || 'Gagal mengirimkan kode verifikasi.');
        if (res.cooldownRemaining) {
          setCooldown(res.cooldownRemaining);
        }
      } else {
        setTargetPhoneFormatted(displayPhoneNumber(res.targetPhone || newPhoneInput));
        setCooldown(res.cooldownRemaining || 60);
        setStep(2);
        setSuccessMsg(res.message || 'Kode verifikasi berhasil dikirim via WhatsApp.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat mengirim kode OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || isLoading) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await requestPhoneChangeOtp(newPhoneInput);
      if (!res.success) {
        setErrorMsg(res.error || 'Gagal mengirim ulang kode.');
        if (res.cooldownRemaining) {
          setCooldown(res.cooldownRemaining);
        }
      } else {
        setCooldown(res.cooldownRemaining || 60);
        setSuccessMsg('Kode verifikasi baru telah dikirim via WhatsApp!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim ulang kode verifikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanOtp = otpInput.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMsg('Masukkan 6 digit angka kode verifikasi yang Anda terima.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyPhoneChangeOtp(newPhoneInput, cleanOtp);
      if (!res.success) {
        setErrorMsg(res.error || 'Kode verifikasi tidak cocok atau telah kedaluwarsa.');
      } else {
        setSuccessMsg(res.message || 'Nomor WhatsApp berhasil diperbarui!');
        setTimeout(() => {
          onSuccess?.(res.newPhone || newPhoneInput);
          handleResetModal();
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memverifikasi kode.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) handleResetModal();
      }}
    >
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 flex flex-col animate-in zoom-in-95">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {step === 1 ? 'Ubah Nomor WhatsApp' : 'Verifikasi Nomor Baru'}
              </h3>
              <p className="text-xs text-slate-500">
                {step === 1
                  ? 'Kirim kode OTP ke nomor baru untuk konfirmasi'
                  : 'Masukkan 6 digit kode yang diterima via WhatsApp'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => !isLoading && handleResetModal()}
            disabled={isLoading}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* STEP 1: Input Nomor WhatsApp Baru */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            {/* Nomor Terdaftar Saat Ini */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                Nomor WhatsApp Saat Ini
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold text-slate-800">
                {displayPhoneNumber(currentPhone)}
              </span>
            </div>

            {/* Input Nomor Baru */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Nomor WhatsApp Baru <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  autoFocus
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="081234567890"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs sm:text-sm font-mono font-bold text-slate-900 transition-all outline-none"
                />
              </div>
            </div>

            {/* Info Security Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-emerald-950 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Sistem akan mengirimkan <strong>6 digit kode OTP verifikasi</strong> melalui chat WhatsApp ke nomor baru ini untuk memastikan nomor aktif dan valid.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetModal}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isLoading || !newPhoneInput.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Kode...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Kode OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Input 6 Digit Kode OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Info Target Nomor */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Kode Dikirim ke WhatsApp
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-700 truncate block">
                  {targetPhoneFormatted || displayPhoneNumber(newPhoneInput)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isLoading}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
              >
                Ubah Nomor
              </button>
            </div>

            {/* Input Kode 6 Digit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block text-center">
                Masukkan 6 Digit Kode Verifikasi
              </label>
              <div className="relative">
                <input
                  ref={otpInputRef}
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpInput(val);
                  }}
                  placeholder="------"
                  className="w-full text-center tracking-[0.4em] py-3 rounded-2xl border-2 border-emerald-300/80 bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 text-xl font-mono font-black text-slate-900 transition-all outline-none"
                />
              </div>
            </div>

            {/* Resend Cooldown Countdown */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs">
              {cooldown > 0 ? (
                <span className="text-slate-400 font-medium">
                  Kirim ulang kode dalam <strong className="text-slate-700 font-mono">{cooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Kirim Ulang Kode OTP</span>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Kembali
              </button>

              <button
                type="submit"
                disabled={isLoading || otpInput.trim().length !== 6}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifikasi...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Verifikasi &amp; Simpan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
