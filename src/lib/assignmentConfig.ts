/**
 * Metadata dan struktur konfigurasi lanjutan untuk tugas (Assignment)
 * Disimpan dalam format JSON pada kolom attachmentUrl tabel assignments
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string]; // Pilihan A, B, C, D
  correctAnswerIndex: number; // 0=A, 1=B, 2=C, 3=D
  points?: number; // Nilai/bobot soal
}

export type OverdueAction = 'LOCK' | 'ALLOW_LATE' | 'ALLOW_WITH_PENALTY';

export interface AssignmentLinkAttachment {
  title?: string;
  url: string;
}

export interface AssignmentConfig {
  // 1. Checklist Ibadah Kustom (DAILY_HABIT)
  checklistItems?: string[];

  // 2. Kuis Online Pilihan Ganda (QUIZ_ONLINE)
  quizData?: {
    questions: QuizQuestion[];
  };

  // 3. Kebijakan Batas Waktu Terlewat
  overdueAction?: OverdueAction;
  penaltyPercentage?: number; // default 25% jika ALLOW_WITH_PENALTY

  // 4. Sasaran Multi-Generasi dan Multi-Santri
  targetGenerationIds?: string[];
  targetClassIds?: string[];
  targetStudentIds?: string[];

  // 5. Lampiran file biasa (jika ada file dokumen yang diupload pengajar)
  documentUrl?: string | null;

  // 6. Lampiran Tugas (Foto & Link Tautan Eksternal)
  taskAttachments?: {
    photos?: string[];
    links?: AssignmentLinkAttachment[];
  };

  // 7. Pengoreksi Tambahan (Fitur Akses Koreksi untuk Pengajar Lain)
  assistantGraderIds?: string[];
}

export const DEFAULT_CHECKLIST_ITEMS: string[] = [

];

/**
 * Mengubah objek konfigurasi tugas menjadi string JSON yang aman disimpan di database
 */
export function serializeAssignmentConfig(config: AssignmentConfig): string {
  try {
    return JSON.stringify(config);
  } catch (e) {
    console.error('[AssignmentConfig] Gagal serialisasi konfigurasi:', e);
    return '';
  }
}

/**
 * Membaca dan mengurai konfigurasi tugas dari string attachmentUrl
 */
export function parseAssignmentConfig(raw: string | null | undefined): AssignmentConfig {
  if (!raw || typeof raw !== 'string') {
    return { overdueAction: 'ALLOW_LATE' };
  }

  const trimmed = raw.trim();

  // Jika string dimulai dengan { dan diakhiri }, parse sebagai JSON AssignmentConfig
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as AssignmentConfig;
      return {
        overdueAction: parsed.overdueAction || 'ALLOW_LATE',
        penaltyPercentage: parsed.penaltyPercentage ?? 25,
        checklistItems: Array.isArray(parsed.checklistItems) ? parsed.checklistItems : undefined,
        quizData: parsed.quizData && Array.isArray(parsed.quizData.questions) ? parsed.quizData : undefined,
        targetGenerationIds: Array.isArray(parsed.targetGenerationIds) ? parsed.targetGenerationIds : undefined,
        targetClassIds: Array.isArray(parsed.targetClassIds) ? parsed.targetClassIds : undefined,
        targetStudentIds: Array.isArray(parsed.targetStudentIds) ? parsed.targetStudentIds : undefined,
        documentUrl: parsed.documentUrl || null,
        taskAttachments: parsed.taskAttachments || undefined,
        assistantGraderIds: Array.isArray(parsed.assistantGraderIds) ? parsed.assistantGraderIds : undefined,
      };
    } catch {
      // Jika parse gagal, anggap sebagai string biasa
    }
  }

  // Jika raw berupa URL biasa (misal file lampiran PDF)
  return {
    overdueAction: 'ALLOW_LATE',
    documentUrl: trimmed,
  };
}

export interface QuizAnswerDetail {
  questionIndex: number;
  question: string;
  options?: [string, string, string, string] | string[];
  selectedOption: number; // 0=A, 1=B, 2=C, 3=D, -1=tidak dijawab
  selectedOptionText: string;
  isCorrect: boolean;
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  points?: number;
}

export interface ParsedQuizSubmission {
  scoreEstimated: number;
  correctCount: number;
  totalQuestions: number;
  answers: QuizAnswerDetail[];
  notes?: string;
  lateNotice?: string;
}

