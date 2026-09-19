'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  School,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Layers,
  MapPin,
  UserCheck,
  Search,
  Check,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { ClassWithRelations, ClassFormReferenceData } from '../types';
import { updateClass } from '@/app/(protected)/kelas/actions';
import OrganizationSelectModal from '@/components/organisasi/OrganizationSelectModal';
import OrganizationSelectTrigger from '@/components/organisasi/OrganizationSelectTrigger';

interface EditClassFormProps {
  classData: ClassWithRelations;
  referenceData: ClassFormReferenceData;
  managerRoles: string[];
}

export default function EditClassForm({
  classData,
  referenceData,
  managerRoles,
}: EditClassFormProps) {
  const router = useRouter();

  // Form State
  const [name, setName] = useState(classData.name);
  const [academicYear, setAcademicYear] = useState(classData.academicYear);
  const [generationId, setGenerationId] = useState(classData.generationId);
  const [organizationId, setOrganizationId] = useState(classData.organizationId);
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>(
    classData.homeroomTeacherId || ''
  );

  // UI State
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Organization Object
  const selectedOrganization = useMemo(
    () => referenceData.organizations.find((o) => o.id === organizationId) || null,
    [referenceData.organizations, organizationId]
  );

  // Selected Generation Object
  const selectedGeneration = useMemo(
    () => referenceData.generations.find((g) => g.id === generationId) || null,
    [referenceData.generations, generationId]
  );

  // Filter Guru / Wali Kelas Tersedia
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.toLowerCase().trim();
    if (!q) return referenceData.availableTeachers;
    return referenceData.availableTeachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(q) ||
        (t.phoneNumber && t.phoneNumber.includes(q)) ||
        (t.organizationName && t.organizationName.toLowerCase().includes(q))
    );
  }, [referenceData.availableTeachers, teacherSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 3) {
      setErrorMessage('Nama kelas wajib diisi minimal 3 karakter.');
      return;
    }

    if (!academicYear.trim()) {
      setErrorMessage('Tahun ajaran wajib diisi.');
      return;
    }

    if (!organizationId) {
      setErrorMessage('Wilayah binaan wajib dipilih.');
      return;
    }

    if (!generationId) {
      setErrorMessage('Jenjang generasi wajib dipilih.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('academicYear', academicYear.trim());
      formData.append('organizationId', organizationId);
      formData.append('generationId', generationId);
      if (homeroomTeacherId) {
        formData.append('homeroomTeacherId', homeroomTeacherId);
      }

      const res = await updateClass(classData.id, {}, formData);

      if (!res.success) {
        setErrorMessage(res.message || 'Gagal memperbarui kelas.');
        setIsSubmitting(false);
        return;
      }

      router.push('/kelas');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat memperbarui kelas.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Form */}
      <div className="flex items-center gap-3">
        <Link
          href="/kelas"
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
          title="Kembali ke Daftar Kelas"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Ubah Kelas Pengajian
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Perbarui data kelas, jenjang generasi, wilayah binaan, atau wali kelas
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1: Identitas Dasar Kelas */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <School className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Informasi Ruang Kelas</h2>
              <p className="text-[11px] text-slate-500">Nama kelas dan tahun ajaran binaan</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Nama Kelas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Nama Kelas Pengajian <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kelas Caberawit Aisyah"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                required
              />
            </div>

            {/* Tahun Ajaran */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Tahun Ajaran <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  list="academic-years-preset"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026/2027"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
                  required
                />
                <datalist id="academic-years-preset">
                  {referenceData.academicYears.map((yr) => (
                    <option key={yr} value={yr} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Jenjang Generasi & Wilayah Binaan */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Jenjang Generasi & Wilayah Binaan</h2>
              <p className="text-[11px] text-slate-500">Rentang usia santri dan teritorial pengajian</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Pilihan Jenjang Generasi */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Jenjang Generasi Santri <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {referenceData.generations.map((gen) => {
                  const isSelected = generationId === gen.id;
                  return (
                    <div
                      key={gen.id}
                      onClick={() => setGenerationId(gen.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-400/30 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            gen.color === 'sky'
                              ? 'bg-sky-500'
                              : gen.color === 'purple'
                              ? 'bg-purple-500'
                              : gen.color === 'amber'
                              ? 'bg-amber-500'
                              : gen.color === 'rose'
                              ? 'bg-rose-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {gen.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Usia {gen.minAge} - {gen.maxAge} tahun
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pilihan Wilayah Binaan */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                Wilayah Binaan Kelas <span className="text-rose-500">*</span>
              </label>

              <OrganizationSelectTrigger
                selectedOrg={selectedOrganization}
                onClick={() => setIsOrgModalOpen(true)}
                onClear={() => setOrganizationId('')}
                allowClear={false}
                placeholder="Pilih Wilayah Binaan..."
              />

              <OrganizationSelectModal
                isOpen={isOrgModalOpen}
                onClose={() => setIsOrgModalOpen(false)}
                onSelect={(org) => {
                  setOrganizationId(org ? org.id : '');
                  setIsOrgModalOpen(false);
                }}
                organizations={referenceData.organizations}
                selectedId={organizationId}
                title="Ubah Wilayah Binaan Kelas"
                description="Pilih unit kelompok, desa, atau daerah yang menaungi ruang kelas pengajian ini."
              />
            </div>
          </div>
        </div>

        {/* CARD 3: Penugasan Wali Kelas */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Wali Kelas Pengampu</h2>
              <p className="text-[11px] text-slate-500">Penanggung jawab pembinaan santri dan presensi</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Cari guru berdasarkan nama atau kontak..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white transition-all"
              />
            </div>

            {/* Opsi Belum Ditugaskan */}
            <div
              onClick={() => setHomeroomTeacherId('')}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                homeroomTeacherId === ''
                  ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-300'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">
                    Belum Ditugaskan
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Wali kelas dapat ditunjuk kemudian
                  </span>
                </div>
              </div>
              {homeroomTeacherId === '' && (
                <Check className="w-4 h-4 text-slate-700 stroke-[2.5]" />
              )}
            </div>

            {/* List Guru Tersedia */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredTeachers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 rounded-xl bg-slate-50 border border-dashed border-slate-200">
                  Tidak ada guru atau pengajar yang cocok.
                </div>
              ) : (
                filteredTeachers.map((teacher) => {
                  const isSelected = homeroomTeacherId === teacher.id;
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => setHomeroomTeacherId(teacher.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-400/30 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {teacher.fullName}
                            </span>
                            {teacher.currentAssignedClassesCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-slate-200/80 text-slate-600">
                                Mengampu {teacher.currentAssignedClassesCount} kelas
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span>{teacher.phoneNumber || 'Tidak ada nomor'}</span>
                            {teacher.organizationName && (
                              <>
                                <span>&bull;</span>
                                <span className="truncate">{teacher.organizationName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Tombol Simpan & Batal */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/kelas"
            className="px-5 py-2.5 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memperbarui...</span>
              </>
            ) : (
              <span>Simpan Perubahan Kelas</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
