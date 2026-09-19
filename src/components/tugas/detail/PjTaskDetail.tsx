'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Clock,
  Award,
  ShieldCheck,
  Calendar,
  User,
  BookOpen,
  Edit,
  Trash2,
  AlertTriangle,
  Search,
  FileText,
  BarChart3,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskDetailLayout from './TaskDetailLayout';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import DeadlineCountdown, { formatDueDate } from '../shared/DeadlineCountdown';
import { deleteAssignment } from '@/app/(protected)/tugas/actions';
import { formatTierOrganization } from '../list/TaskListCard';
import type { OverdueAction } from '@/lib/assignmentConfig';

interface PjTaskDetailData {
  role: 'PJ';
  userProfile: {
    id: string;
    fullName: string;
  };
  assignment: {
    id: string;
    title: string;
    description: string | null;
    taskType: TaskType;
    requiresParentVerification: boolean;
    dueDate: string | null;
    pointsReward: number;
    parentBonusPoints: number;
    attachmentUrl: string | null;
    config: {
      overdueAction?: OverdueAction;
      penaltyPercent?: number;
      [key: string]: any;
    };
    createdAt: string;
    teacherId: string;
    teacherName: string;
    organizationName: string;
    organizationType?: string | null;
    tierLevel?: string | null;
    className: string;
    materialTitle: string | null;
  };
  submissions: Array<{
    id: string;
    studentName: string;
    generationName: string;
    status: SubmissionStatus;
    score: number | null;
    submittedAt: string;
    isVerifiedByParent: boolean;
  }>;
  stats: {
    totalSubmissions: number;
    gradedCount: number;
    verifiedCount: number;
  };
  isOwner: boolean;
}

interface PjTaskDetailProps {
  data: PjTaskDetailData;
}

export default function PjTaskDetail({ data }: PjTaskDetailProps) {
  const router = useRouter();
  const { assignment, stats, submissions, isOwner } = data;
  const config = assignment.config;
  const formattedTierOrg = formatTierOrganization(assignment.organizationName, assignment.organizationType || assignment.tierLevel);

  const [search, setSearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filteredSubmissions = submissions.filter((s) =>
    s.studentName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteAssignment = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteAssignment(assignment.id);
      if (res.error) {
        setDeleteError(res.error);
        setIsDeleting(false);
      } else {
        router.push('/tugas');
        router.refresh();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus penugasan.');
      setIsDeleting(false);
    }
  };

  return (
    <TaskDetailLayout backLabel="Kembali ke Daftar Tugas">
      <div className="space-y-6">
        {/* ─── HEADER CARD ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl -z-0 pointer-events-none" />
          {/* Action Buttons for PJ/Owner */}

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <TaskTypeBadge taskType={assignment.taskType} size="md" />
              {isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/tugas/${assignment.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Edit Tugas
                  </Link>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 leading-tight">
              {assignment.title}
            </h1>

            <div className="flex flex-col items-start gap-y-1.5 text-xs text-slate-500 mb-4">
              {assignment.teacherName && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{assignment.teacherName}</span>
                </span>
              )}

              {formattedTierOrg && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formattedTierOrg}</span>
                </span>
              )}

              {assignment.className && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{assignment.className}</span>
                </span>
              )}

              {assignment.materialTitle && (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>{assignment.materialTitle}</span>
                </span>
              )}

              {assignment.dueDate && (
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatDueDate(assignment.dueDate)}</span>
                </span>
              )}
            </div>

            {/* Deadline & Points Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl flex-1">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold mb-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    Reward Santri
                  </div>
                  <div className="text-lg font-bold text-amber-900">+{assignment.pointsReward} Poin</div>
                </div>

                {assignment.requiresParentVerification && (
                  <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex-1">
                    <div className="flex items-center gap-1.5 text-purple-800 text-xs font-semibold mb-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      Bonus Ortu
                    </div>
                    <div className="text-lg font-bold text-purple-900">+{assignment.parentBonusPoints} Poin</div>
                  </div>
                )}
              </div>
              <div>
                <DeadlineCountdown
                  dueDate={assignment.dueDate}
                  overdueAction={config.overdueAction}
                  penaltyPercentage={config.penaltyPercentage}
                />
              </div>
            </div>

            {/* Description */}
            {assignment.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
                  Instruksi Tugas
                </span>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                  {assignment.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── STATISTIK SUPERVISI ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-semibold">Total Terkumpul</span>
              <TrendingUp className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{stats.totalSubmissions}</div>
            <span className="text-[11px] text-slate-400">Santri yang telah menyetorkan tugas</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-purple-600 font-semibold">Paraf Orang Tua</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-purple-700">{stats.verifiedCount}</div>
            <span className="text-[11px] text-purple-600/80">
              {stats.totalSubmissions > 0
                ? `${Math.round((stats.verifiedCount / stats.totalSubmissions) * 100)}% keterlibatan ortu`
                : 'Belum ada data'}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-emerald-600 font-semibold">Tuntas Dievaluasi</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">{stats.gradedCount}</div>
            <span className="text-[11px] text-emerald-600/80">
              {stats.totalSubmissions > 0
                ? `${Math.round((stats.gradedCount / stats.totalSubmissions) * 100)}% dinilai oleh guru`
                : 'Belum ada data'}
            </span>
          </div>
        </div>

        {/* ─── TABEL REKAP SUBMISSION SANTRI ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Rekapitulasi Setoran Santri</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daftar santri yang telah mengumpulkan tugas ini</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari santri..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {submissions.length === 0
                ? 'Belum ada santri yang mengumpulkan tugas ini.'
                : 'Tidak ada santri yang cocok dengan pencarian.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSubmissions.map((s) => (
                <div key={s.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                      {s.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{s.studentName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {s.generationName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TaskStatusBadge
                      status={s.status}
                      score={s.score}
                      requiresParentVerification={assignment.requiresParentVerification}
                      isVerifiedByParent={s.isVerifiedByParent}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── MODAL HAPUS TUGAS ─── */}
      {
        showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Hapus Tugas Ini?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                <p className="font-semibold">Perhatian:</p>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  <li>Tugas <strong>{assignment.title}</strong> akan dihapus permanen.</li>
                  <li>
                    Sebanyak <strong>{stats.totalSubmissions} submission santri</strong> beserta nilai dan file media akan ikut terhapus.
                  </li>
                </ul>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAssignment}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </TaskDetailLayout >
  );
}
