'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Trophy,
  Flame,
  Award,
  Calendar,
  Sparkles,
  Users,
  GraduationCap,
  Building2,
  Lock,
  CheckCircle2,
  ChevronRight,
  Star,
  Layers,
  HeartHandshake,
  Pencil,
  Edit3,
} from 'lucide-react';
import { displayPhoneNumber } from '@/lib/whatsapp/utils';
import LogoutCard from './LogoutCard';
import EditProfileModal from './EditProfileModal';
import EditPhoneModal from './EditPhoneModal';
import GoogleAuthButton from './GoogleAuthButton';

export interface UserProfileData {
  id: string;
  fullName: string;
  username: string | null;
  email: string | null;
  phoneNumber: string | null;
  gender: string;
  birthPlace: string | null;
  birthDate: Date | string | null;
  status: string;
  createdAt: Date | string;
  generation: {
    id: string;
    code: string;
    name: string;
    color: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    type: string;
    parent: {
      id: string;
      name: string;
      type: string;
      parent: {
        id: string;
        name: string;
        type: string;
      } | null;
    } | null;
  } | null;
  roles: Array<{ role: string }>;
  gamification: {
    level: number;
    totalPoints: number;
    currentStreakDays: number;
    highestStreakDays: number;
  } | null;
  badgesCount: number;
  parents: Array<{
    relationshipType: string;
    parent: {
      id: string;
      fullName: string;
      phoneNumber: string | null;
      email: string | null;
    };
  }>;
  children: Array<{
    student: {
      id: string;
      fullName: string;
      phoneNumber: string | null;
      generation: { name: string; code: string } | null;
    };
  }>;
  homeroomClasses: Array<{
    id: string;
    name: string;
    academicYear: string;
  }>;
}

interface ProfileClientViewProps {
  user: UserProfileData;
}

