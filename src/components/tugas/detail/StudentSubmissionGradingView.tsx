'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Loader2,
  Calendar,
  Award,
  BookOpen,
  User,
  Users,
  X,
  FileCheck,
  Lock,
  MessageSquare,
} from 'lucide-react';
import { TaskType, SubmissionStatus } from '@prisma/client';
import TaskDetailLayout from './TaskDetailLayout';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import LazyAudioSection from '../LazyAudioSection';
import LazyPhotoSection from '../LazyPhotoSection';
import QuizSubmissionReview from '../QuizSubmissionReview';
import { gradeAssignmentSubmission } from '@/app/(protected)/tugas/actions';
import { parseHabitData, getHabitProgress, parseMediaUrls } from '@/lib/habitParser';

interface StudentSubmissionGradingViewProps {
  data: {
    canGrade: boolean;
    isOwner: boolean;
    isAssistantGrader: boolean;
    assignment: {
      id: string;
      title: string;
      description: string | null;
      taskType: TaskType;
      requiresParentVerification: boolean;
      pointsReward: number;
      parentBonusPoints: number;
      dueDate: string | null;
      teacherName: string;
      materialTitle: string | null;
      config: any;
    };
    submission: {
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
    };
    navigation: {
      currentIndex: number;
      totalSubmissions: number;
      prevSubmissionId: string | null;
      nextSubmissionId: string | null;
      allSubmissions: Array<{
        id: string;
        studentName: string;
        status: SubmissionStatus;
        score: number | null;
      }>;
    };
  };
}

const SCORE_PILLS = [70, 75, 80, 85, 90, 95, 100];
const QUICK_FEEDBACK_TAGS = [
  '✓ Makhraj Sempurna',
  '✓ Tajwid Fasih',
  '✓ Hafalan Lancar',
  '✓ Khidmat & Istiqomah',
  'Perlu Latihan Mad',
  'Butuh Bimbingan Tambahan',
  'Pertahankan Prestasinya!',
];

