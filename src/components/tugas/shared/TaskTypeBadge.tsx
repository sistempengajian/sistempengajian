import React from 'react';
import {
  Mic,
  CheckSquare,
  FileText,
  Camera,
  DicesIcon,
  BookOpen,
} from 'lucide-react';
import { TaskType } from '@prisma/client';

interface TaskTypeBadgeProps {
  taskType: TaskType;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const TASK_TYPE_MAP: Record<
  TaskType,
  { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }
> = {
  DAILY_HABIT: {
    label: 'Checklist Harian',
    icon: CheckSquare,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200/80',
  },
  AUDIO_MEMORIZATION: {
    label: 'Setoran Audio',
    icon: Mic,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200/80',
  },
  WRITTEN_SUBMISSION: {
    label: 'Laporan / Tertulis',
    icon: FileText,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200/80',
  },
  QUIZ_ONLINE: {
    label: 'Kuis Online',
    icon: DicesIcon,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200/80',
  },
};

export default function TaskTypeBadge({
  taskType,
  size = 'sm',
  showLabel = true,
  className = '',
}: TaskTypeBadgeProps) {
  const config = TASK_TYPE_MAP[taskType] || {
    label: taskType,
    icon: BookOpen,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200/80',
  };

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 ${padding} rounded-full border font-bold
        ${config.bgColor} ${config.color} ${config.borderColor} ${className}`}
    >
      <Icon className={iconSize} />
      {showLabel && <span className={textSize}>{config.label}</span>}
    </span>
  );
}

/** Helper: Ambil konfigurasi tipe tugas tanpa render component */
export function getTaskTypeConfig(taskType: TaskType) {
  return TASK_TYPE_MAP[taskType] || {
    label: taskType,
    icon: BookOpen,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200/80',
  };
}