const ROLE_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SANTRI: { label: 'Santri Generasi', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ORANG_TUA: { label: 'Orang Tua / Wali', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  PENGAJAR: { label: 'Pengajar / Ustadz', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  WALI_KELAS: { label: 'Wali Kelas', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  PJ_KELOMPOK: { label: 'PJ Kelompok', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  PJ_DESA: { label: 'PJ Desa', color: 'text-blue-800', bg: 'bg-blue-100/70', border: 'border-blue-300' },
  PJ_DAERAH: { label: 'PJ Daerah', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  ADMIN_MASTER: { label: 'Admin Master Pusat', color: 'text-purple-900', bg: 'bg-purple-100/80', border: 'border-purple-300' },
};

export default function ProfileClientView({ user: initialUser }: ProfileClientViewProps) {
  const [currentUser, setCurrentUser] = useState<UserProfileData>(initialUser);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isEditPhoneOpen, setIsEditPhoneOpen] = useState(false);

  // Initial avatar representation
  const initials = currentUser.fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const roleCodes = currentUser.roles.map((r) => r.role);
  const isSantri = roleCodes.includes('SANTRI') || Boolean(currentUser.generation);
  const isOrangTua = roleCodes.includes('ORANG_TUA') || currentUser.children.length > 0;

  // Hierarchy Wilayah
  const kelompokName = currentUser.organization?.type === 'KELOMPOK' ? currentUser.organization.name : null;
  const desaName =
    currentUser.organization?.type === 'DESA'
      ? currentUser.organization.name
      : currentUser.organization?.parent?.type === 'DESA'
      ? currentUser.organization.parent.name
      : null;
  const daerahName =
    currentUser.organization?.type === 'DAERAH'
      ? currentUser.organization.name
      : currentUser.organization?.parent?.type === 'DAERAH'
      ? currentUser.organization.parent.name
      : currentUser.organization?.parent?.parent?.type === 'DAERAH'
      ? currentUser.organization.parent.parent.name
      : null;

  const formattedJoinDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(currentUser.createdAt));

  // Format Tanggal Lahir jika ada
  const formattedBirthDate = currentUser.birthDate
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(currentUser.birthDate))
    : null;

  const ttlString = (() => {
    if (currentUser.birthPlace && formattedBirthDate) {
      return `${currentUser.birthPlace}, ${formattedBirthDate}`;
    }
    if (currentUser.birthPlace) return currentUser.birthPlace;
    if (formattedBirthDate) return formattedBirthDate;
    return 'Belum diisi';
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* 1. Hero Card Profil */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/95 via-slate-50/80 to-slate-100/90 border border-slate-200/80 p-5 sm:p-7 shadow-sm">
        {/* Ambient Gradient Backdrop */}
        <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-amber-500/10 pointer-events-none" />

        <div className="relative z-10 flex sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 p-1 shadow-md shadow-emerald-500/20">
                <div className="w-full h-full rounded-[22px] bg-slate-900 text-white flex items-center justify-center font-black text-2xl sm:text-3xl">
                  {initials}
                </div>
              </div>
              {/* Online/Active Badge */}
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white"
                title="Akun Aktif"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Identity & Badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 max-[340px]:flex-wrap mb-1 truncate">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  {currentUser.fullName}
                </h1>
                {currentUser.status === 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Aktif
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mb-3">
                {currentUser.username ? `@${currentUser.username}` : currentUser.email || 'Akun Terverifikasi'}
              </p>

              {/* Role Badges List */}
              <div className="flex truncate flex-inline items-center gap-1.5 max-[460px]:flex-wrap">
                {currentUser.roles.map((r) => {
                  const config = ROLE_BADGE_CONFIG[r.role] || {
                    label: r.role,
                    color: 'text-slate-700',
                    bg: 'bg-slate-100',
                    border: 'border-slate-200',
                  };
                  return (
                    <span
                      key={r.role}
                      className={`flex-shrink-0 truncate max-w-[150px] items-center px-2.5 py-1 rounded-xl text-[11px] font-bold border ${config.bg} ${config.color} ${config.border} shadow-2xs`}
                    >
                      {config.label}
                    </span>
                  );
                })}

                {currentUser.generation && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                    <GraduationCap className="w-3 h-3 text-amber-600" />
                    <span>Jenjang {currentUser.generation.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Edit Profile Button */}
          <button
            type="button"
            onClick={() => setIsEditProfileOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-95 text-xs font-bold transition-all cursor-pointer shrink-0 self-start sm:self-center"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Edit Profil</span>
          </button>
        </div>
      </div>

      {/* 2. Capaian Gamifikasi Ringkas (Jika ada data gamifikasi) */}
      {currentUser.gamification && (
        <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center font-bold text-xs shadow-2xs flex-shrink-0">
                <Trophy className="w-4 h-4 fill-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Capaian &amp; Poin Belajar</h3>
                <p className="text-[11px] text-slate-500">Statistik gamifikasi dan dedikasi ibadah</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/gamifikasi"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200/70 transition-all active:scale-95 cursor-pointer"
              >
                <span>Misi &amp; Trofi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Level */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs shrink-0">
                Lv.{currentUser.gamification.level}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Level Akun</span>
                <span className="text-sm font-black text-slate-900 truncate truncate">Tingkat {currentUser.gamification.level}</span>
              </div>
            </div>

            {/* Total Poin XP */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold shrink-0">
                <Star className="w-4 h-4 fill-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total XP</span>
                <span className="text-sm font-black text-slate-900 truncate">{currentUser.gamification.totalPoints.toLocaleString('id-ID')} XP</span>
              </div>
            </div>

            {/* Streak Hari */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold shrink-0">
                <Flame className="w-4 h-4 fill-orange-400" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Streak Aktif</span>
                <span className="text-sm font-black text-slate-900 truncate">{currentUser.gamification.currentStreakDays} Hari</span>
              </div>
            </div>

            {/* Lencana Terbuka */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Koleksi Lencana</span>
                <span className="text-sm font-black text-slate-900 truncate">{currentUser.badgesCount} Trofi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Grid Informasi Kontak & Wilayah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kolom Kiri: Informasi Kontak & Akun */}
        <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200/60">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Informasi Pribadi &amp; Kontak</h3>
                <p className="text-[11px] text-slate-500">Data akun yang terdaftar dalam sistem</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Nomor WhatsApp & Tombol Verifikasi OTP */}
            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Nomor WhatsApp</span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 truncate block">
                    {displayPhoneNumber(currentUser.phoneNumber)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditPhoneOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100/70 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold transition-all active:scale-95 cursor-pointer shrink-0 border border-emerald-200/80"
                title="Ganti nomor WhatsApp dengan verifikasi OTP"
              >
                <span>Ubah Nomor</span>
              </button>
            </div>

            {/* Email & Google Auth Button */}
            <GoogleAuthButton email={currentUser.email} />

            {/* Tempat & Tanggal Lahir (TTL) */}
            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Tempat, Tanggal Lahir
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-slate-900 truncate block">
                    {ttlString}
                  </span>
                </div>
              </div>
            </div>

            {/* Jenis Kelamin */}
            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-2.5">
              <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Jenis Kelamin</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                  {currentUser.gender === 'MALE' ? 'Laki-laki (Ikhwan)' : 'Perempuan (Akhwat)'}
                </span>
              </div>
            </div>

            {/* Tanggal Bergabung */}
            <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-center gap-2.5">
              <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Terdaftar Sejak</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-900">{formattedJoinDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Wilayah Binaan & Struktur Hubungan */}
        <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/60">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Wilayah &amp; Relasi Binaan</h3>
              <p className="text-[11px] text-slate-500">Struktur organisasi dan keterhubungan data</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Hierarki Wilayah */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Penempatan Wilayah
              </span>

              <div className="space-y-1.5 text-xs">
                {daerahName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Daerah</span>
                    <strong className="text-slate-900">{daerahName}</strong>
                  </div>
                )}
                {desaName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Desa</span>
                    <strong className="text-slate-900">{desaName}</strong>
                  </div>
                )}
                {kelompokName && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Kelompok</span>
                    <strong className="text-emerald-700">{kelompokName}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Hubungan Keluarga: Wali (Jika Santri) */}
            {isSantri && currentUser.parents.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Orang Tua / Wali Santri Terdaftar</span>
                </div>
                <div className="space-y-1">
                  {currentUser.parents.map((p) => (
                    <div key={p.parent.id} className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                      <span className="text-slate-600">{p.relationshipType}: {p.parent.fullName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{displayPhoneNumber(p.parent.phoneNumber)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hubungan Keluarga: Anak Binaan (Jika Orang Tua) */}
            {isOrangTua && currentUser.children.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Daftar Ananda Santri Terhubung ({currentUser.children.length})</span>
                </div>
                <div className="space-y-1.5">
                  {currentUser.children.map((c) => (
                    <div key={c.student.id} className="p-2 rounded-xl bg-white border border-indigo-100 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-slate-900 block">{c.student.fullName}</strong>
                        <span className="text-[10px] text-indigo-600 font-medium">Jenjang: {c.student.generation?.name || 'Santri'}</span>
                      </div>
                      <Link
                        href={`/laporan?studentId=${c.student.id}`}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer"
                      >
                        Lihat Rapor
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kelas Binaan (Jika Wali Kelas) */}
            {currentUser.homeroomClasses.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  <span>Wali Kelas Atas:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentUser.homeroomClasses.map((cl) => (
                    <span key={cl.id} className="px-2.5 py-1 rounded-xl bg-white border border-teal-200 text-teal-800 text-xs font-bold">
                      {cl.name} ({cl.academicYear})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Keamanan Akun & Metode Masuk */}
      <div className="rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <div className="w-8 h-8 flex-shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200/60">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Keamanan &amp; Metode Otentikasi</h3>
            <p className="text-[11px] text-slate-500">Perlindungan sesi dan otorisasi WhatsApp Gateway</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-emerald-950 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold mb-1">Proteksi Login WhatsApp Magic Link</h4>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Akun Anda dilindungi dengan metode autentikasi tanpa kata sandi (Passwordless). Setiap tautan masuk hanya berlaku 1 kali penggunaan dengan jeda anti-spam 5 menit.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-slate-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold mb-1">Status Sesi Aktif Terverifikasi</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sesi browser Anda saat ini dienkripsi dengan standar token Supabase Auth JWT &amp; HTTP-only cookies aman.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Zona Keluar (Logout Card) */}
      <LogoutCard userName={currentUser.fullName} userEmail={currentUser.email} />

      {/* Modals */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        initialData={{
          fullName: currentUser.fullName,
          username: currentUser.username,
          birthPlace: currentUser.birthPlace,
          birthDate: currentUser.birthDate,
        }}
        onSuccess={() => {
          // Re-render handled by server action revalidation or page refresh
          window.location.reload();
        }}
      />

      <EditPhoneModal
        isOpen={isEditPhoneOpen}
        onClose={() => setIsEditPhoneOpen(false)}
        currentPhone={currentUser.phoneNumber}
        onSuccess={(newPhone) => {
          setCurrentUser((prev) => ({ ...prev, phoneNumber: newPhone }));
          window.location.reload();
        }}
      />
    </div>
  );
}
