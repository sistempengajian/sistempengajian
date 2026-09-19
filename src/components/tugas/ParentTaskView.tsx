'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Heart,
  Search,
  Users,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskListCard from './list/TaskListCard';
import { parseAssignmentConfig, AssignmentConfig } from '@/lib/assignmentConfig';

export interface ChildInfo {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  generationName: string;
  totalPoints: number;
  pendingParafCount?: number;
}

export interface ParentTaskItem {
  id: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  requiresParentVerification: boolean;
  dueDate: string | null;
  pointsReward: number;
  parentBonusPoints: number;
  teacherName: string;
  organizationName: string;
  organizationType?: string | null;
  tierLevel?: string | null;
  className?: string;
  materialTitle?: string | null;
  attachmentUrl?: string | null;
  config?: AssignmentConfig;
  submission: {
    id: string;
    submissionText: string | null;
    mediaFileUrl: string | null;
    status: SubmissionStatus;
    score: number | null;
    teacherFeedback: string | null;
    submittedAt: string;
    parentVerification?: {
      id: string;
      isVerifiedByParent: boolean;
      parentFeedback: string | null;
      magicToken: string | null;
      verifiedAt: string | null;
    } | null;
  } | null;
}

interface ParentTaskViewProps {
  childrenList: ChildInfo[];
  activeChildId?: string;
  assignments: ParentTaskItem[];
  allAssignmentsByChild?: Record<string, ParentTaskItem[]>;
  onSelectChild?: (childId: string) => void;
}

export default function ParentTaskView({
  childrenList,
  activeChildId,
  assignments: initialAssignments,
  allAssignmentsByChild,
  onSelectChild,
}: ParentTaskViewProps) {
  // Active child selector
  const [selectedChildId, setSelectedChildId] = useState<string>(
    activeChildId || childrenList[0]?.id || ''
  );

  useEffect(() => {
    if (activeChildId && activeChildId !== selectedChildId) {
      setSelectedChildId(activeChildId);
    }
  }, [activeChildId]);

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NEED_PARAF' | 'VERIFIED' | 'UNSUBMITTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const currentChild = childrenList.find((c) => c.id === selectedChildId) || childrenList[0];

  const childAssignments: ParentTaskItem[] =
    allAssignmentsByChild && allAssignmentsByChild[selectedChildId]
      ? allAssignmentsByChild[selectedChildId]
      : selectedChildId === activeChildId
        ? initialAssignments
        : initialAssignments;

  const handleSelectChild = (childId: string) => {
    setSelectedChildId(childId);
    if (onSelectChild) {
      onSelectChild(childId);
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/tugas?studentId=${childId}`);
    }
  };

  // KPIs
  const pendingParafCount = childAssignments.filter(
    (a) => a.submission && !a.submission.parentVerification?.isVerifiedByParent
  ).length;

  const verifiedCount = childAssignments.filter(
    (a) => a.submission?.parentVerification?.isVerifiedByParent
  ).length;

  const waitingSubmissionCount = childAssignments.filter((a) => !a.submission).length;

  // Filtered
  const filteredAssignments = childAssignments.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.materialTitle && task.materialTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const isSubmitted = Boolean(task.submission);
    const isVerified = Boolean(task.submission?.parentVerification?.isVerifiedByParent);

    if (filterStatus === 'NEED_PARAF') return isSubmitted && !isVerified;
    if (filterStatus === 'VERIFIED') return isVerified;
    if (filterStatus === 'UNSUBMITTED') return !isSubmitted;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ─── TAB SWITCHER ANAK ─── */}
      {childrenList.length > 1 && (


        < div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
          {childrenList.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <button
                key={child.id}
                type="button"
                onClick={() => handleSelectChild(child.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${isSelected
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                  }`}
              >
                <span>{child.fullName}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-purple-700 text-purple-100' : 'bg-slate-200/80 text-slate-600'
                    }`}
                >
                  {child.generationName}
                </span>
              </button>
            );
          })}
        </div>
      )
      }

      {/* ─── QUICK KPI TILES ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('NEED_PARAF')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${filterStatus === 'NEED_PARAF'
            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-amber-600 block mb-0.5">Perlu Diparaf</span>
          <div className="text-xl font-bold text-amber-700">{pendingParafCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('VERIFIED')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${filterStatus === 'VERIFIED'
            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-purple-600 block mb-0.5">Sudah Diparaf</span>
          <div className="text-xl font-bold text-purple-700">{verifiedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('UNSUBMITTED')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${filterStatus === 'UNSUBMITTED'
            ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Belum Selesai</span>
          <div className="text-xl font-bold text-slate-700">{waitingSubmissionCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${filterStatus === 'ALL'
            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-indigo-600 block mb-0.5">Total Tugas</span>
          <div className="text-xl font-bold text-indigo-700">{childAssignments.length}</div>
        </button>
      </div>

      {/* ─── SEARCH & FILTER HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'ALL'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Semua ({childAssignments.length})
          </button>
          <button
            onClick={() => setFilterStatus('NEED_PARAF')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'NEED_PARAF'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Perlu Paraf ({pendingParafCount})
          </button>
          <button
            onClick={() => setFilterStatus('VERIFIED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'VERIFIED'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Sudah Diparaf ({verifiedCount})
          </button>
          <button
            onClick={() => setFilterStatus('UNSUBMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filterStatus === 'UNSUBMITTED'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Belum Kumpul ({waitingSubmissionCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari tugas ananda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
        </div>
      </div>

      {/* ─── TASK CARDS GRID ─── */}
      {
        filteredAssignments.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-400 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Tidak ada tugas ditemukan</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'Tidak ada tugas yang sesuai dengan pencarian Anda.'
                : 'Semua tugas untuk ananda pada filter ini telah tuntas diperiksa.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssignments.map((task) => {
              const parsedConfig = task.config || parseAssignmentConfig(task.attachmentUrl);
              return (
                <TaskListCard
                  key={`${selectedChildId}-${task.id}`}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  taskType={task.taskType}
                  dueDate={task.dueDate}
                  pointsReward={task.pointsReward}
                  parentBonusPoints={task.parentBonusPoints}
                  requiresParentVerification={task.requiresParentVerification}
                  status={task.submission?.status || null}
                  score={task.submission?.score || null}
                  isVerifiedByParent={task.submission?.parentVerification?.isVerifiedByParent || false}
                  teacherName={task.teacherName}
                  organizationName={task.organizationName}
                  organizationType={task.organizationType}
                  tierLevel={task.tierLevel}
                  className={task.className}
                  materialTitle={task.materialTitle}
                  overdueAction={parsedConfig.overdueAction}
                  penaltyPercent={parsedConfig.penaltyPercentage}
                  role="ORANG_TUA"
                  customActionHref={`/tugas/${task.id}?studentId=${selectedChildId}`}
                />
              );
            })}
          </div>
        )
      }
    </div >
  );
}
