'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  ShieldCheck,
  User,
  Users,
  Building2,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import DeadlineCountdown, { formatDueDate } from '../shared/DeadlineCountdown';
import type { OverdueAction } from '@/lib/assignmentConfig';

export function formatTierOrganization(orgName?: string | null, tierOrType?: string | null): string {
  if (!orgName) return '';
  const cleanName = orgName.trim();
  const lowerName = cleanName.toLowerCase();
  const upperType = (tierOrType || '').toUpperCase();

  if (lowerName.startsWith('kelompok') || lowerName.startsWith('desa') || lowerName.startsWith('daerah')) {
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  if (upperType === 'KELOMPOK') {
    return `Kelompok ${cleanName}`;
  }
  if (upperType === 'DESA') {
    return `Desa ${cleanName}`;
  }
  if (upperType === 'DAERAH') {
    return `Daerah ${cleanName}`;
  }

  return cleanName;
}

export interface TaskListCardProps {
  id: string;
  title: string;
  description?: string | null;
  taskType: TaskType;
  dueDate?: string | null;
  pointsReward: number;
  parentBonusPoints?: number;
  requiresParentVerification?: boolean;

  // Student & Parent specific
  status?: SubmissionStatus | null;
  score?: number | null;
  isVerifiedByParent?: boolean;
  studentName?: string;

  // Teacher & PJ specific
  className?: string;
  teacherName?: string;
  organizationName?: string | null;
  organizationType?: string | null;
  tierLevel?: string | null;
  materialTitle?: string | null;
  totalSubmissions?: number;
  targetStudentsCount?: number;
  pendingCount?: number;
  gradedCount?: number;
  verifiedCount?: number;

  // Overdue Config
  overdueAction?: OverdueAction;
  penaltyPercent?: number;

  // Role perspective
  role?: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ';
  customActionLabel?: string;
  customActionHref?: string;
}

export default function TaskListCard({
  id,
  title,
  description,
  taskType,
  dueDate,
  pointsReward,
  parentBonusPoints = 0,
  requiresParentVerification = false,
  status,
  score,
  isVerifiedByParent,
  studentName,
  className: targetClassName,
  teacherName,
  organizationName,
  organizationType,
  tierLevel,
  materialTitle,
  totalSubmissions,
  targetStudentsCount,
  pendingCount,
  gradedCount,
  verifiedCount,
  overdueAction,
  penaltyPercent,
  role = 'SANTRI',
  customActionLabel,
  customActionHref,
}: TaskListCardProps) {
  const targetHref = customActionHref || `/tugas/${id}`;
  const isTeacherOrPj = role === 'PENGAJAR' || role === 'PJ';
  const formattedTierOrg = formatTierOrganization(organizationName, organizationType || tierLevel);

  // Default Action Label
  let actionLabel = customActionLabel;
  let actionButtonClass = 'bg-emerald-600 hover:bg-emerald-700 text-white';

  if (!actionLabel) {
    if (role === 'SANTRI') {
      const isSubmitted = Boolean(status) && status !== 'PENDING';
      const needsParent = requiresParentVerification && !isVerifiedByParent;
      const isGraded = status === SubmissionStatus.GRADED || (score !== null && score !== undefined);

      const isOverdue = Boolean(dueDate) && new Date(dueDate!).getTime() <= Date.now();

      if (!isSubmitted) {
        actionLabel = isOverdue ? 'Lihat Detail' : 'Kerjakan';
        actionButtonClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm';
      } else if (needsParent) {
        actionLabel = 'Lihat Detail';
        actionButtonClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm';
      } else if (isGraded) {
        actionLabel = 'Lihat Nilai';
        actionButtonClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm';
      } else {
        actionLabel = 'Lihat Detail';
        actionButtonClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm';
      }
    } else if (role === 'ORANG_TUA') {
      if (requiresParentVerification && status && !isVerifiedByParent) {
        actionLabel = 'Beri Paraf';
        actionButtonClass = 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm';
      } else {
        actionLabel = 'Lihat Detail';
        actionButtonClass = 'bg-slate-100 hover:bg-slate-200 text-slate-800';
      }
    } else if (role === 'PENGAJAR') {
      if (pendingCount && pendingCount > 0) {
        actionLabel = `Koreksi (${pendingCount})`;
        actionButtonClass = 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm';
      } else {
        actionLabel = 'Kelola Tugas';
        actionButtonClass = 'bg-slate-100 hover:bg-slate-200 text-slate-800';
      }
    } else {
      actionLabel = 'Pantau Tugas';
      actionButtonClass = 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm';
    }
  }

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between relative overflow-hidden">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TaskTypeBadge taskType={taskType} size="sm" />
            {requiresParentVerification && role !== 'SANTRI' && role !== 'ORANG_TUA' && !isTeacherOrPj && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                <ShieldCheck className="w-3 h-3" />
                Wajib Paraf
              </span>
            )}
          </div>

          {/* Status or Teacher KPI Pills */}
          {role === 'SANTRI' || role === 'ORANG_TUA' ? (
            <TaskStatusBadge
              status={status ?? null}
              score={score}
              requiresParentVerification={requiresParentVerification}
              isVerifiedByParent={isVerifiedByParent}
            />
          ) : typeof totalSubmissions === 'number' ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full text-[11px]">
                {typeof targetStudentsCount === 'number' && targetStudentsCount > 0
                  ? `${totalSubmissions}/${targetStudentsCount} Kumpul`
                  : `${totalSubmissions} Kumpul`}
              </span>
            </div>
          ) : null}
        </div>

        {/* Title */}
        <Link href={targetHref} prefetch={true} className="block group-hover:text-emerald-700 transition-colors">
          <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2 mb-1.5">
            {title}
          </h3>
        </Link>

        {/* Description or Meta */}
        {description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
            {description}
          </p>
        )}

        {/* Additional Meta info (Teacher, Tingkatan, Sasaran, Material) */}
        <div className={`space-y-1.5 text-[11px] text-slate-500 ${dueDate ? 'mb-2' : 'mb-3.5'}`}>

          {teacherName && (
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{teacherName}</span>
            </span>
          )}
          {formattedTierOrg && (
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{formattedTierOrg}</span>
            </span>
          )}
          {targetClassName && (
            <span className="flex items-center gap-1 text-slate-500 font-medium">
              <Users className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{targetClassName}</span>
            </span>
          )}


          {materialTitle && (
            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{materialTitle}</span>
            </div>
          )}
        </div>

        {/* Tanggal & Waktu Akhir Pengumpulan Tugas dengan Icon Calendar */}
        {dueDate && (
          <div className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
            <Calendar className="w-3 h-3" />
            <span>{formatDueDate(dueDate)}</span>
          </div>
        )}

        <div>
          {/* Deadline Countdown compact */}
          <div className="pt-3 border-t border-slate-100 mb-3.5 mt-4">
            <div className="flex items-center justify-between text-xs">
              {dueDate && <span className="text-[11px] text-slate-400 font-medium">Batas Pengumpulan:</span>}
              <DeadlineCountdown
                dueDate={dueDate ?? null}
                overdueAction={overdueAction}
                penaltyPercentage={penaltyPercent}
                compact={true}
              />
            </div>
          </div>

          {/* Bottom Actions Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  +{pointsReward}
                  {requiresParentVerification && parentBonusPoints > 0 && (
                    <span className="inline-flex items-center text-xs font-bold text-amber-800">
                      ({parentBonusPoints} Bonus)

                    </span>

                  )}
                  <span className='text-xs font-bold text-amber-900'>Poin</span>
                </span>
              </div>
            </div>

            <Link
              href={targetHref}
              prefetch={true}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${actionButtonClass}`}
            >
              {actionLabel}
            </Link>
          </div>
        </div >
      </div >
    </div >
  );
}

