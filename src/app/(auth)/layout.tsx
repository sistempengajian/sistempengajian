import React from 'react';
import Link from 'next/link';
import { BookOpen, Sparkles } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/70 via-slate-50 to-indigo-50/50 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Background Decorative Blobs */}
      <div className="fixed top-12 left-10 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-12 right-10 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                Sistem Pengajian
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Sparkles className="w-2.5 h-2.5" /> PWA
                </span>
              </h1>
              <p className="text-xs text-slate-500">Pembinaan Generasi Qur&apos;ani</p>
            </div>
          </Link>
        </div>

        {/* Card Body */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          {children}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p>© 2026 Sistem Pengajian Terpadu • Berstandar PWA & Zero-Trust RLS</p>
        </div>
      </div>
    </div>
  );
}
