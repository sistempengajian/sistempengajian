'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OrganizationSelectModal from '@/components/organisasi/OrganizationSelectModal';
import OrganizationSelectTrigger from '@/components/organisasi/OrganizationSelectTrigger';
import {
  getAllowedOrganizationTypeForRoles,
  filterOrganizationsForUserManagement,
} from '@/lib/scoped-access';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Check,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  Building2,
  ShieldCheck,
  Ban,
  Users as UsersIcon,
  GraduationCap,
} from 'lucide-react';
import { UserRole, Gender } from '@prisma/client';
import { FormReferenceData, UserWithRelations, UpdateUserInput } from '../types';
import { updateUser } from '@/app/(protected)/users/actions';

interface EditUserFormProps {
  user: UserWithRelations;
  referenceData: FormReferenceData;
  allowedRoles: UserRole[];
  managerRoles?: UserRole[];
}

const ROLE_THEMES: Record<
  UserRole,
  { label: string; badgeBg: string; ring: string }
> = {
  SANTRI: {
    label: 'Santri Binaan',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ring: 'border-emerald-500 ring-2 ring-emerald-200',
  },
  ORANG_TUA: {
    label: 'Orang Tua / Wali',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    ring: 'border-amber-500 ring-2 ring-amber-200',
  },
  PENGAJAR: {
    label: 'Pengajar / Ustadz',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
    ring: 'border-teal-500 ring-2 ring-teal-200',
  },
  WALI_KELAS: {
    label: 'Wali Kelas',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    ring: 'border-cyan-500 ring-2 ring-cyan-200',
  },
  PJ_KELOMPOK: {
    label: 'PJ Kelompok',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    ring: 'border-sky-500 ring-2 ring-sky-200',
  },
  PJ_DESA: {
    label: 'PJ Desa',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    ring: 'border-emerald-600 ring-2 ring-emerald-300',
  },
  PJ_DAERAH: {
    label: 'PJ Daerah',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ring: 'border-indigo-500 ring-2 ring-indigo-200',
  },
  ADMIN_MASTER: {
    label: 'Admin Master',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
    ring: 'border-purple-500 ring-2 ring-purple-200',
  },
};

