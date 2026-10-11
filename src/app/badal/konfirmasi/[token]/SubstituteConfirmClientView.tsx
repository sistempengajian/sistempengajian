'use client';

import React, { useState, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { confirmSubstituteRequest } from '@/app/badal/actions';

interface TeacherInfo {
  id: string;
  fullName: string;
  gender?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

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
  scheduleMaterials?: Array<{
    material: {
      id: string;
      title: string;
      description?: string | null;
    };
  }>;
}

interface RequestInfo {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string | null;
  actionNotes?: string | null;
  actionAt?: Date | string | null;
  createdAt: Date | string;
  schedule: ScheduleInfo;
  requesterTeacher: TeacherInfo;
  substituteTeacher: TeacherInfo;
  actionByUser?: {
    id: string;
    fullName: string;
  } | null;
}

interface ReviewerInfo {
  id: string;
  fullName: string;
  gender?: string | null;
}

interface Props {
  token: string;
  request: RequestInfo;
  reviewer: ReviewerInfo;
  targetRole: 'SUBSTITUTE' | 'PJ';
}

export default function SubstituteConfirmClientView({
  token,
  request,
  reviewer,
  targetRole,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(request.status);
  const [actionNotes, setActionNotes] = useState(request.actionNotes || '');

  const [notesInput, setNotesInput] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

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
      : request.schedule.class?.name || 'Seluruh Santri';

  const materialNames =
    request.schedule.scheduleMaterials && request.schedule.scheduleMaterials.length > 0
      ? request.schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ')
      : 'Materi Rutin Terjadwal';

  const isSubstituteReviewer = targetRole === 'SUBSTITUTE';

  // Handler Persetujuan
  const handleApprove = () => {
    if (!confirm('Apakah Anda bersedia menyetujui permohonan guru badal ini?')) return;

    setFeedback(null);
    startTransition(async () => {
      const res = await confirmSubstituteRequest({
        token,
        action: 'APPROVE',
        notes: notesInput.trim() || undefined,
      });

      if (res.success) {
        setCurrentStatus('APPROVED');
        setActionNotes(notesInput.trim() || '');
        setFeedback({
          type: 'success',
          message: res.message || 'Permohonan berhasil disetujui!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal memproses persetujuan.',
        });
      }
    });
  };

  // Handler Penolakan
  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('Mohon cantumkan alasan penolakan permohonan.');
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const res = await confirmSubstituteRequest({
        token,
        action: 'REJECT',
        notes: rejectReason.trim(),
      });

      if (res.success) {
        setCurrentStatus('REJECTED');
        setActionNotes(rejectReason.trim());
        setShowRejectModal(false);
        setFeedback({
          type: 'success',
          message: 'Permohonan telah ditolak. Pengajar pemohon telah diberitahu via WhatsApp.',
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
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              🕌
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Konfirmasi Guru Badal
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {request.schedule.organization.name}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isSubstituteReviewer
                  ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                  : 'bg-purple-50 text-purple-700 border-purple-200/70'
              }`}
            >
              {isSubstituteReviewer ? 'Calon Badal' : 'PJ Wilayah'}
            </span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-[130px]">
              {reviewer.fullName}
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

        {/* Status Card Jika Sudah Selesai */}
        {currentStatus === 'APPROVED' && (
          <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-200/80 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-sm font-bold text-emerald-900">
              Permohonan Guru Badal Telah Disetujui
            </h2>
            <p className="text-xs text-emerald-800">
              Pengajar pemohon telah menerima pemberitahuan resmi via WhatsApp. Sesi ini resmi digantikan oleh{' '}
              <strong>{request.substituteTeacher.fullName}</strong>.
            </p>
            {actionNotes && (
              <div className="pt-2 text-xs text-emerald-900 italic font-medium">
                &quot;{actionNotes}&quot;
              </div>
            )}
          </div>
        )}

        {currentStatus === 'REJECTED' && (
          <div className="bg-rose-50 rounded-3xl p-5 border border-rose-200/80 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <XCircle className="w-7 h-7" />
            </div>
            <h2 className="text-sm font-bold text-rose-900">
              Permohonan Guru Badal Telah Ditolak
            </h2>
            <p className="text-xs text-rose-800">
              Pengajar pemohon telah menerima pemberitahuan via WhatsApp untuk memilih pengajar pengganti lainnya.
            </p>
            {actionNotes && (
              <div className="pt-2 text-xs text-rose-900 italic font-medium">
                Alasan: &quot;{actionNotes}&quot;
              </div>
            )}
          </div>
        )}

        {/* Ringkasan Sesi Jadwal */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Jadwal Pengajian
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                {request.schedule.title}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Hari & Tanggal</p>
                <p className="font-semibold">{dayDateFormatted}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Waktu Sesi</p>
                <p className="font-semibold">{timeFormatted}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Lokasi / Tempat</p>
                <p className="font-semibold truncate max-w-[180px]">
                  {request.schedule.venuePlaceName}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Target Santri</p>
                <p className="font-semibold truncate max-w-[180px]">{classNames}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-2.5 text-xs text-slate-700 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/70">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                Materi Ajar
              </p>
              <p className="font-medium text-slate-800 mt-0.5">{materialNames}</p>
            </div>
          </div>
        </section>

        {/* Informasi Pendelegasian & Alasan Berhalangan (Sesuai Permintaan Spesifik User) */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Detail Delegasi Pengajar
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 block">
                Ustadz Pengampu (Pemohon)
              </span>
              <p className="font-bold text-slate-900 mt-1">{request.requesterTeacher.fullName}</p>
              <p className="text-[11px] text-slate-500">Berhalangan hadir</p>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-100">
              <span className="text-[10px] font-semibold text-emerald-700 block">
                Calon Ustadz Badal
              </span>
              <p className="font-bold text-emerald-950 mt-1">{request.substituteTeacher.fullName}</p>
              <p className="text-[11px] text-emerald-700">Diajukan menggantikan</p>
            </div>
          </div>

          {/* Kartu Alasan Berhalangan Mengajar (Highlight Spesifik) */}
          <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/80 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-amber-900 text-xs font-bold">
              <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
              <span>Alasan / Catatan Berhalangan Mengajar:</span>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed font-medium bg-white/80 p-3 rounded-xl border border-amber-200/60 italic">
              &quot;{request.reason || 'Tidak ada catatan tambahan.'}&quot;
            </p>
          </div>
        </section>

        {/* Formulir Aksi (Hanya jika masih PENDING) */}
        {currentStatus === 'PENDING' && (
          <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tindakan Konfirmasi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isSubstituteReviewer
                  ? 'Sebagai calon Ustadz Badal, mohon konfirmasi kesediaan Anda menggantikan sesi ini.'
                  : 'Sebagai PJ Wilayah, Anda dapat menyetujui atau menolak pendelegasian guru badal ini.'}
              </p>
            </div>

            {/* Input Catatan Opsional Persetujuan */}
            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Catatan Persetujuan (Opsional)
              </label>
              <input
                id="notes"
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Misal: Siap menggantikan / Sudah diselaraskan..."
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
                <span>Tolak Permohonan</span>
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
                    <span>
                      {isSubstituteReviewer ? 'Bersedia (Setujui)' : 'Setujui Permohonan'}
                    </span>
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
                  Tolak Permohonan Badal
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pengajar pemohon akan menerima info ini
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="rejectReason"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="rejectReason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Sedang ada agenda mendesak di waktu bersamaan / belum bisa hadir..."
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
    </div>
  );
}
