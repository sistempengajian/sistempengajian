'use client';

import React, { useState, useTransition } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Loader2,
  Users,
  HeartPulse,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  QrCode,
  ChevronRight,
  Lock,
  Info,
} from 'lucide-react';
import { submitFamilyChildAbsence } from '@/app/keluarga/actions';

interface StudentItem {
  student: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    gender: string;
    generation?: { id: string; name: string } | null;
    organization?: { id: string; name: string } | null;
  };
  relationshipType?: string | null;
  isParticipant?: boolean;
  otherScheduleInfo?: {
    id: string;
    title: string;
    time: string;
  } | null;
  statusBadge:
    | 'HADIR'
    | 'TERLAMBAT'
    | 'ABSENCE_PENDING'
    | 'ABSENCE_APPROVED'
    | 'ABSENCE_REJECTED'
    | 'NOT_CHECKED_IN'
    | 'NOT_PARTICIPANT';
  attendanceRecord?: {
    status: string;
    checkInTime?: string | null;
    method?: string | null;
    notes?: string | null;
  } | null;
  absenceRequest?: {
    id?: string;
    absenceType: 'IZIN' | 'SAKIT';
    reason: string;
    status: string;
  } | null;
  directPresensiUrl?: string;
}

interface FamilyActionHubProps {
  token: string;
  parent: {
    id: string;
    fullName: string;
    gender: string;
    phoneNumber?: string | null;
    organization?: { id: string; name: string } | null;
  };
  schedule: {
    id: string;
    title: string;
    dayDate: string;
    startTime: string;
    endTime: string;
    venuePlaceName: string;
    notes?: string | null;
    organizationName: string;
    teachers: string;
    materials: string;
  };
  initialChildrenData: StudentItem[];
}

