import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import PrivateRemedialForm from '@/components/private-remedial/PrivateRemedialForm';
import { approvePrivateRemedial, rejectPrivateRemedial } from './actions';
import {
  Users,
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Sparkles,
  Inbox,
  ShieldCheck,
  Calendar
} from 'lucide-react';

export default async function PrivateRemedialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all data in parallel to avoid multiple database roundtrips
  const [userProfile, students, teachers, pendingSchedules, approvedSchedules] = await Promise.all([
    user
      ? prisma.user.findUnique({
        where: { id: user.id },
        include: { roles: true },
      })
      : Promise.resolve(null),
    prisma.user.findMany({
      where: {
        roles: {
          some: { role: 'SANTRI' },
        },
      },
      select: {
        id: true,
        fullName: true,
        generation: {
          select: { name: true },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        roles: {
          some: { role: { in: ['PENGAJAR', 'WALI_KELAS', 'PJ_KELOMPOK'] } },
        },
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.schedule.findMany({
      where: {
        scheduleType: 'PRIVATE_REMEDIAL',
        approvalStatus: 'PENDING',
      },
      include: {
        teachers: {
          include: { teacher: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.schedule.findMany({
      where: {
        scheduleType: 'PRIVATE_REMEDIAL',
        approvalStatus: 'APPROVED',
      },
      include: {
        teachers: {
          include: { teacher: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: 10,
    }),
  ]);

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isPj =
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('ADMIN_MASTER');


  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/65 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-black-600" />
            <span>Pengajian Private &amp; Remedial</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Bimbingan capaian khusus, penugasan intensif, dan persetujuan sesi remedial.
          </p>
        </div>
      </div>

      {/* Kotak Masuk Persetujuan PJ (Approval Inbox) */}
      {isPj && (
        <div className="bg-white/65 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Inbox className="w-4 h-4 text-amber-600" />
              <span>Antrean Persetujuan Jadwal Private (Approval PJ)</span>
            </h3>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${pendingSchedules.length > 0
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600'
                }`}
            >
              {pendingSchedules.length} Menunggu
            </span>
          </div>

          <div className="space-y-3">
            {pendingSchedules.map((sch) => {
              const teacher = sch.teachers[0]?.teacher;
              const start = new Date(sch.startTime);
              const end = new Date(sch.endTime);

              return (
                <div
                  key={sch.id}
                  className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm text-slate-800">{sch.title}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {start.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })} •{' '}
                          {start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sch.venuePlaceName}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Diajukan oleh: <span className="font-semibold text-slate-700">{teacher?.fullName || 'Pengajar'}</span>
                    </div>
                  </div>

                  {/* Tombol Setujui / Tolak */}
                  <div className="flex items-center gap-2 shrink-0">
                    <form
                      action={async () => {
                        'use server';
                        await approvePrivateRemedial(sch.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Setujui Sesi</span>
                      </button>
                    </form>

                    <form
                      action={async () => {
                        'use server';
                        await rejectPrivateRemedial(sch.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold text-xs rounded-xl transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}

            {pendingSchedules.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                Semua pengajuan telah diproses. Tidak ada antrean persetujuan.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Pembuatan Jadwal Private */}
      <PrivateRemedialForm
        availableStudents={students}
        availableTeachers={teachers}
        currentUserId={user?.id || ''}
      />

      {/* Daftar Sesi Private Remedial Terjadwal */}
      <div className="bg-white/65 backdrop-blur-xl p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Riwayat &amp; Jadwal Private Remedial Terkonfirmasi ({approvedSchedules.length})</span>
        </h3>

        <div className="space-y-2.5">
          {approvedSchedules.map((sch) => {
            const teacher = sch.teachers[0]?.teacher;
            const start = new Date(sch.startTime);

            return (
              <div
                key={sch.id}
                className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-white flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">{sch.title}</div>
                  <div className="text-slate-500 mt-0.5">
                    {start.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • {sch.venuePlaceName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Ustadz: {teacher?.fullName} • Kuota: Maks 5 Santri
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                  Disetujui PJ
                </span>
              </div>
            );
          })}

          {approvedSchedules.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              Belum ada jadwal sesi private yang telah disetujui.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
