'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  PlusCircle,
  Loader2,
  AlertCircle,
  Check,
  Layers,
  ShieldCheck,
  Calendar,
  Compass,
  Palette,
  BookOpen,
  Info,
} from 'lucide-react';
import { createGeneration } from '@/app/(protected)/generasi/actions';

const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Emerald', bgClass: 'bg-emerald-500', ringClass: 'ring-emerald-400', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'sky', label: 'Sky Blue', bgClass: 'bg-sky-500', ringClass: 'ring-sky-400', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'purple', label: 'Violet', bgClass: 'bg-purple-500', ringClass: 'ring-purple-400', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'amber', label: 'Amber', bgClass: 'bg-amber-500', ringClass: 'ring-amber-400', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'rose', label: 'Rose', bgClass: 'bg-rose-500', ringClass: 'ring-rose-400', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'teal', label: 'Teal', bgClass: 'bg-teal-500', ringClass: 'ring-teal-400', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'orange', label: 'Orange', bgClass: 'bg-orange-500', ringClass: 'ring-orange-400', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' },
];

export default function CreateGenerationForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
  const [minAge, setMinAge] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('emerald');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-slug kode dari nama jika belum diedit manual
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isCodeManuallyEdited) {
      const generated = val
        .toUpperCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 30);
      setCode(generated);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCodeManuallyEdited(true);
    const cleaned = e.target.value
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
    setCode(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Nama jenjang generasi minimal harus 2 karakter.');
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 2) {
      setErrorMessage('Kode generasi minimal harus 2 karakter (huruf, angka, garis bawah).');
      return;
    }

    const parsedMinAge = Number(minAge);
    const parsedMaxAge = Number(maxAge);

    if (isNaN(parsedMinAge) || parsedMinAge < 0) {
      setErrorMessage('Usia minimal tidak boleh negatif atau kosong.');
      return;
    }

    if (isNaN(parsedMaxAge) || parsedMaxAge < parsedMinAge) {
      setErrorMessage('Usia maksimal harus lebih besar atau sama dengan usia minimal.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createGeneration({
        name: trimmedName,
        code: trimmedCode,
        minAge: parsedMinAge,
        maxAge: parsedMaxAge,
        description: description.trim() || null,
        color,
      });

      if (!res.success || !res.generation) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      // Berhasil, kembali ke halaman kelola generasi
      router.push('/generasi');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat membuat jenjang generasi.');
      setIsSubmitting(false);
    }
  };

  const selectedTheme = COLOR_OPTIONS.find((c) => c.id === color) || COLOR_OPTIONS[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/generasi"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 group-hover:border-emerald-300 flex items-center justify-center shadow-2xs transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
          </div>
          <span>Kembali ke Kelola Generasi</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/70 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Layers className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Tambah Jenjang Generasi Baru
            </h1>
          </div>
        </div>
      </div>

      {/* Form Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 text-xs sm:text-sm text-rose-700 flex items-start gap-3 shadow-xs animate-slide-down">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Gagal Menyimpan Jenjang Generasi</p>
            <p className="mt-0.5 text-rose-600 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form Inputs & Realtime Live Preview */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-5">
            {/* Card 1: Identitas & Kode Unik */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Compass className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800">Identitas Jenjang Generasi</h2>
              </div>

              {/* Nama Generasi */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Nama Jenjang Generasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PAUD Qur'ani, Pra-Remaja, Lansia"
                  value={name}
                  onChange={handleNameChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>

              {/* Kode Unik Slug */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Kode Unik Identifikasi <span className="text-rose-500">*</span>
                  </label>
                  {isCodeManuallyEdited && (
                    <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                      Kustom Manual
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: PAUD_QURANI, PRA_REMAJA"
                    value={code}
                    onChange={handleCodeChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 font-mono uppercase font-bold tracking-wider transition-all"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      SLUG
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Otomatis terisi dari nama jenjang. Kode ini bersifat permanen dan digunakan sebagai referensi internal sistem kurikulum &amp; kelas.
                </p>
              </div>
            </div>

            {/* Card 2: Rentang Usia Santri */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calendar className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-800">Rentang Usia Santri Baku</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Usia Minimal (Tahun) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    placeholder="Contoh: 3"
                    value={minAge}
                    onChange={(e) => setMinAge(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 font-bold transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Usia Maksimal (Tahun) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    placeholder="Contoh: 6"
                    value={maxAge}
                    onChange={(e) => setMaxAge(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 font-bold transition-all"
                  />
                </div>
              </div>

              {/* Visual Age Range Helper */}
              {minAge !== '' && maxAge !== '' && Number(maxAge) >= Number(minAge) && (
                <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/60 flex items-center justify-between text-xs text-sky-900">
                  <span className="font-medium">Rentang Usia Pembinaan:</span>
                  <span className="font-extrabold bg-white px-2.5 py-1 rounded-xl shadow-2xs border border-sky-200/60 text-sky-700">
                    {minAge} s/d {maxAge} Tahun
                  </span>
                </div>
              )}
            </div>

            {/* Card 3: Pilihan Warna Tema */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Palette className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-800">Tema Warna Visual Kartu</h2>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Pilih warna identitas untuk membedakan kartu generasi ini pada dashboard dan navigasi kurikulum santri:
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${color === c.id
                        ? 'border-slate-800 bg-slate-900 text-white shadow-xs scale-105'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${c.bgClass} shadow-2xs shrink-0`} />
                      <span className="text-xs font-bold">{c.label}</span>
                      {color === c.id && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 4: Fokus Kurikulum & Capaian Pembinaan */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-slate-800">Fokus Kurikulum &amp; Pembinaan</h2>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Deskripsi &amp; Target Capaian (Opsional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Contoh: Fokus pada pengenalan huruf hijaiyah..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all resize-none"
                />
                <p className="text-[11px] text-slate-500">
                  Deskripsi ini akan ditampilkan sebagai panduan kurikulum santri dan orang tua.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Realtime Live Preview Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Tampilan Kartu (Live Preview)</span>
              </div>

              {/* Preview Card */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs relative overflow-hidden space-y-4 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-slate-900">
                        {name.trim() || 'Nama Jenjang Generasi'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {code.trim() || 'KODE_SLUG'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${selectedTheme.badgeClass}`}>
                        {minAge !== '' && maxAge !== '' ? `${minAge} - ${maxAge} Thn` : 'Rentang Usia'}
                      </span>
                    </div>
                  </div>

                  <div className={`w-10 h-10 rounded-2xl ${selectedTheme.bgClass} text-white flex items-center justify-center shadow-xs shrink-0`}>
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-[44px]">
                  {description.trim() || 'Belum ada deskripsi target kurikulum yang dimasukkan. Deskripsi akan membantu para pengajar menyusun modul materi.'}
                </p>

                {/* Stats Preview Chips */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Santri</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Kelas</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Materi</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="w-full h-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <span>Lihat Kurikulum</span>
                  </div>
                </div>
              </div>

              {/* Informative Help Box */}
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200/70 p-4 text-xs text-amber-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pedoman Jenjang Generasi</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Pastikan rentang usia tidak tumpang tindih secara drastis dengan jenjang lain demi memudahkan pemantauan absensi, evaluasi nilai ujian, dan pembagian kelas binaan di masjid/kelompok.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Sticky Footer */}
        <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-sm flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            href="/generasi"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all text-center"
          >
            Batal &amp; Kembali
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Jenjang...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                <span>Simpan Jenjang Generasi</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
