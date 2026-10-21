'use client';

import React, { useState, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  HeartPulse,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileText,
  MessageSquare,
  ShieldCheck,
  ImageIcon,
} from 'lucide-react';
import { confirmStudentAbsenceRequest } from '@/app/izin/actions';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

interface ScheduleInfo {
  id: string;
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  venuePlaceName: string;
  notes?: string | null;
  organization: {
    id: string;
    name: string;
    type?: string;
  };
  class?: {
    id: string;
    name: string;
  } | null;
  targetClasses?: Array<{
    class: {
      id: string;
      name: string;
    };
  }>;
}

interface StudentInfo {
  id: string;
  fullName: string;
  gender?: string | null;
  avatarUrl?: string | null;
  generation?: {
    id: string;
    name: string;
  } | null;
}

interface SubmitterInfo {
  id: string;
  fullName: string;
  gender?: string | null;
  phoneNumber?: string | null;
}

interface ApprovalItem {
  id: string;
  approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
  action: string;
  notes?: string | null;
  createdAt: Date | string;
  approverUser: {
    id: string;
    fullName: string;
  };
}

interface RequestInfo {
  id: string;
  absenceType: 'IZIN' | 'SAKIT';
  notes: string;
  attachmentUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedCount: number;
  rejectedCount: number;
  createdAt: Date | string;
  schedule: ScheduleInfo;
  student: StudentInfo;
  submittedByUser: SubmitterInfo;
  approvals: ApprovalItem[];
}

interface ReviewerInfo {
  id: string;
  fullName: string;
  gender?: string | null;
}

interface Props {
  token: string;
  request: RequestInfo;
  approverUser: ReviewerInfo;
  approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
  myApproval?: ApprovalItem | null;
}

