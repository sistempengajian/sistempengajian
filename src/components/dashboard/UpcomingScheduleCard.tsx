import React from 'react';
import Link from 'next/link';
import { Clock, MapPin, UserCheck, BookOpen, Calendar } from 'lucide-react';

interface UpcomingScheduleCardProps {
  nextSchedule: any;
  scheduledMaterial: any;
  theme: {
    accentColor: string;
    accentBorder: string;
    [key: string]: any;
  };
  defaultScheduleHref: string;
  targetMaterialUrl: string;
}

export default function UpcomingScheduleCard({
  nextSchedule,
  scheduledMaterial,
  theme,
  defaultScheduleHref,
  targetMaterialUrl,
}: UpcomingScheduleCardProps) {
  return (
    <section className="bg-white/30 backdrop-blur-md border border-slate-200/50 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all">
      {nextSchedule ? (
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
                Jadwal Aktif
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {nextSchedule.title}
            </h2>

            <div className="flex flex-col items-start gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <Clock className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>
                  {new Date(nextSchedule.startTime).toLocaleDateString(
                    'id-ID',
                    {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }
                  )}{' '}
                  •{' '}
                  {new Date(nextSchedule.startTime).toLocaleTimeString(
                    'id-ID',
                    {
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  )}{' '}
                  WIB
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <MapPin className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>
                  {nextSchedule.venuePlaceName || 'Tempat belum ditentukan'}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <UserCheck className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>
                  {nextSchedule.teachers[0]?.teacher?.fullName ||
                    'Ustadz belum ditugaskan'}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/40 border border-slate-200/10 font-medium text-slate-800">
                <BookOpen className={`w-3.5 h-3.5 ${theme.accentColor}`} />
                <span>
                  {scheduledMaterial?.title ||
                    'Materi target belum ditentukan'}
                </span>
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
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-slate-500/10 text-slate-700 border border-slate-300/50">
                <span>Kalender Pengajian</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Belum Ada Sesi Aktif
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Belum Ada Sesi Pengajian Terjadwal
            </h2>

            <p className="text-xs text-slate-500 font-normal leading-relaxed max-w-xl">
              Jadwal sesi pengajian rutin akan tampil otomatis di sini setelah diagendakan oleh pengurus wilayah.
            </p>

            <div className="flex items-center gap-2 pt-1 sm:pt-0 self-start sm:self-center shrink-0">
              <Link
                href={defaultScheduleHref}
                prefetch={true}
                className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Buka Kalender Jadwal</span>
              </Link>
              <Link
                href={targetMaterialUrl}
                prefetch={true}
                className={`px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50/90 ${theme.accentColor} border ${theme.accentBorder} font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Silabus Kurikulum</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
