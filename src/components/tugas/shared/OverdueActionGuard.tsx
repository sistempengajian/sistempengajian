'use client';

import React, { useMemo } from 'react';
import { Lock, AlertTriangle, Percent, Clock } from 'lucide-react';
import type { OverdueAction } from '@/lib/assignmentConfig';

interface OverdueActionGuardProps {
  dueDate: string | null;
  overdueAction?: OverdueAction;
  penaltyPercentage?: number;
  /** Content to render inside the guard (e.g., the submission form) */
  children: React.ReactNode;
}

/**
 * Wraps submission form content and enforces overdue policy:
 * - LOCK: shows lock overlay, hides form
 * - ALLOW_LATE: shows warning banner, form stays active
 * - ALLOW_WITH_PENALTY: shows penalty banner, form stays active
 * - No overdue / no deadline: renders children normally
 */
export default function OverdueActionGuard({
  dueDate,
  overdueAction = 'ALLOW_LATE',
  penaltyPercentage = 25,
  children,
}: OverdueActionGuardProps) {
  const isOverdue = useMemo(() => {
    if (!dueDate) return false;
    return new Date() > new Date(dueDate);
  }, [dueDate]);

  // ─── Not overdue: render children normally ───
  if (!isOverdue) {
    return <>{children}</>;
  }

  // ─── LOCK: Block form entirely ───
  if (overdueAction === 'LOCK') {
    return (
      <div className="relative">
        {/* Locked overlay */}
        <div className="rounded-2xl border-2 border-dashed border-rose-300/80 bg-rose-50/80 p-6 sm:p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-rose-800 mb-1">
            Pengumpulan Telah Ditutup
          </h3>
          <p className="text-xs text-rose-600 leading-relaxed max-w-xs mx-auto">
            Batas waktu pengumpulan tugas ini telah berakhir. Pengajar telah mengunci pengumpulan tugas ini.
          </p>
        </div>
      </div>
    );
  }

  // ─── ALLOW_LATE: Show warning, form stays active ───
  if (overdueAction === 'ALLOW_LATE') {
    return (
      <div>
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 p-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800">
              Pengumpulan Terlambat
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
              Batas waktu telah berlalu, namun pengajar mengizinkan pengumpulan terlambat. Tugas akan diberi tanda terlambat.
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // ─── ALLOW_WITH_PENALTY: Show penalty info, form stays active ───
  if (overdueAction === 'ALLOW_WITH_PENALTY') {
    return (
      <div>
        <div className="flex items-start gap-2.5 rounded-xl bg-orange-50 border border-orange-200/80 p-3 mb-4">
          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
            <Percent className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-orange-800">
              Potongan Poin {penaltyPercentage}%
            </p>
            <p className="text-[11px] text-orange-700 mt-0.5 leading-relaxed">
              Batas waktu telah berlalu. Pengumpulan terlambat diizinkan namun poin yang diperoleh akan dipotong {penaltyPercentage}%.
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // Fallback: just render children
  return <>{children}</>;
}
