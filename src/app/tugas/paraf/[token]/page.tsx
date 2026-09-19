import React from 'react';
import prisma from '@/lib/prisma';
import { verifyMagicToken } from '@/lib/magicToken';
import ParentMagicVerifyForm from './ParentMagicVerifyForm';
import {
  ShieldCheck,
  Award,
  BookOpen,
  Calendar,
  User,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  Mic,
  CheckSquare,
  FileText,
  HelpCircle,
  Dices,
  ListTodo,
  DicesIcon,
  Dice5Icon,
  Gamepad2,
  Gamepad2Icon,
} from 'lucide-react';
import { TaskType } from '@prisma/client';
import Link from 'next/link';

export const metadata = {
  title: 'Paraf Digital Tugas Santri | Sistem Pengajian',
  description: 'Verifikasi dan paraf digital tugas mandiri santri oleh orang tua tanpa perlu login.',
};

export default async function ParentMagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const verificationResult = verifyMagicToken(token);

  if (!verificationResult.valid || !verificationResult.submissionId) {
    return (
      <div className="min-h-screen bg-role-orang-tua flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            Tautan Paraf Tidak Sah atau Kedaluwarsa
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {verificationResult.error ||
              'Tautan verifikasi ini sudah tidak berlaku atau masa aktifnya telah habis (berlaku 72 jam). Silakan minta ananda untuk membagikan tautan baru melalui WhatsApp.'}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Masuk ke Akun Sistem
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Ambil detail submission & tugas
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: verificationResult.submissionId },
    include: {
      student: {
        include: {
          generation: true,
        },
      },
      assignment: {
        include: {
          teacher: true,
          material: true,
        },
      },
      parentVerification: true,
    },
  });

  if (!submission) {
    return (
      <div className="min-h-screen bg-role-orang-tua flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Data Tugas Tidak Ditemukan</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Data pengumpulan tugas ini mungkin telah dihapus atau diperbarui oleh pengajar.
          </p>
        </div>
      </div>
    );
  }

  const isAlreadyVerified = Boolean(submission.parentVerification?.isVerifiedByParent);

  return (
    <div className="min-h-screen bg-role-orang-tua py-6 sm:py-10 px-3 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-indigo-200/80 text-indigo-700 text-xs font-semibold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Portal Paraf Digital Orang Tua</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Pengesahan Tugas Ananda
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Dampingi ananda menyelesaikan tugas mandiri dan berikan paraf pengesahan digital secara instan.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/85 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Santri & Assignment Header Section */}
          <div className="p-4 sm:p-6 bg-indigo-50/70 border-b border-indigo-100/80 space-y-4">
            {/* Santri Info Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white text-indigo-700 font-bold text-base sm:text-lg flex items-center justify-center border border-indigo-200/80 shadow-2xs shrink-0">
                  {submission.student.fullName.charAt(0).toUpperCase()}
                </div>
                <div>

                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {submission.student.fullName}
                  </h2>
                  <div className="text-xs text-indigo-700 font-medium">
                    Jenjang {submission.student.generation?.name || 'Santri'}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 rounded-xl shadow-2xs">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  +{submission.assignment.parentBonusPoints} Poin
                </span>
              </div>
            </div>

            {/* Task Title & Details */}
            <div className="pt-3 border-t border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {submission.assignment.taskType === TaskType.AUDIO_MEMORIZATION && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                    <Mic className="w-3 h-3" />
                    Tugas Audio Hafalan
                  </span>
                )}
                {submission.assignment.taskType === TaskType.DAILY_HABIT && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                    <CheckSquare className="w-3 h-3" />
                    Tugas Checklist Ibadah
                  </span>
                )}
                {submission.assignment.taskType === TaskType.WRITTEN_SUBMISSION && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-white border border-sky-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                    <FileText className="w-3 h-3" />
                    Tugas Foto / Lembar Kerja
                  </span>
                )}
                {submission.assignment.taskType === TaskType.QUIZ_ONLINE && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-white border border-amber-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                    <DicesIcon className="w-3 h-3" />
                    Kuis Online
                  </span>
                )}
              </div>

              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {submission.assignment.title}
              </h3>

              {submission.assignment.description && (
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {submission.assignment.description}
                </p>
              )}

              <div className="flex flex-col items-start gap-3 text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Pengajar: {submission.assignment.teacher.fullName}</span>
                </div>
                {submission.assignment.dueDate && (
                  <>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Batas: {new Date(submission.assignment.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </>
                )}
                {submission.assignment.material && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    {submission.assignment.material.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-4 sm:p-6">
            <ParentMagicVerifyForm
              submissionId={submission.id}
              magicToken={token}
              studentName={submission.student.fullName}
              taskTitle={submission.assignment.title}
              taskType={submission.assignment.taskType}
              submissionText={submission.submissionText}
              mediaFileUrl={submission.mediaFileUrl}
              attachmentUrl={submission.assignment.attachmentUrl}
              isAlreadyVerified={isAlreadyVerified}
              verifiedAt={submission.parentVerification?.verifiedAt ? submission.parentVerification.verifiedAt.toISOString() : null}
              existingFeedback={submission.parentVerification?.parentFeedback || null}
              parentBonusPoints={submission.assignment.parentBonusPoints}
            />
          </div>
        </div>

        {/* Secure Footer Note */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-medium text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Terverifikasi dengan Tanda Tangan Digital Kriptografi HMAC SHA-256</span>
          </div>
          <p>Sistem Pengajian Terstruktur • Kolaborasi Guru, Santri &amp; Orang Tua</p>
        </div>
      </div>
    </div>
  );
}