export default function FamilyActionHubClientView({
  token,
  parent,
  schedule,
  initialChildrenData,
}: FamilyActionHubProps) {
  const [children, setChildren] = useState<StudentItem[]>(initialChildrenData);
  const [openAbsenceFormStudentId, setOpenAbsenceFormStudentId] = useState<string | null>(null);
  const [absenceTypeMap, setAbsenceTypeMap] = useState<Record<string, 'SAKIT' | 'IZIN'>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [activeMessage, setActiveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isPending, startTransition] = useTransition();

  const handleSubmitAbsence = (studentId: string, studentName: string) => {
    setActiveMessage(null);
    const absenceType = absenceTypeMap[studentId] || 'SAKIT';
    const notes = (notesMap[studentId] || '').trim();

    if (!notes || notes.length < 3) {
      setActiveMessage({
        type: 'error',
        text: 'Mohon tuliskan alasan berhalangan hadir dengan jelas (minimal 3 karakter).',
      });
      return;
    }

    startTransition(async () => {
      const res = await submitFamilyChildAbsence({
        token,
        studentId,
        scheduleId: schedule.id,
        absenceType,
        notes,
      });

      if (res.success) {
        setChildren((prev) =>
          prev.map((c) =>
            c.student.id === studentId
              ? {
                  ...c,
                  statusBadge: 'ABSENCE_PENDING',
                  absenceRequest: {
                    absenceType,
                    reason: notes,
                    status: 'PENDING',
                  },
                }
              : c
          )
        );
        setOpenAbsenceFormStudentId(null);
        setActiveMessage({
          type: 'success',
          text: res.message || `Surat izin ${studentName} berhasil dikirimkan ke Wali Kelas.`,
        });
      } else {
        setActiveMessage({
          type: 'error',
          text: res.error || 'Gagal mengirimkan pengajuan izin.',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100/70 to-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header Branding */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            Portal Aksi Pengajian Keluarga
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
            {schedule.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5 text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              {schedule.dayDate}
            </span>
            <span className="flex items-center gap-1.5 text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              {schedule.startTime} - {schedule.endTime} WIB
            </span>
            <span className="flex items-center gap-1.5 text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              {schedule.venuePlaceName}
            </span>
          </div>

          {/* Sapaan Orang Tua */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">
              Wali Santri:{' '}
              <span className="font-bold text-slate-800">
                {parent.gender === 'FEMALE' ? 'Ibu' : 'Bapak'} {parent.fullName}
              </span>
            </div>
            <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
              {schedule.organizationName}
            </div>
          </div>
        </div>

        {/* Notifikasi Status Aksi */}
        {activeMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all animate-in fade-in-50 duration-200 ${
              activeMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {activeMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="flex-1">{activeMessage.text}</p>
          </div>
        )}

        {/* Section Title */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Daftar Santri ({children.length} Ananda)
          </h2>
          <span className="text-[11px] text-slate-500">Pemantauan &amp; Perizinan Terpadu</span>
        </div>

        {/* Cards Per Child */}
        <div className="space-y-4">
          {children.map((item) => {
            const student = item.student;
            const isNotParticipant = item.statusBadge === 'NOT_PARTICIPANT' || item.isParticipant === false;
            const isFormOpen = openAbsenceFormStudentId === student.id;
            const currentAbsenceType = absenceTypeMap[student.id] || 'SAKIT';
            const currentNotes = notesMap[student.id] || '';

            return (
              <div
                key={student.id}
                className={`rounded-3xl p-5 sm:p-6 shadow-xs border transition-all ${
                  isNotParticipant
                    ? 'bg-slate-50/80 border-slate-200/90'
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Child Header Info */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 border ${
                        isNotParticipant
                          ? 'bg-slate-100 border-slate-200 text-slate-500'
                          : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                      }`}
                    >
                      {student.avatarUrl ? (
                        <img
                          src={student.avatarUrl}
                          alt={student.fullName}
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        student.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex gap-2 items-center">
                        <h3
                          className={`text-base font-bold leading-snug ${
                            isNotParticipant ? 'text-slate-700' : 'text-slate-900'
                          }`}
                        >
                          {student.fullName}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isNotParticipant
                                ? 'bg-slate-200/70 text-slate-600'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {student.generation?.name || 'Santri'}
                          </span>
                        </div>
                      </div>
                      {student.organization && (
                        <span className="text-[11px] text-slate-500">
                          {student.organization.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {item.statusBadge === 'NOT_PARTICIPANT' && (
                      <div className="flex flex-col items-start min-[400px]:items-end">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Info className="w-3.5 h-3.5 text-slate-500" />
                          Bukan Peserta Sesi Ini
                        </span>
                      </div>
                    )}

                    {item.statusBadge === 'HADIR' && (
                      <div className="flex flex-col items-start min-[400px]:items-end">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Sudah Hadir
                        </span>
                        {item.attendanceRecord?.checkInTime && (
                          <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                            Presensi {item.attendanceRecord.checkInTime}
                            {item.attendanceRecord.method ? ` • ${item.attendanceRecord.method}` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {item.statusBadge === 'TERLAMBAT' && (
                      <div className="flex flex-col items-start min-[400px]:items-end">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Hadir Terlambat
                        </span>
                        {item.attendanceRecord?.checkInTime && (
                          <span className="text-[10px] text-amber-600 font-medium mt-0.5">
                            Presensi {item.attendanceRecord.checkInTime}
                          </span>
                        )}
                      </div>
                    )}

                    {item.statusBadge === 'ABSENCE_PENDING' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Izin Menunggu Verifikasi Wali Kelas
                      </span>
                    )}

                    {item.statusBadge === 'ABSENCE_APPROVED' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Izin Disetujui
                      </span>
                    )}

                    {item.statusBadge === 'ABSENCE_REJECTED' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        Izin Ditolak
                      </span>
                    )}

                    {item.statusBadge === 'NOT_CHECKED_IN' && (
                      <div className="flex flex-col items-start min-[400px]:items-end">
                        <a
                          href={
                            item.directPresensiUrl ||
                            `/auth/direct?target=presensi_ortu&scheduleId=${schedule.id}&studentId=${student.id}&token=${token}`
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-95 group cursor-pointer"
                          title="Buka halaman presensi orang tua (absen ananda jika tidak membawa HP)"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                          <span className="text-[11px] text-indigo-600 group-hover:text-indigo-700 font-semibold flex items-center gap-1">
                            Belum Presensi
                            <QrCode className="w-3.5 h-3.5" />
                          </span>
                        </a>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Klik untuk melakukan presensi
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Rincian Jika Bukan Peserta Sesi Ini */}
                {isNotParticipant && (
                  <div className="mt-4">
                    {item.otherScheduleInfo ? (
                      <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-amber-900">
                          <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          Terdaftar di Sesi Lain Hari Ini:
                        </div>
                        <div className="font-semibold text-slate-900 pl-5.5">
                          {item.otherScheduleInfo.title}
                        </div>
                        <div className="text-[11px] text-amber-700 pl-5.5">
                          Waktu: {item.otherScheduleInfo.time}
                        </div>
                        <div className="text-[10.5px] text-slate-500 pl-5.5 pt-0.5">
                          *Pengajuan izin dan presensi ananda dapat diakses melalui link pesan pengingat khusus untuk sesi tersebut.
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-700">Tidak Ada Jadwal Pengajian Hari Ini</span>
                          <p className="text-[11px] text-slate-500">
                            Ananda tidak memiliki agenda sesi pengajian yang terjadwal untuk hari ini.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Info Rincian Jika Sudah Mengajukan Izin */}
                {!isNotParticipant && item.absenceRequest && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-700 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Alasan Ketidakhadiran: {item.absenceRequest.absenceType === 'SAKIT' ? 'Sakit' : 'Izin'}
                    </div>
                    <p className="text-slate-600 italic">
                      "{item.absenceRequest.reason}"
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {isNotParticipant ? (
                  <div className="mt-4 pt-3.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Izin terkunci karena ananda bukan peserta sesi ini.
                    </span>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Izin Terkunci
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs">
                      {item.statusBadge === 'HADIR' || item.statusBadge === 'TERLAMBAT' ? (
                        <span className="text-emerald-700 font-semibold inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          Ananda telah terverifikasi hadir di lokasi oleh Pengajar.
                        </span>
                      ) : item.statusBadge === 'ABSENCE_APPROVED' ? (
                        <span className="text-blue-700 font-semibold inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          Permohonan izin ananda telah disetujui.
                        </span>
                      ) : item.statusBadge === 'ABSENCE_PENDING' ? (
                        <span className="text-amber-700 font-semibold inline-flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          Surat izin telah terkirim dan menunggu konfirmasi Wali Kelas.
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Presensi oleh pengajar di lokasi atau melalui presensi mandiri orang tua di atas.
                        </span>
                      )}
                    </div>

                    {/* Tombol Toggle Form Izin (Hanya jika belum hadir di masjid) */}
                    {item.statusBadge !== 'HADIR' && item.statusBadge !== 'TERLAMBAT' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          setOpenAbsenceFormStudentId(isFormOpen ? null : student.id)
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 transition-colors shadow-2xs active:scale-95 cursor-pointer shrink-0"
                      >
                        <HeartPulse className="w-4 h-4 text-rose-600" />
                        {item.absenceRequest ? 'Ubah Pengajuan Izin' : 'Ajukan Izin / Sakit'}
                        {isFormOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Form Accordion Pengajuan Izin */}
                {!isNotParticipant && isFormOpen && (
                  <div className="p-4 rounded-2xl space-y-4 animate-in fade-in-50 duration-200">
                    <div className="text-xs font-bold text-slate-800">
                      Pilih Jenis & Tulis Alasan Izin untuk {student.fullName}:
                    </div>

                    {/* Radio Jenis Izin */}
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          currentAbsenceType === 'SAKIT'
                            ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`absenceType_${student.id}`}
                          value="SAKIT"
                          checked={currentAbsenceType === 'SAKIT'}
                          onChange={() =>
                            setAbsenceTypeMap((prev) => ({
                              ...prev,
                              [student.id]: 'SAKIT',
                            }))
                          }
                          className="sr-only"
                        />
                        <HeartPulse className="w-4 h-4 text-rose-600" />
                        Sakit
                      </label>

                      <label
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          currentAbsenceType === 'IZIN'
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`absenceType_${student.id}`}
                          value="IZIN"
                          checked={currentAbsenceType === 'IZIN'}
                          onChange={() =>
                            setAbsenceTypeMap((prev) => ({
                              ...prev,
                              [student.id]: 'IZIN',
                            }))
                          }
                          className="sr-only"
                        />
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Izin Keluarga / Acara
                      </label>
                    </div>

                    {/* Input Alasan */}
                    <div>
                      <textarea
                        rows={2}
                        value={currentNotes}
                        onChange={(e) =>
                          setNotesMap((prev) => ({
                            ...prev,
                            [student.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          currentAbsenceType === 'SAKIT'
                            ? 'Contoh: Mengalami demam dan flu, sedang istirahat di rumah...'
                            : 'Contoh: Ada keperluan keluarga mendadak ke luar kota...'
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    {/* Tombol Kirim Form Izin */}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenAbsenceFormStudentId(null)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !currentNotes.trim()}
                        onClick={() => handleSubmitAbsence(student.id, student.fullName)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Kirimkan Surat Izin
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Card Pengurus */}
        <div className="p-4 rounded-3xl bg-slate-200/50 text-slate-600 text-xs text-center leading-relaxed">
          Tautan portal ini adalah tautan resmi pengajian keluarga yang dapat diakses langsung tanpa perlu kata sandi. 
          Pembaruan status presensi santri di majelis oleh Ustadz akan otomatis tampil secara langsung di halaman ini.
        </div>
      </div>
    </div>
  );
}
