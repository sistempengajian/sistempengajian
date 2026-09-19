'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Clock,
  Search,
  CheckCheck,
  AlertTriangle,
  UserCheck,
  Filter,
  Users,
  RefreshCw,
  Loader2,
  FileText,
  ExternalLink,
  X,
  Check,
  HeartPulse,
  Info,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { recordManualAttendance, markAllPresent, verifyAbsenceConfirmation } from '@/app/(protected)/presensi/actions';
import { AttendanceStatus, AttendanceMethod, AbsenceConfirmationStatus } from '@prisma/client';

export interface AbsenceConfirmationItem {
  id: string;
  status: AbsenceConfirmationStatus;
  reasonType: string | null;
  parentNotes?: string | null;
  attachmentUrl?: string | null;
  parentName?: string | null;
  confirmedAt?: string | null;
}

export interface StudentAttendanceItem {
  id: string;
  fullName: string;
  generationId?: string;
  generationName?: string;
  classId?: string;
  className?: string;
  currentStatus: AttendanceStatus;
  method?: AttendanceMethod;
  notes?: string | null;
  checkInTime?: string | null;
  absenceConfirmation?: AbsenceConfirmationItem | null;
}

interface ManualAttendanceSheetProps {
  sessionId: string;
  students: StudentAttendanceItem[];
  classes?: Array<{ id: string; name: string }>;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
  onStudentStatusChange?: (studentId: string, newStatus: AttendanceStatus) => void;
}

