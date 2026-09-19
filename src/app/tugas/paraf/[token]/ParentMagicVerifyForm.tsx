'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Award,
  Heart,
  Sparkles,
  Send,
  Calendar,
  User,
  Clock,
  CheckSquare,
  Mic,
  FileText,
  HelpCircle,
  AlertCircle,
  Camera,
  ExternalLink,
  X
} from 'lucide-react';
import { TaskType } from '@prisma/client';
import { verifySubmissionByParent } from '@/app/(protected)/tugas/actions';
import LazyAudioSection from '@/components/tugas/LazyAudioSection';
import LazyPhotoSection from '@/components/tugas/LazyPhotoSection';
import QuizSubmissionReview from '@/components/tugas/QuizSubmissionReview';
import { parseAssignmentConfig } from '@/lib/assignmentConfig';
import { parseHabitData, getHabitProgress, parseMediaUrls } from '@/lib/habitParser';

interface ParentMagicVerifyFormProps {
  submissionId: string;
  magicToken: string;
  studentName: string;
  taskTitle: string;
  taskType: TaskType;
  submissionText: string | null;
  mediaFileUrl: string | null;
  attachmentUrl?: string | null;
  isAlreadyVerified: boolean;
  verifiedAt: string | null;
  existingFeedback: string | null;
  parentBonusPoints: number;
}

const QUICK_FEEDBACK_TAGS = [
  'Alhamdulillah hafalan sangat lancar & fasih',
  'Sudah diperdengarkan & didampingi di rumah',
  'Bagus sekali, terus semangat belajarnya nak!',
  'Ibadah hariannya tertib dan disiplin',
];

