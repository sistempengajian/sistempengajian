'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Info,
  Plus,
  Search,
} from 'lucide-react';
import {
  GenerationWithStats,
  GenerationsOverviewData,
} from './types';
import GenerationMetricsOverview from './GenerationMetricsOverview';
import GenerationCard from './GenerationCard';
import DeleteGenerationModal from './DeleteGenerationModal';

interface GenerationManagementViewProps {
  initialData: GenerationsOverviewData;
}

export default function GenerationManagementView({
  initialData,
}: GenerationManagementViewProps) {
  const [generations, setGenerations] = useState<GenerationWithStats[]>(
    initialData.generations
  );
  const [metrics, setMetrics] = useState(initialData.metrics);
  const [searchQuery, setSearchQuery] = useState('');

  const [generationToDelete, setGenerationToDelete] =
    useState<GenerationWithStats | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { canEdit } = initialData.userPermissions;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenDelete = (gen: GenerationWithStats) => {
    setGenerationToDelete(gen);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== deletedId));
    setMetrics((prev) => ({
      ...prev,
      totalGenerations: Math.max(0, prev.totalGenerations - 1),
    }));
    showToast('Jenjang generasi berhasil dihapus dari sistem.');
  };

  const filteredGenerations = generations.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      (g.description && g.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-4 sm:right-8 z-50 rounded-2xl bg-emerald-700 text-white px-4 py-3 shadow-xl border border-emerald-500/50 flex items-center gap-2.5 text-xs font-semibold animate-slide-down">
          <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shadow-2xs">
                <Layers className="w-5 h-5 stroke-[2.2]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Kelola Jenjang Usia &amp; Generasi Santri
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pengaturan pembagian jenjang usia baku santri, kurikulum bertahap, dan pengelompokan kelas binaan.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            {canEdit ? (
              <>
                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Akses Pengelola
                </span>

                <Link
                  href="/generasi/tambah"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Tambah Generasi</span>
                </Link>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                Mode Panduan (Lihat)
              </span>
            )}
          </div>
        </div>


      </div>

      {/* Ringkasan Metrik Global */}
      <GenerationMetricsOverview
        totalGenerations={metrics.totalGenerations}
        totalStudents={metrics.totalStudents}
        totalClasses={metrics.totalClasses}
        totalMaterials={metrics.totalMaterials}
      />

      {/* Toolbar Filter & Pencarian */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari jenjang atau kode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200/80 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 shadow-2xs transition-all"
          />
        </div>

        <span className="text-xs font-semibold text-slate-500 self-end sm:self-center">
          Menampilkan {filteredGenerations.length} dari {generations.length} jenjang generasi
        </span>
      </div>

      {/* Grid Kartu Generasi */}
      {filteredGenerations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredGenerations.map((gen) => (
            <GenerationCard
              key={gen.id}
              generation={gen}
              canEdit={canEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-slate-200/80 p-12 text-center shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Tidak ada jenjang generasi yang cocok
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `Tidak ditemukan jenjang generasi dengan kata kunci "${searchQuery}".`
              : 'Belum ada jenjang generasi yang didaftarkan di sistem.'}
          </p>
        </div>
      )}

      {/* Modal Hapus Generasi (Safety Guard Dialog) */}
      <DeleteGenerationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setGenerationToDelete(null);
        }}
        generation={generationToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
