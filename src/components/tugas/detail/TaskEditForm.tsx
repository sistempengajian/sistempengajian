'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
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
  Plus,
  ArrowLeft,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
  ExternalLink,
  UserCheck,
  Camera,
  X,
  Save,
  Dices,
} from 'lucide-react';
import { TaskType } from '@prisma/client';
import { updateAssignment } from '@/app/(protected)/tugas/actions';
import TargetAudienceModal, { StudentOption, GenerationOption, ClassOption } from '../TargetAudienceModal';
import CurriculumMaterialModal, { CurriculumMaterialItem } from '../form/CurriculumMaterialModal';
import ManageGradersModal, { TeacherGraderOption } from '../form/ManageGradersModal';
import TaskDetailLayout from './TaskDetailLayout';
import { compressImageToWebP, fileToDataUrl } from '@/lib/imageCompressor';
import {
  DEFAULT_CHECKLIST_ITEMS,
  serializeAssignmentConfig,
  QuizQuestion,
  OverdueAction,
  AssignmentConfig,
  AssignmentLinkAttachment,
} from '@/lib/assignmentConfig';

interface TaskEditFormProps {
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
    config: any;
    className?: string;
    materialTitle?: string | null;
    materialId?: string | null;
  };
  availableGenerations?: GenerationOption[];
  availableClasses?: ClassOption[];
  availableStudents?: StudentOption[];
  availableMaterials?: CurriculumMaterialItem[];
  availableTeachers?: TeacherGraderOption[];
}

