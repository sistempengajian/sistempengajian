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
  ChevronRight,
  UserCheck,
  Image as ImageIcon,
  Link as LinkIcon,
  ExternalLink,
  X,
  FileCheck,
  Building2,
  FileText,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskDetailLayout from './TaskDetailLayout';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import DeadlineCountdown, { formatDueDate } from '../shared/DeadlineCountdown';
import ManageGradersModal, { TeacherGraderOption } from '../form/ManageGradersModal';
import { deleteAssignment, updateAssignmentGraders } from '@/app/(protected)/tugas/actions';
import { formatTierOrganization } from '../list/TaskListCard';
import type { OverdueAction, AssignmentLinkAttachment } from '@/lib/assignmentConfig';

interface SubmissionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar: string | null;
  generationName: string;
  submissionText: string | null;
  mediaFileUrl: string | null;
  status: SubmissionStatus;
  score: number | null;
  teacherFeedback: string | null;
  submittedAt: string;
  isVerifiedByParent: boolean;
  parentVerifierName: string | null;
  parentFeedback: string | null;
}

interface TeacherTaskDetailData {
  role: 'PENGAJAR' | 'PJ';
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
      penaltyPercentage?: number;
      checklistItems?: string[];
      quizQuestions?: any[];
      assistantGraderIds?: string[];
      taskAttachments?: {
        photos?: string[];
        links?: AssignmentLinkAttachment[];
      };
      [key: string]: any;
    };
    createdAt: string;
    className: string;
    materialTitle: string | null;
    teacherId: string;
    teacherName: string;
    organizationName: string;
    organizationType?: string | null;
    tierLevel?: string | null;
  };
  submissions: SubmissionItem[];
  stats: {
    totalSubmissions: number;
    pendingSubmissions: number;
    gradedSubmissions: number;
    verifiedByParent: number;
    avgScore: number | null;
  };
  isOwner: boolean;
  canGrade?: boolean;
  availableTeachers?: TeacherGraderOption[];
}

interface TeacherTaskDetailProps {
  data: TeacherTaskDetailData;
}

