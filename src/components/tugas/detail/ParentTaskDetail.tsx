'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Award,
  Users,
  Building2,
  Clock,
  Sparkles,
  Heart,
  User,
  BookOpen,
  Calendar,
  X,
  Send,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Link as LinkIcon,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { formatTierOrganization } from '../list/TaskListCard';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskDetailLayout from './TaskDetailLayout';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import DeadlineCountdown, { formatDueDate } from '../shared/DeadlineCountdown';
import LazyAudioSection from '../LazyAudioSection';
import LazyPhotoSection from '../LazyPhotoSection';
import QuizSubmissionReview from '../QuizSubmissionReview';
import { verifySubmissionByParent } from '@/app/(protected)/tugas/actions';
import { parseHabitData, getHabitProgress, parseMediaUrls } from '@/lib/habitParser';
import type { OverdueAction, AssignmentConfig } from '@/lib/assignmentConfig';

interface ParentTaskDetailData {
  role: 'ORANG_TUA';
  userProfile: {
    id: string;
    fullName: string;
  };
  childInfo: {
    id: string;
    fullName: string;
    generationName: string;
  } | null;
  allChildren?: {
    id: string;
    fullName: string;
    generationName: string;
  }[];
  activeChildId?: string;
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
    config: AssignmentConfig & {
      [key: string]: any;
    };
    createdAt: string;
    teacherName: string;
    organizationName: string;
    organizationType?: string | null;
    tierLevel?: string | null;
    className?: string | null;
    materialTitle: string | null;
  };
  submission: {
    id: string;
    submissionText: string | null;
    mediaFileUrl: string | null;
    status: SubmissionStatus;
    score: number | null;
    teacherFeedback: string | null;
    submittedAt: string;
    studentName: string;
    parentVerification: {
      id: string;
      isVerifiedByParent: boolean;
      parentFeedback: string | null;
      magicToken: string | null;
      verifiedAt: string | null;
    } | null;
  } | null;
}

interface ParentTaskDetailProps {
  data: ParentTaskDetailData;
}

const QUICK_FEEDBACK_TAGS = [
  'Alhamdulillah hafalan sangat lancar & fasih',
  'Sudah diperdengarkan & didampingi di rumah',
  'Bagus sekali, terus semangat belajarnya nak!',
  'Ibadah hariannya tertib dan disiplin',
  'Alhamdulillah tugas diselesaikan dengan baik',
];

