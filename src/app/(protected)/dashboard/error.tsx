'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, UserCheck } from 'lucide-react';
import PageContainer from '@/components/ui/PageContainer';
import { SURFACE, TOUCH_TARGET } from '@/lib/design-tokens';
import { trackErrorBoundaryHit } from '@/lib/telemetry-client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
    trackErrorBoundaryHit('DashboardPage', error?.message);
  }, [error]);

  return (
    <PageContainer variant="standard" className="py-8 sm:py-12">
      <div
        role="alert"
        className={`${SURFACE.card} p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto`}
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center mx-auto shadow-2xs">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Gagal Memuat Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            Terjadi gangguan sementara saat mengambil ringkasan aktivitas pengajian. Data Anda di server tetap aman.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className={`w-full sm:w-auto ${TOUCH_TARGET.minButton} inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95`}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Coba Muat Ulang</span>
          </button>

          <Link
            href="/profil"
            className={`w-full sm:w-auto ${TOUCH_TARGET.minButton} inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-all`}
          >
            <UserCheck className="w-4 h-4" aria-hidden="true" />
            <span>Buka Profil Akun</span>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
