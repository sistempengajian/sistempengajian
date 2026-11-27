'use client';

import React, { useState } from 'react';
import {
  Activity,
  ThumbsUp,
  QrCode,
  AlertTriangle,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react';
import type { UiTelemetrySummary } from '@/lib/telemetry';

interface AdminTelemetryOverviewCardProps {
  initialSummary: UiTelemetrySummary;
}

const REASON_LABELS: Record<string, string> = {
  SMALL_TEXT: 'Tulisan kekecilan',
  SMALL_BUTTON: 'Tombol susah diklik',
  HARD_TO_FIND: 'Bingung cari menu',
  SLOW: 'Lambat / Macet',
};

/**
 * Ringkasan telemetri friksi UI & Micro-CSAT (khusus ADMIN_MASTER) untuk evaluasi
 * bulanan kondisi lapangan / pencahayaan masjid tanpa biaya pihak ketiga.
 */
export default function AdminTelemetryOverviewCard({
  initialSummary,
}: AdminTelemetryOverviewCardProps) {
  const [summary, setSummary] = useState<UiTelemetrySummary>(initialSummary);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/telemetry/ui?days=30', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as UiTelemetrySummary;
        setSummary(data);
      }
    } catch {
      // Abaikan error refresh sementara
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <section
      aria-label="Ringkasan Telemetri UI dan Micro-CSAT"
      className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Telemetri Friksi UI &amp; Micro-CSAT ({summary.daysWindow} Hari)
            </h3>
            <p className="text-xs text-slate-600">
              Pemantauan kualitas pengalaman mobile untuk evaluasi bulanan pengajian
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Muat Ulang Metrik</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Skor Micro-CSAT</span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {summary.csat.satisfactionPct !== null ? `${summary.csat.satisfactionPct}%` : '—'}
          </div>
          <p className="text-xs text-slate-600">
            {summary.csat.upCount} Lancar &bull; {summary.csat.downCount} Keluhan
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
            <QrCode className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            <span>Kegagalan Scan QR</span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {summary.qrScans.failureRatePct !== null
              ? `${summary.qrScans.failureRatePct}%`
              : '—'}
          </div>
          <p className="text-xs text-slate-600">
            {summary.qrScans.successCount} sukses / {summary.qrScans.failureCount} gagal
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>ErrorBoundary Hit</span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {summary.errorBoundaries.total}
          </div>
          <p className="text-xs text-slate-600">
            {summary.errorBoundaries.items.length} komponen terdampak
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ArrowLeftRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>Ganti Peran</span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {summary.roleSwitches.total}
          </div>
          <p className="text-xs text-slate-600">
            Klik switcher RoleNavTabs
          </p>
        </div>
      </div>

      {summary.csat.downCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/70 space-y-2">
          <p className="text-xs font-bold text-rose-900">
            Rincian Keluhan Tap Cepat:
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.csat.reasons).map(([key, count]) => (
              <span
                key={key}
                className="px-2.5 py-1 rounded-full bg-white border border-rose-200 text-xs font-semibold text-rose-800"
              >
                {REASON_LABELS[key] || key}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
