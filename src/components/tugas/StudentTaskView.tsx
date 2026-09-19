'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Clock,
  Award,
  ShieldCheck,
  CheckCircle2,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskListCard from './list/TaskListCard';
import { parseAssignmentConfig, AssignmentConfig } from '@/lib/assignmentConfig';

export interface StudentTaskItem {
  id: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  requiresParentVerification: boolean;
  dueDate: string | null;
  pointsReward: number;
  parentBonusPoints: number;
  attachmentUrl: string | null;
  config?: AssignmentConfig;
  createdAt: string;
  teacherName: string;
  organizationName: string;
  organizationType?: string | null;
  tierLevel?: string | null;
  className?: string;
  materialTitle?: string | null;
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

interface StudentTaskViewProps {
  assignments: StudentTaskItem[];
  studentName: string;
}

export default function StudentTaskView({ assignments, studentName }: StudentTaskViewProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNSUBMITTED' | 'NEED_PARENT' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Parsed assignments with config
  const enrichedAssignments = assignments.map((task) => ({
    ...task,
    parsedConfig: task.config || parseAssignmentConfig(task.attachmentUrl),
  }));

  // KPI Counts
  const unsubmittedCount = enrichedAssignments.filter(
    (t) => !t.submission || t.submission.status === 'PENDING'
  ).length;
  const needParentCount = enrichedAssignments.filter(
    (t) =>
      t.requiresParentVerification &&
      t.submission &&
      t.submission.status !== 'PENDING' &&
      !t.submission.parentVerification?.isVerifiedByParent
  ).length;
  const completedCount = enrichedAssignments.filter((t) => {
    if (!t.submission || t.submission.status === 'PENDING') return false;
    const isGraded = t.submission.status === SubmissionStatus.GRADED || (t.submission.score !== null && t.submission.score !== undefined);
    const parentSatisfied = !t.requiresParentVerification || Boolean(t.submission.parentVerification?.isVerifiedByParent);
    return isGraded && parentSatisfied;
  }).length;

  // Filtered List
  const filteredAssignments = enrichedAssignments.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.materialTitle && task.materialTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'UNSUBMITTED') {
      return !task.submission || task.submission.status === 'PENDING';
    }
    if (activeTab === 'NEED_PARENT') {
      return (
        task.requiresParentVerification &&
        task.submission &&
        task.submission.status !== 'PENDING' &&
        !task.submission.parentVerification?.isVerifiedByParent
      );
    }
    if (activeTab === 'COMPLETED') {
      if (!task.submission || task.submission.status === 'PENDING') return false;
      const isGraded = task.submission.status === SubmissionStatus.GRADED || (task.submission.score !== null && task.submission.score !== undefined);
      const parentSatisfied = !task.requiresParentVerification || Boolean(task.submission.parentVerification?.isVerifiedByParent);
      return isGraded && parentSatisfied;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ─── QUICK KPI TILES ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${activeTab === 'ALL'
            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Semua Tugas</span>
          <div className="text-xl font-bold text-slate-900">{assignments.length}</div>
        </button>

        <button
          onClick={() => setActiveTab('UNSUBMITTED')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${activeTab === 'UNSUBMITTED'
            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-amber-600 block mb-0.5">Belum Dikerjakan</span>
          <div className="text-xl font-bold text-amber-700">{unsubmittedCount}</div>
        </button>

        <button
          onClick={() => setActiveTab('NEED_PARENT')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${activeTab === 'NEED_PARENT'
            ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-purple-600 block mb-0.5">Menunggu Paraf</span>
          <div className="text-xl font-bold text-purple-700">{needParentCount}</div>
        </button>

        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${activeTab === 'COMPLETED'
            ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-xs'
            : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
        >
          <span className="text-[11px] font-semibold text-teal-600 block mb-0.5">Tuntas Dinilai</span>
          <div className="text-xl font-bold text-teal-700">{completedCount}</div>
        </button>
      </div>

      {/* ─── SEARCH & FILTER HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'ALL'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Semua ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('UNSUBMITTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'UNSUBMITTED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Belum ({unsubmittedCount})
          </button>
          <button
            onClick={() => setActiveTab('NEED_PARENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'NEED_PARENT'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Paraf Ortu ({needParentCount})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${activeTab === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            Selesai ({completedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama tugas / materi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ─── TASK CARDS GRID ─── */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Tidak ada tugas ditemukan</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Tidak ada tugas yang sesuai dengan pencarian Anda.'
              : 'Semua tugas pada kategori ini telah selesai atau belum diterbitkan pengajar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((task) => (
            <TaskListCard
              key={task.id}
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
              overdueAction={task.parsedConfig.overdueAction}
              penaltyPercent={task.parsedConfig.penaltyPercentage}
              role="SANTRI"
            />
          ))}
        </div>
      )}
    </div>
  );
}
