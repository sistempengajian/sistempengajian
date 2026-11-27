import React from 'react';
import Link from 'next/link';
import { BookOpen, CalendarCheck, Target, type LucideIcon } from 'lucide-react';
import { TYPOGRAPHY } from '@/lib/design-tokens';
import ProgressCircle from '@/components/dashboard/ProgressCircle';
import Soft3DIcon, { type Soft3DColorScheme } from '@/components/dashboard/Soft3DIcon';
import type { StudentCurriculumMetrics } from '@/app/(protected)/dashboard/queries';

interface StudentCurriculumSectionProps {
  generationName?: string | null;
  theme?: {
    accentColor: string;
    accentBorder: string;
    [key: string]: any;
  };
  studentMetrics: StudentCurriculumMetrics | null;
}

interface FloatingMetricCardItem {
  key: string;
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  subtitle: string;
  percentage: number;
  href: string;
  icon: LucideIcon;
  colorScheme: Soft3DColorScheme;
}

export default function StudentCurriculumSection({
  generationName,
  studentMetrics,
}: StudentCurriculumSectionProps) {
  const overall = studentMetrics?.overall ?? { completed: 0, total: 0, percentage: 0 };
  const monthly = studentMetrics?.monthly ?? {
    completed: 0,
    total: 0,
    percentage: 0,
    source: 'NONE' as const,
  };
  const monthlyAttendance = studentMetrics?.monthlyAttendance ?? {
    hadir: 0,
    total: 0,
    percentage: 0,
    alpaCount: 0,
  };
  const monthLabel = studentMetrics?.monthLabel || 'Bulan Ini';

  const cards: FloatingMetricCardItem[] = [
    {
      key: 'curriculum',
      eyebrow: 'Kurikulum',
      eyebrowColor: 'text-emerald-700',
      title: `Jenjang ${generationName || 'Santri'}`,
      subtitle:
        overall.total > 0
          ? `${overall.completed}/${overall.total} Materi`
          : 'Belum ada materi',
      percentage: overall.percentage,
      href: '/kurikulum?role=student',
      icon: BookOpen,
      colorScheme: 'emerald',
    },
    {
      key: 'target',
      eyebrow: 'Target',
      eyebrowColor: 'text-blue-700',
      title: `Target ${monthLabel}`,
      subtitle:
        monthly.total > 0
          ? `${monthly.completed}/${monthly.total} ${monthly.source === 'SCHEDULE' ? 'Terjadwal' : 'Materi'
          }`
          : 'Belum ada target',
      percentage: monthly.percentage,
      href: '/kurikulum?role=student',
      icon: Target,
      colorScheme: 'blue',
    },
    {
      key: 'attendance',
      eyebrow: 'Kehadiran',
      eyebrowColor: 'text-rose-700',
      title: `Presensi ${monthLabel}`,
      subtitle:
        monthlyAttendance.total > 0
          ? `${monthlyAttendance.hadir}/${monthlyAttendance.total} Sesi${monthlyAttendance.alpaCount > 0
            ? ` · ${monthlyAttendance.alpaCount} Alpa`
            : ' Hadir'
          }`
          : 'Belum ada sesi',
      percentage: monthlyAttendance.percentage,
      href: '/laporan?role=student',
      icon: CalendarCheck,
      colorScheme: 'rose',
    },
  ];

  return (
    <section aria-labelledby="student-curriculum-heading">
      <h2 id="student-curriculum-heading" className="sr-only">
        Capaian &amp; Kehadiran {generationName || 'Santri'}
      </h2>

      <div className="space-y-2.5 sm:space-y-3">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            prefetch={true}
            className="group flex items-center justify-between gap-3.5 rounded-[22px] bg-white/95 border border-white/90 px-4 py-3.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08)] hover:border-slate-200 hover:shadow-[0_12px_28px_-6px_rgba(15,23,42,0.12)] active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <Soft3DIcon icon={card.icon} colorScheme={card.colorScheme} />

              <div className="min-w-0 space-y-0.5">
                <p className={`${TYPOGRAPHY.badge} uppercase tracking-wider ${card.eyebrowColor}`}>
                  {card.eyebrow}
                </p>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-snug">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium tabular-nums truncate">
                  {card.subtitle}
                </p>
              </div>
            </div>

            <ProgressCircle
              percentage={card.percentage}
              size={46}
              strokeWidth={4}
              colorScheme={card.colorScheme}
              showPercentSymbol={false}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
