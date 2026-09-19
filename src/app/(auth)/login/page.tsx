'use client';

import React, { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '../actions';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Santri (Caberawit)', email: 'santri.farhan@pengajian.app', name: 'Farhan Fauzi' },
  { role: 'Orang Tua / Wali', email: 'ayah.ahmad@gmail.com', name: 'Bapak H. Ahmad' },
  { role: 'Pengajar (Ustadz)', email: 'pj.kelompok@pengajian.app', name: 'Ustadz Abdullah' },
  { role: 'Wali Kelas', email: 'walikelas@pengajian.app', name: 'Ustadzah Khadijah' },
  { role: 'PJ Kelompok', email: 'pj.kelompok@pengajian.app', name: 'PJ Kelompok Klender' },
  { role: 'PJ Desa', email: 'pj.desa@pengajian.app', name: 'PJ Desa Duren Sawit' },
  { role: 'PJ Daerah', email: 'pj.daerah@pengajian.app', name: 'PJ Daerah Jakarta Timur' },
  { role: 'Admin Master', email: 'admin@pengajian.app', name: 'Admin Master Pusat' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('DemoPassword2026!');
    setErrorMessage(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Selamat Datang Kembali</h2>
        <p className="text-sm text-slate-500 mt-1">
          Masuk ke akun Anda untuk mengakses portal pengajian &amp; pembinaan.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Input */}
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

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
              Kata Sandi
            </label>
            <span className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium">
              Lupa sandi?
            </span>
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
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {isPending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Masuk Sekarang
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Demo Account Quick Selector */}
      <div className="mt-8 pt-6 border-t border-slate-200/80">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Demo Akun Peran (Klik Cepat):</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.role}
              type="button"
              onClick={() => handleSelectDemo(account.email)}
              className="text-left p-2.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-xs group"
            >
              <div className="font-semibold text-slate-700 group-hover:text-emerald-800 leading-tight">
                {account.role}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {account.name}
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-3">
          Sistem menggunakan SSR HttpOnly cookies &amp; Edge Rate Limiter
        </p>
      </div>
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