export default function ParentTaskDetail({ data }: ParentTaskDetailProps) {
  const { assignment, childInfo } = data;
  const config = assignment.config;

  const [submission, setSubmission] = useState(data.submission);
  const [parentFeedback, setParentFeedback] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Sinkronkan state jika data submission atau anak aktif berganti
  useEffect(() => {
    setSubmission(data.submission);
    setParentFeedback('');
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [data.submission, data.childInfo?.id]);

  const isVerified = Boolean(submission?.parentVerification?.isVerifiedByParent);
  const taskPhotos: string[] = config.taskAttachments?.photos || (config as any).attachmentPhotos || [];
  const taskLinks: Array<{ url: string; title?: string }> = config.taskAttachments?.links || (config as any).taskLinks || [];
  const documentUrl: string | null =
    config.documentUrl ||
    (config.taskAttachments as any)?.documentUrl ||
    (typeof assignment.attachmentUrl === 'string' && !assignment.attachmentUrl.trim().startsWith('{')
      ? assignment.attachmentUrl.trim()
      : null);
  const formattedTierOrg = formatTierOrganization(assignment.organizationName, assignment.organizationType || assignment.tierLevel);

  const handleQuickTagClick = (tag: string) => {
    setParentFeedback((prev) => (prev ? `${prev}. ${tag}` : tag));
  };

  const handleVerify = async () => {
    if (!submission) return;
    setIsVerifying(true);
    setErrorMessage(null);

    const note = parentFeedback.trim() || 'Telah diverifikasi dan didampingi orang tua di rumah.';

    try {
      const res = await verifySubmissionByParent({
        submissionId: submission.id,
        parentFeedback: note,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSubmission((prev) =>
          prev
            ? {
              ...prev,
              parentVerification: {
                id: prev.parentVerification?.id || 'temp',
                isVerifiedByParent: true,
                parentFeedback: note,
                magicToken: prev.parentVerification?.magicToken || null,
                verifiedAt: new Date().toISOString(),
              },
            }
            : null
        );
        setSuccessMessage(`Alhamdulillah! Paraf berhasil disimpan (+${res.bonusPoints} Bonus Poin).`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan paraf.');
    } finally {
      setIsVerifying(false);
    }
  };

  const habitData =
    assignment.taskType === TaskType.DAILY_HABIT && submission?.submissionText
      ? parseHabitData(submission.submissionText)
      : null;
  const habitProgress = habitData ? getHabitProgress(habitData.habits, config.checklistItems) : null;

  const currentChildId = childInfo?.id || data.activeChildId;

  return (
    <TaskDetailLayout
      backLabel="Kembali ke Daftar Tugas"
      backHref={currentChildId ? `/tugas?studentId=${currentChildId}` : '/tugas'}
    >
      <div className="space-y-6">
        {/* ─── TAB SWITCHER ANAK (JIKA ANAK > 1) ─── */}

        {/* ─── HEADER CARD ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -z-0 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex  items-center gap-2 flex-wrap">
                <TaskTypeBadge taskType={assignment.taskType} size="md" />
              </div>

              {/* Verification status pill */}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  <ShieldCheck className="w-4 h-4" />
                  Sudah Diparaf
                </span>
              ) : assignment.requiresParentVerification && submission ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  Menunggu Paraf Anda
                </span>
              ) : null}
            </div>
            {childInfo && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 mb-2">
                {childInfo.fullName} ({childInfo.generationName})
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 leading-tight">
              {assignment.title}
            </h1>

            <div className="flex flex-col items-start gap-y-1.5 text-xs text-slate-500 mb-2">
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{assignment.teacherName}</span>
              </span>
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
                <div className="inline-flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{formatDueDate(assignment.dueDate)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className='flex flex-col items-start w-full gap-y-2 border-t pt-2 border-slate-100'>
              {assignment.description && (
                <div className="flex w-full items-center gap-1 pb-2 border-b border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                    {assignment.description}
                  </p>
                </div>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                +{assignment.pointsReward}
                {assignment.requiresParentVerification && assignment.parentBonusPoints > 0 && (
                  <span className="inline-flex items-center text-xs font-bold text-amber-800">
                    ({assignment.parentBonusPoints} Bonus)
                  </span>
                )}
                <span className="text-xs font-bold text-amber-900">Poin</span>
              </span>
            </div>
          </div>

        </div>
        <div>
          <DeadlineCountdown
            dueDate={assignment.dueDate}
            overdueAction={config.overdueAction}
            penaltyPercentage={config.penaltyPercentage}
          />
        </div>

        {/* ─── LAMPIRAN TUGAS (FOTO, BERKAS & TAUTAN) ─── */}
        {(taskPhotos.length > 0 || taskLinks.length > 0 || Boolean(documentUrl)) && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                Lampiran Tugas
              </h2>
              <span className="text-[11px] font-medium text-slate-400">
                {taskPhotos.length > 0 && `${taskPhotos.length} Foto `}
                {taskPhotos.length > 0 && (Boolean(documentUrl) || taskLinks.length > 0) && '• '}
                {documentUrl && '1 Berkas Dokumen '}
                {documentUrl && taskLinks.length > 0 && '• '}
                {taskLinks.length > 0 && `${taskLinks.length} Tautan`}
              </span>
            </div>

            {/* Berkas Dokumen / PDF */}
            {documentUrl && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">Berkas Dokumen / Materi:</span>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-purple-100 bg-purple-50/50 hover:bg-purple-100/60 transition-all group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-purple-700">
                        Buka / Unduh Berkas Dokumen Tugas
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {documentUrl}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-600 shrink-0 ml-2">
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
                        <LinkIcon className="w-4 h-4 text-purple-600 shrink-0" />
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-purple-700">
                            {link.title || link.url}
                          </span>
                          {link.title && (
                            <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                              {link.url}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STATUS PENGERJAAN ANANDA ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap gap-2 items-start justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Lembar Pengerjaan Ananda
            </h2>

            {submission && (
              <TaskStatusBadge
                status={submission.status}
                score={submission.score}
                requiresParentVerification={assignment.requiresParentVerification}
                isVerifiedByParent={isVerified}
              />
            )}
          </div>

          {!submission ? (
            <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">Ananda Belum Mengumpulkan Tugas</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Silakan dampingi ananda untuk menyelesaikan tugas ini sebelum batas waktu pengumpulan berakhir.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Dikumpulkan pada:{' '}
                <span className="font-semibold text-slate-600">
                  {new Date(submission.submittedAt).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </p>

              {/* Feedback Guru jika sudah dinilai */}
              {submission.status === SubmissionStatus.GRADED && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                  <Award className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-emerald-900 text-sm">
                      Nilai Guru: {submission.score} / 100
                    </p>
                    {submission.teacherFeedback && (
                      <p className="text-emerald-700 leading-relaxed">
                        Catatan Guru: &ldquo;{submission.teacherFeedback}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Submission Content */}
              <div className=" rounded-xl space-y-3">
                {/* 1. DAILY HABIT */}
                {assignment.taskType === TaskType.DAILY_HABIT && (
                  <div>
                    {habitProgress && (
                      <div className="mb-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs">
                        <span className="font-medium text-emerald-800">
                          Capaian Checklist: {habitProgress.count} / {habitProgress.total} Selesai
                        </span>
                        <span className="font-bold text-emerald-700">{habitProgress.percentage}%</span>
                      </div>
                    )}
                    {habitData && habitData.habits.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {habitData.habits.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded-lg text-xs bg-emerald-50/80 text-emerald-800 border border-emerald-200"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {habitData?.notes && (
                      <div className="mt-3 p-3.5 bg-amber-50/70 rounded-xl text-xs text-slate-700 border border-amber-200/80 flex items-start gap-2.5">
                        <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-900 block text-xs">Catatan Tambahan Santri:</span>
                          <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{habitData.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. AUDIO */}
                {assignment.taskType === TaskType.AUDIO_MEMORIZATION && (
                  <div className="space-y-3">
                    <LazyAudioSection
                      audioUrls={parseMediaUrls(submission.mediaFileUrl)}
                    />
                    {submission.submissionText && !submission.submissionText.startsWith('Setoran hafalan audio santri') && (
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700 flex items-start gap-2.5">
                        <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-900 block text-xs">Catatan Tambahan Santri:</span>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{submission.submissionText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. WRITTEN SUBMISSION */}
                {assignment.taskType === TaskType.WRITTEN_SUBMISSION && (
                  <div className="space-y-3">
                    {submission.submissionText && (
                      <div className="p-4 bg-white rounded-xl text-xs sm:text-sm text-slate-800 leading-relaxed border border-slate-200 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                          <span>Catatan / Laporan Santri:</span>
                        </div>
                        <p className="whitespace-pre-wrap">{submission.submissionText}</p>
                      </div>
                    )}
                    {submission.mediaFileUrl && (
                      <LazyPhotoSection
                        photoUrls={parseMediaUrls(submission.mediaFileUrl)}
                        onPreviewImage={(url: string) => setPreviewImage(url)}
                      />
                    )}
                  </div>
                )}

                {/* 5. QUIZ ONLINE */}
                {assignment.taskType === TaskType.QUIZ_ONLINE && submission.submissionText && (
                  <QuizSubmissionReview
                    submissionText={submission.submissionText}
                    config={config}
                    allowToggle={true}
                    defaultExpanded={true}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── SECTION PARAF DIGITAL ORANG TUA ─── */}
        {assignment.requiresParentVerification && submission && (
          <div className="bg-white rounded-2xl border border-purple-200/80 shadow-sm p-6 space-y-5">
            <div className='flex flex-col pb-3 border-b border-purple-100'>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-base font-bold text-purple-950">Paraf Digital Orang Tua / Wali</h3>
                </div>
              </div>
              <p className="text-xs text-purple-600 mt-0.5">
                Konfirmasikan bahwa Anda telah mendampingi atau memeriksa pengerjaan ananda
              </p>
            </div>

            {isVerified ? (
              <div className=" space-y-2">
                <div className="flex flex-col md:flex-row items-start gap-2 ">
                  <div className='flex items-center gap-2 text-purple-900 font-bold text-sm'>
                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                    Telah Dikonfirmasi
                  </div>

                </div>
                <div className='flex flex-col text-left font-bold text-purple-900 bg-white/70 p-3 rounded-xl border border-purple-100 gap-2'>
                  <div className='text-[11px]'>
                    {' '}
                    {submission.parentVerification?.verifiedAt
                      ? new Date(submission.parentVerification.verifiedAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : 'Sebelumnya'}
                  </div>

                  {submission.parentVerification?.parentFeedback && (
                    <p className="text-xs text-purple-800 italic">
                      &ldquo;{submission.parentVerification.parentFeedback}&rdquo;
                    </p>
                  )}
                </div>
                <div className="text-[11px] text-purple-700 font-medium pt-1">
                  Bonus +{assignment.parentBonusPoints} poin telah berhasil ditambahkan ke poin ananda.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quick Feedback Tags */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Pilih Apresiasi Cepat untuk Ananda:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_FEEDBACK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleQuickTagClick(tag)}
                        className="px-2.5 py-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl transition-colors text-left"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Note Textarea */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Pesan / Doa Restu untuk Ananda:
                  </label>
                  <textarea
                    rows={3}
                    value={parentFeedback}
                    onChange={(e) => setParentFeedback(e.target.value)}
                    placeholder="Tuliskan apresiasi, doa, atau catatan pendampingan untuk ananda..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                  />
                </div>

                {successMessage && (
                  <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    {successMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    {errorMessage}
                  </div>
                )}

                {/* Submit Paraf Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {isVerifying ? 'Menyimpan Paraf...' : `Beri Paraf (+${assignment.parentBonusPoints} Poin)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── PHOTO PREVIEW MODAL ─── */}
      {
        previewImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
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
                alt="Preview Pengerjaan Ananda"
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-black"
              />
            </div>
          </div>
        )
      }
    </TaskDetailLayout >
  );
}
