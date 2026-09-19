'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MessageSquare,
  DicesIcon,
} from 'lucide-react';
import {
  AssignmentConfig,
  parseQuizSubmission,
} from '@/lib/assignmentConfig';

export interface QuizSubmissionReviewProps {
  submissionText: string | null | undefined;
  config?: AssignmentConfig | null;
  studentName?: string;
  defaultExpanded?: boolean;
  allowToggle?: boolean;
  showCorrectAnswers?: boolean;
  titlePrefix?: string;
  className?: string;
}

export default function QuizSubmissionReview({
  submissionText,
  config,
  studentName,
  defaultExpanded = true,
  allowToggle = false,
  showCorrectAnswers = true,
  titlePrefix = 'Hasil Kuis Online',
  className = '',
}: QuizSubmissionReviewProps) {
  const quiz = parseQuizSubmission(submissionText, config);
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  if (!quiz) {
    return null;
  }

  // Menentukan warna badge berdasarkan skor
  const score = quiz.scoreEstimated;
  const isExcellent = score >= 80;
  const isAverage = score >= 60 && score < 80;

  const scoreBadgeBg = isExcellent
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
    : isAverage
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-rose-100 text-rose-800 border-rose-300';

  const progressBarColor = isExcellent
    ? 'bg-emerald-500'
    : isAverage
      ? 'bg-amber-500'
      : 'bg-rose-500';

  return (
    <div
      className={`${className}`}
    >
      {/* Header Ringkasan Nilai Kuis */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
              <DicesIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs sm:text-sm text-amber-950 block">
                {titlePrefix} {studentName ? `• ${studentName}` : ''}
              </span>
              <span className="text-[11px] text-amber-800/80 block">
                {quiz.totalQuestions} Soal Pilihan Ganda
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {quiz.lateNotice && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {quiz.lateNotice}
              </span>
            )}
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border shadow-2xs ${scoreBadgeBg}`}
            >
              {quiz.correctCount} / {quiz.totalQuestions} Benar ({score}%)
            </span>
          </div>
        </div>

        {/* Bar Visualisasi Skor */}
        <div className="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${progressBarColor}`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>

        {/* Catatan Tambahan dari Santri */}


        {/* Tombol Toggle Buka/Tutup Lembar Jawaban jika allowToggle aktif */}
        {allowToggle && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 bg-white/90 hover:bg-white px-3 py-1.5 rounded-xl border border-amber-200/80 shadow-2xs transition-all cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <span>Tutup Lembar Jawaban</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Lihat Kuis &amp; Pembahasan ({quiz.answers.length} Soal)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

        )}
      </div>

      {/* Lembar Butir Jawaban (Daftar Soal) */}
      {isExpanded && (
        <div className="space-y-2.5 pt-1">
          <span className="text-[11px] font-bold text-amber-900 block uppercase tracking-wider">
            Lembar Hasil Jawaban:
          </span>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {quiz.answers.map((ans, aIdx) => (
              <div
                key={aIdx}
                className={`p-3 rounded-xl border transition-all space-y-2 ${ans.isCorrect
                  ? 'bg-white/95 border-emerald-200/90 shadow-2xs'
                  : 'bg-white/95 border-rose-200/90 shadow-2xs'
                  }`}
              >
                {/* Header Butir Soal */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-extrabold border border-slate-200">
                      {aIdx + 1}
                    </span>
                    <span>Soal #{aIdx + 1}</span>
                    {ans.points !== undefined && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({ans.points} Poin)
                      </span>
                    )}
                  </span>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${ans.isCorrect
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                  >
                    {ans.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        BENAR
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-600" />
                        SALAH
                      </>
                    )}
                  </span>
                </div>

                {/* Teks Pertanyaan */}
                <p className="text-xs font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                  {ans.question}
                </p>

                {/* Jawaban Santri */}
                <div
                  className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${ans.isCorrect
                    ? 'bg-emerald-50/40 border-emerald-200/70 text-emerald-950'
                    : 'bg-rose-50/40 border-rose-200/70 text-rose-950'
                    }`}
                >
                  <span className="font-semibold text-[11px] shrink-0 text-slate-500">
                    Jawaban Santri:
                  </span>
                  <span
                    className={`font-bold ${ans.isCorrect ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                  >
                    {ans.selectedOptionText || '(Kosong / Tidak dijawab)'}
                  </span>
                </div>

                {/* Kunci Jawaban Benar (Jika Jawaban Santri Salah & Pembahasan Diperlukan) */}
                {!ans.isCorrect && showCorrectAnswers && ans.correctAnswerText && (
                  <div className="p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[11px] text-emerald-800 block">
                        Kunci Jawaban yang Benar:
                      </span>
                      <span className="font-semibold text-emerald-900">
                        {ans.correctAnswerText}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {quiz.notes && (
            <div className="p-3 rounded-xl bg-white/95 border border-amber-200/80 text-xs text-slate-700 flex items-start gap-2.5 shadow-2xs">
              <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-amber-900 block text-xs">
                  Catatan Tambahan Santri:
                </span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{quiz.notes}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