export default function ManualAttendanceSheet({
  sessionId,
  students: initialStudents,
  classes = [],
  onRefresh,
  isRefreshing = false,
  onStudentStatusChange,
}: ManualAttendanceSheetProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [students, setStudents] = useState<StudentAttendanceItem[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterClassId, setFilterClassId] = useState<string>('ALL');
  const [isPending, startTransition] = useTransition();
  const [savingStudentIds, setSavingStudentIds] = useState<Set<string>>(new Set());
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const [selectedReviewStudent, setSelectedReviewStudent] = useState<StudentAttendanceItem | null>(null);
  const [reviewDecisionPending, setReviewDecisionPending] = useState<boolean>(false);
  const [reviewNoteInput, setReviewNoteInput] = useState<string>('');
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const requestVersionRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sinkronkan state internal saat props santri dari parent diperbarui secara realtime
  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  // Handler untuk memverifikasi surat izin digital dari orang tua
  const handleReviewAbsence = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedReviewStudent?.absenceConfirmation) return;
    const confirmationId = selectedReviewStudent.absenceConfirmation.id;
    const studentId = selectedReviewStudent.id;
    const reasonType = selectedReviewStudent.absenceConfirmation.reasonType;

    setReviewDecisionPending(true);
    try {
      const res = await verifyAbsenceConfirmation({
        confirmationId,
        decision,
        reviewNotes: reviewNoteInput.trim() || undefined,
      });

      if (res.success) {
        const newStatus: AttendanceStatus =
          decision === 'APPROVE'
            ? reasonType === 'SAKIT'
              ? AttendanceStatus.SAKIT
              : AttendanceStatus.IZIN
            : AttendanceStatus.ALPA;

        setStudents((prev) =>
          prev.map((s) => {
            if (s.id === studentId) {
              return {
                ...s,
                currentStatus: newStatus,
                absenceConfirmation: s.absenceConfirmation
                  ? {
                      ...s.absenceConfirmation,
                      status: decision === 'APPROVE' ? 'CONFIRMED' : 'REJECTED',
                    }
                  : null,
              };
            }
            return s;
          })
        );

        onStudentStatusChange?.(studentId, newStatus);
        setSelectedReviewStudent(null);
        setReviewNoteInput('');
        onRefresh?.();
      }
    } catch (err) {
      console.error('Gagal memverifikasi izin:', err);
      alert('Gagal memproses verifikasi izin: ' + (err instanceof Error ? err.message : 'Terjadi kesalahan'));
    } finally {
      setReviewDecisionPending(false);
    }
  };

  // Cleanup timer debounce saat komponen unmount
  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Update status santri dengan teknik debounce, in-flight lock, & request versioning (anti-spam klik berulang)
  const handleStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    // 0. Kunci jika santri sedang dalam proses simpan ke database (in-flight lock)
    if (savingStudentIds.has(studentId)) {
      return;
    }

    // 1. Abaikan jika santri saat ini sudah memiliki status yang sama (mencegah request berulang)
    const currentStudent = students.find((s) => s.id === studentId);
    if (currentStudent && currentStudent.currentStatus === newStatus) {
      return;
    }

    // 2. Naikkan nomor versi request untuk santri ini agar respons usang diabaikan
    const nextVersion = (requestVersionRef.current.get(studentId) || 0) + 1;
    requestVersionRef.current.set(studentId, nextVersion);

    // 3. Update UI segera secara optimistik (0ms latency feedback untuk ustadz)
    const checkInTimeStr =
      newStatus === 'HADIR' || newStatus === 'TERLAMBAT'
        ? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        : null;

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          return {
            ...s,
            currentStatus: newStatus,
            method: AttendanceMethod.MANUAL_TEACHER,
            checkInTime: checkInTimeStr,
          };
        }
        return s;
      })
    );

    onStudentStatusChange?.(studentId, newStatus);

    // 4. Batalkan timer debounce sebelumnya untuk santri ini jika user mengklik lagi
    if (debounceTimersRef.current.has(studentId)) {
      clearTimeout(debounceTimersRef.current.get(studentId)!);
    }

    // 5. Pasang timer debounce 350ms: setelah jeda tenang, kunci tombol dan kirim ke server
    const timer = setTimeout(async () => {
      debounceTimersRef.current.delete(studentId);

      // Kunci tombol santri ini selama proses simpan ke server berlangsung (in-flight lock)
      setSavingStudentIds((prev) => new Set(prev).add(studentId));

      try {
        await recordManualAttendance(sessionId, studentId, newStatus);

        // Hanya jalankan refresh jika versi transaksi masih yang terbaru
        if (requestVersionRef.current.get(studentId) === nextVersion) {
          onRefresh?.();
        }
      } catch (err) {
        console.error('Gagal mencatat absensi manual:', err);
      } finally {
        // Buka kembali kunci tombol setelah server selesai merespons
        setSavingStudentIds((prev) => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
      }
    }, 350);

    debounceTimersRef.current.set(studentId, timer);
  };

  // Tandai semua yang belum hadir menjadi HADIR dengan proteksi anti-spam
  const handleMarkAllPresent = async () => {
    if (isMarkingAll || isPending) return;

    const unpresentIds = students
      .filter((s) => s.currentStatus === 'ALPA')
      .map((s) => s.id);

    if (unpresentIds.length === 0) {
      alert('Semua santri sudah memiliki status presensi.');
      return;
    }

    if (!confirm(`Tandai ${unpresentIds.length} santri yang tersisa sebagai HADIR?`)) {
      return;
    }

    setIsMarkingAll(true);

    // Optimistic UI update
    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    setStudents((prev) =>
      prev.map((s) =>
        unpresentIds.includes(s.id)
          ? { ...s, currentStatus: AttendanceStatus.HADIR, method: AttendanceMethod.MANUAL_TEACHER, checkInTime: nowStr }
          : s
      )
    );

    unpresentIds.forEach((id) => onStudentStatusChange?.(id, AttendanceStatus.HADIR));

    try {
      await markAllPresent(sessionId, unpresentIds);
      onRefresh?.();
    } catch (err) {
      console.error('Gagal menandai hadir massal:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Statistik Ringkas Kehadiran
  const pendingLeaveCount = students.filter((s) => s.absenceConfirmation?.status === 'PENDING').length;

  const stats = {
    total: students.length,
    hadir: students.filter((s) => s.currentStatus === 'HADIR' || s.currentStatus === 'TERLAMBAT').length,
    izin: students.filter((s) => s.currentStatus === 'IZIN').length,
    sakit: students.filter((s) => s.currentStatus === 'SAKIT').length,
    alpa: students.filter((s) => s.currentStatus === 'ALPA').length,
    pendingLeave: pendingLeaveCount,
  };

  const hadirPercentage = stats.total > 0 ? Math.round((stats.hadir / stats.total) * 100) : 0;

  // Filter santri berdasarkan search, filter status, & filter kelas
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'HADIR' && (s.currentStatus === 'HADIR' || s.currentStatus === 'TERLAMBAT')) ||
      (filterStatus === 'PENDING_LEAVE' && s.absenceConfirmation?.status === 'PENDING') ||
      s.currentStatus === filterStatus;
    const matchesClass = filterClassId === 'ALL' || s.classId === filterClassId;
    return matchesSearch && matchesStatus && matchesClass;
  });

  return (
    <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-slate-200/60 shadow-xs p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header & Tombol Segarkan */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs">
                <UserCheck className="w-5 h-5 text-teal-600" />
              </div>
              <span>Lembar Absensi Manual</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Segarkan data presensi"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Banner Peringatan Surat Izin Baru dari Orang Tua */}
      {pendingLeaveCount > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 border border-amber-300">
              <FileText className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-amber-900 flex items-center gap-2">
                <span>{pendingLeaveCount} Pengajuan Surat Izin Digital dari Orang Tua</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                  Perlu Verifikasi
                </span>
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Wali santri telah mengajukan keterangan izin/sakit mandiri. Silakan periksa rincian alasan & bukti lampiran untuk menyetujui.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus('PENDING_LEAVE')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer self-start sm:self-center active:scale-95 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Tinjau Surat ({pendingLeaveCount})</span>
          </button>
        </div>
      )}

      {/* Progress & Stat Counter Badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>Tingkat Kehadiran Kelas:</span>
          <span className="font-bold text-teal-800">{hadirPercentage}% ({stats.hadir}/{stats.total})</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/60">
          <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${(stats.hadir / stats.total) * 100}%` }} />
          <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${(stats.izin / stats.total) * 100}%` }} />
          <div className="bg-blue-400 h-full transition-all duration-300" style={{ width: `${(stats.sakit / stats.total) * 100}%` }} />
          <div className="bg-rose-400 h-full transition-all duration-300" style={{ width: `${(stats.alpa / stats.total) * 100}%` }} />
        </div>

        {/* Filter per Kelas jika sesi gabungan (>1 kelas) */}
        {classes.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 tab-scrollbar">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Filter Kelas:</span>
            <button
              type="button"
              onClick={() => setFilterClassId('ALL')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${filterClassId === 'ALL'
                ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                }`}
            >
              Semua Kelas ({students.length})
            </button>
            {classes.map((cls) => {
              const classCount = students.filter((s) => s.classId === cls.id).length;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setFilterClassId(cls.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border ${filterClassId === cls.id
                    ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                    }`}
                >
                  {cls.name} ({classCount})
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer border text-xs ${filterStatus === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
              : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
              }`}
          >
            Semua ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('HADIR')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer border text-xs ${filterStatus === 'HADIR'
              ? 'bg-teal-600/20 text-teal-700 border-teal-600 shadow-2xs'
              : 'bg-white text-teal-700 border-teal-200/80 hover:bg-teal-50/60'
              }`}
          >
            Hadir ({stats.hadir})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('IZIN')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer border text-xs ${filterStatus === 'IZIN'
              ? 'bg-amber-600/20 text-amber-800 border-amber-600 shadow-2xs'
              : 'bg-white text-amber-700 border-amber-200/80 hover:bg-amber-50/60'
              }`}
          >
            Izin ({stats.izin})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('SAKIT')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer border text-xs ${filterStatus === 'SAKIT'
              ? 'bg-blue-600/20 text-blue-800 border-blue-600 shadow-2xs'
              : 'bg-white text-blue-700 border-blue-200/80 hover:bg-blue-50/60'
              }`}
          >
            Sakit ({stats.sakit})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ALPA')}
            className={`px-3 py-1 rounded-xl font-semibold transition-all cursor-pointer border text-xs ${filterStatus === 'ALPA'
              ? 'bg-rose-600/20 text-rose-800 border-rose-600 shadow-2xs'
              : 'bg-white text-rose-700 border-rose-200/80 hover:bg-rose-50/60'
              }`}
          >
            Alpa ({stats.alpa})
          </button>

          {pendingLeaveCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('PENDING_LEAVE')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer border text-xs flex items-center gap-1.5 ${filterStatus === 'PENDING_LEAVE'
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                }`}
            >
              <FileText className="w-3 h-3 text-amber-700" />
              <span>Surat Izin ({pendingLeaveCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Kotak Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama santri binaan..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
        />
      </div>
      <div className="flex items-center justify-end">
        <div></div>
        <button
          type="button"
          onClick={handleMarkAllPresent}
          disabled={isPending || stats.alpa === 0}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Semua Hadir ({stats.alpa})</span>
        </button>
      </div>

      {/* Daftar Santri & Tombol 1-Tap */}
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/70 overflow-hidden bg-white">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Tidak ada santri yang cocok dengan kriteria pencarian atau filter.
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isHadir = student.currentStatus === 'HADIR' || student.currentStatus === 'TERLAMBAT';
            const isIzin = student.currentStatus === 'IZIN';
            const isSakit = student.currentStatus === 'SAKIT';
            const isAlpa = student.currentStatus === 'ALPA';
            const isPendingSave = savingStudentIds.has(student.id);

            return (
              <div
                key={student.id}
                className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors"
              >
                {/* Info Santri */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                      {student.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span>{student.generationName || 'Santri'}</span>
                      {classes.length > 1 && student.className && (
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/80 text-[10px]">
                          {student.className}
                        </span>
                      )}
                      {student.checkInTime && (
                        <span className="text-teal-700 font-medium">
                          • {student.checkInTime} WIB ({student.method === 'QR_SCAN_STUDENT' ? 'QR Santri' : 'Manual'})
                        </span>
                      )}
                      {student.absenceConfirmation && (
                        student.absenceConfirmation.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReviewStudent(student);
                              setReviewNoteInput('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold border border-amber-300 text-[10px] hover:bg-amber-200 transition-colors cursor-pointer shadow-2xs animate-pulse"
                            title="Klik untuk meninjau surat izin dan bukti foto dari orang tua"
                          >
                            <FileText className="w-2.5 h-2.5 text-amber-700" />
                            <span>Surat Izin Digital (Perlu Review)</span>
                          </button>
                        ) : student.absenceConfirmation.status === 'CONFIRMED' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReviewStudent(student);
                              setReviewNoteInput('');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-semibold border border-teal-200 text-[10px] hover:bg-teal-100 transition-colors cursor-pointer"
                          >
                            <Check className="w-2.5 h-2.5 text-teal-600" />
                            <span>Izin Disetujui</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReviewStudent(student);
                              setReviewNoteInput('');
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 font-semibold border border-rose-200 text-[10px] hover:bg-rose-100 transition-colors cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5 text-rose-600" />
                            <span>Izin Ditolak</span>
                          </button>
                        )
                      )}
                      {student.notes && !student.absenceConfirmation && (
                        <span className="text-slate-500 italic truncate max-w-[160px]" title={student.notes}>
                          • {student.notes}
                        </span>
                      )}
                      {isPendingSave && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200/60 animate-pulse">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4 Tombol 1-Tap Status dengan Proteksi Bounce & In-Flight Lock */}
                <div className="grid grid-cols-4 gap-1 sm:flex sm:items-center sm:gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, AttendanceStatus.HADIR)}
                    disabled={isHadir || isPendingSave}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border text-center flex items-center justify-center gap-1 ${
                      isHadir
                        ? 'bg-teal-600/20 text-teal-700 border-teal-600 shadow-2xs font-bold cursor-default'
                        : isPendingSave
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-teal-50/80 text-teal-700 border-teal-200/80 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isHadir && isPendingSave && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                    <span>Hadir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, AttendanceStatus.IZIN)}
                    disabled={isIzin || isPendingSave}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border text-center flex items-center justify-center gap-1 ${
                      isIzin
                        ? 'bg-amber-600/20 text-amber-800 border-amber-600 shadow-2xs font-bold cursor-default'
                        : isPendingSave
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-amber-50/80 text-amber-700 border-amber-200/80 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isIzin && isPendingSave && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
                    <span>Izin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, AttendanceStatus.SAKIT)}
                    disabled={isSakit || isPendingSave}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border text-center flex items-center justify-center gap-1 ${
                      isSakit
                        ? 'bg-blue-600/20 text-blue-800 border-blue-600 shadow-2xs font-bold cursor-default'
                        : isPendingSave
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-blue-50/80 text-blue-700 border-blue-200/80 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isSakit && isPendingSave && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                    <span>Sakit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStatusChange(student.id, AttendanceStatus.ALPA)}
                    disabled={isAlpa || isPendingSave}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border text-center flex items-center justify-center gap-1 ${
                      isAlpa
                        ? 'bg-rose-600/20 text-rose-800 border-rose-600 shadow-2xs font-bold cursor-default'
                        : isPendingSave
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-rose-50/80 text-rose-700 border-rose-200/80 cursor-pointer active:scale-95'
                    }`}
                  >
                    {isAlpa && isPendingSave && <Loader2 className="w-3 h-3 animate-spin text-rose-600" />}
                    <span>Alpa</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Peninjauan Surat Izin Digital dari Orang Tua (Portal ke Body, Lapisan Paling Depan User) */}
      {mounted && selectedReviewStudent && selectedReviewStudent.absenceConfirmation && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                  <FileText className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                    Surat Izin Digital Santri
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Verifikasi permohonan ketidakhadiran dari wali santri
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReviewStudent(null);
                  setReviewNoteInput('');
                }}
                disabled={reviewDecisionPending}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Santri & Pemohon */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Nama Santri Binaan
                    </span>
                    <div className="text-sm font-bold text-slate-900">{selectedReviewStudent.fullName}</div>
                    <div className="text-[11px] text-slate-500">
                      {selectedReviewStudent.generationName || 'Santri'}
                      {selectedReviewStudent.className ? ` • ${selectedReviewStudent.className}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {selectedReviewStudent.absenceConfirmation.reasonType === 'SAKIT' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <HeartPulse className="w-3.5 h-3.5" />
                        <span>Keterangan Sakit</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Info className="w-3.5 h-3.5" />
                        <span>Permohonan Izin</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                  <span>Diajukan oleh: <strong className="text-slate-800">{selectedReviewStudent.absenceConfirmation.parentName || 'Orang Tua / Wali'}</strong></span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    selectedReviewStudent.absenceConfirmation.status === 'PENDING'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : selectedReviewStudent.absenceConfirmation.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {selectedReviewStudent.absenceConfirmation.status === 'PENDING' ? 'MENUNGGU VERIFIKASI' : selectedReviewStudent.absenceConfirmation.status === 'CONFIRMED' ? 'DISETUJUI' : 'DITOLAK'}
                  </span>
                </div>
              </div>

              {/* Alasan / Catatan Orang Tua */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Keterangan / Alasan dari Orang Tua:</label>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed italic">
                  {selectedReviewStudent.absenceConfirmation.parentNotes || 'Tidak ada catatan tertulis.'}
                </div>
              </div>

              {/* Bukti Foto / Surat Dokter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Lampiran Dokumen / Bukti Foto:</label>
                {selectedReviewStudent.absenceConfirmation.attachmentUrl ? (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900/5 p-2 space-y-2">
                    <div className="relative max-h-56 overflow-hidden rounded-xl bg-slate-100 flex items-center justify-center">
                      <img
                        src={selectedReviewStudent.absenceConfirmation.attachmentUrl}
                        alt="Bukti Surat Izin / Sakit"
                        className="max-h-56 w-full object-contain"
                      />
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={selectedReviewStudent.absenceConfirmation.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline"
                      >
                        <span>Buka Gambar Ukuran Penuh</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Tidak ada lampiran foto surat dokter atau surat izin.
                  </div>
                )}
              </div>

              {/* Catatan Verifikasi Pengajar jika masih PENDING */}
              {selectedReviewStudent.absenceConfirmation.status === 'PENDING' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700">Catatan Ustadz (Opsional):</label>
                  <input
                    type="text"
                    value={reviewNoteInput}
                    onChange={(e) => setReviewNoteInput(e.target.value)}
                    placeholder="Contoh: Disetujui, semoga lekas sembuh..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedReviewStudent(null);
                  setReviewNoteInput('');
                }}
                disabled={reviewDecisionPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Tutup
              </button>

              {selectedReviewStudent.absenceConfirmation.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReviewAbsence('REJECT')}
                    disabled={reviewDecisionPending}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {reviewDecisionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    <span>Tolak (Tandai Alpa)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReviewAbsence('APPROVE')}
                    disabled={reviewDecisionPending}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {reviewDecisionPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Setujui Izin</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs font-semibold text-slate-500">
                  Surat izin ini telah diproses.
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
