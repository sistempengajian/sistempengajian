import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Award,
  BookOpen,
  CheckSquare,
  BarChart3,
  Users,
  Shield,
  QrCode,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  Inbox,
  AlertTriangle,
  FileText,
  UserCheck,
  Building2,
  CheckCircle2,
  Activity,
  Check,
  Star,
  Layers,
  Landmark,
  School,
  Presentation,
} from 'lucide-react';

import { getRoleTheme, COMMON_THEME } from '@/lib/theme';
import StatusGridSection from '@/components/dashboard/StatusGridSection';
import ProgressCircle from '@/components/dashboard/ProgressCircle';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // Fetch full user profile, upcoming schedule, and pending approvals concurrently
  const [profile, nextSchedule, rawPendingApprovalsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        organization: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        generation: true,
        roles: true,
        gamification: true,
        children: {
          include: {
            student: {
              include: {
                generation: true,
                gamification: true,
              },
            },
          },
        },
        homeroomClasses: true,
      },
    }),
    prisma.schedule.findFirst({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
      },
      orderBy: { startTime: 'asc' },
      include: {
        organization: true,
        class: {
          include: {
            generation: true,
          },
        },
        teachers: {
          include: {
            teacher: true,
          },
        },
      },
    }),
    prisma.schedule.count({
      where: {
        scheduleType: 'PRIVATE_REMEDIAL',
        approvalStatus: 'PENDING',
      },
    }),
  ]);

  if (!profile) {
    redirect('/login');
  }

  // Fetch materi kurikulum yang akan disampaikan sesuai jadwal / jenjang pengguna
  const targetGenId = nextSchedule?.class?.generationId || profile.generationId;
  const scheduledMaterial = await prisma.material.findFirst({
    where: {
      isActive: true,
      ...(targetGenId ? { targetGenerationId: targetGenId } : {}),
    },
    include: {
      targetGeneration: true,
    },
    orderBy: [{ isMandatoryForTarget: 'desc' }, { createdAt: 'desc' }],
  });

  const targetMaterialGenCode = scheduledMaterial?.targetGeneration?.code || profile.generation?.code || 'CABERAWIT';
  const targetMaterialUrl = scheduledMaterial
    ? `/kurikulum?gen=${targetMaterialGenCode}#material-${scheduledMaterial.id}`
    : `/kurikulum?gen=${targetMaterialGenCode}`;

  // Determine user role flags
  const roleCodes = profile.roles.map((r) => r.role);
  const isSantri = roleCodes.includes('SANTRI');
  const isOrangTua = roleCodes.includes('ORANG_TUA');
  const isPengajar = roleCodes.includes('PENGAJAR');
  const isWaliKelas = roleCodes.includes('WALI_KELAS');
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH');
  const isAdmin = roleCodes.includes('ADMIN_MASTER');

  const defaultRoleParam = isSantri
    ? 'role=student'
    : isOrangTua
      ? 'role=parent'
      : (isPengajar || isWaliKelas)
        ? 'role=teacher'
        : 'role=manage';

  const defaultScheduleHref = `/jadwal?${defaultRoleParam}`;
  const defaultKurikulumHref = `/kurikulum?${defaultRoleParam}`;

  const pendingApprovalsCount = isPj || isAdmin ? rawPendingApprovalsCount : 0;

  // Nama wilayah (kelompoknya saja)
  const kelompokName = profile.organization?.name || 'Kelompok Binaan';

  // Theme definition per role
  const baseTheme = getRoleTheme(roleCodes);
  const theme = {
    ...baseTheme,
    roleTitle: isSantri
      ? `Santri • ${profile.generation?.name || 'Reguler'}`
      : baseTheme.roleTitle,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Hero Section: Sapaan, Badge Generasi & Kelompok, dan Kalimat Support Singkat */}
      <section className="rounded-2xl bg-white/1 backdrop-blur-xl border border-slate-200/10 p-5 sm:p-6 transition-all space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Assalamu&apos;alaikum, {profile.fullName}
            </h1>

            {/* Badge Generasi User & Nama Wilayah (Kelompoknya Saja) */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {profile.generation?.name ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                  {profile.generation.name}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.badgeClass}`}
                >
                  {theme.roleTitle}
                </span>
              )}

              {kelompokName && (
                <span className={`bg-white/60 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.badgeClass}`}>
                  {kelompokName}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Kalimat Support Singkat */}
        <p className="text-xs sm:text-[13px] text-slate-600 font-normal leading-relaxed pt-2 border-t border-slate-200/50">
          {isSantri
            ? "Semoga senantiasa bersemangat dalam mempelajari Al-Qur'an dan menggapai generasi unggul berkarakter."
            : isPengajar || isWaliKelas
              ? "Selamat berkhidmah membina generasi Qur'ani dengan keikhlasan dan kesabaran."
              : isOrangTua
                ? "Mendampingi ananda tumbuh menjadi generasi unggul yang faham, faqih, dan berakhlak mulia."
                : "Mengemban amanah tata kelola pembinaan pengajian dengan rapi dan terstruktur."}
        </p>
      </section>

      {/* 2. Grid Status: Dipisahkan di bawah Hero, Hanya Icon & Title (Detail dalam Modal) */}
      <StatusGridSection
        roleKey={theme.roleKey}
        theme={theme}
        data={{
          fullName: profile.fullName,
          generationName: profile.generation?.name,
          gamification: profile.gamification,
          childrenList: profile.children.map(({ student, relationshipType }) => ({
            id: student.id,
            fullName: student.fullName,
            generationName: student.generation?.name,
            points: student.gamification?.totalPoints,
            relationshipType,
          })),
          homeroomClassesCount: profile.homeroomClasses.length,
          pendingApprovalsCount,
          nextScheduleTitle: nextSchedule?.title,
          nextScheduleTime: nextSchedule
            ? `${new Date(nextSchedule.startTime).toLocaleDateString('id-ID', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })} • ${new Date(nextSchedule.startTime).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })} WIB`
            : undefined,
          nextScheduleVenue: nextSchedule?.venuePlaceName,
        }}
      />

      {/* 3. Sesi Pengajian Terdekat: Clean & Modern Glassmorphic Card */}
      <section className="bg-white/30 backdrop-blur-md border border-slate-200/50 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span>Sesi Pengajian Terdekat</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {nextSchedule ? 'Jadwal Aktif' : 'Terjadwal'}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {nextSchedule ? nextSchedule.title : 'Pengajian Rutin Terjadwal'}
            </h2>

            <div className="flex flex-col items-start gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <Clock className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>
                  {nextSchedule
                    ? `${new Date(nextSchedule.startTime).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })} • ${new Date(nextSchedule.startTime).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} WIB`
                    : 'Rabu, 09 Sep • 16:30 WIB'}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <MapPin className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>{nextSchedule?.venuePlaceName || 'Masjid Baitul Makmur'}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <UserCheck className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>{nextSchedule?.teachers[0]?.teacher.fullName || 'Ustadz Abdullah S.Pd.I'}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <BookOpen className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>{scheduledMaterial?.title || 'Tafsir Al-Qur\'an & Praktik Tajwid Terpadu'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 sm:pt-0 self-start sm:self-center shrink-0">
              <Link
                href={defaultScheduleHref}
                prefetch={true}
                className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Lihat Jadwal</span>
              </Link>
              <Link
                href={targetMaterialUrl}
                prefetch={true}
                className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Target Materi</span>
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Tampilan Khusus Peran */}

      {/* A. VIEW SANTRI: Capaian Kurikulum & Rapor Belajar */}
      {isSantri && (
        <section className={COMMON_THEME.cardClassPadded}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={COMMON_THEME.sectionTitleClass}>
                    Capaian Kurikulum &amp; Rapor Belajar  {profile.generation?.name || 'Caberawit'}
                  </h3>

                </div>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Rekapitulasi target silabus &amp; standar kompetensi kelulusan santri
                </p>
              </div>
            </div>


          </div>
          <div className='flex justify-start gap-3 mb-4'>
            <Link
              href="/laporan"
              prefetch={true}
              className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 self-start sm:self-center shrink-0 cursor-pointer`}
            >
              <span>Buka Rapor Lengkap</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>


          <div className="space-y-3">
            {/* Item 1: Kurikulum Wajib (Belum Full -> Line & Checklist Kuning) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Kurikulum Wajib (Syarat Kelulusan)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                    85% Selesai
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  17 dari 20 checklist standar kelulusan materi baku telah terpenuhi
                </p>
              </div>

              {/* Circle Line Bar di sisi kanan progress (Kuning saat belum full) */}
              <ProgressCircle percentage={85} size={48} />
            </div>

            {/* Item 2: Modul Tambahan & Pengayaan (Belum Full -> Line & Checklist Kuning) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Modul Tambahan &amp; Pengayaan
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
                    65% Selesai
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  13 dari 20 checklist materi pilihan &amp; pengayaan halaqah
                </p>
              </div>

              {/* Circle Line Bar di sisi kanan progress (Kuning saat belum full) */}
              <ProgressCircle percentage={65} size={48} />
            </div>

            {/* Item 3: Adab & Pembiasaan Harian (Penuh 100% -> Line & Checklist Hijau) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                    Adab &amp; Pembiasaan Harian
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    100% Tuntas
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  10 dari 10 target kedisiplinan sholat &amp; adab harian tuntas sempurna
                </p>
              </div>

              {/* Circle Line Bar di sisi kanan progress (Hijau saat penuh) */}
              <ProgressCircle percentage={100} size={48} />
            </div>
          </div>
        </section>
      )}

      {/* B. VIEW ORANG TUA: Daftar Ananda dalam Binaan */}
      {isOrangTua && (
        <section id="anak" className={COMMON_THEME.cardClassPadded}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={COMMON_THEME.sectionTitleClass}>
                    Daftar Ananda dalam Binaan ({profile.children.length} Santri)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-normal mt-0.5">
                  Pantau capaian rapor hafalan, kehadiran, dan kedisiplinan ananda
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {profile.children.map(({ student, relationshipType }) => (
              <div
                key={student.id}
                className="p-3.5 rounded-2xl bg-white/40 hover:bg-white/60 backdrop-blur-sm border border-slate-200/50 flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-bold text-sm text-slate-900 leading-tight">
                      {student.fullName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      {student.generation?.name || 'Caberawit'} <Star className="size-3 text-[#ffaf29] fill-[#ffaf29]" />
                      {student.gamification?.totalPoints || 0} Poin
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/laporan?childId=${student.id}`}
                    prefetch={true}
                    className="px-3 py-1.5 rounded-xl bg-white/0 hover:bg-slate-50 text-indigo-600 font-semibold text-xs transition-all flex items-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer ml-1"
                  >

                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-[11px] font-semibold text-slate-700">Rapor Ananda</span>
                      <span className="text-[10px] text-slate-400">80% Tercapai</span>
                    </div>
                    <ProgressCircle percentage={80} size={42} />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Banner Cepat Ajukan Izin Sakit */}
          < div
            id="izin"
            className="mt-3.5 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Ajukan Izin / Sakit Ananda
                </span>
                <span className="text-[11px] text-slate-600">
                  Kirim surat dispensasi halangan hadir langsung ke ustadz pembina halaqah.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shrink-0 self-end sm:self-center cursor-pointer"
            >
              Kirim Izin
            </button>
          </div>
        </section>
      )}

      {/* C. VIEW PENGAJAR / WALI KELAS: Tugas & Presensi Kelas */}
      {(isPengajar || isWaliKelas) && (
        <section id="presensi" className={COMMON_THEME.cardClassPadded}>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className={COMMON_THEME.sectionTitleClass}>
                  Tugas &amp; Presensi Kelas Mengajar
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Kelola dynamic QR presensi santri dan penugasan badal halaqah
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white/40 hover:bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3 shadow-2xs transition-all">
              <div>
                <div className="font-bold text-xs text-slate-900">
                  Presensi Sesi Pengajian
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tampilkan Dynamic QR TOTP di layar kelas
                </div>
              </div>
              <Link
                href="/presensi"
                prefetch={true}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Buka QR</span>
              </Link>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white/40 hover:bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3 shadow-2xs transition-all">
              <div>
                <div className="font-bold text-xs text-slate-900">
                  Delegasi Badal Guru
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tunjuk ustadz pengganti saat berhalangan
                </div>
              </div>
              <Link
                href="/jadwal"
                prefetch={true}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
              >
                <span>Ajukan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* D. VIEW PJ KELOMPOK / DESA / DAERAH: Metrik Wilayah */}
      {isPj && (
        <section className={COMMON_THEME.cardClassPadded}>
          <div className="flex items-center gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className={COMMON_THEME.sectionTitleClass}>
                  Metrik Tata Kelola Wilayah
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Pemantauan keaktifan santri &amp; approval sesi private remedial
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-150 rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm py-3 text-center shadow-2xs">
            <div>
              <div className="text-lg sm:text-xl font-black text-slate-900">48</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                Santri Binaan
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-emerald-600">92.4%</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                Rata-rata Hadir
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-rose-600">
                {pendingApprovalsCount}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                Pending Approval
              </div>
            </div>
          </div>

          {pendingApprovalsCount > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Terdapat {pendingApprovalsCount} pengajuan Private Remedial menunggu verifikasi Anda.
                </span>
              </div>
              <Link
                href="/private-remedial"
                prefetch={true}
                className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-2xs"
              >
                Tinjau
              </Link>
            </div>
          )}
        </section>
      )}

      {/* E. VIEW ADMIN MASTER: Metrik Global Sistem */}
      {isAdmin && (
        <section className={COMMON_THEME.cardClassPadded}>
          <div className="flex items-center gap-3 mb-4">

            <div>
              <div className="flex items-center gap-2">
                <h3 className={COMMON_THEME.sectionTitleClass}>
                  Pusat Kendali Admin Master
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Monitoring integritas hierarki wilayah, dewan guru, dan database
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-150 rounded-2xl border border-slate-200/50 bg-white/40 backdrop-blur-sm py-3 text-center shadow-2xs">
            <div className="py-1">
              <div className="text-base sm:text-lg font-black text-slate-900">12</div>
              <div className="text-[11px] text-slate-500 font-medium">Wilayah Binaan</div>
            </div>
            <div className="py-1">
              <div className="text-base sm:text-lg font-black text-slate-900">18</div>
              <div className="text-[11px] text-slate-500 font-medium">Dewan Guru</div>
            </div>
            <div className="py-1">
              <div className="text-base sm:text-lg font-black text-slate-900">120</div>
              <div className="text-[11px] text-slate-500 font-medium">Total Santri</div>
            </div>
            <div className="py-1">
              <div className="text-base sm:text-lg font-black text-emerald-600">Normal</div>
              <div className="text-[11px] text-slate-500 font-medium">Status Database</div>
            </div>
          </div>
        </section>
      )}

      {/* 5. MENU UTAMA SISTEM: Bersih Tanpa Background Abu-Abu, Icon Sesuai Warna Role */}
      <section className={COMMON_THEME.cardClassPadded}>
        <div className="flex items-center justify-between px-0.5 mb-3">
          <h3 className={COMMON_THEME.sectionTitleClass}>
            Menu Utama Sistem {profile.generation?.name || ''}
          </h3>
        </div>

        {/* A. MENU UTAMA KHUSUS SANTRI */}
        {isSantri && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
            <Link
              href="/kelas?role=student"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelas Saya
              </span>
            </Link>

            <Link
              href="/kurikulum?role=student"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kurikulum
              </span>
            </Link>

            <Link
              href="/tugas?role=student"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Tugas Saya
              </span>
            </Link>

            <Link
              href="/jadwal?role=student"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jadwal Saya
              </span>
            </Link>

            <Link
              href="/private-remedial"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Remedial
              </span>
            </Link>

            <Link
              href="/presensi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <QrCode className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Presensi QR
              </span>
            </Link>

            <Link
              href="/laporan"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Rapor Belajar
              </span>
            </Link>
          </div>
        )}

        {/* B. MENU UTAMA KHUSUS ORANG TUA */}
        {isOrangTua && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-3">
            <Link
              href="/kelas?role=parent"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelas Ananda
              </span>
            </Link>

            <Link
              href="/laporan"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Rapor Anak
              </span>
            </Link>

            <Link
              href="/tugas?role=parent"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Tugas Anak
              </span>
            </Link>

            <Link
              href="/jadwal?role=parent"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jadwal Anak
              </span>
            </Link>

            <a
              href="#izin"
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Izin &amp; Sakit
              </span>
            </a>

            <Link
              href="/private-remedial"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Remedial
              </span>
            </Link>

            <Link
              href="/jadwal?role=parent"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kontak Guru
              </span>
            </Link>
          </div>
        )}

        {/* C. MENU UTAMA KHUSUS PENGAJAR / WALI KELAS */}
        {(isPengajar || isWaliKelas) && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
            <Link
              href="/kelas?role=teacher"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelas Binaan
              </span>
            </Link>

            <Link
              href="/laporan"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Rapor Belajar
              </span>
            </Link>

            <Link
              href="/analisis"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Analitika &amp; Presentasi
              </span>
            </Link>

            <Link
              href="/presensi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <QrCode className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Buka Presensi
              </span>
            </Link>

            <Link
              href="/kurikulum?role=teacher"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kurikulum
              </span>
            </Link>

            <Link
              href="/jadwal?role=teacher"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jadwal Mengajar
              </span>
            </Link>

            <Link
              href="/tugas?role=teacher"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Tugas Santri
              </span>
            </Link>

            <Link
              href="/private-remedial"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Private / Remedial
              </span>
            </Link>

            <Link
              href="/jadwal?role=teacher"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Delegasi Badal
              </span>
            </Link>
          </div>
        )}

        {/* D. MENU UTAMA KHUSUS PENGURUS WILAYAH (PJ KELOMPOK, DESA, DAERAH) */}
        {isPj && !isAdmin && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
            <Link
              href="/kelas?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola Kelas
              </span>
            </Link>

            <Link
              href="/analisis"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Analitika Eksekutif
              </span>
            </Link>

            <Link
              href="/kurikulum?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kurikulum
              </span>
            </Link>

            <Link
              href="/jadwal?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola Jadwal
              </span>
            </Link>

            <Link
              href="/tugas?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Monitoring Tugas
              </span>
            </Link>

            <Link
              href="/private-remedial"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0 relative`}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
                )}
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Approval
              </span>
            </Link>

            <Link
              href="/users"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola User
              </span>
            </Link>

            <Link
              href="/generasi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jenjang Generasi
              </span>
            </Link>

            <Link
              href="/organisasi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Landmark className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Tingkatan Wilayah
              </span>
            </Link>
          </div>
        )}

        {/* E. MENU UTAMA KHUSUS ADMIN MASTER */}
        {isAdmin && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
            <Link
              href="/kelas?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola Kelas
              </span>
            </Link>

            <Link
              href="/analisis"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Presentation className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Analitika Eksekutif
              </span>
            </Link>

            <Link
              href="/kurikulum?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kurikulum
              </span>
            </Link>

            <Link
              href="/jadwal?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jadwal Global
              </span>
            </Link>

            <Link
              href="/tugas?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Monitoring Tugas
              </span>
            </Link>

            <Link
              href="/private-remedial"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0 relative`}
              >
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
                )}
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Approval
              </span>
            </Link>

            <Link
              href="/users"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Users className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola User
              </span>
            </Link>

            <Link
              href="/generasi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Layers className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Jenjang Generasi
              </span>
            </Link>

            <Link
              href="/organisasi"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Landmark className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Tingkatan Wilayah
              </span>
            </Link>

            <Link
              href="/kelas?role=manage"
              prefetch={true}
              className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center"
            >
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <School className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Kelola Kelas
              </span>
            </Link>

            <div className="group flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-150 active:scale-95 hover:-translate-y-0.5 cursor-pointer text-center">
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl ${theme.menuIconClass} flex items-center justify-center shadow-xs transition-all duration-200 group-hover:scale-105 shrink-0`}
              >
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </div>
              <span className="text-xs sm:text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors mt-2 text-center leading-tight">
                Audit Log
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
