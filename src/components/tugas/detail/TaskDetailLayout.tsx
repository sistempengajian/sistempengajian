'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface TaskDetailLayoutProps {
  children: React.ReactNode;
  backLabel?: string;
  backHref?: string;
}

/**
 * Layout wrapper untuk halaman detail tugas
 * Konsisten di semua role: tombol kembali + container centered
 */
export default function TaskDetailLayout({
  children,
  backLabel = 'Kembali ke Daftar Tugas',
  backHref = '/tugas',
}: TaskDetailLayoutProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in">
      {/* Back button */}
      <Link
        href={backHref}
        prefetch={true}
        className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 
          transition-colors mb-4 sm:mb-5 px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100/80"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        {backLabel}
      </Link>

      {/* Main content */}
      {children}
    </div>
  );
}