export default function ParentMagicVerifyForm({
  submissionId,
  magicToken,
  studentName,
  taskTitle,
  taskType,
  submissionText,
  mediaFileUrl,
  attachmentUrl,
  isAlreadyVerified: initialVerified,
  verifiedAt: initialVerifiedAt,
  existingFeedback: initialFeedback,
  parentBonusPoints,
}: ParentMagicVerifyFormProps) {
  const [isVerified, setIsVerified] = useState(initialVerified);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(initialVerifiedAt);
  const [feedback, setFeedback] = useState(initialFeedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleQuickTagClick = (tag: string) => {
    if (feedback.includes(tag)) return;
    setFeedback((prev) => (prev ? `${prev}. ${tag}` : tag));
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await verifySubmissionByParent({
        submissionId,
        magicToken,
        parentFeedback: feedback.trim() || 'Telah didampingi dan disahkan oleh orang tua di rumah.',
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setIsVerified(true);
        setVerifiedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem saat memproses paraf.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const habitData = parseHabitData(submissionText);

  return (
    <div className="space-y-5">
      {/* Submission Content Review */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          {taskType === TaskType.AUDIO_MEMORIZATION && <Mic className="w-3.5 h-3.5 text-indigo-600" />}
          {taskType === TaskType.DAILY_HABIT && <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />}
          {taskType === TaskType.WRITTEN_SUBMISSION && <FileText className="w-3.5 h-3.5 text-sky-600" />}
          {taskType === TaskType.QUIZ_ONLINE && <HelpCircle className="w-3.5 h-3.5 text-amber-600" />}
          <span>Hasil Pengerjaan {studentName}</span>
        </div>

        {/* On-Demand Audio Player (Hemat Kuota Bandwidth) */}
        {taskType === TaskType.AUDIO_MEMORIZATION && mediaFileUrl && (
          <LazyAudioSection
            audioUrls={parseMediaUrls(mediaFileUrl)}
            titlePrefix={`Rekaman Suara ${studentName}`}
            themeColor="indigo"
          />
        )}

        {/* Daily Habit Checklist: Tampilkan Selesai/Jumlah dan Amalan Belum Dikerjakan */}
        {taskType === TaskType.DAILY_HABIT && (
          <div className="space-y-2.5">
            {(() => {
              const progress = getHabitProgress(habitData.habits);
              return (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Progress Amalan Harian Ananda:
                    </span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-100/90 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                      {progress.progressText} ({progress.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>

                  {/* Amalan yang sudah dikerjakan */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-emerald-800 block">
                      Sudah Dikerjakan ({progress.completed.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {progress.completed.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-xs text-emerald-950 font-medium shadow-2xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Amalan yang belum dikerjakan */}
                  {progress.uncompleted.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-semibold text-slate-500 block">
                        Belum Dikerjakan ({progress.uncompleted.length}):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {progress.uncompleted.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 border border-dashed border-slate-200 text-xs text-slate-400 font-normal"
                          >
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {habitData.notes && (
                    <p className="text-xs text-slate-600 italic bg-white/80 p-2.5 rounded-xl border border-slate-200/70 mt-1">
                      Catatan Ananda: &ldquo;{habitData.notes}&rdquo;
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* On-Demand Foto Lembar Kerja Santri (Hemat Kuota Bandwidth) */}
        {taskType === TaskType.WRITTEN_SUBMISSION && mediaFileUrl && (
          <LazyPhotoSection
            photoUrls={parseMediaUrls(mediaFileUrl)}
            titlePrefix="Bukti Pengerjaan"
            onPreviewImage={(url) => setPreviewImage(url)}
          />
        )}

        {/* Lembar Hasil Kuis Online (Pilihan Ganda) */}
        {taskType === TaskType.QUIZ_ONLINE && submissionText && (
          <QuizSubmissionReview
            submissionText={submissionText}
            config={parseAssignmentConfig(attachmentUrl)}
            studentName={studentName}
            defaultExpanded={true}
            allowToggle={true}
          />
        )}

        {/* Written or Text Submission (untuk selain DAILY_HABIT dan QUIZ_ONLINE) */}
        {submissionText && taskType !== TaskType.DAILY_HABIT && taskType !== TaskType.QUIZ_ONLINE && (
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-2xs">
            {submissionText}
          </div>
        )}
      </div>

      {/* Verified State Display */}
      {isVerified ? (
        <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-5 sm:p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-emerald-950">
              Alhamdulillah, Tugas Telah Disahkan!
            </h3>
            <p className="text-xs sm:text-sm text-emerald-800 mt-1 max-w-md mx-auto">
              Paraf digital orang tua berhasil disimpan. Ananda memperoleh bonus{' '}
              <span className="font-bold text-emerald-900">+{parentBonusPoints} Poin</span> untuk tugas ini.
            </p>
          </div>

          {verifiedAt && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Disahkan: {new Date(verifiedAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</span>
            </div>
          )}

          {feedback && (
            <div className="mt-3 p-3.5 rounded-xl bg-white/90 border border-emerald-200/70 text-xs sm:text-sm text-slate-700 italic text-left max-w-md mx-auto shadow-2xs">
              &ldquo;{feedback}&rdquo;
            </div>
          )}
        </div>
      ) : (
        /* Action Form for Zero-Login Parent */
        <form onSubmit={handleVerifySubmit} className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-indigo-950">
              Pesan Apresiasi / Doa untuk Ananda:
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Contoh: 'Alhamdulillah hafalan ananda lancar dan tajwidnya bagus, masyaAllah!'"
              rows={5}
              className="w-full text-xs sm:text-sm rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-indigo-300"
            />
          </div>

          {/* Quick Tags */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500">Pilih Cepat Catatan Paraf:</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FEEDBACK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickTagClick(tag)}
                  className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-white border border-indigo-200/80 text-indigo-800 hover:bg-indigo-50 transition-all cursor-pointer shadow-2xs font-medium active:scale-95"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan Pengesahan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Sahkan &amp; Beri Paraf Digital (+{parentBonusPoints} Poin)</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Lightbox / Modal Preview Foto Lembar Kerja */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Foto Lembar Kerja / Tugas Santri</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto flex items-center justify-center bg-slate-950 min-h-[250px]">
              <img
                src={previewImage}
                alt="Preview Lembar Kerja"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
