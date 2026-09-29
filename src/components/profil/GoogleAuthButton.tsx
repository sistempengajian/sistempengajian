'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import {
  Mail,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertTriangle,
  X,
  HelpCircle,
  ExternalLink,
  Link2,
  Unlink,
  ShieldAlert,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { updateUserEmail, unlinkUserEmail } from '@/app/(protected)/profil/actions';

interface GoogleAuthButtonProps {
  email: string | null;
  userId?: string;
}

export default function GoogleAuthButton({ email, userId }: GoogleAuthButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; text: string; details?: string } | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const authStatus = searchParams.get('auth_status');
    const authError = searchParams.get('auth_error');

    if (authStatus === 'success') {
      setFeedback({
        type: 'success',
        text: 'Akun Google berhasil ditautkan ke profil Anda!',
      });
      window.history.replaceState({}, '', '/profil');
    } else if (authError) {
      setFeedback({
        type: 'error',
        text: `Gagal menautkan Google: ${decodeURIComponent(authError)}`,
        details: 'Pastikan Google Provider telah diaktifkan di Supabase Dashboard.',
      });
      window.history.replaceState({}, '', '/profil');
    }
  }, [searchParams]);

  const isGoogleLinked = Boolean(email && email.includes('@'));

  // 1. Aksi ketika tombol "Tautkan" diklik
  const handleConnect = async () => {
    setIsLoading(true);
    setFeedback(null);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      // Simpan cookie ID pengguna agar alur callback tahu akun mana yang sedang ditautkan
      if (userId) {
        document.cookie = `pengajian_link_uid=${userId}; path=/; max-age=600; SameSite=Lax`;
      }

      const redirectTo = `${origin}/auth/callback?action=link&next=/profil${userId ? `&link_uid=${userId}` : ''}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('[Google OAuth Error]:', error);
        setFeedback({
          type: 'warning',
          text: 'Google Provider belum diaktifkan di Supabase Dashboard (400 Bad Request).',
          details: 'Anda dapat mengaktifkannya di Supabase console atau memasukkan email secara manual.',
        });
        setIsManualModalOpen(true);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[Google OAuth Exception]:', err);
      setFeedback({
        type: 'warning',
        text: 'Google Provider belum aktif di Supabase Dashboard (400 Bad Request).',
        details: 'Silakan aktifkan Google Provider di console Supabase atau simpan email secara manual.',
      });
      setIsManualModalOpen(true);
      setIsLoading(false);
    }
  };

  // 2. Aksi ketika tombol "Putuskan" diklik (Buka modal konfirmasi)
  const handleOpenUnlink = () => {
    setIsUnlinkModalOpen(true);
  };

  // 3. Eksekusi pemutusan tautan email
  const handleConfirmUnlink = async () => {
    setIsUnlinking(true);
    setFeedback(null);

    try {
      const res = await unlinkUserEmail();
      if (!res.success) {
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal memutuskan tautan email.',
        });
      } else {
        setFeedback({
          type: 'success',
          text: 'Tautan email berhasil diputuskan.',
        });
        setIsUnlinkModalOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem saat memutuskan tautan.',
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  // 4. Simpan email manual (jika Google OAuth belum disetup di Supabase)
  const handleManualEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManual(true);
    setFeedback(null);

    try {
      const res = await updateUserEmail(manualEmail);
      if (!res.success) {
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal menyimpan email.',
        });
      } else {
        setFeedback({
          type: 'success',
          text: 'Email berhasil ditautkan!',
        });
        setIsManualModalOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Terjadi kesalahan sistem.',
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex flex-col gap-1.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-900'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : feedback.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-bold">{feedback.text}</span>
            </div>

            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {feedback.details && (
            <p className="text-[11px] leading-relaxed opacity-90 pl-6">
              {feedback.details}
            </p>
          )}

          {feedback.type === 'warning' && (
            <div className="flex items-center gap-2 pl-6 pt-1">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
              >
                Tautkan Email Manual
              </button>

              <button
                type="button"
                onClick={() => setShowConfigHelp((prev) => !prev)}
                className="text-[11px] font-semibold text-amber-900 underline hover:text-amber-950 cursor-pointer"
              >
                {showConfigHelp ? 'Sembunyikan Panduan' : 'Panduan Supabase'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Supabase Config Help Box */}
      {showConfigHelp && (
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-xs space-y-2.5 shadow-md">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              Cara Mengaktifkan Google OAuth di Supabase
            </span>
            <button
              type="button"
              onClick={() => setShowConfigHelp(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
            <li>
              Buka <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-emerald-400 underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-2.5 h-2.5" /></a> &gt; Pilih Proyek Anda.
            </li>
            <li>Masuk ke menu <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Google</strong>.</li>
            <li>Centang <strong>Enable Google provider</strong>.</li>
            <li>Masukkan <strong>Client ID</strong> &amp; <strong>Client Secret</strong> dari Google Cloud Console.</li>
            <li>Di menu <strong>URL Configuration</strong> &gt; <strong>Redirect URLs</strong>, tambahkan <code>http://localhost:3000/auth/callback</code>.</li>
            <li>Klik <strong>Save</strong>.</li>
          </ol>
        </div>
      )}

      {/* Main Email Row */}
      <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            {/* Official Google SVG Logo */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Alamat Email Akun
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-900 truncate block">
              {email || 'Belum ditautkan email'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {/* Tombol Tautkan / Putuskan */}
          {isGoogleLinked ? (
            <button
              type="button"
              onClick={handleOpenUnlink}
              disabled={isLoading || isUnlinking}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Putuskan tautan email dari akun ini"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Putuskan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-xs transition-all cursor-pointer active:scale-95"
              title="Tautkan akun dengan Google"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                  <span>Menghubungkan...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Tautkan</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Putuskan Tautan Email (Menggunakan React Portal ke document.body) */}
      {mounted &&
        isUnlinkModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isUnlinking) setIsUnlinkModalOpen(false);
            }}
          >
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Putuskan Tautan Email?</h3>
                    <p className="text-[11px] text-slate-500">Konfirmasi pelepasan alamat email akun</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !isUnlinking && setIsUnlinkModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                Apakah Anda yakin ingin memutuskan tautan email <strong className="text-slate-900">{email}</strong> dari akun Sistem Pengajian ini? Anda dapat menautkannya kembali kapan saja.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUnlinkModalOpen(false)}
                  disabled={isUnlinking}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleConfirmUnlink}
                  disabled={isUnlinking}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUnlinking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memutuskan...</span>
                    </>
                  ) : (
                    <>
                      <Unlink className="w-4 h-4" />
                      <span>Ya, Putuskan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal Input Email Manual (Menggunakan React Portal ke document.body) */}
      {mounted &&
        isManualModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSavingManual) setIsManualModalOpen(false);
            }}
          >
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Tautkan Alamat Email</h3>
                    <p className="text-[11px] text-slate-500">Masukkan alamat email Google atau email aktif</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => !isSavingManual && setIsManualModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleManualEmailSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="nama.santri@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm text-slate-900 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    disabled={isSavingManual}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingManual || !manualEmail.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingManual ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>Tautkan Email</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
