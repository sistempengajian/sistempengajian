'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  Users,
  Clock,
  MapPin,
  UserCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  XCircle,
  HeartPulse,
  Info,
  FileText,
  Image as ImageIcon,
  Plus,
  Check,
  X,
  Edit3,
  Trash2,
  Camera,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { cancelParentAbsenceRequest } from '@/app/(protected)/presensi/actions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import type { AbsenceSubmitSuccessPayload } from './parent/ParentAbsenceRequestModal';
import type { ParentQrScanSuccessPayload } from './parent/ParentQrScannerModal';

const ParentAbsenceRequestModal = dynamic(
  () => import('./parent/ParentAbsenceRequestModal'),
  { ssr: false }
);
const ParentQrScannerModal = dynamic(
  () => import('./parent/ParentQrScannerModal'),
  { ssr: false }
);
const ParentStudentCardModal = dynamic(
  () => import('./parent/ParentStudentCardModal'),
  { ssr: false }
);

export interface ChildScheduleInfo {
  scheduleId: string;
  scheduleTitle: string;
  startTime: string;
  endTime: string;
  venueName?: string | null;
  teacherName?: string | null;
  isSubstitute?: boolean;
  status: 'ACTIVE' | 'SCHEDULED' | 'COMPLETED';
  materialTitles: string[];
}

export interface ChildAttendanceSummary {
  id: string;
  fullName: string;
  generationName: string;
  className?: string | null;
  organizationName?: string | null;
  todaySchedule?: ChildScheduleInfo | null;
  todayAttendanceStatus?:
    | 'HADIR'
    | 'TERLAMBAT'
    | 'IZIN'
    | 'SAKIT'
    | 'ALPA'
    | 'NOT_STARTED';
  todayCheckInTime?: string | null;
  todayNotes?: string | null;
  monthlyStats: {
    totalSessions: number;
    hadirCount: number;
    izinCount: number;
    sakitCount: number;
    alpaCount: number;
    attendanceRate: number;
  };
}

export type AbsenceHistoryItem = {
  id: string;
  studentId: string;
  studentName: string;
  scheduleId: string;
  scheduleTitle: string;
  scheduleStartTime: string;
  reasonType: 'SAKIT' | 'IZIN';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  parentNotes?: string | null;
  attachmentUrl?: string | null;
  confirmedAt?: string | null;
  verifiedByTeacherName?: string | null;
  createdAt: string;
};

export type UpcomingScheduleItem = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  venuePlaceName?: string | null;
  primaryTeacherName: string;
  className?: string | null;
  existingRecord?: {
    status: string;
    notes?: string | null;
    confirmationStatus?: string | null;
    reasonType?: string | null;
    parentNotes?: string | null;
    attachmentUrl?: string | null;
    confirmationId?: string | null;
  } | null;
};

interface ParentAttendanceMonitorProps {
  childrenData: ChildAttendanceSummary[];
  initialAbsenceHistory?: AbsenceHistoryItem[];
  preselectedScheduleId?: string;
  preselectedStudentId?: string;
  initialTab?: 'monitor' | 'leave';
}