/**
 * Mengurai submissionText tugas kuis online (QUIZ_ONLINE)
 * Mendukung format:
 * 1. Objek QUIZ_RESULT standar: { type: 'QUIZ_RESULT', scoreEstimated, correctCount, answers: [...] }
 * 2. Array opsi jawaban santri: [0, 1, 2] atau ["A", "B", "C"]
 * 3. Array objek jawaban: [{ questionIndex: 0, selectedOption: 1 }, ...]
 * 4. Objek pemetaan: { answers: [...] } atau { "0": 1, "1": 0 }
 * 5. String dengan prefix keterlambatan: [TERLAMBAT - ...]
 */
export function parseQuizSubmission(
  rawSubmissionText: string | null | undefined,
  config?: AssignmentConfig | null
): ParsedQuizSubmission | null {
  if (!rawSubmissionText || typeof rawSubmissionText !== 'string') {
    return null;
  }

  let text = rawSubmissionText.trim();
  if (!text) return null;

  let lateNotice: string | undefined;

  // Tangani prefix keterlambatan e.g. "[TERLAMBAT - Potongan 25% Poin]\n{...}" atau "[TERLAMBAT]\n[0, 1, 2]"
  if (text.startsWith('[TERLAMBAT')) {
    const newlineIdx = text.indexOf('\n');
    if (newlineIdx !== -1) {
      lateNotice = text.slice(0, newlineIdx).trim();
      text = text.slice(newlineIdx + 1).trim();
    } else if (text.includes(']\n') || text.includes('] ')) {
      const match = text.match(/^(\[TERLAMBAT[^\]]*\])\s*(.*)$/s);
      if (match) {
        lateNotice = match[1];
        text = match[2].trim();
      }
    }
  }

  // Coba parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(text);
    // Jika hasilnya masih string (double-stringified)
    if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
      try {
        parsed = JSON.parse(parsed);
      } catch { }
    }
  } catch {
    // Bukan JSON, mungkin teks biasa
    return null;
  }

  if (!parsed || (typeof parsed !== 'object')) {
    return null;
  }

  const questions = config?.quizData?.questions || [];

  // 1. FORMAT UTAMA: QUIZ_RESULT
  if (parsed.type === 'QUIZ_RESULT' && Array.isArray(parsed.answers)) {
    const answers: QuizAnswerDetail[] = parsed.answers.map((ans: any, idx: number) => {
      const qIdx = typeof ans.questionIndex === 'number' ? ans.questionIndex : idx;
      const qConfig = questions[qIdx];
      const selOpt = typeof ans.selectedOption === 'number' ? ans.selectedOption : -1;
      const correctIdx = ans.correctAnswerIndex ?? qConfig?.correctAnswerIndex;
      const isCorrect = typeof ans.isCorrect === 'boolean'
        ? ans.isCorrect
        : (correctIdx !== undefined && selOpt >= 0 && selOpt === correctIdx);

      const selText =
        ans.selectedOptionText ||
        (qConfig && selOpt >= 0 && qConfig.options[selOpt] ? qConfig.options[selOpt] : '');
      const correctText =
        correctIdx !== undefined && qConfig && qConfig.options[correctIdx]
          ? qConfig.options[correctIdx]
          : undefined;

      return {
        questionIndex: qIdx,
        question: ans.question || qConfig?.question || `Soal #${qIdx + 1}`,
        options: qConfig?.options,
        selectedOption: selOpt,
        selectedOptionText: selText || (selOpt >= 0 ? `Pilihan ${String.fromCharCode(65 + selOpt)}` : '(Kosong)'),
        isCorrect,
        correctAnswerIndex: correctIdx,
        correctAnswerText: correctText,
        points: qConfig?.points || 20,
      };
    });

    const totalQuestions = typeof parsed.totalQuestions === 'number' ? parsed.totalQuestions : answers.length;
    const correctCount = typeof parsed.correctCount === 'number'
      ? parsed.correctCount
      : answers.filter((a) => a.isCorrect).length;
    const scoreEstimated = typeof parsed.scoreEstimated === 'number'
      ? parsed.scoreEstimated
      : (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);

    return {
      scoreEstimated,
      correctCount,
      totalQuestions,
      answers,
      notes: parsed.notes || undefined,
      lateNotice: lateNotice || (parsed.isLate ? '[TERLAMBAT]' : undefined),
    };
  }

  // 2. FORMAT ARRAY (misal: [0, 1, 2] atau ["A", "B", "C"] atau [{ questionIndex, selectedOption }])
  if (Array.isArray(parsed)) {
    const totalItems = Math.max(parsed.length, questions.length);
    let correctCount = 0;

    const answers: QuizAnswerDetail[] = [];
    for (let i = 0; i < totalItems; i++) {
      const qConfig = questions[i];
      const item = parsed[i];

      let selOpt = -1;
      let selText = '';

      if (typeof item === 'number') {
        selOpt = item;
        selText = qConfig?.options?.[selOpt] || (selOpt >= 0 ? `Pilihan ${String.fromCharCode(65 + selOpt)}` : '');
      } else if (typeof item === 'string') {
        const trimmedItem = item.trim();
        const upper = trimmedItem.toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(upper)) {
          selOpt = upper.charCodeAt(0) - 65;
          selText = qConfig?.options?.[selOpt] || `Pilihan ${upper}`;
        } else if (!isNaN(Number(trimmedItem))) {
          selOpt = Number(trimmedItem);
          selText = qConfig?.options?.[selOpt] || (selOpt >= 0 ? `Pilihan ${String.fromCharCode(65 + selOpt)}` : '');
        } else {
          selText = trimmedItem;
          if (qConfig) {
            selOpt = qConfig.options.findIndex(
              (o) => o.trim().toLowerCase() === trimmedItem.toLowerCase()
            );
          }
        }
      } else if (typeof item === 'object' && item !== null) {
        selOpt = item.selectedOption ?? item.selectedOptionIndex ?? item.answer ?? -1;
        selText = item.selectedOptionText || (qConfig && selOpt >= 0 ? qConfig.options[selOpt] : '');
      }

      const correctIdx = qConfig?.correctAnswerIndex;
      const isCorrect = correctIdx !== undefined && selOpt >= 0 && selOpt === correctIdx;
      if (isCorrect) correctCount++;

      answers.push({
        questionIndex: i,
        question: qConfig?.question || `Soal #${i + 1}`,
        options: qConfig?.options,
        selectedOption: selOpt,
        selectedOptionText: selText || (selOpt >= 0 ? `Pilihan ${String.fromCharCode(65 + selOpt)}` : '(Kosong)'),
        isCorrect,
        correctAnswerIndex: correctIdx,
        correctAnswerText: correctIdx !== undefined && qConfig ? qConfig.options[correctIdx] : undefined,
        points: qConfig?.points || 20,
      });
    }

    const totalQuestions = answers.length;
    const scoreEstimated = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      scoreEstimated,
      correctCount,
      totalQuestions,
      answers,
      lateNotice,
    };
  }

  // 3. FORMAT OBJEK DENGAN PEMETAAN INDEX (misal: { "0": 1, "1": 0 } atau { answers: [0, 1] })
  const possibleArray = parsed.answers || parsed.quizAnswers;
  if (Array.isArray(possibleArray)) {
    return parseQuizSubmission(JSON.stringify(possibleArray), config);
  }

  // Cek jika keys berupa integer indices: { "0": 1, "1": 0 }
  const numericKeys = Object.keys(parsed).filter((k) => !isNaN(Number(k)));
  if (numericKeys.length > 0) {
    const reconstructedArray: any[] = [];
    numericKeys.forEach((k) => {
      reconstructedArray[Number(k)] = parsed[k];
    });
    return parseQuizSubmission(JSON.stringify(reconstructedArray), config);
  }

  return null;
}

/**
 * Memformat label sasaran penugasan (contoh: "Pra-Remaja", "3 Kelas Dipilih", "Semua Santri")
 */
export function formatTargetSasaranLabel(
  config: AssignmentConfig,
  classModel?: { name: string } | null,
  generations?: { id: string; name: string }[]
): string {
  if (classModel?.name) return classModel.name;
  if (config.targetGenerationIds && config.targetGenerationIds.length > 0) {
    const genNames = (generations || [])
      .filter((g) => config.targetGenerationIds?.includes(g.id))
      .map((g) => g.name.split(' ')[0]);
    return genNames.length > 0 ? genNames.join(', ') : `${config.targetGenerationIds.length} Generasi`;
  }
  if (config.targetClassIds && config.targetClassIds.length > 0) {
    return `${config.targetClassIds.length} Kelas Dipilih`;
  }
  if (config.targetStudentIds && config.targetStudentIds.length > 0) {
    return `${config.targetStudentIds.length} Santri Khusus`;
  }
  return 'Semua Santri';
}
