'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  Layers,
  Users,
  CalendarCheck,
  Building2,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
  Save,
  CheckCircle2,
  Info,
  Check,
  Search,
  Plus,
  Loader2,
  ExternalLink
} from 'lucide-react';
import type { RollingTargetScope } from '@prisma/client';
import RotationProjectionTable from './RotationProjectionTable';
import {
  createRollingPengajian,
  updateRollingPengajian,
  getRollingReferenceData,
  RollingPengajianInput
} from '@/app/(protected)/jadwal/rolling-pengajian/actions';

interface RollingPengajianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  rollingPengajianToEdit?: any | null;
  referenceData: {
    materialRollings: any[];
    teacherRollings: any[];
    classes: any[];
    generations: any[];
  } | null;
  onSuccess: () => void;
}

export default function RollingPengajianFormModal({
  isOpen,
  onClose,
  rollingPengajianToEdit,
  referenceData,
  onSuccess,
}: RollingPengajianFormModalProps) {
  const isEditMode = Boolean(rollingPengajianToEdit);
  const [isPending, startTransition] = useTransition();

  // Local reference data state for resilient client-side loading
  const [localRefData, setLocalRefData] = useState(referenceData);
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetScope, setTargetScope] = useState<RollingTargetScope>('WILAYAH_UMUM');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedGenerationId, setSelectedGenerationId] = useState<string>('');
  const [materialRollingId, setMaterialRollingId] = useState('');
  const [teacherRollingId, setTeacherRollingId] = useState('');
  const [venuePlaceName, setVenuePlaceName] = useState('');
  const [venueType, setVenueType] = useState('MASJID');

  const [classSearch, setClassSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize when referenceData prop changes
  useEffect(() => {
    if (referenceData) {
      setLocalRefData(referenceData);
    }
  }, [referenceData]);

  // Ensure fresh reference data is fetched if localRefData is null/empty when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (
      !localRefData ||
      !localRefData.classes?.length ||
      !localRefData.generations?.length ||
      !localRefData.materialRollings?.length ||
      !localRefData.teacherRollings?.length
    ) {
      setIsLoadingRef(true);
      getRollingReferenceData()
        .then((res) => {
          if (res.data) {
            setLocalRefData(res.data);
          }
        })
        .catch((err) => {
          console.error('Failed to load rolling reference data:', err);
        })
        .finally(() => {
          setIsLoadingRef(false);
        });
    }
  }, [isOpen, localRefData]);

  const materialRollings = localRefData?.materialRollings || [];
  const teacherRollings = localRefData?.teacherRollings || [];
  const classes = localRefData?.classes || [];
  const generations = localRefData?.generations || [];

  // Inisialisasi form saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    if (rollingPengajianToEdit) {
      setName(rollingPengajianToEdit.name || '');
      setDescription(rollingPengajianToEdit.description || '');
      setTargetScope(rollingPengajianToEdit.targetScope || 'WILAYAH_UMUM');
      setMaterialRollingId(rollingPengajianToEdit.materialRollingId || '');
      setTeacherRollingId(rollingPengajianToEdit.teacherRollingId || '');
      setVenuePlaceName(rollingPengajianToEdit.venuePlaceName || '');
      setVenueType(rollingPengajianToEdit.venueType || 'MASJID');

      // Ambil ID kelas terpilih
      const cIds = rollingPengajianToEdit.targetClasses?.map((tc: any) => tc.classId || tc.class?.id) || [];
      setSelectedClassIds(cIds);

      // Ambil ID generasi terpilih
      const gId = rollingPengajianToEdit.targetGenerations?.[0]?.generationId || rollingPengajianToEdit.targetGenerations?.[0]?.generation?.id || '';
      setSelectedGenerationId(gId);
    } else {
      // Default baru
      setName('');
      setDescription('');
      setTargetScope('WILAYAH_UMUM');
      setSelectedClassIds([]);
      setSelectedGenerationId('');
      setMaterialRollingId(materialRollings[0]?.id || '');
      setTeacherRollingId(teacherRollings[0]?.id || '');
      setVenuePlaceName('');
      setVenueType('MASJID');
    }

    setErrorMessage(null);
    setClassSearch('');
  }, [isOpen, rollingPengajianToEdit]);

  // Auto-select template pertama jika belum terpilih dan data telah tersedia
  useEffect(() => {
    if (!isEditMode && isOpen) {
      if (!materialRollingId && materialRollings.length > 0) {
        setMaterialRollingId(materialRollings[0].id);
      }
      if (!teacherRollingId && teacherRollings.length > 0) {
        setTeacherRollingId(teacherRollings[0].id);
      }
    }
  }, [isOpen, isEditMode, materialRollings, teacherRollings, materialRollingId, teacherRollingId]);

  // Selected Material & Teacher Rolling Objects
  const selectedMaterialRolling = useMemo(() => {
    return materialRollings.find((m) => m.id === materialRollingId) || null;
  }, [materialRollings, materialRollingId]);

  const selectedTeacherRolling = useMemo(() => {
    return teacherRollings.find((t) => t.id === teacherRollingId) || null;
  }, [teacherRollings, teacherRollingId]);

  // Toggle multi-select kelas
  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // Filter kelas untuk pencarian
  const filteredClasses = useMemo(() => {
    if (!classSearch.trim()) return classes;
    const q = classSearch.toLowerCase();
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, classSearch]);

  // Handle Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Nama kegiatan pengajian wajib diisi.');
      return;
    }

    if (!materialRollingId) {
      setErrorMessage('Pilih salah satu template Rolling Materi (Tahap 1).');
      return;
    }

    if (!teacherRollingId) {
      setErrorMessage('Pilih salah satu template Rolling Pengajar (Tahap 2).');
      return;
    }

    const trimmedVenue = venuePlaceName.trim();
    if (!trimmedVenue) {
      setErrorMessage('Nama tempat/masjid pengajian bawaan wajib diisi.');
      return;
    }

    if (targetScope === 'KELAS' && selectedClassIds.length === 0) {
      setErrorMessage('Pilih minimal satu kelas untuk sasaran pengajian ini.');
      return;
    }

    if (targetScope === 'GENERASI' && !selectedGenerationId) {
      setErrorMessage('Pilih 1 jenjang usia sasaran untuk kegiatan pengajian ini.');
      return;
    }

    const payload: RollingPengajianInput = {
      name: trimmedName,
      description: description.trim() || null,
      targetScope,
      classIds: targetScope === 'KELAS' ? selectedClassIds : [],
      generationIds: targetScope === 'GENERASI' && selectedGenerationId ? [selectedGenerationId] : [],
      materialRollingId,
      teacherRollingId,
      venuePlaceName: trimmedVenue,
      venueType,
    };

    startTransition(async () => {
      let res;
      if (isEditMode) {
        res = await updateRollingPengajian(rollingPengajianToEdit.id, payload);
      } else {
        res = await createRollingPengajian(payload);
      }

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-150">
      {/* Header Modal Fullscreen */}
      <div className="border-b border-slate-200/80 bg-slate-50/90 backdrop-blur-md shrink-0">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80 shadow-2xs shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                  {isEditMode ? 'Edit Pengajian Rolling' : 'Buat Pengajian Rolling Baru'}
                </h3>
                {isLoadingRef && (
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Memuat referensi...</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tahap 3: Blueprint terpadu penggabungan template materi dan dewan pengajar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body Modal: Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50/40">
        <form id="rolling-pengajian-form" onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-semibold">{errorMessage}</div>
            </div>
          )}

          {/* Section 1: Identitas & Lokasi */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>1. Identitas & Tempat Pengajian</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nama Kegiatan Pengajian</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Pengajian Rutin Remaja Masjid Baitul Makmur"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Keterangan / Tujuan Pengajian (Opsional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Catatan tambahan mengenai kelompok binaan atau agenda kajian"
                  className="w-full px-4 py-2 text-xs bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nama Tempat / Masjid Bawaan</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={venuePlaceName}
                  onChange={(e) => setVenuePlaceName(e.target.value)}
                  placeholder="Contoh: Masjid Baitul Makmur"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Tipe Tempat Pengajian</label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-800"
                >
                  <option value="MASJID">Masjid / Musholla</option>
                  <option value="AULA">Aula / Gedung Serbaguna</option>
                  <option value="RUMAH">Rumah Binaan</option>
                  <option value="LAINNYA">Tempat Lainnya</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Sasaran Peserta (Mendukung Multi-Target) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>2. Sasaran Peserta Pengajian</span>
            </h4>

            {/* Pilihan Scope Peserta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'WILAYAH_UMUM',
                  title: 'Umum Se-Wilayah',
                  desc: 'Terbuka untuk semua santri & jamaah di wilayah',
                },
                {
                  id: 'KELAS',
                  title: 'Berdasarkan Kelas',
                  desc: 'Bisa memilih satu atau lebih kelas santri',
                },
                {
                  id: 'GENERASI',
                  title: 'Berdasarkan Jenjang Usia',
                  desc: 'Bisa memilih satu atau lebih jenjang usia',
                },
              ].map((scope) => {
                const isSelected = targetScope === scope.id;
                return (
                  <button
                    type="button"
                    key={scope.id}
                    onClick={() => setTargetScope(scope.id as RollingTargetScope)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900">{scope.title}</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{scope.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Multi-Select Kelas jika KELAS */}
            {targetScope === 'KELAS' && (
              <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-200/80 space-y-3">
                <div className="flex flex-col items-start justify-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">Pilih Kelas Target:</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                      {selectedClassIds.length} dari {classes.length} Kelas Dipilih
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end justify-between w-full gap-3">
                    {classes.length > 4 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={classSearch}
                          onChange={(e) => setClassSearch(e.target.value)}
                          placeholder="Cari nama kelas..."
                          className="pl-10 pr-20 py-1 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                    {classes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClassIds(classes.map((c) => c.id))}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <span className="text-slate-300 text-xs">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedClassIds([])}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                        >
                          Kosongkan
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {filteredClasses.length === 0 ? (
                  <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center">
                    <p className="text-xs text-slate-500">
                      {classes.length === 0
                        ? 'Belum ada kelas yang terdaftar dalam cakupan wilayah Anda.'
                        : 'Tidak ada kelas yang sesuai dengan kata kunci pencarian.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredClasses.map((cls) => {
                      const isChecked = selectedClassIds.includes(cls.id);
                      return (
                        <button
                          type="button"
                          key={cls.id}
                          onClick={() => handleToggleClass(cls.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs ring-1 ring-indigo-500/30'
                            : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs truncate block leading-snug">{cls.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] truncate ${isChecked ? 'text-indigo-100' : 'text-slate-500'}`}>
                                {cls.generation?.name || 'Umum'}
                              </span>
                              {cls.organization?.name && (
                                <>
                                  <span className={`text-[9px] ${isChecked ? 'text-indigo-200' : 'text-slate-300'}`}>•</span>
                                  <span className={`text-[9px] truncate ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {cls.organization.name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? 'bg-white text-indigo-600 border-white' : 'border-slate-300 bg-slate-50'
                              }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Single-Select Generasi jika GENERASI */}
            {targetScope === 'GENERASI' && (
              <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Pilih 1 Jenjang Usia Sasaran:</span>
                  <span className="text-[11px] text-slate-400">Kurikulum materi disesuaikan per usia</span>
                </div>

                {generations.length === 0 ? (
                  <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center">
                    <p className="text-xs text-slate-500">Belum ada master data jenjang usia / generasi.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {generations.map((gen) => {
                      const isSelected = selectedGenerationId === gen.id;
                      return (
                        <button
                          type="button"
                          key={gen.id}
                          onClick={() => setSelectedGenerationId(gen.id)}
                          className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold ring-2 ring-indigo-400/30 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                        >
                          <span className="text-xs font-bold">{gen.name}</span>
                          <span className="text-[10px] text-slate-400">
                            {gen.minAge && gen.maxAge ? `${gen.minAge}-${gen.maxAge} Th` : gen.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Pemasangan Template Rolling Materi & Pengajar */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>3. Pasangkan Template Silabus & Dewan Pengajar</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Template Rolling Materi */}
              <div className="space-y-2.5 p-4 rounded-2xl border border-teal-200 bg-teal-50/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-teal-700" />
                    <span>Template Rolling Materi (Tahap 1)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <Link
                    href="/jadwal/rolling-materi"
                    target="_blank"
                    className="text-[10px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-0.5 underline"
                  >
                    <span>Kelola Silabus</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {materialRollings.length === 0 ? (
                  <div className="p-3 rounded-xl bg-white border border-teal-200 text-xs text-teal-900 space-y-2">
                    <p className="text-[11px] text-teal-800">
                      Belum ada template Rolling Materi yang aktif untuk wilayah Anda.
                    </p>
                    <Link
                      href="/jadwal/rolling-materi"
                      target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Rolling Materi Sekarang</span>
                    </Link>
                  </div>
                ) : (
                  <>
                    <select
                      value={materialRollingId}
                      onChange={(e) => setMaterialRollingId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-teal-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-semibold text-slate-800 cursor-pointer"
                      required
                    >
                      <option value="">-- Pilih Template Materi --</option>
                      {materialRollings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.queues?.length || 0} Antrean - {m.rollingType})
                          {m.organization?.name ? ` [${m.organization.name}]` : ''}
                        </option>
                      ))}
                    </select>

                    {selectedMaterialRolling && (
                      <div className="p-2.5 rounded-xl bg-white border border-teal-200/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-teal-900">
                          <span>Tipe: {selectedMaterialRolling.rollingType}</span>
                          <span>{selectedMaterialRolling.itemsPerSession} Materi/Sesi</span>
                        </div>
                        <p className="text-slate-500 text-[10px]">
                          Memiliki {selectedMaterialRolling.queues?.length || 0} langkah antrean silabus bergulir
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Template Rolling Pengajar */}
              <div className="space-y-2.5 p-4 rounded-2xl border border-sky-200 bg-sky-50/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-700" />
                    <span>Template Rolling Pengajar (Tahap 2)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <Link
                    href="/jadwal/rolling-pengajar"
                    target="_blank"
                    className="text-[10px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-0.5 underline"
                  >
                    <span>Kelola Ustadz</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {teacherRollings.length === 0 ? (
                  <div className="p-3 rounded-xl bg-white border border-sky-200 text-xs text-sky-900 space-y-2">
                    <p className="text-[11px] text-sky-800">
                      Belum ada template Rolling Pengajar yang aktif untuk wilayah Anda.
                    </p>
                    <Link
                      href="/jadwal/rolling-pengajar"
                      target="_blank"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Rolling Pengajar Sekarang</span>
                    </Link>
                  </div>
                ) : (
                  <>
                    <select
                      value={teacherRollingId}
                      onChange={(e) => setTeacherRollingId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-sky-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-semibold text-slate-800 cursor-pointer"
                      required
                    >
                      <option value="">-- Pilih Template Pengajar --</option>
                      {teacherRollings.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.queues?.length || 0} Antrean - {t.rollingType})
                          {t.organization?.name ? ` [${t.organization.name}]` : ''}
                        </option>
                      ))}
                    </select>

                    {selectedTeacherRolling && (
                      <div className="p-2.5 rounded-xl bg-white border border-sky-200/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-sky-900">
                          <span>Tipe: {selectedTeacherRolling.rollingType}</span>
                          <span>{selectedTeacherRolling.teachersPerSession} Ustadz/Sesi</span>
                        </div>
                        <p className="text-slate-500 text-[10px]">
                          Memiliki {selectedTeacherRolling.queues?.length || 0} langkah antrean rotasi dewan pengajar
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Simulasi Matriks Perputaran (Live Rotation Projection) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>4. Simulasi Proyeksi Rotasi Pertemuan</span>
            </h4>

            <RotationProjectionTable
              materialRolling={selectedMaterialRolling}
              teacherRolling={selectedTeacherRolling}
              projectionCount={6}
            />
          </div>
        </form>
      </div>

      {/* Footer Modal Action Bar */}
      <div className="border-t border-slate-200/80 bg-white px-4 sm:px-6 py-3.5 shrink-0 shadow-xs mb-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          >
            Batal
          </button>

          <button
            type="submit"
            form="rolling-pengajian-form"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
          >
            {isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Menyimpan Blueprint...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isEditMode ? 'Perbarui Pengajian Rolling' : 'Simpan Pengajian Rolling'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
