'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  BookOpen,
  Clock,
  CheckCircle2,
  Award,
  ShieldCheck,
  Search,
  Users,
  Filter,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskListCard from './list/TaskListCard';
import TaskStatusBadge from './shared/TaskStatusBadge';
import { parseAssignmentConfig } from '@/lib/assignmentConfig';

export interface SubmissionItem {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  taskType: TaskType;
  pointsReward: number;
  parentBonusPoints: number;
  studentId: string;
  studentName: string;
  generationName: string;
  submissionText: string | null;
  mediaFileUrl: string | null;
  attachmentUrl?: string | null;
  status: SubmissionStatus;
  score: number | null;
  teacherFeedback: string | null;
  submittedAt: string;
  isVerifiedByParent: boolean;
  parentVerifierName: string | null;
  parentFeedback: string | null;
}

export interface TeacherAssignmentItem {
  id: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  requiresParentVerification: boolean;
  dueDate: string | null;
  pointsReward: number;
  parentBonusPoints: number;
  attachmentUrl: string | null;
  config?: any;
  createdAt: string;
  className: string;
  materialTitle: string | null;
  teacherName?: string;
  organizationName?: string | null;
  organizationType?: string | null;
  tierLevel?: string | null;
  targetStudentsCount?: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  gradedSubmissions: number;
  verifiedByParent?: number;
}

interface TeacherAssignmentViewProps {
  assignments: TeacherAssignmentItem[];
  gradingQueue: SubmissionItem[];
  availableGenerations?: Array<{
    id: string;
    code: string;
    name: string;
    minAge?: number;
    maxAge?: number;
    description?: string | null;
    studentCount?: number;
  }>;
  availableClasses?: Array<{ id: string; name: string }>;
  availableMaterials?: Array<{ id: string; title: string }>;
  availableStudents?: Array<{
    id: string;
    fullName: string;
    generationId?: string | null;
    generationCode?: string | null;
    generationName?: string;
    organizationName?: string | null;
    avatarUrl?: string | null;
  }>;
}

