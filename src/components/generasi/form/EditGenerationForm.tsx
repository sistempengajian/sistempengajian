'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
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
  Lock,
  Users,
  GraduationCap,
  MessageSquare,
  Send,
  Radio,
  RefreshCw,
  Bell,
  CalendarDays,
} from 'lucide-react';
import { GenerationWithStats } from '../types';
import {
  updateGeneration,
  testSendGroupPing,
  triggerGenerationWeeklyDigest,
} from '@/app/(protected)/generasi/actions';
import CustomSelect from '@/components/ui/CustomSelect';

const COLOR_OPTIONS = [
  { id: 'emerald', label: 'Emerald', bgClass: 'bg-emerald-500', ringClass: 'ring-emerald-400', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'sky', label: 'Sky Blue', bgClass: 'bg-sky-500', ringClass: 'ring-sky-400', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  { id: 'purple', label: 'Violet', bgClass: 'bg-purple-500', ringClass: 'ring-purple-400', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'amber', label: 'Amber', bgClass: 'bg-amber-500', ringClass: 'ring-amber-400', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'rose', label: 'Rose', bgClass: 'bg-rose-500', ringClass: 'ring-rose-400', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
  { id: 'teal', label: 'Teal', bgClass: 'bg-teal-500', ringClass: 'ring-teal-400', badgeClass: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'orange', label: 'Orange', bgClass: 'bg-orange-500', ringClass: 'ring-orange-400', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' },
];

interface EditGenerationFormProps {
  generation: GenerationWithStats;
}

export default function EditGenerationForm({ generation }: EditGenerationFormProps) {
  const router = useRouter();

  const [name, setName] = useState(generation.name);
  const [minAge, setMinAge] = useState<number | ''>(generation.minAge);
  const [maxAge, setMaxAge] = useState<number | ''>(generation.maxAge);
  const [description, setDescription] = useState(generation.description || '');
  const [color, setColor] = useState(generation.color || 'emerald');

  // Integrasi Notifikasi WhatsApp Grup
  const [whatsappGroupId, setWhatsappGroupId] = useState(generation.whatsappGroupId || '');
  const [whatsappGroupName, setWhatsappGroupName] = useState(generation.whatsappGroupName || '');
  const [waGroupH1Enabled, setWaGroupH1Enabled] = useState(generation.waGroupH1Enabled ?? true);
  const [waGroupWeeklyEnabled, setWaGroupWeeklyEnabled] = useState(generation.waGroupWeeklyEnabled ?? true);

  // States untuk pemilihan grup dari gateway WAHA
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  // States untuk pengujian interaktif (Ping & Weekly Broadcast)
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(generation.name);
    setMinAge(generation.minAge);
    setMaxAge(generation.maxAge);
    setDescription(generation.description || '');
    setColor(generation.color || 'emerald');
    setWhatsappGroupId(generation.whatsappGroupId || '');
    setWhatsappGroupName(generation.whatsappGroupName || '');
    setWaGroupH1Enabled(generation.waGroupH1Enabled ?? true);
    setWaGroupWeeklyEnabled(generation.waGroupWeeklyEnabled ?? true);
  }, [generation]);

  const fetchWahaGroups = async () => {
    setIsLoadingGroups(true);
    setTestFeedback(null);
    try {
      const res = await fetch('/api/whatsapp/groups');
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setAvailableGroups(data.groups);
        setShowGroupPicker(true);
        if (data.groups.length === 0) {
          setTestFeedback({
            type: 'error',
            message: 'Tidak ada grup WA ditemukan dari gateway WAHA. Anda dapat memasukkan ID Grup secara manual.',
          });
        }
      } else {
        setTestFeedback({
          type: 'error',
          message: data.message || 'Gagal memuat grup dari gateway WAHA. Pastikan gateway aktif.',
        });
      }
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        message: err.message || 'Gagal terhubung ke endpoint grup WhatsApp.',
      });
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleTestPing = async () => {
    if (!whatsappGroupId.trim()) {
      setTestFeedback({ type: 'error', message: 'Silakan isi ID Grup WhatsApp terlebih dahulu.' });
      return;
    }
    setIsTestingPing(true);
    setTestFeedback(null);
    try {
      const res = await testSendGroupPing(generation.id);
      setTestFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: any) {
      setTestFeedback({ type: 'error', message: err.message || 'Gagal mengirim pesan uji coba.' });
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleSendWeeklyDigest = async () => {
    if (!whatsappGroupId.trim()) {
      setTestFeedback({ type: 'error', message: 'Silakan isi ID Grup WhatsApp terlebih dahulu.' });
      return;
    }
    setIsSendingDigest(true);
    setTestFeedback(null);
    try {
      const res = await triggerGenerationWeeklyDigest(generation.id);
      setTestFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
      });
    } catch (err: any) {
      setTestFeedback({ type: 'error', message: err.message || 'Gagal memicu rangkuman jadwal.' });
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Nama jenjang generasi minimal harus 2 karakter.');
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
      const res = await updateGeneration(generation.id, {
        name: trimmedName,
        minAge: parsedMinAge,
        maxAge: parsedMaxAge,
        description: description.trim() || null,
        color,
        whatsappGroupId: whatsappGroupId.trim() || null,
        whatsappGroupName: whatsappGroupName.trim() || null,
        waGroupH1Enabled,
        waGroupWeeklyEnabled,
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
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memperbarui data generasi.');
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
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${selectedTheme.bgClass} text-white flex items-center justify-center shadow-sm shrink-0 transition-colors`}>
            <Layers className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Edit Jenjang: {generation.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200/80">
                {generation.code}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Error Banner */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 text-xs sm:text-sm text-rose-700 flex items-start gap-3 shadow-xs animate-slide-down">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Gagal Menyimpan Perubahan</p>
            <p className="mt-0.5 text-rose-600 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form Inputs & Realtime Live Preview */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-5">
            {/* Card 1: Identitas Jenjang */}
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
                  placeholder="Contoh: Cabe Rawit, Pra-Remaja"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>

              {/* Kode Slug (Readonly) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Kode Unik Identifikasi
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Terkunci Permanen
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={generation.code}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-500 font-mono font-bold tracking-wider cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Kode identifikasi ini tidak dapat diubah setelah dibuat demi menjaga integritas relasi foreign key pada data santri, kelas, dan modul materi kurikulum yang telah ada.
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
                  Pilih warna tema kartu untuk membedakan jenjang ini di seluruh antarmuka aplikasi:
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
                  placeholder="Target capaian pembelajaran santri pada jenjang ini..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all resize-none"
                />
              </div>
            </div>

            {/* Card 5: Integrasi Notifikasi WhatsApp Grup Jenjang */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Notifikasi Grup WhatsApp Jenjang</h2>
                    <p className="text-[11px] text-slate-500">Pengingat H-1 dan rangkuman jadwal mingguan ke grup WA santri/wali</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  WAHA GATEWAY
                </span>
              </div>

              {/* Feedback Alert for Group Testing */}
              {testFeedback && (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                    testFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {testFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 font-medium">{testFeedback.message}</span>
                  <button
                    type="button"
                    onClick={() => setTestFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold ml-1 text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Form Input: Nama Grup & ID Grup */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama / Label Grup WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Grup WA Pra-Remaja Kelompok"
                    value={whatsappGroupName}
                    onChange={(e) => setWhatsappGroupName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      ID Grup WhatsApp (ChatId / JID)
                    </label>
                    <button
                      type="button"
                      onClick={fetchWahaGroups}
                      disabled={isLoadingGroups}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 transition-colors cursor-pointer"
                    >
                      {isLoadingGroups ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Memuat Grup WAHA...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Tarik Daftar Grup dari WAHA</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="12036302839482910@g.us"
                    value={whatsappGroupId}
                    onChange={(e) => setWhatsappGroupId(e.target.value)}
                    className="w-full px-4 py-2.5 font-mono rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                  />

                  {/* Dropdown Selector jika grup berhasil ditarik dari WAHA */}
                  {showGroupPicker && availableGroups.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                        <span>Pilih dari Grup WA yang Terdeteksi ({availableGroups.length}):</span>
                        <button
                          type="button"
                          onClick={() => setShowGroupPicker(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          Tutup
                        </button>
                      </div>
                      <CustomSelect
                        value=""
                        onChange={(val) => {
                          const selected = availableGroups.find((g) => g.id === (val as string));
                          if (selected) {
                            setWhatsappGroupId(selected.id);
                            setWhatsappGroupName(selected.name);
                            setShowGroupPicker(false);
                          }
                        }}
                        options={[
                          { value: '', label: '-- Pilih salah satu grup --', disabled: true },
                          ...availableGroups.map((grp) => ({
                            value: grp.id,
                            label: `${grp.name} (${grp.id})`,
                          })),
                        ]}
                        searchable={availableGroups.length > 5}
                        searchPlaceholder="Cari nama grup WhatsApp..."
                        placeholder="-- Pilih salah satu grup --"
                        size="sm"
                      />
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    ID grup berakhiran <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">@g.us</code>. Sistem mengirimkan pengingat tanpa membuka tautan token login pribadi ke grup.
                  </p>
                </div>
              </div>

              {/* Toggles Pengingat Otomatis */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-150 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={waGroupH1Enabled}
                    onChange={(e) => setWaGroupH1Enabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Bell className="w-3.5 h-3.5 text-amber-500" />
                      <span>Pengingat Sesi H-1 Otomatis ke Grup</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Otomatis memposting ringkasan pengajian esok hari ke grup jenjang ini ~20 jam sebelum sesi dimulai.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-150 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={waGroupWeeklyEnabled}
                    onChange={(e) => setWaGroupWeeklyEnabled(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <CalendarDays className="w-3.5 h-3.5 text-sky-500" />
                      <span>Rangkuman Jadwal 1 Minggu ke Depan (Weekly Digest)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Otomatis mengirimkan daftar seluruh sesi pengajian jenjang ini (Senin s/d Ahad) setiap Ahad sore (17:00 WIB).
                    </p>
                  </div>
                </label>
              </div>

              {/* Uji Coba & Aksi Cepat Manual */}
              {whatsappGroupId && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Aksi Uji Coba &amp; Pengiriman Manual:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestPing}
                      disabled={isTestingPing || !whatsappGroupId.trim()}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isTestingPing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                          <span>Menguji...</span>
                        </>
                      ) : (
                        <>
                          <Radio className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Uji Coba Ping Grup</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendWeeklyDigest}
                      disabled={isSendingDigest || !whatsappGroupId.trim()}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSendingDigest ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          <span>Mengirim Rangkuman...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kirim Jadwal Pekan Ini Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Linked Stats & Sticky Live Preview Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-20 space-y-4">
              {/* Linked Data Overview */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Data Terhubung Saat Ini</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-emerald-800">
                    <span className="text-base font-black block">{generation.studentCount}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 block">Santri</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-100 text-sky-800">
                    <span className="text-base font-black block">{generation.classCount}</span>
                    <span className="text-[10px] font-semibold text-sky-600 block">Kelas</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100 text-purple-800">
                    <span className="text-base font-black block">{generation.materialCount}</span>
                    <span className="text-[10px] font-semibold text-purple-600 block">Materi</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Perubahan rentang usia akan memengaruhi rekomendasi kelas santri dan pengurutan modul kurikulum pada jenjang ini.
                </p>
              </div>

              {/* Realtime Live Preview */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 pt-1">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Tampilan Kartu (Live Preview)</span>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs relative overflow-hidden space-y-4 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <span className="text-base sm:text-lg font-black text-slate-900 block">
                      {name.trim() || generation.name}
                    </span>

                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {generation.code}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${selectedTheme.badgeClass}`}>
                        {minAge !== '' && maxAge !== '' ? `${minAge} - ${maxAge} Thn` : 'Rentang Usia'}
                      </span>
                    </div>
                  </div>

                  <div className={`w-10 h-10 rounded-2xl ${selectedTheme.bgClass} text-white flex items-center justify-center shadow-xs shrink-0 transition-colors`}>
                    <Layers className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-[44px]">
                  {description.trim() || 'Belum ada deskripsi target kurikulum yang dimasukkan.'}
                </p>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">{generation.studentCount}</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Santri</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">{generation.classCount}</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Kelas</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-sm font-black text-slate-800 block">{generation.materialCount}</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Materi</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="w-full h-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <span>Lihat Kurikulum</span>
                  </div>
                </div>
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
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                <span>Simpan Perubahan Jenjang</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
