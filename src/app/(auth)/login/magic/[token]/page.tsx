'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { verifyWhatsAppMagicToken } from '@/app/(auth)/actions';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  PhoneCall,
} from 'lucide-react';
import Link from 'next/link';

interface MagicLoginPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function MagicLoginVerificationPage({ params }: MagicLoginPageProps) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAlreadyUsed, setIsAlreadyUsed] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verify() {
      if (!token) {
        setStatus('error');
        setErrorMessage('Tautan masuk tidak memiliki token yang valid.');
        return;
      }

      try {
        const result = await verifyWhatsAppMagicToken(token);

        if (!isMounted) return;

        if (result.success) {
          setStatus('success');
          setUserName(result.userName || 'Pengguna');

          // 1. Beritahu PWA / tab lain secara real-time via BroadcastChannel & localStorage
          try {
            localStorage.setItem('sipanji_auth_sync', Date.now().toString());
            if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
              const ch = new BroadcastChannel('sipanji_auth_channel');
              ch.postMessage({ type: 'LOGIN_SUCCESS', userName: result.userName });
              ch.close();
            }
          } catch (e) {
            // Ignore channel errors
          }

          // 2. Redirect otomatis ke dashboard setelah 2.5 detik
          setTimeout(() => {
            router.push('/dashboard');
          }, 2500);
        } else {
          setStatus('error');
          setErrorMessage(result.error || 'Gagal memverifikasi tautan masuk.');
          if (result.isUsed) setIsAlreadyUsed(true);
          if (result.isExpired) setIsExpired(true);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('error');
        setErrorMessage(err.message || 'Terjadi kesalahan saat memverifikasi tautan masuk.');
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token, router]);

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      {/* State 1: Verifikasi Berjalan */}
      {status === 'verifying' && (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-8 border border-slate-200/80 shadow-xl text-center flex flex-col items-center animate-fade-in">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 animate-pulse">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-emerald-500/30 border-t-emerald-600 animate-spin" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Memverifikasi Tautan Masuk
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xs">
            Mohon tunggu sebentar, sistem sedang mengamankan sesi otentikasi WhatsApp Anda...
          </p>

          <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium bg-slate-50 px-3.5 py-1.5 rounded-full border border-slate-200/60">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>Single-Use Magic Link Protection</span>
          </div>
        </div>
      )}

      {/* State 2: Berhasil Masuk */}
      {status === 'success' && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 border border-emerald-200 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-5 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-1">
            Masuk Berhasil!
          </h2>
          <p className="text-sm font-semibold text-emerald-700 mb-2">
            Ahlan wa Sahlan, {userName}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-4">
            Tautan telah terverifikasi dan sesi login Anda telah aktif.
          </p>

          {/* Kartu Khusus Panduan Pengguna Aplikasi (PWA) */}
          <div className="w-full p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-left mb-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sudah Memasang Aplikasi SiPanji di HP?</span>
            </div>
            <p className="text-[11px] text-emerald-800/90 leading-relaxed">
              Anda bisa langsung kembali membuka ikon <strong>SiPanji</strong> di Layar Utama HP Anda. Aplikasi telah otomatis masuk tanpa perlu login ulang!
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Lanjut di Browser Ini (Buka Dashboard)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* State 3: Gagal / Kedaluwarsa / Sudah Dipakai */}
      {status === 'error' && (
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 border border-rose-200 shadow-xl text-center flex flex-col items-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-6">
            {isExpired ? (
              <Clock className="w-8 h-8 text-amber-500" />
            ) : isAlreadyUsed ? (
              <ShieldCheck className="w-8 h-8 text-rose-500" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            {isAlreadyUsed
              ? 'Tautan Sudah Pernah Digunakan'
              : isExpired
              ? 'Tautan Masuk Kedaluwarsa'
              : 'Gagal Masuk'}
          </h2>

          <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 text-rose-700 text-xs text-left mb-6 w-full leading-relaxed">
            {errorMessage}
          </div>

          <div className="space-y-2.5 w-full">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Minta Link Masuk WhatsApp Baru</span>
            </Link>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center"
            >
              <span>Kembali ke Halaman Masuk</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