export default function StudentAbsenceConfirmClientView({
  token,
  request,
  approverUser,
  approverRole,
  myApproval: initialMyApproval,
}: Props) {
  const toast = useToast();
  const { open: openConfirm, ConfirmModalComponent } = useConfirm();
  const [myApproval, setMyApproval] = useState<ApprovalItem | null | undefined>(initialMyApproval);
  const [approvedCount, setApprovedCount] = useState(request.approvedCount);
  const [notesInput, setNotesInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const [isSubmitting, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const startDate = new Date(request.schedule.startTime);
  const endDate = new Date(request.schedule.endTime);

  const dayDateFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(startDate);

  const timeFormatted = `${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(startDate)} - ${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(endDate)} WIB`;

  const classNames =
    request.schedule.targetClasses && request.schedule.targetClasses.length > 0
      ? request.schedule.targetClasses.map((tc) => tc.class.name).join(', ')
      : request.schedule.class?.name || request.student.generation?.name || 'Seluruh Santri';

  const roleTitle =
    approverRole === 'PARENT'
      ? 'Orang Tua / Wali'
      : approverRole === 'HOMEROOM_TEACHER'
      ? 'Wali Kelas'
      : 'PJ Wilayah';

  // Handler Persetujuan
  const handleApprove = () => {
    openConfirm(
      {
        title: 'Konfirmasi Persetujuan Izin',
        description: `Konfirmasi persetujuan izin untuk ananda ${request.student.fullName}?`,
        variant: 'info',
        confirmText: 'Ya, Setujui',
        cancelText: 'Batal',
      },
      async () => {
        setFeedback(null);
        const res = await confirmStudentAbsenceRequest({
          token,
          action: 'APPROVE',
          notes: notesInput.trim() || undefined,
        });

        if (res.success) {
          setMyApproval({
            id: 'temp-' + Date.now(),
            approverRole,
            action: 'APPROVED',
            notes: notesInput.trim() || null,
            createdAt: new Date(),
            approverUser: { id: approverUser.id, fullName: approverUser.fullName },
          });
          if (res.currentApprovedCount) setApprovedCount(res.currentApprovedCount);
          setFeedback({
            type: 'success',
            message: res.message || 'Konfirmasi persetujuan berhasil disimpan.',
          });
          toast.success(res.message || 'Konfirmasi persetujuan berhasil disimpan.');
        } else {
          setFeedback({
            type: 'error',
            message: res.error || 'Gagal menyimpan konfirmasi.',
          });
          toast.error(res.error || 'Gagal menyimpan konfirmasi.');
        }
      }
    );
  };

  // Handler Penolakan
  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Mohon cantumkan alasan penolakan.');
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const res = await confirmStudentAbsenceRequest({
        token,
        action: 'REJECT',
        notes: rejectReason.trim(),
      });

      if (res.success) {
        setMyApproval({
          id: 'temp-' + Date.now(),
          approverRole,
          action: 'REJECTED',
          notes: rejectReason.trim(),
          createdAt: new Date(),
          approverUser: { id: approverUser.id, fullName: approverUser.fullName },
        });
        setShowRejectModal(false);
        setFeedback({
          type: 'success',
          message: 'Konfirmasi penolakan izin telah dicatat.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal memproses penolakan.',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
              📋
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Konfirmasi Izin Santri
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {request.schedule.organization.name}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
              {roleTitle}
            </span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-[130px]">
              {approverUser.fullName}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* Banner Alert Feedback */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl flex items-start space-x-3 text-xs leading-relaxed transition-all shadow-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                : 'bg-rose-50 text-rose-800 border border-rose-200/80'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {/* Status Verifikasi Peninjau Ini */}
        {myApproval && (
          <div
            className={`p-4 rounded-3xl border text-center space-y-1.5 shadow-xs ${
              myApproval.action === 'APPROVED'
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/90 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-center space-x-1.5 font-bold text-xs">
              {myApproval.action === 'APPROVED' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Anda Telah Menyetujui Permohonan Ini</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Anda Menolak Permohonan Ini</span>
                </>
              )}
            </div>
            {myApproval.notes && (
              <p className="text-xs italic bg-white/70 p-2 rounded-xl mt-1">
                &quot;{myApproval.notes}&quot;
              </p>
            )}
            <p className="text-[11px] text-slate-500 pt-1">
              Status akumulasi: <strong>{approvedCount}/2 persetujuan tercapai</strong>.
            </p>
          </div>
        )}

        {/* Ringkasan Sesi Jadwal */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                Jadwal Pengajian Terkait
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                {request.schedule.title}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Hari & Tanggal</p>
                <p className="font-semibold">{dayDateFormatted}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Waktu Sesi</p>
                <p className="font-semibold">{timeFormatted}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Lokasi / Tempat</p>
                <p className="font-semibold truncate max-w-[180px]">{request.schedule.venuePlaceName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <User className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Santri Pemohon</p>
                <p className="font-semibold truncate max-w-[180px]">{request.student.fullName}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Informasi Detail Permohonan Izin / Sakit */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Detail Alasan Berhalangan
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                request.absenceType === 'SAKIT'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {request.absenceType === 'SAKIT' ? '🏥 Sakit' : '✉️ Izin'}
            </span>
          </div>

          {/* Kartu Keterangan Alasan */}
          <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200/70 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-bold">
              <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
              <span>Catatan / Keterangan:</span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed font-medium bg-white/80 p-3 rounded-xl border border-amber-200/60 italic">
              &quot;{request.notes}&quot;
            </p>
          </div>

          {/* Lampiran Dokumen Foto Jika Ada */}
          {request.attachmentUrl && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Dokumen Pendukung:</span>
              </p>
              <div
                onClick={() => setShowImageModal(true)}
                className="inline-block relative cursor-pointer group rounded-2xl overflow-hidden border border-slate-200"
              >
                <img
                  src={request.attachmentUrl}
                  alt="Lampiran Izin"
                  className="w-32 h-32 object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                  Klik Perbesar
                </span>
              </div>
            </div>
          )}

          {/* Riwayat Persetujuan Lainnya */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Status Persetujuan ({approvedCount}/2 Dibutuhkan):
            </p>
            <div className="space-y-1.5 text-xs">
              {request.approvals.length === 0 ? (
                <p className="text-slate-400 italic text-[11px]">Belum ada pihak lain yang mengonfirmasi.</p>
              ) : (
                request.approvals.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-start justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{app.approverUser.fullName}</p>
                      <p className="text-[10px] text-slate-500">
                        {app.approverRole === 'PARENT'
                          ? 'Orang Tua'
                          : app.approverRole === 'HOMEROOM_TEACHER'
                          ? 'Wali Kelas'
                          : 'PJ Wilayah'}
                      </p>
                      {app.notes && (
                        <p className="text-[11px] text-slate-600 italic mt-0.5">
                          &quot;{app.notes}&quot;
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Disetujui
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Tindakan Konfirmasi (Jika belum dikonfirmasi oleh peninjau ini) */}
        {!myApproval && (
          <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tindakan Konfirmasi Anda
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sebagai {roleTitle}, mohon konfirmasi persetujuan ketidakhadiran santri ini.
              </p>
            </div>

            {/* Input Pesan / Doa Opsional untuk Santri */}
            <div>
              <label htmlFor="notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Pesan / Doa untuk Santri (Opsional)
              </label>
              <input
                id="notes"
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Contoh: Syafakallah, lekas sembuh ya ananda / Izin disetujui..."
                className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 bg-slate-50/50"
              />
            </div>

            {/* Tombol Aksi */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={isSubmitting}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Tolak Izin</span>
              </button>

              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui Izin</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Modal Dialog Penolakan */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Tolak Permohonan Izin
                </h3>
                <p className="text-[11px] text-slate-500">
                  Santri/wali akan menerima info penolakan ini
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="rejectReason" className="block text-xs font-bold text-slate-800 mb-1">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="rejectReason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Jadwal pengajian sangat penting untuk kelulusan materi, mohon diusahakan hadir..."
                className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600 bg-slate-50/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={isSubmitting}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center space-x-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Kirim Penolakan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Gambar Dokumen Pendukung */}
      {showImageModal && request.attachmentUrl && (
        <div
          onClick={() => setShowImageModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in cursor-pointer"
        >
          <div className="max-w-lg w-full relative">
            <img
              src={request.attachmentUrl}
              alt="Lampiran Dokumen Penuh"
              className="max-h-[85vh] w-auto mx-auto rounded-2xl shadow-2xl"
            />
            <p className="text-center text-white/80 text-xs mt-3">Klik di mana saja untuk menutup</p>
          </div>
        </div>
      )}
      <ConfirmModalComponent />
    </div>
  );
}
