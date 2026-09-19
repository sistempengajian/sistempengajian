import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  School,
  ArrowLeft,
  Pencil,
  Calendar,
  CheckSquare,
  Users,
  MapPin,
  UserCheck,
  Phone,
  Clock,
  Sparkles,
  ArrowUpRight,
  HelpCircle,
  Award,
} from 'lucide-react';
import { TierLevel } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getClassDetail } from '../queries';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cls = await prisma.class.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: cls ? `${cls.name} | Sistem Pengajian` : 'Detail Kelas | Sistem Pengajian',
    description: 'Informasi lengkap ruang kelas pengajian, wali kelas, dan daftar santri binaan.',
  };
}

export default async function DetailKelasPage({ params }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const { id } = await params;

  let detailData;
  try {
    detailData = await getClassDetail(authUser.id, id);
  } catch (error) {
    console.error('Failed to load class detail:', error);
    notFound();
  }

  const { classData, students, schedules, assignments, userPermissions } = detailData;

  const genColorClass = (() => {
    switch (classData.generation.color) {
      case 'sky':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  })();

  const tierColorClass = (() => {
    switch (classData.tierLevel) {
      case TierLevel.DAERAH:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case TierLevel.DESA:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  })();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. Header Detail */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/kelas"
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
            title="Kembali ke Daftar Kelas"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${genColorClass}`}
              >
                {classData.generation.name} ({classData.generation.minAge}-{classData.generation.maxAge} thn)
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${tierColorClass}`}
              >
                {classData.tierLevel}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                TP {classData.academicYear}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {classData.name}
            </h1>
          </div>
        </div>

        {userPermissions.canEdit && (
          <Link
            href={`/kelas/${classData.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs sm:text-sm font-bold shadow-2xs transition-all self-start sm:self-auto"
          >
            <Pencil className="w-4 h-4" />
            <span>Ubah Data Kelas</span>
          </Link>
        )}
      </div>

      {/* 2. Kartu Ikhtisar Wilayah & Wali Kelas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wilayah Binaan */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Wilayah Binaan</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {classData.organization.name}
            </h3>
            <p className="text-xs text-slate-500">
              Tingkat {classData.organization.type}
              {classData.organization.parent && ` • Induk: ${classData.organization.parent.name}`}
            </p>
          </div>
        </div>

        {/* Wali Kelas Pengampu */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
            <UserCheck className="w-4 h-4 text-teal-600" />
            <span>Wali Kelas Pengampu</span>
          </div>
          {classData.homeroomTeacher ? (
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {classData.homeroomTeacher.fullName}
              </h3>
              <p className="text-xs text-slate-500">
                {classData.homeroomTeacher.phoneNumber ? (
                  <a
                    href={`tel:${classData.homeroomTeacher.phoneNumber}`}
                    className="hover:text-emerald-600 underline"
                  >
                    {classData.homeroomTeacher.phoneNumber}
                  </a>
                ) : (
                  'Kontak belum tersedia'
                )}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-bold text-slate-500">Belum Ditugaskan</h3>
              <p className="text-xs text-slate-400">Silakan tentukan wali kelas</p>
            </div>
          )}
        </div>

        {/* Statistik Ruang */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Aktivitas Pembelajaran</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Santri Terdaftar:</span>
            <strong className="text-slate-900 font-bold">{students.length} orang</strong>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Jadwal Sesi:</span>
            <strong className="text-slate-900 font-bold">{schedules.length} sesi</strong>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tugas Terdata:</span>
            <strong className="text-slate-900 font-bold">{assignments.length} tugas</strong>
          </div>
        </div>
      </div>

      {/* 3. Daftar Santri Binaan */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Santri Binaan di Kelas Ini
              </h2>
              <p className="text-xs text-slate-500">
                Santri jenjang {classData.generation.name} di {classData.organization.name}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {students.length} Santri
          </span>
        </div>

        {students.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
            Belum ada santri terdaftar pada jenjang {classData.generation.name} di wilayah {classData.organization.name}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map((student, idx) => (
              <div
                key={student.id}
                className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3 hover:bg-slate-100/80 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-800 truncate">
                    {student.fullName}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{student.gender === 'MALE' ? 'Ikhwan' : 'Akhwat'}</span>
                    <span>&bull;</span>
                    <span>{student.phoneNumber || 'Tanpa no. HP'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bagian Bawah: Jadwal & Tugas Pengajian */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jadwal Pengajian Terkait */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Jadwal Pengajian</h3>
            </div>
            <Link
              href="/jadwal"
              className="text-xs text-sky-700 font-bold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {schedules.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
              Belum ada jadwal sesi pengajian untuk kelas ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map((sch) => {
                const startTime = new Date(sch.startTime);
                return (
                  <Link
                    key={sch.id}
                    href={`/jadwal/${sch.id}`}
                    className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 hover:border-sky-300 flex items-center justify-between gap-3 text-xs transition-all group cursor-pointer shadow-2xs"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 group-hover:text-sky-700 transition-colors truncate">
                        {sch.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{sch.venuePlaceName}</span>
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>
                            {startTime.toLocaleDateString('id-ID', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                            , {startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                          </span>
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                        {sch.status === 'ACTIVE'
                          ? 'Berlangsung'
                          : sch.status === 'SCHEDULED'
                          ? 'Terjadwal'
                          : 'Selesai'}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Tugas Santri Terkait */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Tugas & Habit Harian</h3>
            </div>
            <Link
              href="/tugas"
              className="text-xs text-amber-700 font-bold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Lihat Semua</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {assignments.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
              Belum ada tugas yang ditugaskan ke kelas ini.
            </div>
          ) : (
            <div className="space-y-2.5">
              {assignments.map((asg) => (
                <div
                  key={asg.id}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-bold text-slate-800">{asg.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {asg.submissionsCount} pengumpulan &bull; +{asg.pointsReward} poin
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                    {asg.taskType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