export default function TaskEditForm({
  assignment,
  availableGenerations = [],
  availableClasses = [],
  availableStudents = [],
  availableMaterials = [],
  availableTeachers = [],
}: TaskEditFormProps) {
  const router = useRouter();
  const config = assignment.config || {};
  const effectiveGenerations = availableGenerations.length > 0 ? availableGenerations : availableClasses;

  const [title, setTitle] = useState(assignment.title || '');
  const [description, setDescription] = useState(assignment.description || '');
  const [taskType, setTaskType] = useState<TaskType>(assignment.taskType || TaskType.AUDIO_MEMORIZATION);

  // Sasaran Penugasan (Multi-Generasi & Multi-Santri)
  const [targetGenerationIds, setTargetGenerationIds] = useState<string[]>(config.targetGenerationIds || []);
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>(config.targetStudentIds || []);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Tautan Materi Kurikulum (Modal)
  const initialMaterial = availableMaterials.find((m) => m.id === assignment.materialId) ||
    (assignment.materialId
      ? {
        id: assignment.materialId,
        title: assignment.materialTitle || 'Materi Terpilih',
        checklistItems: [],
      }
      : null);
  const [selectedMaterial, setSelectedMaterial] = useState<CurriculumMaterialItem | null>(initialMaterial);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Batas Waktu Pengumpulan (Checkbox Kondisional)
  const initialDueDate = assignment.dueDate
    ? new Date(new Date(assignment.dueDate).getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    : '';
  const [hasDeadline, setHasDeadline] = useState(Boolean(assignment.dueDate));
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [overdueAction, setOverdueAction] = useState<OverdueAction>(config.overdueAction || 'LOCK');
  const [penaltyPercentage, setPenaltyPercentage] = useState<number>(config.penaltyPercentage || config.penaltyPercent || 25);

  // Poin & Verifikasi Orang Tua
  const [pointsReward, setPointsReward] = useState<number>(assignment.pointsReward || 20);
  const [parentBonusPoints, setParentBonusPoints] = useState<number>(assignment.parentBonusPoints || 10);
  const [requiresParentVerification, setRequiresParentVerification] = useState<boolean>(assignment.requiresParentVerification);

  // Lampiran Tugas (Foto & Link Tautan)
  const [attachmentPhotos, setAttachmentPhotos] = useState<string[]>(config.taskAttachments?.photos || []);
  const [attachmentLinks, setAttachmentLinks] = useState<AssignmentLinkAttachment[]>(config.taskAttachments?.links || []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Hak Akses Koreksi (Pengajar Pembantu)
  const [assistantGraderIds, setAssistantGraderIds] = useState<string[]>(config.assistantGraderIds || []);
  const [isGradersModalOpen, setIsGradersModalOpen] = useState(false);

  // 1. Checklist Ibadah State (DAILY_HABIT)
  const [checklistItems, setChecklistItems] = useState<string[]>(
    config.checklistItems && config.checklistItems.length > 0
      ? config.checklistItems
      : [...DEFAULT_CHECKLIST_ITEMS]
  );
  const [newChecklistInput, setNewChecklistInput] = useState('');

  // 2. Kuis Online State (QUIZ_ONLINE)
  const rawQuestions = config.quizData?.questions || config.quizQuestions;
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(
    rawQuestions && rawQuestions.length > 0
      ? rawQuestions
      : [
        {
          id: 'q_1',
          question: '',
          options: ['', '', '', ''],
          correctAnswerIndex: 0,
        },
      ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- HANDLER FOTO LAMPIRAN ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingPhoto(true);
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          setErrorMessage('Ukuran file foto maksimal 15MB.');
          continue;
        }
        const compressedFile = await compressImageToWebP(file);
        const compressedBase64 = await fileToDataUrl(compressedFile);
        newPhotos.push(compressedBase64);
      }
      setAttachmentPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengupload foto.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setAttachmentPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // --- HANDLER LINK LAMPIRAN ---
  const handleAddLink = () => {
    const trimmedUrl = newLinkUrl.trim();
    if (!trimmedUrl) return;

    let validUrl = trimmedUrl;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = `https://${validUrl}`;
    }

    setAttachmentLinks((prev) => [
      ...prev,
      {
        url: validUrl,
        title: newLinkTitle.trim() || undefined,
      },
    ]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setShowAddLinkForm(false);
  };

  const handleRemoveLink = (index: number) => {
    setAttachmentLinks((prev) => prev.filter((_, i) => i !== index));
  };

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

    if (taskType === TaskType.DAILY_HABIT && checklistItems.length === 0) {
      setErrorMessage('Tugas checklist ibadah wajib memiliki minimal 1 point amalan.');
      return;
    }

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

      const updatedConfig: AssignmentConfig = {
        ...config,
        overdueAction: hasDeadline ? overdueAction : undefined,
        penaltyPercentage: hasDeadline && overdueAction === 'ALLOW_WITH_PENALTY' ? penaltyPercentage : undefined,
        targetGenerationIds: targetGenerationIds.length > 0 ? targetGenerationIds : undefined,
        targetStudentIds: targetStudentIds.length > 0 ? targetStudentIds : undefined,
        assistantGraderIds: assistantGraderIds.length > 0 ? assistantGraderIds : undefined,
      };

      if (attachmentPhotos.length > 0 || attachmentLinks.length > 0) {
        updatedConfig.taskAttachments = {
          photos: attachmentPhotos.length > 0 ? attachmentPhotos : undefined,
          links: attachmentLinks.length > 0 ? attachmentLinks : undefined,
        };
      } else {
        delete updatedConfig.taskAttachments;
      }

      if (taskType === TaskType.DAILY_HABIT) {
        updatedConfig.checklistItems = checklistItems;
      } else if (taskType === TaskType.QUIZ_ONLINE) {
        updatedConfig.quizData = { questions: quizQuestions };
      }

      const formData = new FormData();
      formData.set('title', title.trim());
      formData.set('description', description.trim());
      formData.set('taskType', taskType);
      formData.set('assignmentConfig', serializeAssignmentConfig(updatedConfig));
      formData.set('materialId', selectedMaterial ? selectedMaterial.id : '');
      formData.set('dueDate', hasDeadline && dueDate ? dueDate : '');
      formData.set('pointsReward', pointsReward.toString());
      formData.set('parentBonusPoints', parentBonusPoints.toString());
      formData.set('requiresParentVerification', requiresParentVerification ? 'true' : 'false');

      const res = await updateAssignment(assignment.id, formData);
      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
      } else {
        router.push(`/tugas/${assignment.id}`);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan perubahan tugas.');
      setIsSubmitting(false);
    }
  };

  return (
    <TaskDetailLayout backLabel="Kembali ke Detail Tugas">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in">
        {/* Header Box */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
                <span>Mode Edit Tugas</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Edit Data & Pengaturan Tugas
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Perbarui rincian instruksi, target santri, materi kurikulum, lampiran tugas, dan tenggat waktu.
              </p>
            </div>
            <Link
              href={`/tugas/${assignment.id}`}
              prefetch={true}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Batal
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center gap-2.5 shadow-2xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* 1. FORMAT TUGAS */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            1. Format & Jenis Tugas
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                type: TaskType.AUDIO_MEMORIZATION,
                label: 'Setoran Suara',
                desc: 'Rekaman hafalan Al-Qur’an & doa',
                icon: Mic,
                color: 'teal',
              },
              {
                type: TaskType.DAILY_HABIT,
                label: 'Checklist Ibadah',
                desc: 'Monitoring amalan sholat & ibadah',
                icon: CheckSquare,
                color: 'emerald',
              },
              {
                type: TaskType.WRITTEN_SUBMISSION,
                label: 'Esai / Ringkasan',
                desc: 'Menulis resume materi pengajian',
                icon: FileText,
                color: 'blue',
              },
              {
                type: TaskType.QUIZ_ONLINE,
                label: 'Kuis Online',
                desc: 'Pilihan ganda dengan koreksi instan',
                icon: Dices,
                color: 'indigo',
              },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = taskType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setTaskType(t.type)}
                  className={`flex flex-col p-4 rounded-2xl border text-left transition-all ${isSelected
                    ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors ${isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 mb-0.5">{t.label}</span>
                  <span className="text-[11px] text-slate-500 leading-snug">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. INFORMASI UTAMA & TAUTAN MATERI */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            2. Informasi Tugas & Target Sasaran
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Setoran Hafalan Surat Al-Mulk Ayat 1-10"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Instruksi / Catatan Tambahan</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Jelaskan tata cara pengerjaan tugas atau kriteria penilaian..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsTargetModalOpen(true)}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Ubah Target Sasaran
            </button>
          </div>
          <div
            onClick={() => setIsTargetModalOpen(true)}
            className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {targetGenerationIds.length === 0 && targetStudentIds.length === 0
                    ? 'Semua Santri di Organisasi Anda'
                    : targetStudentIds.length > 0
                      ? `${targetStudentIds.length} Santri Tertentu Dipilih`
                      : `${targetGenerationIds.length} Generasi Dipilih`}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {targetGenerationIds.length > 0
                    ? effectiveGenerations
                      .filter((g) => targetGenerationIds.includes(g.id))
                      .map((g) => g.name)
                      .join(', ')
                    : targetStudentIds.length > 0
                      ? 'Penugasan terarah untuk santri khusus yang telah dipilih.'
                      : 'Seluruh santri aktif di unit organisasi Anda berhak melihat & mengerjakan.'}
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-teal-600 px-3 py-1 bg-white border border-slate-200 rounded-xl shrink-0">
              Kelola
            </span>
          </div>



          {/* Tautan Materi Kurikulum (Modal) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-700" />
                Tautan Materi Kurikulum (Opsional)
              </label>
              {selectedMaterial && (
                <button
                  type="button"
                  onClick={() => setSelectedMaterial(null)}
                  className="text-[11px] text-red-600 hover:text-red-700 font-medium"
                >
                  Lepas Materi
                </button>
              )}
            </div>


            {selectedMaterial ? (
              <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-teal-700 group-hover:text-teal-600 transition-colors" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center  gap-2">
                      <span className="text-xs font-bold text-slate-900">{selectedMaterial.title}</span>
                      {selectedMaterial.targetGenerationName && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-semibold">
                          {selectedMaterial.targetGenerationName}
                        </span>
                      )}
                    </div>
                    {selectedMaterial.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {selectedMaterial.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMaterialModalOpen(true)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60 shrink-0"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial(null)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Hapus materi"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(true)}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition-colors flex items-center justify-between gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-teal-700 group-hover:text-teal-700 transition-colors" />
                </div>
                <span className="text-xs text-left text-slate-600 group-hover:text-slate-900 font-medium">
                  Pilih materi kurikulum dari perpustakaan materi...
                </span>
                <span className="text-xs font-semibold text-teal-600 px-3 py-1 bg-white border border-slate-200 rounded-xl shrink-0">
                  Cari Materi
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 3. LAMPIRAN TUGAS (FOTO & LINK TAUTAN) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              3. Lampiran Tugas
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Opsional</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Foto Lampiran */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  Foto / Gambar Dokumen
                </span>
                <span className="text-[10px] text-slate-400">
                  {attachmentPhotos.length} Foto
                </span>
              </div>

              {/* Photos Preview Grid */}
              {attachmentPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {attachmentPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video border border-slate-200 bg-slate-100">
                      <img src={photo} alt={`Lampiran ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-600 hover:text-teal-700 bg-white hover:bg-teal-50/40 transition-all cursor-pointer">
                {isUploadingPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                    <span>Memproses Foto...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                    <span>Unggah Foto ({attachmentPhotos.length}/6)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto || attachmentPhotos.length >= 6}
                  className="hidden"
                />
              </label>
            </div>

            {/* Tautan Link Eksternal */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                  Tautan Link Eksternal
                </span>
                <span className="text-[10px] text-slate-400">
                  {attachmentLinks.length} Tautan
                </span>
              </div>

              {/* Links List */}
              {attachmentLinks.length > 0 && (
                <div className="space-y-1.5">
                  {attachmentLinks.map((link, idx) => (
                    <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{link.title || link.url}</p>
                        {link.title && <p className="text-[10px] text-slate-400 truncate">{link.url}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddLinkForm ? (
                <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                  <input
                    type="text"
                    placeholder="Judul Tautan (contoh: Video Referensi)"
                    value={newLinkTitle}
                    onChange={(e) => setNewLinkTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  <input
                    type="url"
                    placeholder="URL Tautan (https://...)"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddLinkForm(false)}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="px-3 py-1 text-[11px] font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Tambahkan
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddLinkForm(true)}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-teal-500 text-xs font-semibold text-slate-600 hover:text-teal-700 bg-white hover:bg-teal-50/40 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Tautan Materi</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. SASARAN PENUGASAN (MULTI-GENERASI & SANTRI) */}


        {/* 5. BATAS WAKTU PENGUMPULAN (CHECKBOX KONDISIONAL) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">

          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            4. Pengaturan Batas Waktu Pengumpulan
          </label>

          {/* Checkbox Trigger */}
          <div
            onClick={() => setHasDeadline(!hasDeadline)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${hasDeadline
              ? 'bg-teal-50/60 border-teal-500 shadow-2xs'
              : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${hasDeadline ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                  }`}
              >
                {hasDeadline && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Tentukan Batas Waktu Pengumpulan (Deadline)
                </p>
              </div>
            </div>
          </div>

          {/* Section Tenggat Waktu & Aksi Batas Waktu jika Checkbox dicentang */}
          {hasDeadline && (
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-4 animate-scale-in">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Tanggal & Jam Batas Akhir
                </label>
                <input
                  type="datetime-local"
                  required={hasDeadline}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full sm:w-80 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium"
                />
              </div>

              {/* Setting Aksi Overdue */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-semibold text-slate-700 block">
                  Aksi Setelah Batas Waktu Berakhir:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'LOCK' as OverdueAction,
                      title: 'Kunci Otomatis',
                      desc: 'Tutup pengumpulan tugas sepenuhnya',
                      icon: Lock,
                    },
                    {
                      id: 'ALLOW_LATE' as OverdueAction,
                      title: 'Izinkan Terlambat',
                      desc: 'Santri tetap bisa mengirim dengan tag terlambat',
                      icon: Clock,
                    },
                    {
                      id: 'ALLOW_WITH_PENALTY' as OverdueAction,
                      title: 'Potong Poin',
                      desc: 'Tetap bisa kumpul tapi reward dipotong',
                      icon: RotateCcw,
                    },
                  ].map((action) => {
                    const ActionIcon = action.icon;
                    const isSelected = overdueAction === action.id;
                    return (
                      <div
                        key={action.id}
                        onClick={() => setOverdueAction(action.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${isSelected
                          ? 'border-amber-500 bg-amber-50/70 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-100/60'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ActionIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                          <span className="text-xs font-bold text-slate-900">{action.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">{action.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {overdueAction === 'ALLOW_WITH_PENALTY' && (
                  <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs mt-2">
                    <span className="text-slate-700 font-medium">Persentase Potongan Poin:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={5}
                        max={90}
                        step={5}
                        value={penaltyPercentage}
                        onChange={(e) => setPenaltyPercentage(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold text-xs"
                      />
                      <span className="font-bold text-amber-700">%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
            5. Reward Gamifikasi & Sinergi Orang Tua
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                Poin Reward Kelulusan Santri
              </label>
              <p className="text-[11px] text-amber-800/80 leading-relaxed">
                Poin gamifikasi yang langsung didapatkan santri setelah tugas dinilai dan lulus oleh guru.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={5}
                  max={100}
                  step={5}
                  value={pointsReward}
                  onChange={(e) => setPointsReward(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-xl text-center font-bold text-slate-800"
                />
                <span className="text-xs font-bold text-amber-900">Poin Utama</span>
              </div>
            </div>

            <div className="p-4 bg-purple-50/60 border border-purple-200/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  Wajib Paraf Digital Orang Tua
                </label>
                <input
                  type="checkbox"
                  checked={requiresParentVerification}
                  onChange={(e) => setRequiresParentVerification(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-purple-800/80 leading-relaxed">
                Mengharuskan orang tua memeriksa hafalan/amalan ananda dan memberikan paraf digital.
              </p>
              {requiresParentVerification && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={5}
                    value={parentBonusPoints}
                    onChange={(e) => setParentBonusPoints(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-xl text-center font-bold text-slate-800"
                  />
                  <span className="text-xs font-bold text-purple-900">Bonus Poin Paraf</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. HAK AKSES KOREKSI (DELEGASI PENGAJAR PEMBANTU) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block flex items-center gap-1.5">

                6. Akses Koreksi Tambahan (Pengajar Pembantu)
              </label>
            </div>
          </div>

          <div
            onClick={() => setIsGradersModalOpen(true)}
            className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition-colors flex items-center justify-between"
          >
            <div className="flex flex-wrap justify-between items-center gap-3  ">
              <div className="flex items-center gap-2  ">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 whitespace-wrap">
                  {assistantGraderIds.length === 0
                    ? 'Hanya Pembuat Tugas (Pribadi)'
                    : `${assistantGraderIds.length}  Akses Koreksi Tugas`}
                </span>
              </div>
              <div className="flex gap-2 items-center justify-between">


                {/* Ditambahkan `truncate sm:whitespace-normal` agar terpotong di layar kecil, tapi normal di layar besar */}

                <span className="text-xs font-semibold text-teal-600 px-3 py-1 bg-white border border-slate-200 rounded-xl shrink-0">
                  Pilih Pengajar
                </span>
              </div>

              <span className="text-[11px] flex-col text-slate-500 mt-0.5">
                {assistantGraderIds.length > 0
                  ? availableTeachers
                    .filter((t) => assistantGraderIds.includes(t.id))
                    .map((t) => t.fullName)
                    .join(', ')
                  : 'Belum ada pengajar lain yang ditugaskan untuk membantu mengoreksi.'}
              </span>
            </div>

          </div>
        </div>

        {/* 7. POIN & VERIFIKASI ORANG TUA */}


        {/* 8. BUILDER KHUSUS SESUAI FORMAT */}
        {
          taskType === TaskType.DAILY_HABIT && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    8. Konfigurasi Checklist Amalan Harian
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Daftar amalan yang harus dicentang oleh santri setiap harinya.
                  </p>
                </div>
                <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                  {checklistItems.length} Amalan
                </span>
              </div>

              <div className="space-y-2">
                {checklistItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-medium text-slate-800">{item}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

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
                  placeholder="Tambah amalan baru (cth: Dzikir Pagi & Petang)..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Tambah
                </button>
              </div>
            </div>
          )
        }

        {
          taskType === TaskType.QUIZ_ONLINE && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    8. Builder Soal Kuis Online
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tentukan pertanyaan, 4 pilihan ganda, dan tandai jawaban yang benar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddQuizQuestion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Soal
                </button>
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 bg-indigo-100/80 px-2.5 py-1 rounded-lg">
                        Nomor {qIdx + 1}
                      </span>
                      {quizQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuizQuestion(qIdx)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus Soal
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Pertanyaan:</label>
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                        placeholder="Tuliskan butir soal pertanyaan kuis..."
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700 block">
                        Pilihan Jawaban (Pilih radio button untuk kunci jawaban yang benar):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correctAnswerIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${isCorrect
                                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                                : 'bg-white border-slate-200'
                                }`}
                            >
                              <input
                                type="radio"
                                name={`correct_${q.id}`}
                                checked={isCorrect}
                                onChange={() => handleSetCorrectAnswer(qIdx, optIdx)}
                                className="text-emerald-600 focus:ring-emerald-500 cursor-pointer ml-1"
                              />
                              <span className="text-xs font-bold text-slate-400 w-4">
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                                placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
                                className="flex-1 px-2 py-1 text-xs text-slate-900 bg-transparent border-none focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        {/* SUBMIT BUTTONS */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200/80 shadow-md flex items-center justify-between gap-4">
          <Link
            href={`/tugas/${assignment.id}`}
            prefetch={true}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors text-center"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Perubahan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan</span>
              </>
            )}
          </button>
        </div>
      </form >

      {/* Target Audience Modal */}
      < TargetAudienceModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)
        }
        availableGenerations={effectiveGenerations}
        availableStudents={availableStudents}
        initialGenerationIds={targetGenerationIds}
        initialStudentIds={targetStudentIds}
        onSave={(generationIds: string[], studentIds: string[]) => {
          setTargetGenerationIds(generationIds);
          setTargetStudentIds(studentIds);
          setIsTargetModalOpen(false);
        }}
      />

      {/* Curriculum Material Modal */}
      <CurriculumMaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        materials={availableMaterials}
        generations={effectiveGenerations}
        selectedMaterialId={selectedMaterial?.id}
        onSelectMaterial={(material) => {
          setSelectedMaterial(material);
          if (material) {
            const checklist = (material as any).checklistItems;
            if (taskType === TaskType.DAILY_HABIT && checklist && checklist.length > 0) {
              setChecklistItems(checklist);
            }
          }
        }}
        onSelect={(material: CurriculumMaterialItem | null) => {
          setSelectedMaterial(material);
          if (material) {
            const checklist = (material as any).checklistItems;
            if (taskType === TaskType.DAILY_HABIT && checklist && checklist.length > 0) {
              setChecklistItems(checklist);
            }
          }
        }}
      />

      {/* Manage Graders Modal */}
      <ManageGradersModal
        isOpen={isGradersModalOpen}
        onClose={() => setIsGradersModalOpen(false)}
        availableTeachers={availableTeachers}
        selectedGraderIds={assistantGraderIds}
        onSave={(graderIds: string[]) => setAssistantGraderIds(graderIds)}
      />
    </TaskDetailLayout >
  );
}