export default function TeacherAssignmentView({
  assignments,
  gradingQueue,
  availableGenerations = [],
  availableClasses = [],
  availableMaterials = [],
  availableStudents = [],
}: TeacherAssignmentViewProps) {
  const [activeTab, setActiveTab] = useState<'ASSIGNMENTS' | 'QUEUE'>('ASSIGNMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'PENDING' | 'PARENT_VERIFIED' | 'GRADED'>('PENDING');

  const pendingCount = gradingQueue.filter(
    (s) => s.status === SubmissionStatus.SUBMITTED || s.status === SubmissionStatus.VERIFIED_BY_PARENT
  ).length;

  const parentVerifiedCount = gradingQueue.filter(
    (s) => s.isVerifiedByParent && s.status !== SubmissionStatus.GRADED
  ).length;

  const gradedCount = gradingQueue.filter((s) => s.status === SubmissionStatus.GRADED).length;

  // Filtered Assignments
  const filteredAssignments = assignments.filter((a) => {
    const match =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.materialTitle && a.materialTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return match;
  });

  // Filtered Queue
  const filteredQueue = gradingQueue.filter((sub) => {
    const matchSearch =
      sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.assignmentTitle.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (queueFilter === 'PENDING') {
      return sub.status === SubmissionStatus.SUBMITTED || sub.status === SubmissionStatus.VERIFIED_BY_PARENT;
    }
    if (queueFilter === 'PARENT_VERIFIED') {
      return sub.isVerifiedByParent && sub.status !== SubmissionStatus.GRADED;
    }
    if (queueFilter === 'GRADED') {
      return sub.status === SubmissionStatus.GRADED;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ─── ACTION BAR (CREATE TASK BUTTON) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Manajemen Penugasan Kelas</h2>
          <p className="text-xs text-slate-500">
            Terbitkan tugas baru atau kelola dan koreksi tugas yang telah diterbitkan
          </p>
        </div>

        <Link
          href="/tugas/buat"
          prefetch={true}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Terbitkan Tugas Baru
        </Link>
      </div>

      {/* ─── QUICK KPI TILES ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab('QUEUE');
            setQueueFilter('PENDING');
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'QUEUE' && queueFilter === 'PENDING'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-amber-600 block mb-0.5">Menunggu Koreksi</span>
          <div className="text-xl font-bold text-amber-700">{pendingCount}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('QUEUE');
            setQueueFilter('PARENT_VERIFIED');
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'QUEUE' && queueFilter === 'PARENT_VERIFIED'
              ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-purple-600 block mb-0.5">Diparaf Ortu</span>
          <div className="text-xl font-bold text-purple-700">{parentVerifiedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('QUEUE');
            setQueueFilter('GRADED');
          }}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'QUEUE' && queueFilter === 'GRADED'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-emerald-600 block mb-0.5">Tuntas Dinilai</span>
          <div className="text-xl font-bold text-emerald-700">{gradedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ASSIGNMENTS')}
          className={`p-3.5 rounded-2xl border text-left transition-all ${
            activeTab === 'ASSIGNMENTS'
              ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-semibold text-teal-600 block mb-0.5">Tugas Dibuat</span>
          <div className="text-xl font-bold text-teal-700">{assignments.length}</div>
        </button>
      </div>

      {/* ─── TAB SWITCHER & SEARCH ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'ASSIGNMENTS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Daftar Tugas ({assignments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('QUEUE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'QUEUE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Antrean Koreksi ({gradingQueue.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari tugas / nama..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ─── TAB 1: DAFTAR TUGAS DIBUAT ─── */}
      {activeTab === 'ASSIGNMENTS' && (
        <>
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Belum ada tugas diterbitkan</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
                Klik tombol &quot;Terbitkan Tugas Baru&quot; di atas untuk membuat penugasan pasca-pengajian bagi santri.
              </p>
              <Link
                href="/tugas/buat"
                prefetch={true}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Buat Tugas Pertama
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssignments.map((task) => {
                const parsedConfig = task.config || parseAssignmentConfig(task.attachmentUrl);
                return (
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
                    className={task.className}
                    teacherName={task.teacherName}
                    organizationName={task.organizationName}
                    organizationType={task.organizationType}
                    tierLevel={task.tierLevel}
                    materialTitle={task.materialTitle}
                    totalSubmissions={task.totalSubmissions}
                    targetStudentsCount={task.targetStudentsCount}
                    pendingCount={task.pendingSubmissions}
                    gradedCount={task.gradedSubmissions}
                    verifiedCount={task.verifiedByParent || 0}
                    overdueAction={parsedConfig.overdueAction}
                    penaltyPercent={parsedConfig.penaltyPercentage}
                    role="PENGAJAR"
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── TAB 2: ANTREAN KOREKSI ─── */}
      {activeTab === 'QUEUE' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            <button
              onClick={() => setQueueFilter('PENDING')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                queueFilter === 'PENDING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Menunggu Koreksi ({pendingCount})
            </button>
            <button
              onClick={() => setQueueFilter('PARENT_VERIFIED')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                queueFilter === 'PARENT_VERIFIED' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Diparaf Ortu ({parentVerifiedCount})
            </button>
            <button
              onClick={() => setQueueFilter('GRADED')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                queueFilter === 'GRADED' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Selesai Dinilai ({gradedCount})
            </button>
            <button
              onClick={() => setQueueFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                queueFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              Semua Setoran ({gradingQueue.length})
            </button>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              Tidak ada setoran santri yang sesuai filter ini.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredQueue.map((sub) => (
                <div
                  key={sub.submissionId}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{sub.studentName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                        {sub.generationName}
                      </span>
                      <span className="text-xs text-slate-500">• {sub.assignmentTitle}</span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      <span>
                        Kumpul:{' '}
                        {new Date(sub.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {sub.isVerifiedByParent && (
                        <span className="text-purple-600 font-medium inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Diparaf Ortu
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <TaskStatusBadge
                      status={sub.status}
                      score={sub.score}
                      isVerifiedByParent={sub.isVerifiedByParent}
                    />
                    <Link
                      href={`/tugas/${sub.assignmentId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
                    >
                      Buka Lembar Koreksi
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