export default function EditUserForm({
  user,
  referenceData,
  allowedRoles,
  managerRoles,
}: EditUserFormProps) {
  const router = useRouter();

  const effectiveManagerRoles = useMemo(
    () => managerRoles || [],
    [managerRoles]
  );

  // State Form
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    user.roles.map((r) => r.role)
  );
  const [fullName, setFullName] = useState(user.fullName);
  const [username, setUsername] = useState(user.username || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [email, setEmail] = useState(user.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [gender, setGender] = useState<Gender>(user.gender);
  const [status, setStatus] = useState<string>(user.status);
  const [organizationId, setOrganizationId] = useState(
    user.organizationId || ''
  );
  const [generationId, setGenerationId] = useState(user.generationId || '');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);

  // Tingkat wilayah yang diwajibkan oleh peran pengguna target saat ini
  const requiredOrgType = useMemo(
    () => getAllowedOrganizationTypeForRoles(selectedRoles),
    [selectedRoles]
  );

  // Filter daftar organisasi:
  // 1. Hanya di bawah tingkatan PJ pengelola
  // 2. Sesuai dengan peran target (Santri/Pengajar/dll -> Kelompok; PJ Desa -> Desa)
  const allowedOrganizations = useMemo(() => {
    return filterOrganizationsForUserManagement(
      referenceData.organizations,
      effectiveManagerRoles,
      selectedRoles
    );
  }, [referenceData.organizations, effectiveManagerRoles, selectedRoles]);

  const selectedOrganization = useMemo(
    () => referenceData.organizations.find((o) => o.id === organizationId) || null,
    [referenceData.organizations, organizationId]
  );

  // Auto-reset organizationId jika tidak valid dalam daftar yang diizinkan untuk peran saat ini
  useEffect(() => {
    if (organizationId) {
      const isValid = allowedOrganizations.some((o) => o.id === organizationId);
      if (!isValid) {
        setOrganizationId('');
      }
    }
  }, [allowedOrganizations, organizationId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSantri = selectedRoles.includes('SANTRI');

  const toggleRole = (role: UserRole) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== role));
      }
    } else {
      // Jika memilih peran administratif tingkat tinggi (PJ Desa, PJ Daerah, Admin)
      if (role === 'PJ_DESA' || role === 'PJ_DAERAH' || role === 'ADMIN_MASTER') {
        setSelectedRoles([role]);
      } else {
        // Jika memilih peran tingkat kelompok (Santri, Pengajar, Wali Kelas, dll), lepaskan peran teritorial tinggi
        const filtered = selectedRoles.filter(
          (r) => !['PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(r)
        );
        setSelectedRoles([...filtered, role]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Nama lengkap wajib diisi minimal 2 karakter.');
      return;
    }

    if (selectedRoles.length === 0) {
      setErrorMessage('Pengguna harus memiliki minimal satu peran aktif.');
      return;
    }

    if (isSantri && !generationId) {
      setErrorMessage('Jenjang generasi wajib dipilih untuk peran Santri.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: UpdateUserInput = {
        fullName: trimmedName,
        username: username.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        email: email.trim() || undefined,
        password: newPassword.trim() || undefined,
        gender,
        status,
        roles: selectedRoles,
        organizationId: organizationId || null,
        generationId: isSantri ? generationId || null : null,
      };

      const res = await updateUser(user.id, payload);

      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      router.push('/users');
      router.refresh();
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Terjadi kesalahan sistem saat memperbarui pengguna.'
      );
      setIsSubmitting(false);
    }
  };

  const selectedOrg = referenceData.organizations.find(
    (o) => o.id === organizationId
  );
  const selectedGen = referenceData.generations.find(
    (g) => g.id === generationId
  );

  const initials = fullName.trim()
    ? fullName
      .trim()
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
    : 'U';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors group"
        >
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 group-hover:border-emerald-300 flex items-center justify-center shadow-2xs transition-all">
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
          </div>
          <span>Kembali ke Kelola Pengguna</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/70 p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${gender === 'FEMALE'
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : 'bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}
          >
            {initials}
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                Edit Pengguna: {user.fullName}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : status === 'SUSPENDED'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
              >
                {status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Perbarui peran, data profil, penempatan wilayah, atau sesuaikan status keaktifan akun.
            </p>
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
            {/* Card 1: Peran Pengguna (Multi-Role) */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    1. Peran Pengguna (Roles)
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">
                  (Dapat memilih lebih dari satu)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {referenceData.availableRoles
                  .filter((r) => allowedRoles.includes(r.role))
                  .map((roleItem) => {
                    const isSelected = selectedRoles.includes(roleItem.role);
                    const theme = ROLE_THEMES[roleItem.role];

                    return (
                      <button
                        key={roleItem.role}
                        type="button"
                        onClick={() => toggleRole(roleItem.role)}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex items-start justify-between gap-2 cursor-pointer ${isSelected
                          ? `${theme.ring} bg-white shadow-xs`
                          : 'border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                          }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-xs font-black text-slate-900 block truncate">
                            {roleItem.label}
                          </span>
                          <span className="text-[10px] text-slate-500 block leading-tight">
                            {roleItem.description}
                          </span>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                            }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Card 2: Identitas & Kontak */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <User className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  2. Identitas &amp; Status Pengguna
                </h2>
              </div>

              <div className="space-y-3.5">
                {/* Nama Lengkap */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-medium transition-all"
                  />
                </div>

                {/* Jenis Kelamin & Status Akun */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Jenis Kelamin
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('MALE')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${gender === 'MALE'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        Laki-Laki
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('FEMALE')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${gender === 'FEMALE'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                      >
                        Perempuan
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Status Akun:
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-semibold bg-white cursor-pointer transition-all"
                    >
                      <option value="ACTIVE">Aktif (ACTIVE)</option>
                      <option value="INACTIVE">Nonaktif (INACTIVE)</option>
                      <option value="SUSPENDED">Ditangguhkan (SUSPENDED)</option>
                    </select>
                  </div>
                </div>

                {/* Nomor WhatsApp & Username */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Nomor WhatsApp / HP
                    </label>
                    <input
                      type="text"
                      placeholder="08xxxxxxxxxx"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-medium transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Username
                    </label>
                    <input
                      type="text"
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-medium transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Wilayah & Jenjang Generasi */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-4 h-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-800">
                  3. Wilayah Binaan &amp; Jenjang Generasi
                </h2>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      {requiredOrgType === 'KELOMPOK'
                        ? 'Wilayah Binaan (Tingkat Kelompok)'
                        : requiredOrgType === 'DESA'
                          ? 'Wilayah Binaan (Tingkat Desa)'
                          : requiredOrgType === 'DAERAH'
                            ? 'Wilayah Binaan (Tingkat Daerah)'
                            : 'Wilayah Binaan'}
                      <span className="text-rose-500"> *</span>
                    </label>
                  </div>

                  <OrganizationSelectTrigger
                    selectedOrg={selectedOrganization}
                    onClick={() => setIsOrgModalOpen(true)}
                    onClear={() => setOrganizationId('')}
                    allowClear={false}
                    placeholder={
                      requiredOrgType === 'KELOMPOK'
                        ? 'Pilih Kelompok Binaan...'
                        : requiredOrgType === 'DESA'
                          ? 'Pilih Desa Binaan...'
                          : requiredOrgType === 'DAERAH'
                            ? 'Pilih Daerah Binaan...'
                            : 'Pilih Wilayah Binaan...'
                    }
                  />

                  <OrganizationSelectModal
                    isOpen={isOrgModalOpen}
                    onClose={() => setIsOrgModalOpen(false)}
                    organizations={allowedOrganizations}
                    selectedId={organizationId}
                    onSelect={(org) => setOrganizationId(org ? org.id : '')}
                    allowClear={false}
                    title={
                      requiredOrgType === 'KELOMPOK'
                        ? 'Pilih Kelompok Binaan'
                        : requiredOrgType === 'DESA'
                          ? 'Pilih Desa Binaan'
                          : requiredOrgType === 'DAERAH'
                            ? 'Pilih Daerah Binaan'
                            : 'Pilih Wilayah Binaan'
                    }
                    description={
                      requiredOrgType === 'KELOMPOK'
                        ? 'Sesuai peran yang dipilih, pengguna wajib bernaung pada tingkat Kelompok binaan.'
                        : requiredOrgType === 'DESA'
                          ? 'Sesuai peran PJ Desa, pengguna wajib bernaung pada tingkat Desa binaan.'
                          : 'Pilih tingkatan wilayah binaan untuk pengguna ini.'
                    }
                  />

                  {allowedOrganizations.length === 0 && (
                    <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Belum ada wilayah binaan tingkat{' '}
                        {requiredOrgType === 'KELOMPOK' ? 'Kelompok' : 'Desa'}{' '}
                        di wilayah Anda. Silakan tambahkan terlebih dahulu di menu{' '}
                        <strong>Kelola Tingkatan</strong>.
                      </span>
                    </p>
                  )}
                </div>

                {isSantri && (
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Jenjang Generasi Santri <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required={isSantri}
                      value={generationId}
                      onChange={(e) => setGenerationId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-semibold bg-white cursor-pointer transition-all"
                    >
                      <option value="">-- Pilih Jenjang Generasi --</option>
                      {referenceData.generations.map((gen) => (
                        <option key={gen.id} value={gen.id}>
                          {gen.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Kredensial Login & Reset Password */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-bold text-slate-800">
                    4. Akun Login &amp; Reset Kata Sandi
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Email Login
                  </label>
                  <input
                    type="email"
                    placeholder="user@pengajian.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-medium transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Kata Sandi Baru (Opsional)
                  </label>
                  <input
                    type="password"
                    placeholder="Kosongkan jika tidak diubah"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 text-xs sm:text-sm text-slate-800 font-medium transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Linked Data & Realtime Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="lg:sticky lg:top-20 space-y-4">
              {/* Linked Data Summary */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2.5">
                  <GraduationCap className="w-4 h-4 text-teal-600" />
                  <span>Rekam Jejak Historis Pengguna</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-emerald-800">
                    <span className="text-sm sm:text-base font-black block">
                      {user.stats.attendancesCount}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 block">
                      Presensi
                    </span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 text-sky-800">
                    <span className="text-sm sm:text-base font-black block">
                      {user.stats.submissionsCount}
                    </span>
                    <span className="text-[10px] font-semibold text-sky-600 block">
                      Tugas Selesai
                    </span>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-purple-800">
                    <span className="text-sm sm:text-base font-black block">
                      {user.stats.classesCount}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-600 block">
                      Kelas Binaan
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Card */}
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 pt-1">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Kartu Pengguna (Live Preview)</span>
              </div>

              <div className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4 relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${gender === 'FEMALE'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                  >
                    {initials}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-base font-black text-slate-900 truncate">
                      {fullName.trim() || user.fullName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 truncate">
                      <span>@{username.trim() || 'username'}</span>
                      {phoneNumber && <span>• {phoneNumber}</span>}
                    </div>
                  </div>
                </div>

                {/* Role Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedRoles.map((role) => {
                    const theme = ROLE_THEMES[role];
                    return (
                      <span
                        key={role}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${theme.badgeBg}`}
                      >
                        {theme.label}
                      </span>
                    );
                  })}

                  {isSantri && selectedGen && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{selectedGen.name}</span>
                    </span>
                  )}
                </div>

                {/* Wilayah */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-[11px]">
                      {selectedOrg ? selectedOrg.name : 'Wilayah belum dipilih'}
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
            href="/users"
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
                <span>Simpan Perubahan Pengguna</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
