'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Calendar,
  Clock,
  Award,
  Users,
  BookOpen,
  Mic,
  CheckSquare,
  FileText,
  HelpCircle,
  ShieldCheck,
  Trash2,
  Lock,
  RotateCcw,
  Check,
  AlertCircle,
  ListPlus,
  Sparkles,
  ChevronRight,
  GraduationCap,
  DicesIcon,
} from 'lucide-react';
import { TaskType } from '@prisma/client';
import { createAssignment } from '@/app/(protected)/tugas/actions';
import TargetAudienceModal, { StudentOption, GenerationOption, ClassOption } from './TargetAudienceModal';
import {
  DEFAULT_CHECKLIST_ITEMS,
  serializeAssignmentConfig,
  QuizQuestion,
  OverdueAction,
  AssignmentConfig,
} from '@/lib/assignmentConfig';

interface AssignmentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGenerations?: GenerationOption[];
  availableClasses?: ClassOption[];
  availableStudents?: StudentOption[];
  availableMaterials?: Array<{ id: string; title: string }>;
  onSuccess?: () => void;
}

export default function AssignmentCreateModal({
  isOpen,
  onClose,
  availableGenerations = [],
  availableClasses = [],
  availableStudents = [],
  availableMaterials = [],
  onSuccess,
}: AssignmentCreateModalProps) {
  const effectiveGenerations = availableGenerations.length > 0 ? availableGenerations : availableClasses;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>(TaskType.AUDIO_MEMORIZATION);

  // Sasaran Penugasan (Multi-Generasi & Multi-Santri)
  const [targetGenerationIds, setTargetGenerationIds] = useState<string[]>([]);
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Tautan Materi Kurikulum
  const [materialId, setMaterialId] = useState('');

  // Batas Waktu & Aksi Pasca-Deadline
  const [dueDate, setDueDate] = useState('');
  const [overdueAction, setOverdueAction] = useState<OverdueAction>('LOCK');
  const [penaltyPercentage, setPenaltyPercentage] = useState(25);

  // Poin & Verifikasi
  const [pointsReward, setPointsReward] = useState(20);
  const [parentBonusPoints, setParentBonusPoints] = useState(10);
  const [requiresParentVerification, setRequiresParentVerification] = useState(true);

  // 1. Checklist Ibadah State (DAILY_HABIT)
  const [checklistItems, setChecklistItems] = useState<string[]>([...DEFAULT_CHECKLIST_ITEMS]);
  const [newChecklistInput, setNewChecklistInput] = useState('');

  // 2. Kuis Online State (QUIZ_ONLINE)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    {
      id: 'q_1',
      question: '',
      options: ['', '', '', ''],
      correctAnswerIndex: 0,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // --- HANDLER CHECKLIST IBADAH ---
  const handleAddChecklistItem = () => {
    const trimmed = newChecklistInput.trim();
    if (!trimmed) return;
    if (checklistItems.includes(trimmed)) {
      setErrorMessage('Point amalan tersebut sudah ada dalam daftar.');
      return;
    }
    setChecklistItems((prev) => [...prev, trimmed]);
    setNewChecklistInput('');
    setErrorMessage(null);
  };

  const handleRemoveChecklistItem = (idx: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetChecklistDefaults = () => {
    setChecklistItems([...DEFAULT_CHECKLIST_ITEMS]);
  };

  // --- HANDLER KUIS ONLINE ---
  const handleAddQuizQuestion = () => {
    setQuizQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}`,
        question: '',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
      },
    ]);
  };

  const handleRemoveQuizQuestion = (qIndex: number) => {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions((prev) => prev.filter((_, i) => i !== qIndex));
  };

  const handleQuestionTextChange = (qIndex: number, text: string) => {
    setQuizQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], question: text };
      return next;
    });
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, text: string) => {
    setQuizQuestions((prev) => {
      const next = [...prev];
      const newOptions = [...next[qIndex].options] as [string, string, string, string];
      newOptions[optIndex] = text;
      next[qIndex] = { ...next[qIndex], options: newOptions };
      return next;
    });
  };

  const handleSetCorrectAnswer = (qIndex: number, optIndex: number) => {
    setQuizQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correctAnswerIndex: optIndex };
      return next;
    });
  };

  // --- SUBMISSION ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Judul tugas wajib diisi.');
      return;
    }

    // Validasi Checklist Ibadah
    if (taskType === TaskType.DAILY_HABIT && checklistItems.length === 0) {
      setErrorMessage('Tugas checklist ibadah wajib memiliki minimal 1 point amalan.');
      return;
    }

    // Validasi Kuis Online
    if (taskType === TaskType.QUIZ_ONLINE) {
      for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        if (!q.question.trim()) {
          setErrorMessage(`Pertanyaan pada Soal ${i + 1} belum diisi.`);
          return;
        }
        const filledOptions = q.options.filter((opt) => opt.trim().length > 0);
        if (filledOptions.length < 2) {
          setErrorMessage(`Soal ${i + 1} wajib memiliki minimal 2 pilihan jawaban.`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Siapkan konfigurasi tugas terstruktur
      const config: AssignmentConfig = {
        overdueAction,
        penaltyPercentage: overdueAction === 'ALLOW_WITH_PENALTY' ? penaltyPercentage : undefined,
        targetGenerationIds: targetGenerationIds.length > 0 ? targetGenerationIds : undefined,
        targetStudentIds: targetStudentIds.length > 0 ? targetStudentIds : undefined,
      };

      if (taskType === TaskType.DAILY_HABIT) {
        config.checklistItems = checklistItems;
      } else if (taskType === TaskType.QUIZ_ONLINE) {
        config.quizData = { questions: quizQuestions };
      }

      const formData = new FormData();
      formData.set('title', title.trim());
      formData.set('description', description.trim());
      formData.set('taskType', taskType);
      formData.set('assignmentConfig', serializeAssignmentConfig(config));
      formData.set('classId', '');

      if (materialId) formData.set('materialId', materialId);
      if (dueDate) formData.set('dueDate', dueDate);
      formData.set('pointsReward', pointsReward.toString());
      formData.set('parentBonusPoints', parentBonusPoints.toString());
      formData.set('requiresParentVerification', requiresParentVerification ? 'true' : 'false');

      const res = await createAssignment(formData);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ringkasan label sasaran terpilih
  const getTargetSummaryText = () => {
    if (targetGenerationIds.length === 0 && targetStudentIds.length === 0) {
      return 'Semua (Seluruh Generasi)';
    }
    const parts: string[] = [];
    if (targetGenerationIds.length > 0) {
      if (effectiveGenerations.length > 0 && targetGenerationIds.length === effectiveGenerations.length) {
        parts.push('Semua Generasi');
      } else {
        const selectedNames = effectiveGenerations
          .filter((g) => targetGenerationIds.includes(g.id))
          .map((g) => g.name.split(' ')[0]);
        if (selectedNames.length > 0 && selectedNames.length <= 2) {
          parts.push(selectedNames.join(', '));
        } else {
          parts.push(`${targetGenerationIds.length} Generasi Terpilih`);
        }
      }
    }
    if (targetStudentIds.length > 0) {
      parts.push(`${targetStudentIds.length} Santri Spesifik`);
    }
    return parts.join(' & ');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
        <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          {/* Header Modal */}
          <div className="p-4 sm:p-5 bg-teal-50/70 border-b border-teal-100/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Terbitkan Tugas Rumah Baru</h3>
                <p className="text-[11px] sm:text-xs text-slate-500">Pasca-pengajian untuk penguatan santri & sinergi orang tua</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 flex items-center justify-center border border-slate-200/60 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Pilihan 4 Tipe Tugas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tipe Tugas
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskType(TaskType.AUDIO_MEMORIZATION)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${taskType === TaskType.AUDIO_MEMORIZATION
                    ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold">Audio Hafalan</h5>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskType(TaskType.DAILY_HABIT)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${taskType === TaskType.DAILY_HABIT
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold">Checklist Ibadah</h5>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskType(TaskType.WRITTEN_SUBMISSION)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${taskType === TaskType.WRITTEN_SUBMISSION
                    ? 'bg-sky-50/80 border-sky-500 ring-2 ring-sky-500/20 text-sky-900'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold">Foto / Resume</h5>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskType(TaskType.QUIZ_ONLINE)}
                  className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${taskType === TaskType.QUIZ_ONLINE
                    ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 text-amber-900'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                      <DicesIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold">Kuis Online</h5>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Judul Tugas */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Judul Tugas <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Setoran Hafalan Surat Al-Mulk Ayat 1-10"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </div>

            {/* Instruksi Pengerjaan */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Instruksi / Keterangan Tugas
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Jelaskan instruksi atau arahan pengerjaan bagi santri..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
              />
            </div>

            {/* SASARAN PENUGASAN (MULTI-KELAS & SANTRI) & TAUTAN MATERI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">

                    <span>Sasaran Penugasan</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(true)}
                  className="w-full p-2.5 rounded-xl border border-teal-200/80 bg-teal-50/50 hover:bg-teal-50 text-left flex items-center justify-between text-xs transition-all cursor-pointer shadow-2xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-slate-900 font-bold text-xs">
                        {getTargetSummaryText()}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200 shrink-0 ml-1">
                    Ubah
                  </span>
                </button>
              </div>

              {/* Tautan Materi Kurikulum */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Tautan Materi Kurikulum</span>
                </label>
                <select
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Tanpa Tautan Materi</option>
                  {availableMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* BUILDER KHUSUS: 1. CHECKLIST IBADAH AMALAN (DAILY_HABIT) */}
            {taskType === TaskType.DAILY_HABIT && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950">
                      Buat Poin Checklist
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {checklistItems.length} Point
                  </span>
                </div>

                {/* Input Tambah Point Checklist */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    placeholder="Tulis point amalan baru (mis: 'Sholat Dhuha')..."
                    className="flex-1 px-3 py-2 rounded-xl border border-emerald-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />

                  </button>
                </div>

                {/* Daftar Point Checklist Yang Dikonfigurasi */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {checklistItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-emerald-100/90 shadow-2xs flex items-center justify-between text-xs gap-2 group hover:border-emerald-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-slate-800 font-medium truncate">{item}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(idx)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Hapus point ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BUILDER KHUSUS: 2. KUIS ONLINE (QUIZ_ONLINE) */}
            {taskType === TaskType.QUIZ_ONLINE && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-950">
                      Buat Soal Kuis
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    {quizQuestions.length} Soal
                  </span>
                </div>

                {/* List Soal-soal Kuis */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {quizQuestions.map((q, qIdx) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-2xl bg-white border border-amber-200/90 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-[11px]">
                            {qIdx + 1}
                          </span>
                          <span>Pertanyaan Soal #{qIdx + 1}</span>
                        </span>
                        {quizQuestions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuizQuestion(qIdx)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus soal ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Teks Pertanyaan */}
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                        placeholder="Tuliskan teks pertanyaan kuis..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />

                      {/* 4 Opsi Jawaban (A, B, C, D) */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                          <span>Pilihan Jawaban:</span>
                          <span className="text-emerald-700 font-bold">
                            Kunci: {String.fromCharCode(65 + q.correctAnswerIndex)}
                          </span>
                        </div>

                        {(['A', 'B', 'C', 'D'] as const).map((optLetter, optIdx) => {
                          const isCorrect = q.correctAnswerIndex === optIdx;
                          return (
                            <div key={optIdx} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetCorrectAnswer(qIdx, optIdx)}
                                className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer shrink-0 ${isCorrect
                                  ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                  }`}
                                title={`Jadikan opsi ${optLetter} sebagai kunci jawaban benar`}
                              >
                                {optLetter}
                              </button>
                              <input
                                type="text"
                                value={q.options[optIdx] || ''}
                                onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                placeholder={`Jawaban ${optLetter}...`}
                                className={`flex-1 px-3 py-1.5 rounded-xl border text-xs focus:outline-hidden transition-colors ${isCorrect
                                  ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-medium'
                                  : 'border-slate-200 bg-white text-slate-800 focus:border-amber-500'
                                  }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tombol Tambah Soal */}
                <button
                  type="button"
                  onClick={handleAddQuizQuestion}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-400 bg-amber-100/50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>Tambah Soal Kuis</span>
                </button>
              </div>
            )}

            {/* BATAS WAKTU & AKSI PASCA-DEADLINE */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Batas Pengumpulan
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Poin Santri
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={pointsReward}
                    onChange={(e) => setPointsReward(parseInt(e.target.value, 10) || 20)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Bonus Paraf Ortu
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={parentBonusPoints}
                    onChange={(e) => setParentBonusPoints(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* FITUR BARU: PILIH AKSI SETELAH BATAS PENGUMPULAN BERAKHIR */}
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5 pb-1">
                  <span>Aksi Setelah Batas Pengumpulan Berakhir</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div
                    onClick={() => setOverdueAction('LOCK')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${overdueAction === 'LOCK'
                      ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Kunci Otomatis</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">
                      Tolak pengumpulan setelah waktu habis
                    </p>
                  </div>

                  <div
                    onClick={() => setOverdueAction('ALLOW_LATE')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${overdueAction === 'ALLOW_LATE'
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Izinkan Terlambat</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">
                      Tetap diterima dengan label Terlambat
                    </p>
                  </div>

                  <div
                    onClick={() => setOverdueAction('ALLOW_WITH_PENALTY')}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${overdueAction === 'ALLOW_WITH_PENALTY'
                      ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-1 ring-indigo-400/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Potong Poin (-25%)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal">
                      Izinkan dengan pemotongan poin reward
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sinergi Orang Tua Toggle */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 flex items-start gap-3">
              <input
                type="checkbox"
                id="requiresParentVerification"
                checked={requiresParentVerification}
                onChange={(e) => setRequiresParentVerification(e.target.checked)}
                className="mt-1 w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="requiresParentVerification" className="text-xs space-y-0.5 cursor-pointer select-none">
                <span className="font-bold text-indigo-900 block flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Wajibkan Paraf &amp; Verifikasi Orang Tua
                </span>
                <span className="text-slate-600 text-[11px] block leading-relaxed">
                  Santri wajib meminta paraf orang tua (via aplikasi atau Magic Link WhatsApp) untuk mengklaim bonus poin keluarga (+{parentBonusPoints} Poin).
                </span>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-xs font-bold text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menerbitkan...' : 'Terbitkan Tugas'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Multi-Select Sasaran Generasi & Santri */}
      <TargetAudienceModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        availableGenerations={effectiveGenerations}
        availableStudents={availableStudents}
        initialGenerationIds={targetGenerationIds}
        initialStudentIds={targetStudentIds}
        onSave={(genIds, studentIds) => {
          setTargetGenerationIds(genIds);
          setTargetStudentIds(studentIds);
        }}
      />
    </>
  );
}
