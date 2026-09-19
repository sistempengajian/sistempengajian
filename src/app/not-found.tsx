import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto p-6 bg-white rounded-3xl border border-slate-200 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200/80">
          <FileQuestion className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Tugas atau halaman yang Anda tuju tidak ditemukan atau telah dipindahkan.
        </p>
        <Link
          href="/tugas"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Daftar Tugas
        </Link>
      </div>
    </div>
  );
}
