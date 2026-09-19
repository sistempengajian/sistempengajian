import React from 'react';
import {
  Clock,
  CheckCircle2,
  ShieldCheck,
  Award,
  Hourglass,
  AlertCircle,
  Check,
} from 'lucide-react';
import { SubmissionStatus } from '@prisma/client';

export interface TaskStatusBadgeProps {
  /** null atau PENDING = belum dikerjakan */
  status: SubmissionStatus | null;
  score?: number | null;
  requiresParentVerification?: boolean;
  isVerifiedByParent?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Logika status penugasan terpadu (single unified badge pill):
 * 1. Belum dikerjakan (!status || status === 'PENDING')
 * 2. Menunggu diparaf ortu (tugas wajib paraf & belum diparaf ortu) -> bahkan jika guru sudah menilai
 * 3. Menunggu dinilai guru (tugas tidak butuh paraf ATAU sudah diparaf, tapi belum dinilai guru)
 * 4. Score nilai (tugas sudah dinilai & jika butuh paraf, sudah diparaf)
 */
function getStatusConfig(
  status: SubmissionStatus | null,
  score: number | null | undefined,
  requiresParentVerification: boolean,
  isVerifiedByParent: boolean
): StatusConfig {
  const isSubmitted = Boolean(status) && status !== 'PENDING';

  // 1. Belum Dikerjakan
  if (!isSubmitted) {
    return {
      label: 'Belum Dikerjakan',
      icon: Hourglass,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-200/90',
    };
  }

  // 2. Menunggu Paraf Ortu (Jika wajib paraf ortu & belum diparaf)
  // Aturan: Meskipun guru sudah menilai duluan, status tetap menampilkan 'Menunggu Paraf Ortu'
  if (requiresParentVerification && !isVerifiedByParent) {
    return {
      label: 'Menunggu Paraf Ortu',
      icon: ShieldCheck,
      color: 'text-purple-700',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200/90',
    };
  }

  // 3. Menunggu Dinilai Guru
  // Terjadi jika: (tidak butuh paraf OR sudah diparaf) DAN guru belum menilai (score null & status bukan GRADED)
  const isGraded = status === 'GRADED' || (score !== null && score !== undefined);
  if (!isGraded) {
    return {
      label: 'Menunggu Dinilai',
      icon: Clock,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200/90',
    };
  }

  // 4. Score Nilai (Telah dinilai guru & jika wajib paraf, sudah diparaf)
  if (score !== null && score !== undefined) {
    let scoreColor = 'text-emerald-700 bg-emerald-50 border-emerald-300';
    if (score < 60) {
      scoreColor = 'text-rose-700 bg-rose-50 border-rose-200';
    } else if (score < 75) {
      scoreColor = 'text-amber-700 bg-amber-50 border-amber-200';
    }

    const [color, bgColor, borderColor] = scoreColor.split(' ');
    return {
      label: `Nilai: ${score}`,
      icon: CheckCircle2,
      color,
      bgColor,
      borderColor,
    };
  }

  // Fallback jika status GRADED tetapi score null
  return {
    label: 'Sudah Dinilai',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200/90',
  };
}

export default function TaskStatusBadge({
  status,
  score,
  requiresParentVerification = false,
  isVerifiedByParent = false,
  size = 'sm',
  className = '',
}: TaskStatusBadgeProps) {
  const config = getStatusConfig(
    status,
    score,
    Boolean(requiresParentVerification),
    Boolean(isVerifiedByParent)
  );

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} rounded-full border font-bold ${textSize} ${config.bgColor} ${config.color} ${config.borderColor} ${className} transition-colors shrink-0 shadow-2xs`}
    >
      <Icon className={iconSize} />
      <span>{config.label}</span>
    </span>
  );
}
