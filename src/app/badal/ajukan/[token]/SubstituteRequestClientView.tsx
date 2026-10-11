'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  Users,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  submitSubstituteRequest,
  cancelSubstituteRequest,
  getSubstituteRequestStatus,
} from '@/app/badal/actions';

interface TeacherItem {
  id: string;
  fullName: string;
  gender?: string | null;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
}

interface ScheduleData {
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

interface SubstituteRequestData {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason?: string | null;
  actionNotes?: string | null;
  createdAt: Date | string;
  substituteTeacher: {
    id: string;
    fullName: string;
    gender?: string | null;
    avatarUrl?: string | null;
  };
  actionByUser?: {
    id: string;
    fullName: string;
  } | null;
}

interface Props {
  token: string;
  schedule: ScheduleData;
  requesterTeacher: TeacherItem;
  availableTeachers: TeacherItem[];
  initialRequest: SubstituteRequestData | null;
}

export default function SubstituteRequestClientView({
  token,
  schedule,
  requesterTeacher,
  availableTeachers,
  initialRequest,
}: Props) {
  const [currentRequest, setCurrentRequest] = useState<SubstituteRequestData | null>(initialRequest);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isCancelling, startCancelTransition] = useTransition();
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Jika status ditolak, beri opsi untuk membuka form pengajuan ulang
  const [isReapplying, setIsReapplying] = useState<boolean>(false);

  // Format tanggal & waktu
  const startDate = new Date(schedule.startTime);
  const endDate = new Date(schedule.endTime);

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
    schedule.targetClasses && schedule.targetClasses.length > 0
      ? schedule.targetClasses.map((tc) => tc.class.name).join(', ')
      : schedule.class?.name || 'Seluruh Santri';

  const materialNames =
    schedule.scheduleMaterials && schedule.scheduleMaterials.length > 0
      ? schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ')
      : 'Materi Rutin Terjadwal';

  // Polling function
  const checkStatus = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setIsPolling(true);
    try {
      const res = await getSubstituteRequestStatus(token);
      if (res.success && res.currentRequest) {
        setCurrentRequest(res.currentRequest as unknown as SubstituteRequestData);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Polling error:', e);
    } finally {
      if (showLoadingIndicator) setIsPolling(false);
    }
  };

