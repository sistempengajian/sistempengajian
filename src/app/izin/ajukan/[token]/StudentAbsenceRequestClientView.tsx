'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  HeartPulse,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Info,
  ShieldCheck,
  XCircle,
  ImageIcon,
} from 'lucide-react';
import {
  submitStudentAbsenceRequest,
  getStudentAbsenceRequestStatus,
} from '@/app/izin/actions';
import { useToast } from '@/components/ui/Toast';

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

interface StudentData {
  id: string;
  fullName: string;
  gender?: string | null;
  avatarUrl?: string | null;
  generation?: {
    id: string;
    name: string;
  } | null;
}

interface SubmitterData {
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

interface CurrentRequestData {
  id: string;
  absenceType: 'IZIN' | 'SAKIT';
  notes: string;
  attachmentUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approvedCount: number;
  rejectedCount: number;
  createdAt: Date | string;
  approvals: ApprovalItem[];
}

interface Props {
  token: string;
  schedule: ScheduleData;
  student: StudentData;
  submitter: SubmitterData;
  submitterRole: 'STUDENT' | 'PARENT';
  initialRequest: CurrentRequestData | null;
}

export default function StudentAbsenceRequestClientView({
  token,
  schedule,
  student,
  submitter,
  submitterRole,
  initialRequest,
}: Props) {
  const toast = useToast();
  const [currentRequest, setCurrentRequest] = useState<CurrentRequestData | null>(initialRequest);
  const [absenceType, setAbsenceType] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [notes, setNotes] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

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
      : schedule.class?.name || student.generation?.name || 'Seluruh Santri';

  const materialNames =
    schedule.scheduleMaterials && schedule.scheduleMaterials.length > 0
      ? schedule.scheduleMaterials.map((sm) => sm.material.title).join(', ')
      : 'Materi Rutin Terjadwal';

  // Handle upload foto lampiran (resize / base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error('Ukuran file foto maksimal 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachmentBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Polling function
  const checkStatus = async (showLoading = false) => {
    if (showLoading) setIsPolling(true);
    try {
      const res = await getStudentAbsenceRequestStatus(token);
      if (res.success && res.currentRequest) {
        setCurrentRequest(res.currentRequest as unknown as CurrentRequestData);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Polling error:', e);
    } finally {
      if (showLoading) setIsPolling(false);
    }
  };

  // Auto-refresh 10 detik saat tab aktif
  useEffect(() => {
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

    const handleVisibility = () => {
      if (!document.hidden) {
        checkStatus(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentRequest?.status, token]);

  // Submit pengajuan
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!notes.trim() || notes.trim().length < 3) {
      setFeedback({
        type: 'error',
        message: 'Mohon tuliskan keterangan alasan berhalangan dengan jelas (minimal 3 karakter).',
      });
      return;
    }

    startSubmitTransition(async () => {
      const res = await submitStudentAbsenceRequest({
        token,
        absenceType,
        notes: notes.trim(),
        attachmentUrl: attachmentBase64 || undefined,
        website_url: honeypot,
      });

      if (res.success && res.request) {
        setCurrentRequest(res.request as unknown as CurrentRequestData);
        setFeedback({
          type: 'success',
          message: 'Permohonan izin berhasil dikirimkan ke pihak terkait untuk verifikasi.',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal mengajukan izin.',
        });
      }
    });
  };

  const showForm = !currentRequest || currentRequest.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-xs">
              📝
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Permohonan Izin Santri
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {schedule.organization.name}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
              {submitterRole === 'PARENT' ? 'Wali Santri' : 'Santri'}
            </span>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate max-w-[130px]">
              {student.fullName}
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
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
          </div>
        )}

        {/* Kartu Ringkasan Sesi Jadwal */}
        <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                Jadwal Pengajian Terkait
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                {schedule.title}
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
                <p className="font-semibold truncate max-w-[180px]">{schedule.venuePlaceName}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-slate-700 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
              <User className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Santri Pemohon</p>
                <p className="font-semibold truncate max-w-[180px]">{student.fullName}</p>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-2.5 text-xs text-slate-700 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/70">
            <BookOpen className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                Materi Ajar
              </p>
              <p className="font-medium text-slate-800 mt-0.5">{materialNames}</p>
            </div>
          </div>
        </section>

        {/* Kondisi 1: Form Pengajuan Izin */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4"
          >
            {/* Bot Honeypot Input */}
            <input
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pilih Jenis Ketidakhadiran
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pilih jenis alasan berhalangan hadir pada sesi ini.
              </p>
            </div>

            {/* Pilihan Radio: Izin vs Sakit */}
            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setAbsenceType('IZIN')}
                className={`flex items-center space-x-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  absenceType === 'IZIN'
                    ? 'border-amber-500 bg-amber-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    absenceType === 'IZIN' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  ✉️
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Izin</p>
                  <p className="text-[11px] text-slate-500">Acara / Keperluan</p>
                </div>
              </label>

              <label
                onClick={() => setAbsenceType('SAKIT')}
                className={`flex items-center space-x-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  absenceType === 'SAKIT'
                    ? 'border-rose-500 bg-rose-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                    absenceType === 'SAKIT' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Sakit</p>
                  <p className="text-[11px] text-slate-500">Kondisi Medis</p>
                </div>
              </label>
            </div>

            {/* Textarea Catatan / Alasan */}
            <div>
              <label htmlFor="notes" className="block text-xs font-bold text-slate-900 mb-1">
                Keterangan / Alasan Berhalangan <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  absenceType === 'SAKIT'
                    ? 'Contoh: Mengalami demam dan batuk sejak pagi, disarankan dokter istirahat...'
                    : 'Contoh: Menghadiri acara keluarga di luar kota / kegiatan sekolah yang tidak bisa ditinggalkan...'
                }
                className="w-full text-xs p-3 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 placeholder:text-slate-400 bg-slate-50/50"
                required
              />
            </div>

            {/* Unggah Dokumen Pendukung (Foto Surat Dokter / Bukti) */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Lampiran Dokumen Pendukung (Opsional)
              </label>
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-slate-100/60 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {attachmentBase64 ? (
                  <div className="flex items-center justify-center space-x-3">
                    <img
                      src={attachmentBase64}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-200"
                    />
                    <div className="text-left text-xs">
                      <p className="font-bold text-emerald-700">Foto Terlampir</p>
                      <p className="text-[11px] text-slate-500">Klik untuk mengganti foto</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-5 h-5 mx-auto text-slate-400" />
                    <p className="text-xs font-medium text-slate-700">
                      Unggah Foto Surat Dokter / Bukti Kegiatan
                    </p>
                    <p className="text-[11px] text-slate-400">JPG, PNG (Maks. 4MB)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Kirim */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !notes.trim()}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim Permohonan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Permohonan Izin Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Kondisi 2: Status PENDING - Menunggu Konfirmasi Multi-Pihak */}
        {currentRequest && currentRequest.status === 'PENDING' && (
          <section className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-bold text-amber-800">
                  Menunggu Persetujuan ({currentRequest.approvedCount}/2)
                </span>
              </div>

              <button
                type="button"
                onClick={() => checkStatus(true)}
                disabled={isPolling}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/70 transition-colors"
                title="Cek update status sekarang"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isPolling ? 'animate-spin text-amber-700' : ''}`}
                />
                <span>Cek Status</span>
              </button>
            </div>

            <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-200/70 space-y-2 text-xs">
              <p className="text-amber-900 leading-relaxed font-medium">
                Permohonan <strong>{currentRequest.absenceType === 'SAKIT' ? 'Sakit' : 'Izin'}</strong> telah dikirim ke WhatsApp Orang Tua, Wali Kelas, dan PJ Wilayah.
              </p>
              <p className="text-[11px] text-amber-800">
                <em>Jika telah disetujui minimal 2 pihak, status absensi pada sesi pengajian akan otomatis tercatat menjadi {currentRequest.absenceType}.</em>
              </p>

              <div className="pt-2 border-t border-amber-200/60 space-y-1.5">
                <p className="text-[11px] text-amber-700/80 font-bold uppercase tracking-wider">
                  Keterangan Alasan:
                </p>
                <p className="italic bg-white/80 p-2.5 rounded-xl border border-amber-200/50">
                  &quot;{currentRequest.notes}&quot;
                </p>
              </div>

              {/* Riwayat Persetujuan */}
              <div className="pt-2 border-t border-amber-200/60">
                <p className="text-[11px] font-bold text-amber-900 mb-1">
                  Riwayat Konfirmasi:
                </p>
                {currentRequest.approvals.length === 0 ? (
                  <p className="text-[11px] text-amber-700 italic">Belum ada konfirmasi masuk.</p>
                ) : (
                  <div className="space-y-1">
                    {currentRequest.approvals.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between bg-white/90 p-2 rounded-xl border border-amber-200/60 text-[11px]"
                      >
                        <div className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-slate-800">
                            {app.approverUser.fullName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ({app.approverRole === 'PARENT' ? 'Ortu' : app.approverRole === 'HOMEROOM_TEACHER' ? 'Wali Kelas' : 'PJ'})
                          </span>
                        </div>
                        <span className="text-emerald-700 font-bold">Disetujui</span>
                      </div>
                    ))}
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
          </section>
        )}

        {/* Kondisi 3: Status APPROVED - Disetujui Penuh */}
        {currentRequest && currentRequest.status === 'APPROVED' && (
          <section className="bg-white rounded-3xl p-6 border border-emerald-200 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Permohonan Terverifikasi
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Alhamdulillah, Izin Resmi Disetujui!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                Permohonan {currentRequest.absenceType === 'SAKIT' ? 'Sakit' : 'Izin'} telah disetujui oleh minimal 2 pihak. Status kehadiran santri pada presensi pengajar telah otomatis tercatat.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left border border-slate-100 space-y-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Daftar Pihak yang Menyetujui:
              </p>
              {currentRequest.approvals.map((app) => (
                <div key={app.id} className="border-b border-slate-200/50 pb-1.5 last:border-none">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span>{app.approverUser.fullName}</span>
                    <span className="text-emerald-700 text-[11px]">
                      {app.approverRole === 'PARENT' ? 'Orang Tua' : app.approverRole === 'HOMEROOM_TEACHER' ? 'Wali Kelas' : 'PJ Wilayah'}
                    </span>
                  </div>
                  {app.notes && (
                    <p className="text-[11px] text-slate-600 italic mt-0.5">
                      &quot;{app.notes}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
