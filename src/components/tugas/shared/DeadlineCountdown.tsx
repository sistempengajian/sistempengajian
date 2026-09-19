'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Lock, AlertTriangle, Timer } from 'lucide-react';
import type { OverdueAction } from '@/lib/assignmentConfig';

interface DeadlineCountdownProps {
  dueDate: string | null;
  overdueAction?: OverdueAction;
  penaltyPercentage?: number;
  /** Compact mode: single line, no detail breakdown */
  compact?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isOverdue: boolean;
}

function calcRemaining(dueDate: string): TimeRemaining {
  const diff = new Date(dueDate).getTime() - Date.now();
  const isOverdue = diff <= 0;
  const abs = Math.abs(diff);

  return {
    days: Math.floor(abs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((abs % (1000 * 60)) / 1000),
    totalMs: diff,
    isOverdue,
  };
}

export function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const dd = d.getDate().toString().padStart(2, '0');
  const mmm = months[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${dd} ${mmm} ${yyyy} • ${hh}:${mm} WIB`;
}

function getUrgencyColor(remaining: TimeRemaining) {
  if (remaining.isOverdue) return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200/80', dot: 'bg-rose-500' };
  const hoursLeft = remaining.days * 24 + remaining.hours;
  if (hoursLeft < 6) return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200/80', dot: 'bg-rose-500' };
  if (hoursLeft < 24) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200/80', dot: 'bg-amber-500' };
  return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200/80', dot: 'bg-emerald-500' };
}

function formatCountdown(r: TimeRemaining, compact: boolean): string {
  if (r.isOverdue) {
    return 'Berakhir';
  }

  if (compact) {
    if (r.days > 0) return `${r.days}h ${r.hours}j lagi`;
    if (r.hours > 0) return `${r.hours}j ${r.minutes}m lagi`;
    return `${r.minutes}m ${r.seconds}d lagi`;
  }

  if (r.days > 0) return `Tersisa ${r.days} hari ${r.hours} jam`;
  if (r.hours > 0) return `Tersisa ${r.hours} jam ${r.minutes} menit`;
  return `Tersisa ${r.minutes} menit ${r.seconds} detik`;
}

function getOverdueLabel(action: OverdueAction | undefined, penalty?: number): { label: string; color: string } | null {
  if (!action) return null;
  switch (action) {
    case 'LOCK':
      return { label: 'Pengumpulan Terkunci', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    case 'ALLOW_LATE':
      return { label: 'Terlambat Diizinkan', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    case 'ALLOW_WITH_PENALTY':
      return { label: `Potongan ${penalty || 25}% Poin`, color: 'bg-orange-100 text-orange-800 border-orange-200' };
    default:
      return null;
  }
}

export default function DeadlineCountdown({
  dueDate,
  overdueAction,
  penaltyPercentage,
  compact = false,
  className = '',
}: DeadlineCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    if (!dueDate) return;
    setRemaining(calcRemaining(dueDate));
    const interval = setInterval(() => {
      setRemaining(calcRemaining(dueDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [dueDate]);

  if (!dueDate) return null;

  if (!remaining) return null;

  const urgency = getUrgencyColor(remaining);
  const countdown = formatCountdown(remaining, compact);
  const overdueInfo = remaining.isOverdue ? getOverdueLabel(overdueAction, penaltyPercentage) : null;

  // ─── Compact Mode ───
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${urgency.dot} ${!remaining.isOverdue ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-semibold ${urgency.text}`}>
          {countdown}
        </span>
      </div>
    );
  }

  // ─── Full Mode ───
  return (
    <div className={`rounded-2xl ${urgency.bg} border ${urgency.border} p-3 sm:p-3.5 ${className}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-xl ${urgency.bg} ${urgency.text} flex items-center justify-center shrink-0 mt-0.5`}>
          {remaining.isOverdue ? <Lock className="w-3.5 h-3.5" /> : <Timer className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-xs font-bold ${urgency.text}`}>
              Batas Pengumpulan
            </span>
            {!remaining.isOverdue && overdueInfo && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${overdueInfo.color}`}>
                {overdueInfo.label}
              </span>
            )}
          </div>

          <p className={`text-sm font-extrabold ${urgency.text} ${remaining.isOverdue ? 'mt-0.5' : 'mt-1'} tabular-nums tracking-tight`}>
            {countdown}
          </p>
        </div>
      </div>
    </div>
  );
}
