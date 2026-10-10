'use client';

import React, { useState, useTransition, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { requestWhatsAppMagicLogin, getWhatsAppLoginCooldown, checkLoginTokenStatus, login, loginAsDemoUser } from '../actions';
import { createClient } from '@/lib/supabase/client';
import {
  Phone,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  Send,
  ShieldCheck,
  Loader2,
  Zap,
} from 'lucide-react';
import { displayPhoneNumber } from '@/lib/whatsapp/utils';

interface DemoAccount {
  role: string;
  name: string;
  phone: string;
  email: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'Santri (Caberawit)', name: 'Farhan Fauzi', phone: '081299990003', email: 'santri.farhan@pengajian.app' },
  { role: 'Orang Tua / Wali', name: 'H. Ahmad Syukron', phone: '081299990001', email: 'ayah.ahmad@gmail.com' },
  { role: 'Pengajar (Ustadz)', name: 'Ustadz Abdullah S.Pd.I', phone: '081255556666', email: 'pj.kelompok@pengajian.app' },
  { role: 'Wali Kelas', name: 'Ustadzah Khadijah', phone: '081277778888', email: 'walikelas@pengajian.app' },
  { role: 'PJ Kelompok', name: 'Ustadz Abdullah (Klender)', phone: '081255556666', email: 'pj.kelompok@pengajian.app' },
  { role: 'PJ Desa', name: 'Ustadz Ridwan (Duren Sawit)', phone: '081233334444', email: 'pj.desa@pengajian.app' },
  { role: 'PJ Daerah', name: 'Drs. H. Mansur (Jaktim)', phone: '081211112222', email: 'pj.daerah@pengajian.app' },
  { role: 'Admin Master', name: 'Admin Master Pusat', phone: '081100000001', email: 'admin@pengajian.app' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const authError = searchParams.get('auth_error');

  // Login Mode: 'whatsapp' (default) | 'password' (fallback)
  const [loginMode, setLoginMode] = useState<'whatsapp' | 'password'>('whatsapp');

  // WhatsApp Magic Link States
  const [phone, setPhone] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [sentSuccessInfo, setSentSuccessInfo] = useState<{
    phone: string;
    userName?: string;
  } | null>(null);
  const [activeLoginToken, setActiveLoginToken] = useState<string | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);

  // Email / Password Fallback States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Google OAuth State
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // General Status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tangkap pesan error dari redirect URL (misal akun Google belum ditautkan)
  useEffect(() => {
    if (authError) {
      setErrorMessage(decodeURIComponent(authError));
      window.history.replaceState({}, '', '/login');
    }
  }, [authError]);

  // Cooldown countdown timer interval
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Real-time Auto-Detection: Otomatis mendeteksi saat link WhatsApp diklik (Cross-window, visibility, polling)
  useEffect(() => {
    if (!sentSuccessInfo || !activeLoginToken || isAutoLoggingIn) return;

    let isMounted = true;
    let isChecking = false;

    const verifySessionStatus = async () => {
      if (isChecking || !isMounted) return;
      isChecking = true;
      try {
        const res = await checkLoginTokenStatus(activeLoginToken);
        if (res.isVerified && isMounted) {
          setIsAutoLoggingIn(true);
          setTimeout(() => {
            window.location.href = redirectTo;
          }, 600);
        }
      } catch (e) {
        // Abaikan kegagalan jaringan saat background polling
      } finally {
        isChecking = false;
      }
    };

    // 1. Background Polling setiap 2 detik
    const interval = setInterval(verifySessionStatus, 2000);

    // 2. Trigger instan saat pengguna kembali ke PWA dari WhatsApp (visibility / focus)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        verifySessionStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 3. Trigger instan via BroadcastChannel & LocalStorage Event dari tab browser
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('sipanji_auth_channel');
        channel.onmessage = (event) => {
          if (event.data?.type === 'LOGIN_SUCCESS') {
            verifySessionStatus();
          }
        };
      }
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sipanji_auth_sync') {
        verifySessionStatus();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorage);
      try {
        channel?.close();
      } catch {}
    };
  }, [sentSuccessInfo, activeLoginToken, isAutoLoggingIn, redirectTo]);

  // Cek status verifikasi secara manual jika pengguna menekan tombol "Sudah Klik Link"
  const handleManualCheckStatus = async () => {
    if (!activeLoginToken || isManualChecking || isAutoLoggingIn) return;
    setIsManualChecking(true);
    setErrorMessage(null);
    try {
      const res = await checkLoginTokenStatus(activeLoginToken);
      if (res.isVerified) {
        setIsAutoLoggingIn(true);
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 500);
      } else {
        setErrorMessage(
          'Tautan belum diklik atau sesi masih dalam proses di WhatsApp. Silakan klik tautan di WhatsApp terlebih dahulu.'
        );
      }
    } catch {
      setErrorMessage('Terjadi gangguan koneksi saat memeriksa status login.');
    } finally {
      setIsManualChecking(false);
    }
  };

  // Cek cooldown otomatis saat nomor telepon berubah (setelah 10 digit)
  const handlePhoneBlur = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 9) {
      const res = await getWhatsAppLoginCooldown(cleaned);
      if (res.cooldownRemaining > 0) {
        setCooldownSeconds(res.cooldownRemaining);
      }
    }
  };

  // Format Cooldown Label (MM:SS)
  const formatCooldown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Submit WhatsApp Magic Link Request
  const handleWhatsAppSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (cooldownSeconds > 0) {
      setErrorMessage(
        `Pengiriman masih dalam masa jeda. Silakan tunggu ${formatCooldown(cooldownSeconds)} lagi.`
      );
      return;
    }

    startTransition(async () => {
      const res = await requestWhatsAppMagicLogin(phone);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal mengirim link masuk WhatsApp.');
        if (res.cooldownRemaining && res.cooldownRemaining > 0) {
          setCooldownSeconds(res.cooldownRemaining);
        }
      } else {
        setSentSuccessInfo({
          phone: res.targetPhone || phone,
          userName: res.userName,
        });
        setActiveLoginToken(res.loginToken || null);
        setCooldownSeconds(res.cooldownRemaining || 300);
      }
    });
  };

  // Submit Password Fallback
  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('redirectTo', redirectTo);

    startTransition(async () => {
      const res = await login(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  // Submit Sign in with Google
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const callbackRedirect = `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackRedirect,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('[Google Sign-In Error]:', error);
        setErrorMessage(
          'Google Provider belum aktif di Supabase Dashboard (400 Bad Request). Silakan gunakan login via WhatsApp.'
        );
        setIsGoogleLoading(false);
      }
    } catch (err: any) {
      console.error('[Google Sign-In Exception]:', err);
      setErrorMessage(err.message || 'Gagal memulai masuk dengan Google.');
      setIsGoogleLoading(false);
    }
  };

  // Instant Demo Login State
  const [instantLoadingRole, setInstantLoadingRole] = useState<string | null>(null);

  // Quick Demo Account Selector (Fill inputs)
  const handleSelectDemo = (account: DemoAccount) => {
    setPhone(account.phone);
    setEmail(account.email);
    setPassword('DemoPassword2026!');
    setErrorMessage(null);
    setSentSuccessInfo(null);

    // Cek apakah akun demo sedang dalam cooldown
    getWhatsAppLoginCooldown(account.phone).then((res) => {
      if (res.cooldownRemaining > 0) {
        setCooldownSeconds(res.cooldownRemaining);
      } else {
        setCooldownSeconds(0);
      }
    });
  };

  // 1-Click Instant Demo Login (Direct dashboard access for testing)
  const handleInstantDemoLogin = (e: React.MouseEvent, account: DemoAccount) => {
    e.stopPropagation();
    setInstantLoadingRole(account.role);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await loginAsDemoUser(account.phone);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk akun demo.');
        setInstantLoadingRole(null);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <div>
      {/* Header Banner */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold mb-2.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Login Aman Tanpa Password</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Masuk ke Portal Pengajian
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {loginMode === 'whatsapp'
            ? 'Cukup masukkan nomor WhatsApp aktif Anda untuk menerima tautan masuk instan (1x pakai).'
            : 'Masuk menggunakan alamat email atau username terdaftar beserta kata sandi.'}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs leading-relaxed animate-in fade-in">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Perhatian</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Mode 1: WhatsApp Magic Link Form (Default & Recommended) */}
      {loginMode === 'whatsapp' && (
        <div>
          {/* Card Notifikasi Berhasil Terkirim */}
          {sentSuccessInfo ? (
            isAutoLoggingIn ? (
              <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/25 flex items-center gap-3.5 animate-in zoom-in-95">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-base text-white">
                    Login Terverifikasi!
                  </h4>
                  <p className="text-xs text-emerald-100 mt-0.5 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Membuka Dashboard SiPanji secara otomatis...</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 text-emerald-900 animate-in zoom-in-95 space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-emerald-950 mb-1">
                      Tautan Masuk Terkirim ke WhatsApp!
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Link verifikasi telah dikirim ke nomor{' '}
                      <strong className="text-emerald-950 font-mono font-bold">
                        {sentSuccessInfo.phone}
                      </strong>
                      {sentSuccessInfo.userName ? ` (${sentSuccessInfo.userName})` : ''}.
                    </p>
                  </div>
                </div>

                {/* Status Deteksi Realtime */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-100/70 border border-emerald-200/80 text-emerald-900 text-xs font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  <span className="truncate">Menunggu Anda mengklik tautan di WhatsApp...</span>
                </div>

                {/* Petunjuk Pengguna Awam / PWA */}
                <div className="p-3 rounded-xl bg-white/90 border border-emerald-200/70 text-[11px] text-emerald-900 space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Petunjuk Masuk Cepat:</span>
                  </div>
                  <p>1. Buka pesan WhatsApp dan klik link masuk resmi SiPanji.</p>
                  <p>2. Kembali ke aplikasi ini — halaman akan <strong>otomatis masuk ke Dashboard</strong> tanpa perlu di-refresh manual!</p>
                </div>

                {/* Tombol Cek Masuk Manual jika Pengguna Ingin Langsung Lanjut */}
                <button
                  type="button"
                  onClick={handleManualCheckStatus}
                  disabled={isManualChecking}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isManualChecking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>Sudah Klik Link di WhatsApp? Masuk Sekarang</span>
                </button>

                {/* Baris Kirim Ulang dengan Jeda Waktu */}
                <div className="pt-3 border-t border-emerald-200/70 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Jeda Kirim Ulang:{' '}
                      <strong className="font-mono text-xs text-emerald-900">
                        {cooldownSeconds > 0 ? formatCooldown(cooldownSeconds) : 'Siap'}
                      </strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e: any) => handleWhatsAppSubmit(e)}
                    disabled={isPending || cooldownSeconds > 0}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 text-emerald-800 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
                    <span>
                      {cooldownSeconds > 0
                        ? `Tunggu ${formatCooldown(cooldownSeconds)}`
                        : 'Kirim Ulang'}
                    </span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleWhatsAppSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="phone">
                  Nomor WhatsApp Terdaftar
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Gunakan format nomor lokal (08...) atau internasional (628...).
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending || cooldownSeconds > 0}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengirim Link WhatsApp...</span>
                  </>
                ) : cooldownSeconds > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Jeda Kirim Ulang ({formatCooldown(cooldownSeconds)})</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Link Masuk via WhatsApp</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Mode 2: Password Fallback Form */}
      {loginMode === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
              Alamat Email atau Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@pengajian.app"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                Kata Sandi
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isPending ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* Divider: Atau Masuk dengan Google */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
          <span className="bg-white px-3 text-slate-400">atau</span>
        </div>
      </div>

      {/* Tombol Sign in with Google */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isPending || isGoogleLoading}
        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-xs sm:text-sm shadow-2xs active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
        title="Masuk menggunakan akun Google yang sudah ditautkan di profil"
      >
        {isGoogleLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            <span>Menghubungkan ke Google...</span>
          </>
        ) : (
          <>
            {/* Official Google Logo */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Lanjutkan dengan Google</span>
          </>
        )}
      </button>

      {/* Mode Switcher Toggle */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setLoginMode(loginMode === 'whatsapp' ? 'password' : 'whatsapp');
            setErrorMessage(null);
          }}
          className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-4 decoration-emerald-300 hover:decoration-emerald-600 transition-all cursor-pointer"
        >
          {loginMode === 'whatsapp'
            ? 'Masuk dengan Email & Kata Sandi'
            : '← Gunakan WhatsApp Magic Link (Tanpa Sandi)'}
        </button>
      </div>

      {/* Security Note */}
      <p className="text-[11px] text-slate-400 text-center mt-6">
        Otentikasi dilindungi pembatasan 1x pakai &amp; sinkronisasi database pengguna
      </p>

      {/* Demo Account Quick Selector (Hanya aktif di mode pengembangan / development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 pt-6 border-t border-slate-200/80">
          <div className="flex items-center justify-between gap-1.5 text-xs font-bold text-slate-700 mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Pilih Akun Demo Uji Coba:</span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Klik Masuk Cepat untuk demo instan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DEMO_ACCOUNTS.map((account) => {
              const isSelected = phone === account.phone;
              const isLoading = instantLoadingRole === account.role;
              return (
                <div
                  key={account.role}
                  onClick={() => handleSelectDemo(account)}
                  className={`p-3 rounded-2xl border transition-all text-xs flex flex-col justify-between gap-2.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                      : 'border-slate-200/80 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-200 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 leading-tight">
                        {account.role}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{displayPhoneNumber(account.phone)}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
                      {account.name}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleInstantDemoLogin(e, account)}
                    disabled={isPending}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Masuk Demo...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                        <span>Masuk Cepat (Demo)</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat halaman masuk...</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
