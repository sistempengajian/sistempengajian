'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { SURFACE } from '@/lib/design-tokens';
import { trackErrorBoundaryHit } from '@/lib/telemetry-client';

interface ErrorBoundaryProps {
  children: ReactNode;
  sectionName?: string;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Error Boundary modular untuk membungkus client wrapper berat (Kalender, Cockpit Presensi, Laporan, Analitika)
 * agar error runtime tidak meruntuhkan seluruh halaman.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tidak terduga.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.sectionName ? `:${this.props.sectionName}` : ''}]`,
      error,
      errorInfo
    );
    trackErrorBoundaryHit(this.props.sectionName, error?.message);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className={`${SURFACE.card} p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto my-4`}
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center mx-auto shadow-2xs">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">
              {this.props.sectionName
                ? `Gagal Memuat ${this.props.sectionName}`
                : 'Bagian Ini Mengalami Gangguan'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Terjadi kendala sementara saat merender tampilan. Data Anda di server tetap aman.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Muat Ulang Bagian Ini</span>
            </button>

            <Link
              href="/dashboard"
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
