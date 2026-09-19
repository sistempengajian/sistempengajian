'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrganizationSelectModal from '../OrganizationSelectModal';
import OrganizationSelectTrigger from '../OrganizationSelectTrigger';
import {
  ArrowLeft,
  Sparkles,
  PlusCircle,
  Loader2,
  AlertCircle,
  Check,
  Map,
  Landmark,
  Users,
  Compass,
  GitBranch,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { OrganizationType } from '@prisma/client';
import { ParentOption } from '../types';
import { createOrganization } from '@/app/(protected)/organisasi/actions';

interface CreateOrganizationFormProps {
  daerahList: ParentOption[];
  desaList: ParentOption[];
  canCreateDaerah: boolean;
  canCreateDesa?: boolean;
}

const TYPE_OPTIONS = [
  {
    type: 'DAERAH' as OrganizationType,
    label: 'Tingkat Daerah',
    fullName: 'Tingkat Daerah',
    subtitle: 'Tingkat 1 (Provinsi / Wilayah)',
    desc: 'Induk tertinggi wilayah pembinaan.',
    icon: Map,
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    ring: 'border-indigo-500 ring-2 ring-indigo-200',
  },
  {
    type: 'DESA' as OrganizationType,
    label: 'Tingkat Desa',
    fullName: 'Tingkat Desa',
    subtitle: 'Tingkat 2 (Kecamatan / Desa)',
    desc: 'Membawahi kelompok pengajian.',
    icon: Landmark,
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    ring: 'border-emerald-500 ring-2 ring-emerald-200',
  },
  {
    type: 'KELOMPOK' as OrganizationType,
    label: 'Tingkat Kelompok',
    fullName: 'Tingkat Kelompok',
    subtitle: 'Tingkat 3 (Masjid / Pengajian)',
    desc: 'Unit binaan santri & kelas.',
    icon: Users,
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
    ring: 'border-sky-500 ring-2 ring-sky-200',
  },
];

export default function CreateOrganizationForm({
  daerahList,
  desaList,
  canCreateDaerah,
  canCreateDesa = true,
}: CreateOrganizationFormProps) {
  const router = useRouter();

  const availableTypeOptions = TYPE_OPTIONS.filter((t) => {
    if (t.type === 'DAERAH') return canCreateDaerah;
    if (t.type === 'DESA') return canCreateDesa;
    return true; // KELOMPOK
  });

  const initialType: OrganizationType = canCreateDaerah
    ? 'DAERAH'
    : canCreateDesa
    ? 'DESA'
    : 'KELOMPOK';

  const initialParentId =
    initialType === 'DESA' && daerahList.length === 1
      ? daerahList[0].id
      : initialType === 'KELOMPOK' && desaList.length === 1
      ? desaList[0].id
      : '';

  const [type, setType] = useState<OrganizationType>(initialType);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState(initialParentId);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);

  const selectedParent = useMemo(() => {
    const list = type === 'DESA' ? daerahList : desaList;
    return list.find((o) => o.id === parentId) || null;
  }, [type, daerahList, desaList, parentId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ganti tipe tingkatan dengan auto pre-select jika hanya ada 1 parent sah
  const handleTypeChange = (newType: OrganizationType) => {
    setType(newType);
    if (newType === 'DESA' && daerahList.length === 1) {
      setParentId(daerahList[0].id);
    } else if (newType === 'KELOMPOK' && desaList.length === 1) {
      setParentId(desaList[0].id);
    } else {
      setParentId('');
    }
  };

  const selectedTypeConfig =
    TYPE_OPTIONS.find((t) => t.type === type) || TYPE_OPTIONS[1];
  const IconComponent = selectedTypeConfig.icon;

  // Nama parent terpilih untuk live preview
  let parentDisplay = null;
  if (type === 'DESA' && parentId) {
    const parentDaerah = daerahList.find((d) => d.id === parentId);
    parentDisplay = parentDaerah?.name || null;
  } else if (type === 'KELOMPOK' && parentId) {
    const parentDesa = desaList.find((d) => d.id === parentId);
    parentDisplay = parentDesa
      ? `${parentDesa.name} (${parentDesa.parentName || 'Daerah'})`
      : null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Nama tingkatan wilayah minimal harus 2 karakter.');
      return;
    }

    if (type !== 'DAERAH' && !parentId) {
      setErrorMessage(
        `Silakan pilih Induk Wilayah untuk tingkatan ${type === 'DESA' ? 'Desa' : 'Kelompok'
        }.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrganization({
        name: trimmedName,
        type,
        parentId: type === 'DAERAH' ? null : parentId,
      });

      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      router.push('/organisasi');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Terjadi kesalahan sistem saat membuat tingkatan wilayah.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/organisasi"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 group-hover:border-emerald-300 flex items-center justify-center shadow-2xs transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
          </div>
          <span>Kembali ke Kelola Organisasi</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/70 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Landmark className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Tambah Tingkatan Wilayah Baru
            </h1>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 text-xs sm:text-sm text-rose-700 flex items-start gap-3 shadow-xs animate-slide-down">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Gagal Menyimpan Tingkatan Wilayah</p>
            <p className="mt-0.5 text-rose-600 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-5">
            {/* Card 1: Pilihan Tingkat Wilayah */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Compass className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  1. Pilih Tingkatan Wilayah
                </h2>
              </div>

              {/* Radio Cards: Mobile-friendly stack, Desktop row */}
              <div className={`grid grid-cols-1 ${availableTypeOptions.length === 2 ? 'sm:grid-cols-2' : availableTypeOptions.length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-3'} gap-3`}>
                {availableTypeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.type;

                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => handleTypeChange(opt.type)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-2 cursor-pointer ${
                        isSelected
                          ? `${opt.ring} bg-white shadow-xs`
                          : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-8 h-8 rounded-xl border ${opt.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 block">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-slate-500 block leading-tight pt-0.5">
                          {opt.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Induk Wilayah (Parent Selector) */}
            {type !== 'DAERAH' ? (
              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <GitBranch className="w-4 h-4 text-sky-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    2. Pilih Induk Wilayah ({type === 'DESA' ? 'Daerah' : 'Desa'})
                  </h2>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Induk Wilayah Pengayom <span className="text-rose-500">*</span>
                  </label>

                  <OrganizationSelectTrigger
                    selectedOrg={selectedParent}
                    onClick={() => setIsParentModalOpen(true)}
                    placeholder={
                      type === 'DESA'
                        ? 'Pilih Induk Daerah...'
                        : 'Pilih Induk Desa...'
                    }
                  />

                  <OrganizationSelectModal
                    isOpen={isParentModalOpen}
                    onClose={() => setIsParentModalOpen(false)}
                    organizations={type === 'DESA' ? daerahList : desaList}
                    selectedId={parentId}
                    onSelect={(org) => setParentId(org ? org.id : '')}
                    title={type === 'DESA' ? 'Pilih Induk Daerah' : 'Pilih Induk Desa'}
                    description={
                      type === 'DESA'
                        ? 'Pilih tingkatan Daerah yang mengayomi Desa ini'
                        : 'Pilih tingkatan Desa tempat Kelompok ini bernaung'
                    }
                  />

                  <p className="text-[11px] text-slate-500">
                    {type === 'DESA'
                      ? 'Desa akan menginduk pada Daerah yang dipilih.'
                      : 'Kelompok pengajian akan berada di bawah naungan Desa yang dipilih.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-indigo-50/70 border border-indigo-200/80 p-4 sm:p-5 text-xs text-indigo-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Tingkatan Daerah adalah Induk Tertinggi</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-800">
                  Wilayah Tingkat Daerah tidak memerlukan induk wilayah (*Root Level*). Daerah akan menjadi payung pembinaan bagi desa-desa dan kelompok pengajian di dalamnya.
                </p>
              </div>
            )}

            {/* Card 3: Nama Wilayah */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Landmark className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  {type === 'DAERAH' ? '2' : '3'}. Nama Tingkatan Wilayah
                </h2>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Nama Wilayah / Organisasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    type === 'DAERAH'
                      ? 'Contoh: Daerah Istimewa Yogyakarta'
                      : type === 'DESA'
                        ? 'Contoh: Desa Sleman Timur'
                        : 'Contoh: Kelompok Al-Barokah'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  Nama ini akan ditampilkan pada profil santri, jadwal presensi, dan struktur organisasi.
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
              <div
                className={`rounded-3xl bg-white border ${selectedTypeConfig.ring} p-5 shadow-xs relative overflow-hidden space-y-3.5 transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${selectedTypeConfig.badgeBg}`}
                      >
                        {selectedTypeConfig.fullName}
                      </span>

                      {parentDisplay && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[200px]">
                          <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{parentDisplay}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 tracking-tight truncate pt-0.5">
                      {name.trim() || 'Nama Tingkatan Wilayah'}
                    </h3>
                  </div>

                  <div
                    className={`w-10 h-10 rounded-2xl border ${selectedTypeConfig.iconBg} flex items-center justify-center shadow-2xs shrink-0`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Santri</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Pengajar</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">0</span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      {type === 'KELOMPOK' ? 'Kelas' : 'Binaan'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informative Guidance */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-xs text-slate-600 space-y-1.5 shadow-2xs">
                <span className="font-bold text-slate-800 block">
                  Panduan Struktur Wilayah:
                </span>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Pastikan nama wilayah ditulis secara jelas dan tidak duplikat dengan wilayah lain di bawah induk yang sama demi mempermudah pembuatan kelas dan pemilihan pembina wilayah.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Sticky Footer */}
        <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-4 shadow-sm flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Link
            href="/organisasi"
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
                <span>Menyimpan Wilayah...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                <span>Simpan Tingkatan Wilayah</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
