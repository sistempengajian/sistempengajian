'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrganizationSelectModal from '../OrganizationSelectModal';
import OrganizationSelectTrigger from '../OrganizationSelectTrigger';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Map,
  Landmark,
  Users,
  GitBranch,
  ShieldCheck,
  Lock,
  GraduationCap,
} from 'lucide-react';
import { OrganizationWithStats, ParentOption } from '../types';
import { updateOrganization } from '@/app/(protected)/organisasi/actions';

interface EditOrganizationFormProps {
  organization: OrganizationWithStats;
  parentOptions: ParentOption[];
}

const TYPE_CONFIG = {
  DAERAH: {
    label: 'Daerah',
    fullName: 'Tingkat Daerah',
    icon: Map,
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    border: 'border-indigo-200/80',
    ring: 'border-indigo-500 ring-2 ring-indigo-200',
  },
  DESA: {
    label: 'Desa',
    fullName: 'Tingkat Desa',
    icon: Landmark,
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    border: 'border-emerald-200/80',
    ring: 'border-emerald-500 ring-2 ring-emerald-200',
  },
  KELOMPOK: {
    label: 'Kelompok',
    fullName: 'Tingkat Kelompok',
    icon: Users,
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-600 border-sky-200',
    border: 'border-sky-200/80',
    ring: 'border-sky-500 ring-2 ring-sky-200',
  },
};

export default function EditOrganizationForm({
  organization,
  parentOptions,
}: EditOrganizationFormProps) {
  const router = useRouter();

  const [name, setName] = useState(organization.name);
  const [parentId, setParentId] = useState(organization.parentId || '');
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);

  const selectedParent = useMemo(() => {
    return parentOptions.find((p) => p.id === parentId) || null;
  }, [parentOptions, parentId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const config = TYPE_CONFIG[organization.type] || TYPE_CONFIG.KELOMPOK;
  const IconComponent = config.icon;

  // Nama parent terpilih untuk live preview
  let parentDisplay = organization.parentName;
  if (parentId) {
    const selectedParent = parentOptions.find((p) => p.id === parentId);
    if (selectedParent) {
      parentDisplay = selectedParent.name;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Nama tingkatan wilayah minimal harus 2 karakter.');
      return;
    }

    if (organization.type !== 'DAERAH' && !parentId) {
      setErrorMessage('Induk wilayah wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateOrganization(organization.id, {
        name: trimmedName,
        parentId: organization.type === 'DAERAH' ? null : parentId,
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
        err.message || 'Terjadi kesalahan sistem saat memperbarui tingkatan wilayah.'
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
          <div
            className={`w-12 h-12 rounded-2xl border ${config.iconBg} flex items-center justify-center shadow-sm shrink-0`}
          >
            <IconComponent className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                Edit Wilayah: {organization.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${config.badgeBg}`}>
                {config.fullName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 text-xs sm:text-sm text-rose-700 flex items-start gap-3 shadow-xs animate-slide-down">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Gagal Menyimpan Perubahan</p>
            <p className="mt-0.5 text-rose-600 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Form Grid */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Fields */}
          <div className="lg:col-span-7 space-y-5">
            {/* Card 1: Tipe Wilayah (Readonly) */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Tingkatan Wilayah</span>
                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  Terkunci Permanen
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl border ${config.iconBg} flex items-center justify-center shrink-0`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">
                    {config.fullName}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Tingkat hierarki organisasi bersifat tetap demi menjaga integritas data santri dan kelas.
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Nama Wilayah */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Nama Tingkatan Wilayah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/60 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium transition-all"
                />
              </div>
            </div>

            {/* Card 3: Induk Wilayah (Parent Selector) */}
            {organization.type !== 'DAERAH' && (
              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Induk Wilayah Pengayom ({organization.type === 'DESA' ? 'Daerah' : 'Desa'}) <span className="text-rose-500">*</span>
                  </label>

                  <OrganizationSelectTrigger
                    selectedOrg={selectedParent}
                    onClick={() => setIsParentModalOpen(true)}
                    placeholder={
                      organization.type === 'DESA'
                        ? 'Pilih Induk Daerah...'
                        : 'Pilih Induk Desa...'
                    }
                  />

                  <OrganizationSelectModal
                    isOpen={isParentModalOpen}
                    onClose={() => setIsParentModalOpen(false)}
                    organizations={parentOptions}
                    selectedId={parentId}
                    onSelect={(org) => setParentId(org ? org.id : '')}
                    title={
                      organization.type === 'DESA'
                        ? 'Pilih Induk Daerah'
                        : 'Pilih Induk Desa'
                    }
                    description={
                      organization.type === 'DESA'
                        ? 'Pilih tingkatan Daerah yang mengayomi Desa ini'
                        : 'Pilih tingkatan Desa tempat Kelompok ini bernaung'
                    }
                  />

                  <p className="text-[11px] text-slate-500">
                    Pilihan induk wilayah telah disaring untuk mencegah hierarki melingkar (*circular dependency*).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Linked Stats & Live Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-20 space-y-4">
              {/* Linked Data Overview */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2.5">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>Data Terhubung Saat Ini</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-emerald-800">
                    <span className="text-sm sm:text-base font-black block">
                      {organization.studentCount}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 block">Santri</span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-sky-800">
                    <span className="text-sm sm:text-base font-black block">
                      {organization.teacherCount}
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 block">Pengajar</span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-purple-800">
                    <span className="text-sm sm:text-base font-black block">
                      {organization.type === 'DAERAH'
                        ? `${organization.childrenCount} Desa`
                        : organization.type === 'DESA'
                          ? `${organization.childrenCount} Klp`
                          : `${organization.classCount} Kelas`}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-600 block">
                      {organization.type === 'KELOMPOK' ? 'Kelas' : 'Binaan'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Perubahan nama atau induk wilayah akan otomatis memperbarui tampilan jadwal, presensi, dan hierarki pembinaan santri terkait.
                </p>
              </div>

              {/* Realtime Live Preview Card */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 pt-1">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Tampilan Kartu (Live Preview)</span>
              </div>

              <div
                className={`rounded-3xl bg-white border ${config.ring} p-5 shadow-xs relative overflow-hidden space-y-3.5 transition-all`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${config.badgeBg}`}
                      >
                        {config.fullName}
                      </span>

                      {parentDisplay && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 truncate max-w-[200px]">
                          <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{parentDisplay}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 tracking-tight truncate pt-0.5">
                      {name.trim() || organization.name}
                    </h3>
                  </div>

                  <div
                    className={`w-10 h-10 rounded-2xl border ${config.iconBg} flex items-center justify-center shadow-2xs shrink-0`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">
                      {organization.studentCount}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Santri</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">
                      {organization.teacherCount}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">Pengajar</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-150">
                    <span className="text-xs sm:text-sm font-black text-slate-800 block">
                      {organization.type === 'DAERAH'
                        ? `${organization.childrenCount} Desa`
                        : organization.type === 'DESA'
                          ? `${organization.childrenCount} Klp`
                          : `${organization.classCount} Kelas`}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      {organization.type === 'KELOMPOK' ? 'Kelas' : 'Binaan'}
                    </span>
                  </div>
                </div>
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
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                <span>Simpan Perubahan Wilayah</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