export default function StudentSubmissionGradingView({ data }: StudentSubmissionGradingViewProps) {
  const router = useRouter();
  const { assignment, submission, navigation, canGrade } = data;
  const config = assignment.config || {};

  // Form State
  const [score, setScore] = useState<number>(submission.score ?? 85);
  const [feedback, setFeedback] = useState<string>(submission.teacherFeedback ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Photo preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Parse Habit
  const habitData =
    assignment.taskType === TaskType.DAILY_HABIT && submission.submissionText
      ? parseHabitData(submission.submissionText)
      : null;
  const habitProgress = habitData
    ? getHabitProgress(habitData.habits, config.checklistItems)
    : null;

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
      setFeedback((prev) => prev.replace(tag, '').trim());
    } else {
      setSelectedTags((prev) => [...prev, tag]);
      setFeedback((prev) => (prev ? `${prev}, ${tag}` : tag));
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGrade) return;

    if (score < 0 || score > 100) {
      setErrorMessage('Nilai harus di antara 0 dan 100.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await gradeAssignmentSubmission({
        submissionId: submission.id,
        score,
        teacherFeedback: feedback.trim() || undefined,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(`Nilai berhasil disimpan! Santri mendapatkan +${res.pointsAwarded} Poin.`);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan nilai.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TaskDetailLayout backLabel="Kembali ke Lembar Tugas">
      <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in">
        {/* Navigation & Breadcrumb Bar */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/tugas/${assignment.id}`}
              prefetch={true}
              className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              title="Kembali ke Detail Tugas"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                  {assignment.title}
                </span>
                <TaskTypeBadge taskType={assignment.taskType} size="sm" />
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Halaman Penilaian & Evaluasi Santri
              </p>
            </div>
          </div>

          {/* Student Switcher & Counter */}
          <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <span className="text-xs font-semibold text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg">
              Santri {navigation.currentIndex} dari {navigation.totalSubmissions}
            </span>
            <div className="flex items-center gap-1">
              {navigation.prevSubmissionId ? (
                <Link
                  href={`/tugas/${assignment.id}/koreksi/${navigation.prevSubmissionId}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Santri Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-300 cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
              )}

              {navigation.nextSubmissionId ? (
                <Link
                  href={`/tugas/${assignment.id}/koreksi/${navigation.nextSubmissionId}`}
                  prefetch={true}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                  title="Santri Berikutnya"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 text-slate-300 cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Student Profile Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-start gap-4">
            <div className="flex flex-start items-center gap-2 w-full">

              {submission.studentAvatar ? (
                <img
                  src={submission.studentAvatar}
                  alt={submission.studentName}
                  className="w-15 h-15 rounded-2xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xl border border-teal-200">
                  {submission.studentName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex w-full items-center">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {submission.studentName}
                </h2>
              </div>
            </div>
            <div className="flex flex-col items-start gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Dikumpulkan:{' '}
                {new Date(submission.submittedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                Reward Maks: +{assignment.pointsReward} Poin
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                {submission.generationName}
              </span>
            </div>

            <div className="flex items-start gap-2 ">
              <TaskStatusBadge
                status={submission.status}
                score={submission.score}
                requiresParentVerification={assignment.requiresParentVerification}
                isVerifiedByParent={submission.isVerifiedByParent}
              />
            </div>
          </div>

          {/* Parent Verification Callout */}
          {submission.isVerifiedByParent && (
            <div className="mt-4 p-3.5 bg-purple-50/80 border border-purple-200 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-purple-900">
                  Telah Diparaf Orang Tua: {submission.parentVerifierName || 'Wali Santri'}
                </p>
                {submission.parentFeedback && (
                  <p className="text-purple-700 mt-1 italic leading-relaxed">
                    &ldquo;{submission.parentFeedback}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submission Work Display */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              Hasil Pengerjaan Santri
            </h3>
          </div>

          {/* 1. DAILY HABIT */}
          {assignment.taskType === TaskType.DAILY_HABIT && (
            <div className="space-y-4">
              {habitProgress && (
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      Progres Amalan: {habitProgress.count} dari {habitProgress.total} Selesai
                    </span>
                    <span className="text-[11px] text-emerald-700 mt-0.5 block">
                      Kelengkapan amalan ibadah harian santri
                    </span>
                  </div>
                  <span className="text-base font-extrabold text-emerald-700 bg-white px-3 py-1 rounded-xl shadow-2xs border border-emerald-200">
                    {habitProgress.percentage}%
                  </span>
                </div>
              )}

              {habitData && habitData.habits.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {habitData.habits.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-3 rounded-xl text-xs bg-emerald-50/50 text-emerald-900 border border-emerald-100 font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {habitData?.notes && (
                <div className="p-3.5 bg-amber-50/70 rounded-xl text-xs text-slate-700 border border-amber-200/80 flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-900 block text-xs">Catatan Tambahan Santri:</span>
                    <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{habitData.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. AUDIO MEMORIZATION */}
          {assignment.taskType === TaskType.AUDIO_MEMORIZATION && (
            <div className="space-y-3">
              <LazyAudioSection audioUrls={parseMediaUrls(submission.mediaFileUrl)} />
              {submission.submissionText && !submission.submissionText.startsWith('Setoran hafalan audio santri') && (
                <div className="p-3.5 bg-amber-50/70 rounded-xl text-xs text-slate-700 border border-amber-200/80 flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-900 block text-xs">Catatan Tambahan Santri:</span>
                    <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">{submission.submissionText}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. WRITTEN SUBMISSION / TEXT ESSAY */}
          {assignment.taskType === TaskType.WRITTEN_SUBMISSION && (
            <div className="space-y-4">
              {submission.submissionText && (
                <div className="p-4 bg-slate-50 rounded-2xl text-xs sm:text-sm text-slate-800 leading-relaxed border border-slate-200 space-y-1.5">
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

          {/* 4. QUIZ ONLINE */}
          {assignment.taskType === TaskType.QUIZ_ONLINE && submission.submissionText && (
            <div className="space-y-3">
              <QuizSubmissionReview
                submissionText={submission.submissionText}
                config={config}
                allowToggle={true}
                defaultExpanded={true}
              />
            </div>
          )}

          {/* Fallback jika ada foto media untuk tipe lain selain teks dan audio */}
          {assignment.taskType !== TaskType.WRITTEN_SUBMISSION &&
            assignment.taskType !== TaskType.AUDIO_MEMORIZATION &&
            submission.mediaFileUrl && (
              <div className="pt-2">
                <span className="text-xs font-semibold text-slate-700 block mb-2">
                  Lampiran Berkas / Foto Pengerjaan:
                </span>
                <LazyPhotoSection
                  photoUrls={parseMediaUrls(submission.mediaFileUrl)}
                  onPreviewImage={(url: string) => setPreviewImage(url)}
                />
              </div>
            )}
        </div>

        {/* Grading Suite Form */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">

              Formulir Penilaian & Masukan Guru
            </h3>
            {canGrade ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                {data.isOwner ? 'Owner' : 'Access'}
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Hanya Lihat
              </span>
            )}
          </div>

          {!canGrade && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Anda sedang dalam mode lihat saja. Hanya pembuat tugas atau pengajar yang telah diberikan izin akses koreksi yang dapat memberikan skor penilaian.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-semibold">{successMessage}</span>
              </div>
              {navigation.nextSubmissionId && (
                <Link
                  href={`/tugas/${assignment.id}/koreksi/${navigation.nextSubmissionId}`}
                  prefetch={true}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 shrink-0 ml-2"
                >
                  Santri Berikutnya
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSaveGrade} className="space-y-4">
            {/* Score Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Skor Nilai (0 - 100) <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={!canGrade || isSaving}
                  value={score}
                  onChange={(e) => setScore(parseInt(e.target.value, 10) || 0)}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {SCORE_PILLS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={!canGrade || isSaving}
                      onClick={() => setScore(p)}
                      className={`px-3 py-2 text-xs font-bold rounded-xl transition-all ${score === p
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        } disabled:opacity-50`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Feedback Tags */}
            {canGrade && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Pilihan Tag Masukan Cepat:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_FEEDBACK_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        disabled={isSaving}
                        className={`px-3 py-1.5 text-xs rounded-xl transition-all ${isSelected
                          ? 'bg-teal-700 text-white font-semibold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Feedback Text Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Catatan Bimbingan & Evaluasi Pengajar:
              </label>
              <textarea
                rows={3}
                disabled={!canGrade || isSaving}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tuliskan catatan apresiasi, perbaikan bacaan/makhraj, atau motivasi belajar..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 disabled:opacity-60 resize-y"
              />
            </div>

            {/* Action Submit */}
            {canGrade && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Santri akan memperoleh notifikasi nilai dan poin gamifikasi.
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan Nilai...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {submission.status === SubmissionStatus.GRADED
                            ? 'Perbarui Nilai'
                            : 'Kirim Nilai Santri'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Photo Preview Lightbox */}
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
                alt="Preview Pengerjaan Santri"
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-black"
              />
            </div>
          </div>
        )
      }
    </TaskDetailLayout >
  );
}
