'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, Clock, MapPin, UserCheck } from 'lucide-react';
import type { TierLevel } from '@prisma/client';
import type { UpcomingScheduleItem } from '@/app/(protected)/dashboard/queries';
import type { RoleTheme } from '@/lib/theme';
import { formatWibDate, formatWibTime } from '@/lib/utils';
import { IslamicCardPattern, MosqueWatermark } from '@/components/ui/IslamicDecorations';

interface UpcomingScheduleCardProps {
  schedules: UpcomingScheduleItem[];
  theme: {
    roleKey?: RoleTheme['roleKey'];
    accentColor: string;
    accentBorder: string;
    mandalaColor?: string;
    [key: string]: any;
  };
  defaultScheduleHref: string;
  renderedAtIso: string;
}

const TIER_BADGE_MAP: Record<TierLevel, { label: string; className: string }> = {
  DAERAH: {
    label: 'Daerah',
    className: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
  DESA: {
    label: 'Desa',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  KELOMPOK: {
    label: 'Kelompok',
    className: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
};

const ACTIVE_DOT_COLOR_MAP: Record<RoleTheme['roleKey'], string> = {
  SANTRI: 'bg-emerald-600',
  PENGAJAR: 'bg-teal-600',
  ORANG_TUA: 'bg-indigo-600',
  PJ: 'bg-blue-600',
  ADMIN_MASTER: 'bg-purple-600',
};

function toWibDayTimestamp(value: string | Date): number {
  const dateObj = typeof value === 'string' ? new Date(value) : value;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
  const [y, m, d] = formatted.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function getRelativeStatus(
  schedule: UpcomingScheduleItem,
  referenceIso: string
): { label: string; isLive: boolean } {
  const nowMs = new Date(referenceIso).getTime();
  const startMs = new Date(schedule.startTime).getTime();
  const endMs = schedule.endTime ? new Date(schedule.endTime).getTime() : null;

  const isLive =
    schedule.status === 'ACTIVE' ||
    (nowMs >= startMs && endMs !== null && nowMs <= endMs);
  if (isLive) {
    return { label: 'Berlangsung', isLive: true };
  }

  const dayDiff = Math.round(
    (toWibDayTimestamp(schedule.startTime) - toWibDayTimestamp(referenceIso)) / 86_400_000
  );

  if (dayDiff === 0) return { label: 'Hari Ini', isLive: false };
  if (dayDiff === 1) return { label: 'Besok', isLive: false };
  if (dayDiff === 2) return { label: 'Lusa', isLive: false };
  if (dayDiff > 2 && dayDiff <= 7) return { label: `${dayDiff} Hari Lagi`, isLive: false };

  return { label: 'Akan Datang', isLive: false };
}

function resolveTeacherName(teachers: UpcomingScheduleItem['teachers']): string {
  const substitute = teachers.find((t) => t.isSubstitute);
  if (substitute?.teacher?.fullName) {
    return `${substitute.teacher.fullName} (Pengganti)`;
  }
  return teachers[0]?.teacher?.fullName || 'Ustadz belum ditugaskan';
}

export default function UpcomingScheduleCard({
  schedules,
  theme,
  defaultScheduleHref,
  renderedAtIso,
}: UpcomingScheduleCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const activeDotClass =
    (theme.roleKey && ACTIVE_DOT_COLOR_MAP[theme.roleKey]) || 'bg-emerald-600';

  const handleScroll = () => {
    const track = trackRef.current;
    const firstSlide = slideRefs.current[0];
    if (!track || !firstSlide || schedules.length <= 1) return;

    const baseLeft = firstSlide.offsetLeft;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    let closestIdx = 0;
    let minDist = Infinity;

    slideRefs.current.forEach((el, idx) => {
      if (!el || idx >= schedules.length) return;
      const expectedScrollLeft = Math.min(el.offsetLeft - baseLeft, maxScroll);
      const dist = Math.abs(expectedScrollLeft - track.scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    setActiveIndex((prev) => (prev === closestIdx ? prev : closestIdx));
  };

  const scrollToSlide = (targetIdx: number) => {
    const track = trackRef.current;
    const targetEl = slideRefs.current[targetIdx];
    const firstSlide = slideRefs.current[0];
    if (!track || !targetEl || !firstSlide) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const targetLeft = Math.min(targetEl.offsetLeft - firstSlide.offsetLeft, maxScroll);

    track.scrollTo({ left: targetLeft, behavior: 'smooth' });
    setActiveIndex(targetIdx);
  };

  const accentDecorationColor = theme.mandalaColor || '#0d9488';

  if (schedules.length === 0) {
    return (
      <section aria-label="Jadwal Pengajian Mendatang">
        <Link
          href={defaultScheduleHref}
          prefetch={true}
          className="group relative overflow-hidden flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-[#f8fbfa] via-white to-[#f4faf7] border border-white/90 p-4 sm:p-5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.10)] hover:border-slate-200 active:scale-[0.99] transition-all cursor-pointer"
        >
          <IslamicCardPattern color={accentDecorationColor} />
          <MosqueWatermark color={accentDecorationColor} className="opacity-70" />

          <div className="relative z-10 space-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100/90 text-slate-700 border border-slate-200/80">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Kalender Pengajian</span>
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
              Belum Ada Sesi Pengajian Mendatang
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed truncate">
              Ketuk kartu ini untuk membuka daftar dan kalender pengajian.
            </p>
          </div>
          <ChevronRight className="relative z-10 w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </section>
    );
  }

  const isMulti = schedules.length > 1;
  const slideWidthClass = isMulti ? 'w-[88%] sm:w-[90%]' : 'w-full';

  return (
    <section aria-label="Jadwal Pengajian Terdekat">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={
          isMulti
            ? 'flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 scroll-pl-4 sm:scroll-pl-6 pt-2 pb-5 -mt-2 -mb-3'
            : 'flex pt-2 pb-5 -mt-2 -mb-3'
        }
      >
        {schedules.map((schedule, idx) => {
          const tierBadge = TIER_BADGE_MAP[schedule.tierLevel] || TIER_BADGE_MAP.KELOMPOK;
          const isPrivate = schedule.scheduleType === 'PRIVATE_REMEDIAL';
          const status = getRelativeStatus(schedule, renderedAtIso);
          const dateText = formatWibDate(schedule.startTime, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
          const startTimeText = formatWibTime(schedule.startTime);
          const endTimeText = schedule.endTime ? formatWibTime(schedule.endTime) : '';
          const timeText = endTimeText
            ? `${startTimeText} – ${endTimeText} WIB`
            : `${startTimeText} WIB`;

          return (
            <Link
              key={schedule.id}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              href={`/jadwal/${encodeURIComponent(schedule.id)}`}
              prefetch={true}
              className={`group relative overflow-hidden ${slideWidthClass} shrink-0 snap-start rounded-3xl bg-gradient-to-br from-[#f8fbfa] via-white to-[#f4faf7] border border-white/90 p-4 sm:p-5 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.11)] hover:border-slate-200 hover:shadow-[0_16px_34px_-8px_rgba(15,23,42,0.14)] active:scale-[0.99] transition-all cursor-pointer flex flex-col justify-between gap-3`}
            >
              <IslamicCardPattern color={accentDecorationColor} />
              <MosqueWatermark color={accentDecorationColor} />

              <div className="relative z-10 space-y-2.5">
                {/* Baris Badge Kiri (Tingkatan & Private/Remedial) + Status Waktu Kanan */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${tierBadge.className}`}
                    >
                      {tierBadge.label}
                    </span>

                    {isPrivate && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                        Private / Remedial
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {status.isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                        </span>
                        <span>{status.label}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500">
                        {status.label}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>

                {/* Judul Sesi */}
                <h2 className="text-base font-bold text-slate-900 tracking-tight truncate">
                  {schedule.title}
                </h2>
              </div>

              {/* Detail Sesi 2x2: Tanggal terpisah dari Jam, Tempat & Pengajar (tanpa Materi) */}
              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-medium text-slate-800 min-w-0">
                  <Calendar className={`w-4 h-4 shrink-0 ${theme.accentColor}`} />
                  <span className="truncate">{dateText}</span>
                </div>

                <div className="flex items-center gap-2 font-medium text-slate-800 min-w-0">
                  <Clock className={`w-4 h-4 shrink-0 ${theme.accentColor}`} />
                  <span className="truncate tabular-nums">{timeText}</span>
                </div>

                <div className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
                  <MapPin className={`w-4 h-4 shrink-0 ${theme.accentColor}`} />
                  <span className="truncate">
                    {schedule.venuePlaceName || 'Tempat belum ditentukan'}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
                  <UserCheck className={`w-4 h-4 shrink-0 ${theme.accentColor}`} />
                  <span className="truncate">{resolveTeacherName(schedule.teachers)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Indikator Dot Saja (tanpa tombol panah & tanpa label nomor sesi) */}
      {isMulti && (
        <div
          className="flex items-center justify-center gap-1 pt-1"
          role="tablist"
          aria-label="Pilih sesi pengajian terdekat"
        >
          {schedules.map((schedule, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={schedule.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Lihat sesi ${idx + 1}: ${schedule.title}`}
                onClick={() => scrollToSlide(idx)}
                className="p-1.5 flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    isActive
                      ? `w-5 ${activeDotClass}`
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