  // Auto-refresh 10 detik saat tab aktif
  useEffect(() => {
    // Polling hanya aktif jika status saat ini PENDING
    if (currentRequest?.status !== 'PENDING') return;

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!intervalId) {
        intervalId = setInterval(() => {
          if (!document.hidden) {
            checkStatus(false);
          }
        }, 10000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkStatus(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentRequest?.status, token]);

  // Handler kirim pengajuan
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedTeacherId) {
      setFeedback({
        type: 'error',
        message: 'Silakan pilih Ustadz calon badal terlebih dahulu.',
      });
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'Mohon tuliskan alasan/catatan tidak dapat mengajar (minimal 3 karakter).',
      });
      return;
    }

    startSubmitTransition(async () => {
      const res = await submitSubstituteRequest({
        token,
        substituteTeacherId: selectedTeacherId,
        reason: reason.trim(),
      });

      if (res.success && res.request) {
        setCurrentRequest(res.request as unknown as SubstituteRequestData);
        setIsReapplying(false);
        setFeedback({
          type: 'success',
          message: 'Pengajuan Ustadz Badal berhasil dikirim ke WhatsApp calon badal & PJ Wilayah.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal mengajukan Ustadz badal.',
        });
      }
    });
  };

  // Handler batal pengajuan
  const handleCancel = () => {
    if (!currentRequest) return;
    if (!confirm('Apakah Anda yakin ingin membatalkan pengajuan Ustadz Badal ini?')) return;

    startCancelTransition(async () => {
      const res = await cancelSubstituteRequest({
        token,
        requestId: currentRequest.id,
      });

      if (res.success) {
        setCurrentRequest(null);
        setIsReapplying(false);
        setSelectedTeacherId('');
        setReason('');
        setFeedback({
          type: 'info',
          message: 'Pengajuan Ustadz Badal telah dibatalkan.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal membatalkan pengajuan.',
        });
      }
    });
  };

  const showForm =
    !currentRequest ||
    currentRequest.status === 'CANCELLED' ||
    (currentRequest.status === 'REJECTED' && isReapplying);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
              🕌
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Delegasi Guru Badal
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {schedule.organization.name}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              Ustadz Pengampu
            </span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-[130px]">
              {requesterTeacher.fullName}
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
                : feedback.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200/80'
                : 'bg-blue-50 text-blue-800 border border-blue-200/80'
            }`}
          >
            {feedback.type === 'success' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            {feedback.type === 'error' && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            {feedback.type === 'info' && (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {/* Kartu Ringkasan Sesi Jadwal */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Rincian Sesi Mengajar
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                {schedule.title}
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
                <p className="font-semibold truncate max-w-[180px]">{schedule.venuePlaceName}</p>
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

        {/* Kondisi 1: Form Pengajuan Badal */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Pilih Calon Ustadz Badal (Pengganti)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih rekan pengajar di {schedule.organization.name} yang diajukan untuk menggantikan sesi ini.
              </p>
            </div>

            {/* Daftar Calon Guru Badal */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availableTeachers.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                  Tidak ditemukan rekan pengajar lain di kelompok ini. Hubungi PJ Wilayah langsung.
                </div>
              ) : (
                availableTeachers.map((teacher) => {
                  const isSelected = selectedTeacherId === teacher.id;
                  return (
                    <label
                      key={teacher.id}
                      onClick={() => setSelectedTeacherId(teacher.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs'
                          : 'border-slate-200/90 hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {teacher.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">
                            {teacher.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {teacher.gender === 'FEMALE' ? 'Ustadzah' : 'Ustadz'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Form Input Catatan / Alasan Tidak Dapat Mengajar (Sesuai Permintaan Spesifik User) */}
            <div className="pt-2 border-t border-slate-100">
              <label
                htmlFor="reason"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Catatan / Alasan Tidak Dapat Mengajar <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tuliskan alasan berhalangan (misal: Sedang dinas luar kota, sakit, ada urusan keluarga mendesak)..."
                className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 placeholder:text-slate-400 bg-slate-50/50"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Catatan ini akan otomatis disisipkan ke pesan WhatsApp calon badal & PJ Wilayah.
                </span>
              </p>
            </div>

            {/* Tombol Ajukan */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !selectedTeacherId || !reason.trim()}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Permohonan ke WA...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Ajukan Ustadz Badal Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Kondisi 2: Status PENDING - Menunggu Konfirmasi */}
        {currentRequest && currentRequest.status === 'PENDING' && (
          <section className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold text-amber-800">
                  Menunggu Konfirmasi
                </span>
              </div>

              <button
                type="button"
                onClick={() => checkStatus(true)}
                disabled={isPolling}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/70 transition-colors"
                title="Cek update status sekarang"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isPolling ? 'animate-spin text-emerald-700' : ''}`}
                />
                <span>Cek Status</span>
              </button>
            </div>

            <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/70 space-y-2">
              <h3 className="text-xs font-bold text-amber-900">
                Permohonan Telah Dikirimkan
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Pesan WhatsApp permohonan delegasi telah dikirimkan ke calon Ustadz Badal dan PJ Wilayah. Halaman ini akan memperbarui status secara otomatis.
              </p>

              <div className="pt-2 border-t border-amber-200/60 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-amber-700/80">Calon Ustadz Badal:</span>
                  <span className="font-bold text-amber-900">
                    {currentRequest.substituteTeacher.fullName}
                  </span>
                </div>
                {currentRequest.reason && (
                  <div className="flex flex-col pt-1">
                    <span className="text-amber-700/80 text-[11px]">Catatan / Alasan:</span>
                    <span className="font-medium text-amber-950 italic bg-white/70 p-2 rounded-xl border border-amber-200/50 mt-1">
                      &quot;{currentRequest.reason}&quot;
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Indikator Auto-Refresh 10 Detik */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Auto-refresh real-time aktif (setiap 10 detik)</span>
              </div>
              <span>
                Update:{' '}
                {lastUpdated.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            {/* Tombol Batalkan Pengajuan */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Batalkan Pengajuan Ini</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* Kondisi 3: Status APPROVED - Disetujui */}
        {currentRequest && currentRequest.status === 'APPROVED' && (
          <section className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Pengajuan Selesai
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Alhamdulillah, Permohonan Disetujui!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                Tugas mengajar untuk sesi ini telah resmi didelegasikan kepada:{' '}
                <strong className="text-emerald-700">
                  {currentRequest.substituteTeacher.fullName}
                </strong>
                .
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left border border-slate-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Guru Badal:</span>
                <span className="font-bold text-slate-900">
                  {currentRequest.substituteTeacher.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disetujui Oleh:</span>
                <span className="font-bold text-slate-900">
                  {currentRequest.actionByUser?.fullName || 'Pihak Terkait'}
                </span>
              </div>
              {currentRequest.actionNotes && (
                <div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-slate-500 text-[11px]">Catatan Persetujuan:</span>
                  <p className="font-medium text-slate-800 italic mt-0.5">
                    &quot;{currentRequest.actionNotes}&quot;
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Jadwal di aplikasi telah diperbarui secara otomatis. Jazakumullahu Khairan.
            </p>
          </section>
        )}

        {/* Kondisi 4: Status REJECTED - Ditolak */}
        {currentRequest && currentRequest.status === 'REJECTED' && !isReapplying && (
          <section className="bg-white rounded-3xl p-6 border border-rose-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <XCircle className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                Pengajuan Ditolak
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Permohonan Belum Dapat Disetujui
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                Rekan pengajar yang diajukan ({currentRequest.substituteTeacher.fullName}) atau PJ Wilayah belum dapat menerima permohonan ini.
              </p>
            </div>

            {currentRequest.actionNotes && (
              <div className="bg-rose-50/70 rounded-2xl p-4 text-xs text-left border border-rose-200/60">
                <p className="text-[11px] text-rose-800 font-bold uppercase tracking-wider">
                  Alasan / Catatan Penolakan:
                </p>
                <p className="font-medium text-rose-950 mt-1 italic">
                  &quot;{currentRequest.actionNotes}&quot;
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsReapplying(true);
                  setSelectedTeacherId('');
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-[0.99]"
              >
                <span>Ajukan ke Calon Badal Lain</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