export default function ParentAttendanceMonitor({
  childrenData: initialChildren,
  initialAbsenceHistory = [],
  preselectedScheduleId,
  preselectedStudentId,
  initialTab = 'monitor',
}: ParentAttendanceMonitorProps) {
  const [childrenList, setChildrenList] =
    useState<ChildAttendanceSummary[]>(initialChildren);
  const [activeTab, setActiveTab] = useState<'monitor' | 'leave'>(initialTab);
  const [absenceHistory, setAbsenceHistory] = useState<AbsenceHistoryItem[]>(
    initialAbsenceHistory
  );

  // State pengontrol sub-modal (lazy loaded via next/dynamic)
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState<boolean>(
    Boolean(preselectedScheduleId || initialTab === 'leave')
  );
  const [modalInitialChildId, setModalInitialChildId] = useState<string>(
    preselectedStudentId || (initialChildren[0]?.id ?? '')
  );
  const [modalInitialScheduleId, setModalInitialScheduleId] = useState<string>(
    preselectedScheduleId || ''
  );
  const [editingHistoryItem, setEditingHistoryItem] =
    useState<AbsenceHistoryItem | null>(null);

  const [scanningChild, setScanningChild] =
    useState<ChildAttendanceSummary | null>(null);
  const [selectedChildForCard, setSelectedChildForCard] =
    useState<ChildAttendanceSummary | null>(null);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState<string | null>(
    null
  );
  const [scanSuccessData, setScanSuccessData] = useState<{
    studentName: string;
    scheduleTitle: string;
    points: number;
    time: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toast = useToast();
  const { open: openConfirm, ConfirmModalComponent } = useConfirm();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleOpenAbsenceModal = (
    child?: ChildAttendanceSummary,
    specificScheduleId?: string
  ) => {
    setEditingHistoryItem(null);
    const targetChildId = child
      ? child.id
      : modalInitialChildId || initialChildren[0]?.id || '';
    const targetScheduleId =
      specificScheduleId ||
      (child?.todaySchedule ? child.todaySchedule.scheduleId : '');
    setModalInitialChildId(targetChildId);
    setModalInitialScheduleId(targetScheduleId);
    setIsAbsenceModalOpen(true);
  };

  const handleEditExistingAbsence = (item: AbsenceHistoryItem) => {
    if (item.status !== 'PENDING') {
      toast.warning(
        'Surat izin yang telah diverifikasi atau disetujui ustadz pengampu tidak dapat diedit lagi.'
      );
      return;
    }
    setEditingHistoryItem(item);
    setModalInitialChildId(item.studentId);
    setModalInitialScheduleId(item.scheduleId);
    setIsAbsenceModalOpen(true);
  };

  const handleCloseAbsenceModal = () => {
    setIsAbsenceModalOpen(false);
    setEditingHistoryItem(null);
    setModalInitialScheduleId('');
  };

  const handleAbsenceSubmitSuccess = (payload: AbsenceSubmitSuccessPayload) => {
    const selectedChild = childrenList.find((c) => c.id === payload.studentId);

    if (selectedChild?.todaySchedule?.scheduleId === payload.scheduleId) {
      setChildrenList((prev) =>
        prev.map((c) =>
          c.id === payload.studentId
            ? {
                ...c,
                todayAttendanceStatus: payload.absenceStatus,
                todayNotes: payload.absenceNotes
                  ? `[Izin Orang Tua] ${payload.absenceNotes}`
                  : '[Izin Orang Tua] Diajukan oleh wali',
              }
            : c
        )
      );
    }

    setAbsenceHistory((prev) => {
      const existingIdx = prev.findIndex(
        (h) =>
          h.studentId === payload.studentId &&
          h.scheduleId === payload.scheduleId
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          reasonType: payload.absenceStatus,
          parentNotes: payload.absenceNotes || null,
          status: 'PENDING',
          confirmedAt: null,
          attachmentUrl: payload.finalAttachment,
        };
        return updated;
      }
      const newHistoryItem: AbsenceHistoryItem = {
        id: payload.confirmationId,
        studentId: payload.studentId,
        studentName: selectedChild?.fullName || 'Santri',
        scheduleId: payload.scheduleId,
        scheduleTitle: payload.scheduleTitle,
        scheduleStartTime: payload.scheduleStartTime,
        reasonType: payload.absenceStatus,
        status: 'PENDING',
        parentNotes: payload.absenceNotes || null,
        attachmentUrl: payload.finalAttachment,
        createdAt: new Date().toISOString(),
      };
      return [newHistoryItem, ...prev];
    });
  };

  const handleCancelAbsenceRequest = (confirmationId: string) => {
    openConfirm(
      {
        title: 'Batalkan Surat Izin?',
        description:
          'Apakah Anda yakin ingin membatalkan dan menghapus surat permohonan izin ini?',
        variant: 'danger',
        confirmText: 'Ya, Batalkan',
      },
      async () => {
        startTransition(async () => {
          try {
            const res = await cancelParentAbsenceRequest(confirmationId);
            if (res.success) {
              const cancelledItem = absenceHistory.find(
                (h) => h.id === confirmationId
              );
              const targetScheduleId = cancelledItem?.scheduleId;
              const targetStudentId = cancelledItem?.studentId;

              setAbsenceHistory((prev) =>
                prev.filter((h) => h.id !== confirmationId)
              );

              if (targetScheduleId && targetStudentId) {
                setChildrenList((prev) =>
                  prev.map((c) => {
                    if (
                      c.id === targetStudentId &&
                      c.todaySchedule?.scheduleId === targetScheduleId
                    ) {
                      return {
                        ...c,
                        todayAttendanceStatus: 'NOT_STARTED',
                        todayNotes: null,
                      };
                    }
                    return c;
                  })
                );
              }

              if (isAbsenceModalOpen) {
                handleCloseAbsenceModal();
              }
              toast.success('Surat permohonan izin berhasil dibatalkan.');
            }
          } catch (err: unknown) {
            const error = err as Error;
            toast.error(error.message || 'Gagal membatalkan surat izin.');
          }
        });
      }
    );
  };

  const handleOpenParentScanModal = (child: ChildAttendanceSummary) => {
    if (!child.todaySchedule) {
      toast.info('Tidak ada jadwal pengajian aktif untuk ananda hari ini.');
      return;
    }
    setScanningChild(child);
  };

  const handleParentScanSuccess = (payload: ParentQrScanSuccessPayload) => {
    setChildrenList((prev) =>
      prev.map((c) => {
        if (c.id === payload.studentId) {
          const wasPresent =
            c.todayAttendanceStatus === 'HADIR' ||
            c.todayAttendanceStatus === 'TERLAMBAT';
          const newTotal = wasPresent
            ? c.monthlyStats.totalSessions
            : c.monthlyStats.totalSessions + 1;
          const newHadir = wasPresent
            ? c.monthlyStats.hadirCount
            : c.monthlyStats.hadirCount + 1;
          const newRate =
            newTotal > 0 ? Math.round((newHadir / newTotal) * 100) : 100;
          return {
            ...c,
            todayAttendanceStatus: 'HADIR',
            todayCheckInTime: payload.time,
            todayNotes: 'Presensi dicatat via scan Dynamic QR oleh orang tua',
            monthlyStats: {
              ...c.monthlyStats,
              hadirCount: newHadir,
              totalSessions: newTotal,
              attendanceRate: newRate,
            },
          };
        }
        return c;
      })
    );
    setScanningChild(null);
    setScanSuccessData({
      studentName: payload.studentName,
      scheduleTitle: payload.scheduleTitle,
      points: payload.points,
      time: payload.time,
    });
  };

  if (childrenList.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto border border-indigo-200/60">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Belum Ada Data Ananda Terhubung
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Akun orang tua Anda belum terhubung dengan santri binaan. Hubungi pengurus kelompok atau wali kelas untuk menghubungkan profil santri Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white/85 backdrop-blur-md p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60 shadow-2xs">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Portal Orang Tua &amp; Wali Santri
              </h2>
              <p className="text-xs text-slate-500">
                Monitoring presensi belajar dan pengajuan surat izin mandiri ananda binaan.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleOpenAbsenceModal()}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Ajukan Surat Izin Digital</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-1 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 w-full max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('monitor')}
          className={`min-h-[44px] py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'monitor'
              ? 'bg-white text-indigo-900 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>
            Monitoring<span className="hidden sm:inline"> Kehadiran</span> (
            {childrenList.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`min-h-[44px] py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'leave'
              ? 'bg-white text-indigo-900 shadow-xs border border-indigo-100'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Riwayat Izin ({absenceHistory.length})</span>
        </button>
      </div>

      {activeTab === 'monitor' && (
        <div className="space-y-4">
          {childrenList.map((child) => {
            const initials = child.fullName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            const canRequestAbsence =
              Boolean(child.todaySchedule) &&
              child.todayAttendanceStatus !== 'HADIR' &&
              child.todayAttendanceStatus !== 'TERLAMBAT' &&
              child.todayAttendanceStatus !== 'IZIN' &&
              child.todayAttendanceStatus !== 'SAKIT';

            return (
              <div
                key={child.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:border-slate-300"
              >
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {child.fullName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5 flex-wrap">
                        <span className="font-semibold text-indigo-600">
                          {child.generationName}
                        </span>
                        {child.className && <span>• {child.className}</span>}
                        {child.organizationName && (
                          <span>• {child.organizationName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedChildForCard(child)}
                      className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Lihat & Cetak Kartu Identitas QR Santri"
                    >
                      <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Kartu QR Santri</span>
                    </button>

                    {child.todayAttendanceStatus === 'HADIR' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Hadir{' '}
                          {child.todayCheckInTime
                            ? `(${child.todayCheckInTime} WIB)`
                            : ''}
                        </span>
                      </span>
                    )}
                    {child.todayAttendanceStatus === 'TERLAMBAT' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          Terlambat{' '}
                          {child.todayCheckInTime
                            ? `(${child.todayCheckInTime} WIB)`
                            : ''}
                        </span>
                      </span>
                    )}
                    {child.todayAttendanceStatus === 'IZIN' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>Izin Orang Tua</span>
                      </span>
                    )}
                    {child.todayAttendanceStatus === 'SAKIT' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                        <HeartPulse className="w-3.5 h-3.5 text-orange-600" />
                        <span>Keterangan Sakit</span>
                      </span>
                    )}
                    {child.todayAttendanceStatus === 'ALPA' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Belum Hadir</span>
                      </span>
                    )}
                    {(!child.todayAttendanceStatus ||
                      child.todayAttendanceStatus === 'NOT_STARTED') && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Menunggu Sesi</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {child.todaySchedule ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {child.todaySchedule.scheduleTitle}
                          </span>
                          {child.todaySchedule.status === 'ACTIVE' && (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-teal-100 text-teal-800 rounded-full animate-pulse">
                              SEDANG BERLANGSUNG
                            </span>
                          )}
                        </div>

                        {canRequestAbsence && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => handleOpenParentScanModal(child)}
                              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                              title="Pindai QR code ustadz untuk presensi anak"
                            >
                              <Camera className="w-4 h-4 shrink-0" />
                              <span>Scan QR Kehadiran</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenAbsenceModal(
                                  child,
                                  child.todaySchedule?.scheduleId
                                )
                              }
                              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              <FileText className="w-4 h-4 shrink-0" />
                              <span>Ajukan Surat Izin Sesi Ini</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {child.todaySchedule.startTime} -{' '}
                            {child.todaySchedule.endTime} WIB
                          </span>
                        </div>
                        {child.todaySchedule.venueName && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {child.todaySchedule.venueName}
                            </span>
                          </div>
                        )}
                        {child.todaySchedule.teacherName && (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              Ustadz: {child.todaySchedule.teacherName}
                              {child.todaySchedule.isSubstitute ? ' (Badal)' : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {child.todaySchedule.materialTitles.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                            <span>Materi Kajian Hari Ini:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {child.todaySchedule.materialTitles.map(
                              (title, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs"
                                >
                                  {title}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {child.todayNotes && (
                        <div className="text-xs text-slate-600 italic bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                          Catatan: {child.todayNotes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="w-8 h-8 text-slate-400 shrink-0" />
                        <span className="text-center">
                          Tidak ada jadwal pengajian aktif untuk ananda hari ini.
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenAbsenceModal(child)}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Izin Sesi Mendatang
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700">
                        Tingkat Kehadiran 30 Hari Terakhir
                      </span>
                      <span className="font-extrabold text-indigo-600">
                        {child.monthlyStats.attendanceRate}%
                      </span>
                    </div>

                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {child.monthlyStats.totalSessions > 0 ? (
                        <>
                          <div
                            style={{
                              width: `${
                                (child.monthlyStats.hadirCount /
                                  child.monthlyStats.totalSessions) *
                                100
                              }%`,
                            }}
                            className="bg-emerald-500 transition-all duration-500"
                            title={`Hadir: ${child.monthlyStats.hadirCount}`}
                          />
                          <div
                            style={{
                              width: `${
                                (child.monthlyStats.izinCount /
                                  child.monthlyStats.totalSessions) *
                                100
                              }%`,
                            }}
                            className="bg-blue-400 transition-all duration-500"
                            title={`Izin: ${child.monthlyStats.izinCount}`}
                          />
                          <div
                            style={{
                              width: `${
                                (child.monthlyStats.sakitCount /
                                  child.monthlyStats.totalSessions) *
                                100
                              }%`,
                            }}
                            className="bg-orange-400 transition-all duration-500"
                            title={`Sakit: ${child.monthlyStats.sakitCount}`}
                          />
                          <div
                            style={{
                              width: `${
                                (child.monthlyStats.alpaCount /
                                  child.monthlyStats.totalSessions) *
                                100
                              }%`,
                            }}
                            className="bg-rose-400 transition-all duration-500"
                            title={`Alpa: ${child.monthlyStats.alpaCount}`}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-slate-200" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{child.monthlyStats.hadirCount} Hadir</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>{child.monthlyStats.izinCount} Izin</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                        <span>{child.monthlyStats.sakitCount} Sakit</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>{child.monthlyStats.alpaCount} Alpa</span>
                      </span>
                      <span className="text-slate-500">
                        • Total {child.monthlyStats.totalSessions} Sesi
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="space-y-4">
          {absenceHistory.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200/60">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Belum Ada Pengajuan Surat Izin
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Anda belum pernah mengajukan surat izin atau sakit digital untuk ananda. Anda dapat mengajukannya kapan pun ananda berhalangan hadir.
              </p>
              <button
                type="button"
                onClick={() => handleOpenAbsenceModal()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Buat Surat Izin Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {absenceHistory.map((item) => {
                const dateFormatted = new Date(
                  item.scheduleStartTime
                ).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900">
                          {item.studentName}
                        </span>
                        {item.reasonType === 'SAKIT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <HeartPulse className="w-3 h-3 text-blue-600" />
                            <span>Keterangan Sakit</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Info className="w-3 h-3 text-amber-700" />
                            <span>Permohonan Izin</span>
                          </span>
                        )}

                        {item.status === 'PENDING' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            MENUNGGU VERIFIKASI USTADZ
                          </span>
                        )}
                        {item.status === 'CONFIRMED' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>DISETUJUI PENGAMPU</span>
                          </span>
                        )}
                        {item.status === 'REJECTED' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <X className="w-3 h-3" />
                            <span>DITOLAK (DITANDAI ALPA)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 font-medium">
                        Sesi:{' '}
                        <span className="text-slate-800 font-semibold">
                          {item.scheduleTitle}
                        </span>{' '}
                        ({dateFormatted})
                      </div>

                      {item.parentNotes && (
                        <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 italic">
                          Catatan: &ldquo;{item.parentNotes}&rdquo;
                        </div>
                      )}

                      {item.verifiedByTeacherName && (
                        <div className="text-xs text-slate-500">
                          Diverifikasi oleh:{' '}
                          <strong className="text-slate-700">
                            {item.verifiedByTeacherName}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 self-start sm:self-center flex items-center gap-2 flex-wrap">
                      {item.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditExistingAbsence(item)}
                            className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Perbarui alasan atau ganti berkas surat izin"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Perbarui</span>
                          </button>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleCancelAbsenceRequest(item.id)}
                            className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Batalkan / Hapus permohonan surat izin"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Batalkan</span>
                          </button>
                        </>
                      )}
                      {item.attachmentUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setViewingAttachmentUrl(item.attachmentUrl!)
                          }
                          className="min-h-[44px] sm:min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                          <span>Bukti Foto</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-modal dinamis (hanya di-load ketika dibuka) */}
      {isAbsenceModalOpen && (
        <ParentAbsenceRequestModal
          childrenList={childrenList}
          initialChildId={modalInitialChildId}
          initialScheduleId={modalInitialScheduleId}
          editingHistoryItem={editingHistoryItem}
          absenceHistory={absenceHistory}
          onClose={handleCloseAbsenceModal}
          onCancelRequest={handleCancelAbsenceRequest}
          onSubmitSuccess={handleAbsenceSubmitSuccess}
        />
      )}

      {scanningChild && (
        <ParentQrScannerModal
          scanningChild={scanningChild}
          onClose={() => setScanningChild(null)}
          onScanSuccess={handleParentScanSuccess}
        />
      )}

      {selectedChildForCard && (
        <ParentStudentCardModal
          student={selectedChildForCard}
          onClose={() => setSelectedChildForCard(null)}
        />
      )}

      {/* Modal Full Preview Lampiran Gambar */}
      {mounted &&
        viewingAttachmentUrl &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Lampiran Bukti Surat Izin"
            className="!mt-0 fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewingAttachmentUrl(null);
            }}
          >
            <div className="bg-white max-w-xl w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Lampiran Bukti Surat Izin
                </span>
                <button
                  type="button"
                  onClick={() => setViewingAttachmentUrl(null)}
                  aria-label="Tutup lampiran"
                  className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 bg-slate-900/5 max-h-[75vh] overflow-auto flex items-center justify-center">
                <img
                  src={viewingAttachmentUrl}
                  alt="Lampiran Surat"
                  className="max-h-[70vh] w-auto object-contain rounded-xl"
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Dialog Sukses Presensi QR Orang Tua */}
      {mounted &&
        scanSuccessData &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Presensi Berhasil"
            className="!mt-0 fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
          >
            <div className="bg-white border border-slate-100 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs mb-3">
                <Sparkles className="w-7 h-7 text-emerald-600 animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Alhamdulillah, Presensi Hadir!
              </h3>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Kehadiran ananda{' '}
                <span className="font-bold text-slate-900">
                  {scanSuccessData.studentName}
                </span>{' '}
                pada sesi{' '}
                <span className="font-bold text-slate-900">
                  {scanSuccessData.scheduleTitle}
                </span>{' '}
                berhasil dicatat pada jam {scanSuccessData.time} WIB.
              </p>

              <div className="mt-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-bold text-xs inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>+{scanSuccessData.points} Poin Istiqomah Santri</span>
              </div>

              <button
                type="button"
                onClick={() => setScanSuccessData(null)}
                className="mt-6 w-full min-h-[44px] py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Selesai &amp; Lihat Ringkasan
              </button>
            </div>
          </div>,
          document.body
        )}

      {ConfirmModalComponent()}
    </div>
  );
}
