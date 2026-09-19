'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Award,
  Send,
  Share2,
  Copy,
  Sparkles,
  User,
  Calendar,
  Camera,
  Trash2,
  RotateCcw,
  ExternalLink,
  X,
  Plus,
  ShieldCheck,
  PenTool,
  MessageSquare,
  BookOpen,
  AlertCircle,
  Dices,
  Image as ImageIcon,
  Link as LinkIcon,
  Users,
  Building2,
  FileText,
} from 'lucide-react';
import { formatTierOrganization } from '../list/TaskListCard';
import { TaskType, SubmissionStatus } from '@prisma/client';
import { submitAssignment, getParentMagicLink } from '@/app/(protected)/tugas/actions';
import AudioRecorderWidget from '../AudioRecorderWidget';
import WaveformAudioPlayer from '../WaveformAudioPlayer';
import LazyAudioSection from '../LazyAudioSection';
import LazyPhotoSection from '../LazyPhotoSection';
import QuizSubmissionReview from '../QuizSubmissionReview';
import TaskDetailLayout from './TaskDetailLayout';
import DeadlineCountdown, { formatDueDate } from '../shared/DeadlineCountdown';
import TaskTypeBadge from '../shared/TaskTypeBadge';
import TaskStatusBadge from '../shared/TaskStatusBadge';
import OverdueActionGuard from '../shared/OverdueActionGuard';
import { parseHabitData, getHabitProgress, parseMediaUrls, DEFAULT_HABIT_ITEMS } from '@/lib/habitParser';
import { compressImageToWebP } from '@/lib/imageCompressor';
import { parseAssignmentConfig, parseQuizSubmission, AssignmentConfig, QuizQuestion } from '@/lib/assignmentConfig';

// ─── Types ───
interface StudentDetailData {
  role: 'SANTRI';
  userProfile: {
    id: string;
    fullName: string;
    totalPoints: number;
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
    config: AssignmentConfig;
    createdAt: string;
    teacherName: string;
    teacherId: string;
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
    parentVerification?: {
      id: string;
      isVerifiedByParent: boolean;
      parentFeedback: string | null;
      magicToken: string | null;
      verifiedAt: string | null;
    } | null;
  } | null;
}

interface TaskDraft {
  writtenText: string;
  habitChecked: string[];
  uploadedPhotos: Array<{ url: string; name: string }>;
  recordedAudios: string[];
  quizAnswers?: Record<number, number>;
  lastSaved: number;
}

const DRAFT_PREFIX = 'santri_task_draft_';
const inMemoryDrafts: Record<string, TaskDraft> = {};

function getTaskDraft(taskId: string): TaskDraft | null {
  if (inMemoryDrafts[taskId]) return inMemoryDrafts[taskId];
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`${DRAFT_PREFIX}${taskId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as TaskDraft;
        inMemoryDrafts[taskId] = parsed;
        return parsed;
      }
    }
  } catch { }
  return null;
}

function saveTaskDraft(taskId: string, draft: Partial<TaskDraft>) {
  try {
    const existing = getTaskDraft(taskId) || {
      writtenText: '',
      habitChecked: [],
      uploadedPhotos: [],
      recordedAudios: [],
      lastSaved: Date.now(),
    };
    const updated: TaskDraft = { ...existing, ...draft, lastSaved: Date.now() };
    inMemoryDrafts[taskId] = updated;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${DRAFT_PREFIX}${taskId}`, JSON.stringify(updated));
      } catch { }
    }
  } catch { }
}

function clearTaskDraft(taskId: string) {
  delete inMemoryDrafts[taskId];
  try { if (typeof window !== 'undefined') localStorage.removeItem(`${DRAFT_PREFIX}${taskId}`); } catch { }
}

