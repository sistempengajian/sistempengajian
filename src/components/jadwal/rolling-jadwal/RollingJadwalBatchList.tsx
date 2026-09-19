'use client';

import React, { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Calendar,
  Layers,
  AlertCircle,
  Loader2,
  BookOpen,
  ArrowLeft,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  CalendarCheck,
} from 'lucide-react';
import { deleteRollingJadwalBatch } from '@/app/(protected)/jadwal/rolling-jadwal/actions';
import RollingScheduleGeneratorModal from './RollingScheduleGeneratorModal';
import { getRoleRollingTheme } from '@/lib/theme';

interface BatchItem {
  batchId: string;
  blueprintName: string;
  rollingPengajianId: string | null;
  totalSessions: number;
  firstSession: Date;
  lastSession: Date;
  createdAt: Date;
}

interface Props {
  initialBatches: BatchItem[];
  canManage?: boolean;
  roleCodes?: string[];
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RollingJadwalBatchList({
  initialBatches,
  canManage = true,
  roleCodes = [],
}: Props) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const theme = getRoleRollingTheme(roleCodes);

  // Prefetch rute kalender agar navigasi kembali instan
  useEffect(() => {
    router.prefetch('/jadwal');
  }, [router]);

  function handleDelete(batchId: string, blueprintName: string) {
    if (!confirm(`Hapus semua sesi jadwal dari batch "${blueprintName}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setDeletingId(batchId);
    setError(null);
    startTransition(async () => {
      const res = await deleteRollingJadwalBatch(batchId);
      if (res.success) {
        setBatches((prev) => prev.filter((b) => b.batchId !== batchId));
      } else {
        setError(res.error ?? 'Gagal menghapus batch jadwal');
      }
      setDeletingId(null);
    });
  }

  // Filter batches
  const filteredBatches = batches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.blueprintName.toLowerCase().includes(q) ||
      b.batchId.toLowerCase().includes(q) ||
      formatDate(b.firstSession).toLowerCase().includes(q) ||
      formatDate(b.lastSession).toLowerCase().includes(q)
    );
  });

  const totalAllSessions = batches.reduce((acc, curr) => acc + curr.totalSessions, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Navigation Breadcrumb / Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/jadwal"
            prefetch={true}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Kembali ke Kalender Jadwal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
                Riwayat Batch Jadwal Rolling
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar riwayat batch sesi jadwal yang telah dibuat otomatis ke kalender pengajian wilayah.
            </p>
          </div>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsGeneratorOpen(true)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${theme.card4Button} text-xs font-bold transition-all active:scale-95 shadow-md ${theme.card4ButtonShadow} border ${theme.card4ButtonBorder} cursor-pointer shrink-0`}
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Generate Jadwal Baru</span>
          </button>
        )}
      </div>

      {/* ── Search & Metrics Toolbar ── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama blueprint atau batch ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
            Total Batch: <strong>{batches.length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
            Total Sesi: <strong>{totalAllSessions}</strong>
          </span>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-semibold text-rose-800 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Empty State ── */}
      {filteredBatches.length === 0 && (
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-dashed border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery ? 'Tidak Ada Batch yang Cocok' : 'Belum Ada Riwayat Batch Jadwal Rolling'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              {searchQuery
                ? `Tidak ditemukan batch dengan kata kunci "${searchQuery}". Coba kata kunci lain.`
                : 'Belum ada sesi jadwal yang digenerate. Buat sesi kalender otomatis dari blueprint Pengajian Rolling.'}
            </p>
          </div>
          {canManage && !searchQuery && (
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(true)}
              className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${theme.card4Button} text-xs font-bold transition-all active:scale-95 shadow-md ${theme.card4ButtonShadow} border ${theme.card4ButtonBorder} cursor-pointer`}
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Generate Jadwal Pertama</span>
            </button>
          )}
        </div>
      )}

      {/* ── Batch Cards List ── */}
      {filteredBatches.length > 0 && (
        <div className="space-y-3">
          {filteredBatches.map((batch) => {
            const isDeleting = deletingId === batch.batchId;
            return (
              <div
                key={batch.batchId}
                className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 sm:p-5 hover:border-slate-300 hover:shadow-xs transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left Column: Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <BookOpen className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {batch.blueprintName}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Batch: {batch.batchId.slice(0, 8)}…
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        {batch.totalSessions} Sesi Jadwal
                      </span>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/70">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" />
                        {formatDate(batch.firstSession)} — {formatDate(batch.lastSession)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Dibuat pada: {formatDate(batch.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Right Column: Actions */}
                <div className="flex items-center gap-2 sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                  <Link
                    href="/jadwal"
                    prefetch={true}
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-all active:scale-95 shadow-2xs"
                  >
                    <span>Lihat di Kalender</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(batch.batchId, batch.blueprintName)}
                      disabled={isPending}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all disabled:opacity-40 cursor-pointer shadow-2xs active:scale-95"
                      title="Hapus Seluruh Sesi dari Batch Ini"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Generator Modal Integration ── */}
      <RollingScheduleGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onSuccess={() => {
          setIsGeneratorOpen(false);
          router.refresh();
        }}
        roleCodes={roleCodes}
      />
    </div>
  );
}