export default function TeacherTaskDetail({ data }: TeacherTaskDetailProps) {
  const router = useRouter();
  const { assignment, stats, isOwner } = data;
  const config = assignment.config || {};
  const formattedTierOrg = formatTierOrganization(
    assignment.organizationName,
    assignment.organizationType || assignment.tierLevel
  );

  // Submissions state
  const [submissions] = useState<SubmissionItem[]>(data.submissions);

  // Filters
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'PARENT_VERIFIED' | 'GRADED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Akses Koreksi Modal State
  const [showGradersModal, setShowGradersModal] = useState(false);
  const [assistantGraderIds, setAssistantGraderIds] = useState<string[]>(config.assistantGraderIds || []);

  // Photo preview modal for task attachments
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const filteredSubmissions = submissions.filter((sub) => {
    const matchSearch = sub.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (filterTab === 'PENDING') {
      return sub.status === SubmissionStatus.SUBMITTED || sub.status === SubmissionStatus.VERIFIED_BY_PARENT;
    }
    if (filterTab === 'PARENT_VERIFIED') {
      return sub.isVerifiedByParent && sub.status !== SubmissionStatus.GRADED;
    }
    if (filterTab === 'GRADED') {
      return sub.status === SubmissionStatus.GRADED;
    }
    return true;
  });

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

  const handleSaveGraders = async (graderIds: string[]) => {
    try {
      const res = await updateAssignmentGraders({
        assignmentId: assignment.id,
        graderIds,
      });
      if (res.error) {
        alert(res.error);
      } else {
        setAssistantGraderIds(graderIds);
        setShowGradersModal(false);
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui akses koreksi.');
    }
  };

  const taskPhotos = config.taskAttachments?.photos || [];
  const taskLinks = config.taskAttachments?.links || [];
  const documentUrl =
    config.documentUrl ||
    (config.taskAttachments as any)?.documentUrl ||
    (typeof assignment.attachmentUrl === 'string' && !assignment.attachmentUrl.trim().startsWith('{')
      ? assignment.attachmentUrl.trim()
      : null);

  return (
    <TaskDetailLayout backLabel="Kembali ke Daftar Tugas">
      <div className="space-y-6">
        {/* ─── HEADER CARD ─── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex flex-wrap justify-between gap-2 mb-4">
              <div className="flex flex-col sm:flex-row items-start gap-2">
                <TaskTypeBadge taskType={assignment.taskType} size="md" />
                <button
                  type="button"
                  onClick={() => setShowGradersModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span>Akses Koreksi ({assistantGraderIds.length})</span>
                </button>
              </div>

              {/* Action Buttons for Creator / Owner */}
              {isOwner && (
                <div className="flex flex-col sm:flex-row items-end gap-2">


                  <Link
                    href={`/tugas/${assignment.id}/edit`}
                    prefetch={true}
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

            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 mb-2 leading-tight tracking-tight">
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
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{assignment.materialTitle}</span>
                </span>
              )}

              {assignment.dueDate && (
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium text-[12px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatDueDate(assignment.dueDate)}</span>
                </span>
              )}
            </div>

            {/* Description */}
            {assignment.description && (
              <div className="pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed pb-3">
                {assignment.description}
              </div>
            )}

            {/* Reward Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200/60 px-3.5 py-2 rounded-2xl text-amber-900 text-xs font-semibold">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Reward Santri: +{assignment.pointsReward} Poin</span>
              </div>

              {assignment.requiresParentVerification && (
                <div className="flex items-center gap-2 bg-purple-50/80 border border-purple-200/60 px-3.5 py-2 rounded-2xl text-purple-900 text-xs font-semibold">
                  <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Bonus Paraf Ortu: +{assignment.parentBonusPoints} Poin</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── LAMPIRAN TUGAS (FOTO, BERKAS & TAUTAN) ─── */}
        {(taskPhotos.length > 0 || taskLinks.length > 0 || Boolean(documentUrl)) && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-wrap items-start gap-2 justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                Lampiran Foto, Berkas & Tautan Tugas
              </h2>
              <div className='flex items-center'>
                <span className="text-[11px] font-medium text-slate-400">
                  {taskPhotos.length > 0 && `${taskPhotos.length} Foto `}
                  {taskPhotos.length > 0 && (Boolean(documentUrl) || taskLinks.length > 0) && '• '}
                  {documentUrl && '1 Berkas Dokumen '}
                  {documentUrl && taskLinks.length > 0 && '• '}
                  {taskLinks.length > 0 && `${taskLinks.length} Tautan`}
                </span>
              </div>
            </div>

            {/* Berkas Dokumen / PDF */}
            {documentUrl && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">Berkas Dokumen / Materi:</span>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-teal-100 bg-teal-50/50 hover:bg-teal-100/60 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-teal-700">
                        Buka / Unduh Berkas Dokumen Tugas
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {documentUrl}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-teal-600 shrink-0 ml-2">
                    <span className="text-[11px] font-semibold hidden sm:inline">Buka Berkas</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </a>
              </div>
            )}

            {/* Foto Lampiran */}
            {taskPhotos.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">Foto Lampiran:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {taskPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setPreviewImage(photo)}
                      className="cursor-pointer group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={photo}
                        alt={`Lampiran tugas ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        Lihat Foto
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link Lampiran */}
            {taskLinks.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">Tautan / Link Materi:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {taskLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition-all group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <LinkIcon className="w-4 h-4 text-teal-600 shrink-0" />
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-teal-700">
                            {link.title || link.url}
                          </span>
                          {link.title && (
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              {link.url}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── DEADLINE COUNTDOWN ─── */}
        <div>
          <DeadlineCountdown
            dueDate={assignment.dueDate}
            overdueAction={config.overdueAction}
            penaltyPercentage={config.penaltyPercentage || config.penaltyPercent}
          />
        </div>

        {/* ─── STATISTIK PENGERJAAN ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium block mb-1">Total Mengumpulkan</span>
            <div className="text-2xl font-bold text-slate-900">{stats.totalSubmissions}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs text-amber-600 font-medium block mb-1">Menunggu Dinilai</span>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingSubmissions}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs text-emerald-600 font-medium block mb-1">Sudah Dinilai</span>
            <div className="text-2xl font-bold text-emerald-600">{stats.gradedSubmissions}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-xs text-purple-600 font-medium block mb-1">Diparaf Ortu</span>
            <div className="text-2xl font-bold text-purple-600">{stats.verifiedByParent}</div>
          </div>
        </div>

        {/* ─── DAFTAR PENGERJAAN SANTRI (CARD LIST TERPISAH) ─── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                Lembar Hasil & Koreksi Santri
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar santri yang mengumpulkan tugas. Klik tombol untuk membuka halaman koreksi tiap santri.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari santri..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${filterTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Semua ({submissions.length})
            </button>
            <button
              onClick={() => setFilterTab('PENDING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${filterTab === 'PENDING'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Menunggu ({stats.pendingSubmissions})
            </button>
            <button
              onClick={() => setFilterTab('PARENT_VERIFIED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${filterTab === 'PARENT_VERIFIED'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Paraf Ortu ({stats.verifiedByParent})
            </button>
            <button
              onClick={() => setFilterTab('GRADED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${filterTab === 'GRADED'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Selesai Dinilai ({stats.gradedSubmissions})
            </button>
          </div>

          {/* List Submissions */}
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">Tidak ada pengumpulan tugas</p>
              <p className="text-xs text-slate-400 mt-1">
                {submissions.length === 0
                  ? 'Belum ada santri yang mengumpulkan tugas ini.'
                  : 'Tidak ada santri yang cocok dengan filter saat ini.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="py-4 px-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3.5">
                    {sub.studentAvatar ? (
                      <img
                        src={sub.studentAvatar}
                        alt={sub.studentName}
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm border border-teal-200 shrink-0">
                        {sub.studentName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{sub.studentName}</h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {sub.generationName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Kumpul:{' '}
                        {new Date(sub.submittedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <TaskStatusBadge
                      status={sub.status}
                      score={sub.score}
                      requiresParentVerification={assignment.requiresParentVerification}
                      isVerifiedByParent={sub.isVerifiedByParent}
                    />

                    <Link
                      href={`/tugas/${assignment.id}/koreksi/${sub.id}`}
                      prefetch={true}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${sub.status === SubmissionStatus.GRADED
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                        }`}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>{sub.status === SubmissionStatus.GRADED ? 'Lihat Nilai' : 'Koreksi Tugas'}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                    </Link>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
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

      {/* ─── MODAL AKSES KOREKSI ─── */}
      <ManageGradersModal
        isOpen={showGradersModal}
        onClose={() => setShowGradersModal(false)}
        teachers={data.availableTeachers || []}
        selectedGraderIds={assistantGraderIds}
        onSave={handleSaveGraders}
      />

      {/* ─── PHOTO PREVIEW LIGHTBOX ─── */}
      {
        previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-2xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewImage}
                alt="Preview Lampiran Tugas"
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-black"
              />
            </div>
          </div>
        )
      }
    </TaskDetailLayout >
  );
}