export default function StudentTaskDetail({ data }: { data: StudentDetailData }) {
  const { assignment: task, submission, userProfile } = data;
  const config = task.config;
  const isGraded = submission?.status === SubmissionStatus.GRADED;
  const isSubmitted = Boolean(submission);

  // ─── Form State (Inisialisasi aman SSR untuk mencegah hydration mismatch) ───
  const [recordedAudios, setRecordedAudios] = useState<string[]>(() => {
    return parseMediaUrls(submission?.mediaFileUrl);
  });
  const [isAddingAudio, setIsAddingAudio] = useState(() => {
    return task.taskType === TaskType.AUDIO_MEMORIZATION && (!submission?.mediaFileUrl || parseMediaUrls(submission?.mediaFileUrl).length === 0);
  });
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ url: string; name: string }>>(() => {
    if (task.taskType !== TaskType.AUDIO_MEMORIZATION && task.taskType !== TaskType.DAILY_HABIT) {
      return parseMediaUrls(submission?.mediaFileUrl).map((url, idx) => ({
        url,
        name: `Foto Lembar Kerja ${idx + 1}`,
      }));
    }
    return [];
  });
  const [writtenText, setWrittenText] = useState(() => {
    if (task.taskType === TaskType.DAILY_HABIT) {
      return parseHabitData(submission?.submissionText).notes || '';
    }
    if (task.taskType === TaskType.QUIZ_ONLINE) {
      return parseQuizSubmission(submission?.submissionText, config)?.notes || '';
    }
    if (task.taskType === TaskType.AUDIO_MEMORIZATION) {
      if (!submission?.submissionText || submission.submissionText.startsWith('Setoran hafalan audio santri')) {
        return '';
      }
      return submission.submissionText;
    }
    return submission?.submissionText || '';
  });
  const [habitChecked, setHabitChecked] = useState<string[]>(() => {
    return parseHabitData(submission?.submissionText).habits;
  });
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>(() => {
    if (submission?.submissionText) {
      const parsed = parseQuizSubmission(submission.submissionText, config);
      if (parsed?.answers) {
        const answers: Record<number, number> = {};
        parsed.answers.forEach((ans) => {
          if (ans.questionIndex !== undefined && ans.selectedOption >= 0) {
            answers[ans.questionIndex] = ans.selectedOption;
          }
        });
        return answers;
      }
    }
    return {};
  });

  const isOverdue = Boolean(task.dueDate && new Date() > new Date(task.dueDate));
  const canEditSubmission = isSubmitted && task.taskType !== TaskType.QUIZ_ONLINE && !isOverdue;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!isSubmitted);
  const effectiveIsEditing = isSubmitted ? (isEditing && canEditSubmission) : true;
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [activeShareToken, setActiveShareToken] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Muat draft pengerjaan lokal dari localStorage setelah komponen ter-mount di client (mencegah hydration mismatch)
  useEffect(() => {
    if (isSubmitted && !effectiveIsEditing) return;

    const draft = getTaskDraft(task.id);
    if (!draft) return;

    if (draft.recordedAudios && draft.recordedAudios.length > 0) {
      setRecordedAudios(draft.recordedAudios);
      setIsAddingAudio(false);
    }
    if (draft.uploadedPhotos && draft.uploadedPhotos.length > 0) {
      setUploadedPhotos(draft.uploadedPhotos);
    }
    if (typeof draft.writtenText === 'string' && draft.writtenText.length > 0) {
      setWrittenText(draft.writtenText);
    }
    if (draft.habitChecked && draft.habitChecked.length > 0) {
      setHabitChecked(draft.habitChecked);
    }
    if (draft.quizAnswers && Object.keys(draft.quizAnswers).length > 0) {
      setQuizAnswers(draft.quizAnswers);
    }
  }, [task.id, isSubmitted, effectiveIsEditing]);

  // ─── Helpers ───
  const [previewTaskImage, setPreviewTaskImage] = useState<string | null>(null);
  const taskPhotos = config.taskAttachments?.photos || [];
  const taskLinks = config.taskAttachments?.links || [];
  const documentUrl =
    config.documentUrl ||
    (config.taskAttachments as any)?.documentUrl ||
    (typeof task.attachmentUrl === 'string' && !task.attachmentUrl.trim().startsWith('{')
      ? task.attachmentUrl.trim()
      : null);

  const saveDraft = useCallback((overrides: Partial<TaskDraft> = {}) => {
    saveTaskDraft(task.id, {
      writtenText,
      habitChecked,
      uploadedPhotos,
      recordedAudios,
      quizAnswers,
      ...overrides,
    });
  }, [task.id, writtenText, habitChecked, uploadedPhotos, recordedAudios, quizAnswers]);

  const handleWrittenTextChange = (val: string) => {
    setWrittenText(val);
    saveDraft({ writtenText: val });
  };

  const handleToggleHabit = (item: string) => {
    setHabitChecked((prev) => {
      const next = prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
      saveDraft({ habitChecked: next });
      return next;
    });
  };

  const handleAnswerQuiz = (qIndex: number, optIndex: number) => {
    setQuizAnswers((prev) => {
      const next = { ...prev, [qIndex]: optIndex };
      saveDraft({ quizAnswers: next });
      return next;
    });
  };

  // ─── Photo Handlers ───
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (previewPhotoIndex !== null) {
      const rawFile = files[0];
      if (rawFile.size > 15 * 1024 * 1024) {
        setErrorMessage('Ukuran file foto maksimal 15MB.');
        e.target.value = '';
        return;
      }
      try {
        const file = await compressImageToWebP(rawFile);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setUploadedPhotos((prev) => {
            const next = [...prev];
            next[previewPhotoIndex] = { url: dataUrl, name: file.name };
            saveDraft({ uploadedPhotos: next });
            return next;
          });
        };
        reader.readAsDataURL(file);
      } catch { }
      e.target.value = '';
      return;
    }

    const remaining = 3 - uploadedPhotos.length;
    if (remaining <= 0) {
      setErrorMessage('Maksimal 3 foto.');
      e.target.value = '';
      return;
    }

    for (const rawFile of Array.from(files).slice(0, remaining)) {
      if (rawFile.size > 15 * 1024 * 1024) continue;
      try {
        const file = await compressImageToWebP(rawFile);
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setUploadedPhotos((prev) => {
            if (prev.length >= 3) return prev;
            const next = [...prev, { url: dataUrl, name: file.name }];
            saveDraft({ uploadedPhotos: next });
            return next;
          });
        };
        reader.readAsDataURL(file);
      } catch { }
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveDraft({ uploadedPhotos: next });
      return next;
    });
  };

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.set('assignmentId', task.id);

      if (task.taskType === TaskType.AUDIO_MEMORIZATION) {
        if (recordedAudios.length === 0) {
          setErrorMessage('Harap rekam setidaknya 1 audio.');
          setIsSubmitting(false);
          return;
        }
        formData.set('mediaFileUrl', recordedAudios.length === 1 ? recordedAudios[0] : JSON.stringify(recordedAudios));
        formData.set('submissionText', writtenText.trim() || `Setoran hafalan audio santri (${recordedAudios.length} rekaman)`);
      } else if (task.taskType === TaskType.DAILY_HABIT) {
        if (habitChecked.length === 0) {
          setErrorMessage('Harap centang setidaknya 1 butir ibadah.');
          setIsSubmitting(false);
          return;
        }
        formData.set('submissionText', JSON.stringify({ completedHabits: habitChecked, notes: writtenText.trim() || null }));
      } else if (task.taskType === TaskType.QUIZ_ONLINE) {
        const questions = config.quizData?.questions || [];
        if (questions.length > 0) {
          const unanswered = questions.filter((_, idx) => quizAnswers[idx] === undefined || quizAnswers[idx] < 0).length;
          if (unanswered > 0) {
            setErrorMessage(`Masih ada ${unanswered} soal yang belum dijawab.`);
            setIsSubmitting(false);
            return;
          }
          let correctCount = 0;
          let totalPoints = 0;
          let earned = 0;
          const detailed = questions.map((q, idx) => {
            const sel = quizAnswers[idx] ?? -1;
            const correct = q.correctAnswerIndex !== undefined && q.correctAnswerIndex === sel;
            const pts = q.points || 20;
            totalPoints += pts;
            if (correct) { correctCount++; earned += pts; }
            return { questionIndex: idx, question: q.question, selectedOption: sel, selectedOptionText: sel >= 0 ? q.options[sel] : '', isCorrect: correct, correctAnswerIndex: q.correctAnswerIndex };
          });
          formData.set('submissionText', JSON.stringify({
            type: 'QUIZ_RESULT', scoreEstimated: totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0,
            correctCount, totalQuestions: questions.length, answers: detailed, notes: writtenText.trim() || undefined,
          }));
        } else {
          formData.set('submissionText', writtenText.trim() || 'Jawaban Kuis Online');
        }
      } else {
        formData.set('submissionText', writtenText.trim());
        if (uploadedPhotos.length > 0) {
          const urls = uploadedPhotos.map((p) => p.url);
          formData.set('mediaFileUrl', urls.length === 1 ? urls[0] : JSON.stringify(urls));
        }
      }

      const res = await submitAssignment(formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        clearTaskDraft(task.id);
        setSuccessMessage('Tugas berhasil dikumpulkan!');
        setIsEditing(false);
        if (task.requiresParentVerification && res.submissionId) {
          const tokenRes = await getParentMagicLink(res.submissionId);
          if (tokenRes.token) setActiveShareToken(tokenRes.token);
          setShowSharePanel(true);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Share ───
  const getMagicLinkUrl = () => {
    if (!activeShareToken) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/tugas/paraf/${activeShareToken}`;
  };

  const handleCopyLink = () => {
    const url = getMagicLinkUrl();
    if (url) { navigator.clipboard.writeText(url); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2500); }
  };

  const handleShareWhatsApp = () => {
    const url = getMagicLinkUrl();
    if (!url) return;
    const msg = `Assalamu'alaikum Ayah/Bunda, ananda ${userProfile.fullName} baru saja menyelesaikan tugas: *${task.title}*.\n\nMohon berkenan membuka tautan di bawah untuk paraf digital:\n${url}\n\nJazakumullahu khairan.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Derived ───
  const habitItems = config.checklistItems?.length ? config.checklistItems : DEFAULT_HABIT_ITEMS;
  const habitProgress = task.taskType === TaskType.DAILY_HABIT ? getHabitProgress(habitChecked, habitItems) : null;
  const questions = config.quizData?.questions || [];

  return (
    <TaskDetailLayout>
      <div className="space-y-4">
        {/* ═══════ HEADER CARD ═══════ */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between mb-2 gap-2">
                <div className='flex sm:flex-row flex-col sm:items-center items-start gap-2'>
                  <TaskTypeBadge taskType={task.taskType} size="md" />
                </div>
                <div className="flex items-end gap-2">
                  <TaskStatusBadge
                    status={submission?.status ?? null}
                    score={submission?.score}
                    requiresParentVerification={task.requiresParentVerification}
                    isVerifiedByParent={submission?.parentVerification?.isVerifiedByParent}
                    size="md"
                  />
                </div>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {task.title}
              </h1>
              {(() => {
                const formattedTierOrg = formatTierOrganization(task.organizationName, task.organizationType || task.tierLevel);
                return (
                  <div className="flex flex-col items-start gap-y-1.5 mt-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{task.teacherName}</span>
                    </span>
                    {formattedTierOrg && (
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formattedTierOrg}</span>
                      </span>
                    )}
                    {task.className && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{task.className}</span>
                      </span>
                    )}
                    {task.materialTitle && (
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{task.materialTitle}</span>
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formatDueDate(task.dueDate)}</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Description */}
          <div className='flex flex-col items-start w-full gap-y-2 mt-2'>
            {task.description && (
              <div className="flex w-full items-center gap-2 mt-1 pt-2 border-t border-b py-2 border-slate-100">
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{task.description}</p>
              </div>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              +{task.pointsReward}
              {task.requiresParentVerification && task.parentBonusPoints > 0 && (
                <span className="inline-flex items-center text-xs font-bold text-amber-800">
                  ({task.parentBonusPoints} Bonus)
                </span>
              )}
              <span className="text-xs font-bold text-amber-900">Poin</span>
            </span>
          </div>
        </div>


        {/* ═══════ LAMPIRAN TUGAS (FOTO, BERKAS & TAUTAN) ═══════ */}
        {(taskPhotos.length > 0 || taskLinks.length > 0 || Boolean(documentUrl)) && (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-teal-600" />
                Lampiran & Berkas Tugas
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
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 block">Berkas Dokumen / Materi:</span>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-teal-100 bg-teal-50/60 hover:bg-teal-100/70 transition-all group"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 shrink-0 group-hover:scale-105 transition-transform">
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
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 block">Foto Panduan / Soal:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {taskPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setPreviewTaskImage(photo)}
                      className="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={photo}
                        alt={`Lampiran tugas ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-semibold">
                        Perbesar
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link Lampiran */}
            {taskLinks.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-700 block">Tautan / Referensi Eksternal:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {taskLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all group"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <LinkIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-teal-700">
                            {link.title || link.url}
                          </span>
                          {link.title && (
                            <span className="text-[10px] text-slate-400 block truncate">
                              {link.url}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-teal-600 shrink-0 ml-1.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ DEADLINE ═══════ */}
        <DeadlineCountdown
          dueDate={task.dueDate}
          overdueAction={config.overdueAction}
          penaltyPercentage={config.penaltyPercentage}
        />

        {/* ═══════ SUCCESS MESSAGE ═══════ */}
        {successMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-3.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-bold text-emerald-800">{successMessage}</p>
          </div>
        )}

        {/* ═══════ GRADED RESULT ═══════ */}
        {isGraded && submission && (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-xs p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" /> Hasil Penilaian Guru
            </h2>
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-black px-4 py-2 rounded-xl border ${(submission.score || 0) >= 80 ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : (submission.score || 0) >= 60 ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                {submission.score}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Skor Akhir</p>
                <p className="text-[11px] text-slate-500">dari 100 poin</p>
              </div>
            </div>
            {submission.teacherFeedback && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                <p className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Catatan Guru
                </p>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{submission.teacherFeedback}</p>
              </div>
            )}

            {/* Quiz review */}
            {task.taskType === TaskType.QUIZ_ONLINE && submission.submissionText && (
              <QuizSubmissionReview
                submissionText={submission.submissionText}
                config={config}
                allowToggle={true}
                defaultExpanded={false}
              />
            )}
          </div>
        )}

        {/* ═══════ PARENT VERIFICATION STATUS ═══════ */}
        {task.requiresParentVerification && submission && (
          <div className={`rounded-2xl border p-3.5 ${submission.parentVerification?.isVerifiedByParent
            ? 'bg-indigo-50/80 border-indigo-200/80'
            : 'bg-amber-50/80 border-amber-200/80'
            }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-4 h-4 ${submission.parentVerification?.isVerifiedByParent ? 'text-indigo-600' : 'text-amber-600'
                }`} />
              <span className={`text-xs font-bold ${submission.parentVerification?.isVerifiedByParent ? 'text-indigo-800' : 'text-amber-800'
                }`}>
                {submission.parentVerification?.isVerifiedByParent
                  ? 'Sudah Diparaf Orang Tua ✓'
                  : 'Menunggu Paraf Orang Tua'}
              </span>
            </div>
            {submission.parentVerification?.parentFeedback && (
              <p className="text-[11px] text-indigo-700 mt-1.5 leading-relaxed">
                "{submission.parentVerification.parentFeedback}"
              </p>
            )}
            {!submission.parentVerification?.isVerifiedByParent && !showSharePanel && (
              <button
                type="button"
                onClick={async () => {
                  const tokenRes = await getParentMagicLink(submission.id);
                  if (tokenRes.token) setActiveShareToken(tokenRes.token);
                  setShowSharePanel(true);
                }}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                Minta Paraf Ortu
              </button>
            )}
            {!submission.parentVerification?.isVerifiedByParent && showSharePanel && (
              <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-2">
                <p className="text-[11px] font-semibold text-amber-900">
                  Bagikan tautan paraf ke orang tua via WhatsApp atau salin tautan:
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-50 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copySuccess ? 'Tersalin!' : 'Salin'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ SUBMISSION FORM / VIEW ═══════ */}
        {!isGraded && (
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-xs p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Dices className="w-4 h-4 text-emerald-600" />
                {effectiveIsEditing ? 'Lembar Pengerjaan' : 'Pengerjaan Dikumpulkan'}
              </h2>
              {canEditSubmission && (
                effectiveIsEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[11px] font-bold text-emerald-700 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    Edit Pengerjaan
                  </button>
                )
              )}
            </div>

            {effectiveIsEditing ? (
              <OverdueActionGuard
                dueDate={task.dueDate}
                overdueAction={config.overdueAction}
                penaltyPercentage={config.penaltyPercentage}
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Error */}
                  {errorMessage && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200/80">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-700 font-semibold">{errorMessage}</p>
                    </div>
                  )}

                  {/* ── DAILY HABIT ── */}
                  {task.taskType === TaskType.DAILY_HABIT && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 mb-2">Centang ibadah yang telah dilaksanakan:</p>
                      {habitItems.map((item) => (
                        <label key={item}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${habitChecked.includes(item)
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                            }`}>
                          <input type="checkbox" checked={habitChecked.includes(item)}
                            onChange={() => handleToggleHabit(item)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          <span className="text-xs font-medium">{item}</span>
                        </label>
                      ))}
                      {habitProgress && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                            <span>Progress</span>
                            <span>{habitProgress.count}/{habitProgress.total} ({habitProgress.percentage}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${habitProgress.percentage}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── AUDIO MEMORIZATION ── */}
                  {task.taskType === TaskType.AUDIO_MEMORIZATION && (
                    <div className="space-y-3">
                      {recordedAudios.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50 border border-violet-200/80">
                          <WaveformAudioPlayer audioUrl={url} />
                          <button type="button" onClick={() => {
                            setRecordedAudios((prev) => {
                              const next = prev.filter((_, i) => i !== idx);
                              saveDraft({ recordedAudios: next });
                              return next;
                            });
                          }}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 border border-rose-200/80 shrink-0 cursor-pointer">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {isAddingAudio ? (
                        <AudioRecorderWidget
                          onAudioRecorded={(url: string | null) => {
                            if (url) {
                              setRecordedAudios((prev) => {
                                const next = [...prev, url];
                                saveDraft({ recordedAudios: next });
                                return next;
                              });
                            }
                            setIsAddingAudio(false);
                          }}
                        />
                      ) : recordedAudios.length < 3 ? (
                        <button type="button" onClick={() => setIsAddingAudio(true)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-600 text-xs font-bold hover:bg-violet-50 transition-colors cursor-pointer">
                          <Plus className="w-3.5 h-3.5" /> Tambah Rekaman ({recordedAudios.length}/3)
                        </button>
                      ) : null}
                    </div>
                  )}

                  {/* ── QUIZ ONLINE FORM ── */}
                  {task.taskType === TaskType.QUIZ_ONLINE && questions.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-slate-600">Pilih jawaban yang paling tepat:</p>
                      {questions.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                          <p className="text-xs font-bold text-slate-800">
                            {qIdx + 1}. {q.question}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = quizAnswers[qIdx] === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleAnswerQuiz(qIdx, optIdx)}
                                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${isSelected
                                    ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${isSelected ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span className="truncate">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── PHOTO / WRITTEN SUBMISSION ── */}
                  {task.taskType === TaskType.WRITTEN_SUBMISSION && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                          Laporan / Catatan Santri
                        </label>
                        <textarea
                          value={writtenText}
                          onChange={(e) => handleWrittenTextChange(e.target.value)}
                          placeholder="Tulis ringkasan materi, catatan atau laporan pengerjaan di sini..."
                          rows={5}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-y"
                        />
                      </div>
                      {/* Photo upload section */}
                      <div className="space-y-2">
                        {uploadedPhotos.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {uploadedPhotos.map((photo, idx) => (
                              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200/80">
                                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => handleRemovePhoto(idx)}
                                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-rose-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {uploadedPhotos.length < 3 && (
                          <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer">
                            <Camera className="w-3.5 h-3.5" /> Lampirkan Foto ({uploadedPhotos.length}/3)
                          </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                      </div>
                    </div>
                  )}

                  {/* ── CATATAN TAMBAHAN SANTRI (AUDIO, HABIT, QUIZ) ── */}
                  {task.taskType !== TaskType.WRITTEN_SUBMISSION && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        Catatan Tambahan Santri <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
                      </label>
                      <textarea
                        value={writtenText}
                        onChange={(e) => handleWrittenTextChange(e.target.value)}
                        placeholder="Tulis pesan atau catatan tambahan untuk guru / pengajar di sini..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all resize-y"
                      />
                    </div>
                  )}

                  {/* Submit button */}
                  <button type="submit" disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer">
                    <Send className="w-3.5 h-3.5" />
                    {isSubmitting ? 'Mengirim...' : isSubmitted ? 'Perbarui Pengerjaan' : 'Kumpulkan Tugas'}
                  </button>
                </form>
              </OverdueActionGuard>
            ) : (
              /* ── Read-only view of submitted work ── */
              <div className="space-y-3">
                  {/* Show submitted text */}
                  {task.taskType === TaskType.DAILY_HABIT && submission?.submissionText && (
                    <div className="space-y-2">
                      {(() => {
                        const parsed = parseHabitData(submission.submissionText);
                        const progress = getHabitProgress(parsed.habits, habitItems);
                        return (
                          <>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                              <span>Ibadah Selesai</span>
                              <span>{progress.count}/{progress.total}</span>
                            </div>
                            {parsed.habits.map((h) => (
                              <div key={h} className="flex items-center gap-2 text-xs text-emerald-700">
                                <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center">✓</div>
                                {h}
                              </div>
                            ))}
                            {parsed.notes && (
                              <div className="mt-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700 flex items-start gap-2.5">
                                <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="font-bold text-amber-900 block text-[11px]">Catatan Tambahan Santri:</span>
                                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{parsed.notes}</p>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {task.taskType === TaskType.AUDIO_MEMORIZATION && (
                    <div className="space-y-3">
                      {submission?.mediaFileUrl && (
                        <LazyAudioSection audioUrls={parseMediaUrls(submission.mediaFileUrl)} />
                      )}
                      {submission?.submissionText && !submission.submissionText.startsWith('Setoran hafalan audio santri') && (
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700 flex items-start gap-2.5">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-900 block text-[11px]">Catatan Tambahan Santri:</span>
                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{submission.submissionText}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {task.taskType === TaskType.WRITTEN_SUBMISSION && (
                    <div className="space-y-3">
                      {submission?.submissionText && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            Catatan / Laporan Santri:
                          </span>
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{submission.submissionText}</p>
                        </div>
                      )}
                      {submission?.mediaFileUrl && (
                        <LazyPhotoSection photoUrls={parseMediaUrls(submission.mediaFileUrl)} />
                      )}
                    </div>
                  )}

                  {task.taskType === TaskType.QUIZ_ONLINE && submission?.submissionText && (
                    <QuizSubmissionReview
                      submissionText={submission.submissionText}
                      config={config}
                      allowToggle={true}
                      defaultExpanded={true}
                    />
                  )}

                  <p className="text-[11px] text-slate-400 italic">
                    Dikumpulkan pada {new Date(submission?.submittedAt || '').toLocaleDateString('id-ID', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Lightbox Preview Foto Lampiran Tugas */}
      {previewTaskImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewTaskImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewTaskImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewTaskImage}
              alt="Preview Lampiran Tugas"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-black"
            />
          </div>
        </div>
      )}
    </TaskDetailLayout>
  );
}
