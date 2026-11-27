'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  MapPin,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  HeartPulse,
  FileText,
  Upload,
  Check,
  X,
  RefreshCw,
  FileEdit,
  ChevronRight,
  Trash2,
  User,
} from 'lucide-react';
import {
  submitParentAbsenceRequest,
  getChildUpcomingSchedules,
} from '@/app/(protected)/presensi/actions';
import { useToast } from '@/components/ui/Toast';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { triggerMicroCsatPrompt } from '@/lib/telemetry-client';
import type {
  ChildAttendanceSummary,
  AbsenceHistoryItem,
  UpcomingScheduleItem,
} from '../ParentAttendanceMonitor';

export interface AbsenceSubmitSuccessPayload {
  studentId: string;
  scheduleId: string;
  absenceStatus: 'IZIN' | 'SAKIT';
  absenceNotes: string;
  confirmationId: string;
  finalAttachment: string | null | undefined;
  scheduleTitle: string;
  scheduleStartTime: string;
}

interface ParentAbsenceRequestModalProps {
  childrenList: ChildAttendanceSummary[];
  initialChildId: string;
  initialScheduleId?: string;
  editingHistoryItem: AbsenceHistoryItem | null;
  absenceHistory: AbsenceHistoryItem[];
  onClose: () => void;
  onCancelRequest: (confirmationId: string) => void;
  onSubmitSuccess: (payload: AbsenceSubmitSuccessPayload) => void;
}

/**
 * Modal full-screen pengajuan/pembaruan Surat Izin & Sakit Ananda beserta
 * bottom sheet pemilihan santri & sesi jadwal (di-code-split via `next/dynamic`).
 */
export default function ParentAbsenceRequestModal({
  childrenList,
  initialChildId,
  initialScheduleId = '',
  editingHistoryItem,
  absenceHistory,
  onClose,
  onCancelRequest,
  onSubmitSuccess,
}: ParentAbsenceRequestModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string>(initialChildId);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(initialScheduleId);
  const [upcomingSchedules, setUpcomingSchedules] = useState<UpcomingScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [absenceStatus, setAbsenceStatus] = useState<'IZIN' | 'SAKIT'>(
    editingHistoryItem?.reasonType === 'SAKIT' ? 'SAKIT' : 'IZIN'
  );
  const [absenceNotes, setAbsenceNotes] = useState<string>(
    editingHistoryItem?.parentNotes || ''
  );
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(
    editingHistoryItem?.attachmentUrl || null
  );
  const [isAttachmentRemoved, setIsAttachmentRemoved] = useState(false);
  const [isSessionBottomSheetOpen, setIsSessionBottomSheetOpen] = useState(false);
  const [isStudentBottomSheetOpen, setIsStudentBottomSheetOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const toast = useToast();
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const sessionSheetRef = useRef<HTMLDivElement>(null);
  const studentSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useFocusTrap(
    mounted && !isSessionBottomSheetOpen && !isStudentBottomSheetOpen,
    modalPanelRef,
    () => {
      if (!isPending) onClose();
    }
  );
  useFocusTrap(isSessionBottomSheetOpen, sessionSheetRef, () =>
    setIsSessionBottomSheetOpen(false)
  );
  useFocusTrap(isStudentBottomSheetOpen, studentSheetRef, () =>
    setIsStudentBottomSheetOpen(false)
  );

  const selectedChild =
    childrenList.find((c) => c.id === selectedChildId) || childrenList[0];
  const selectedSchedule = upcomingSchedules.find(
    (s) => s.id === selectedScheduleId
  );
  const isExistingLeave = Boolean(editingHistoryItem);
  const selectedConfirmationId =
    editingHistoryItem?.id ||
    selectedSchedule?.existingRecord?.confirmationId ||
    absenceHistory.find(
      (h) => h.scheduleId === selectedScheduleId && h.studentId === selectedChildId
    )?.id ||
    null;

  const selectableSchedules = upcomingSchedules.filter((sch) => {
    const hasLeave = Boolean(
      sch.existingRecord?.confirmationStatus ||
        sch.existingRecord?.status === 'IZIN' ||
        sch.existingRecord?.status === 'SAKIT'
    );
    return !hasLeave;
  });

  const fetchSchedulesForChild = useCallback(
    async (
      childId: string,
      scheduleIdToSelect?: string,
      isEditMode: boolean = false
    ) => {
      if (!childId) return;
      setIsLoadingSchedules(true);
      try {
        const schedules = await getChildUpcomingSchedules(childId);
        setUpcomingSchedules(schedules as UpcomingScheduleItem[]);

        const availableSchedules = (schedules as UpcomingScheduleItem[]).filter(
          (s) =>
            !s.existingRecord?.confirmationStatus &&
            s.existingRecord?.status !== 'IZIN' &&
            s.existingRecord?.status !== 'SAKIT'
        );

        let targetId = '';
        if (isEditMode && scheduleIdToSelect) {
          targetId = scheduleIdToSelect;
        } else if (scheduleIdToSelect) {
          const targetSch = schedules.find((s) => s.id === scheduleIdToSelect);
          const hasLeave = Boolean(
            targetSch?.existingRecord?.confirmationStatus ||
              targetSch?.existingRecord?.status === 'IZIN' ||
              targetSch?.existingRecord?.status === 'SAKIT'
          );
          targetId = !hasLeave
            ? scheduleIdToSelect
            : availableSchedules[0]?.id || '';
        } else {
          targetId = availableSchedules[0]?.id || '';
        }

        setSelectedScheduleId(targetId);

        if (isEditMode && targetId) {
          const targetSch = schedules.find((s) => s.id === targetId);
          if (targetSch?.existingRecord) {
            if (
              targetSch.existingRecord.reasonType === 'SAKIT' ||
              targetSch.existingRecord.status === 'SAKIT'
            ) {
              setAbsenceStatus('SAKIT');
            } else {
              setAbsenceStatus('IZIN');
            }
            const rawNotes =
              targetSch.existingRecord.parentNotes ||
              targetSch.existingRecord.notes?.replace(/^\[Izin Orang Tua\]\s*/, '') ||
              '';
            setAbsenceNotes(rawNotes);
            if (targetSch.existingRecord.attachmentUrl) {
              setAttachmentPreview(targetSch.existingRecord.attachmentUrl);
              setAttachmentData(null);
              setIsAttachmentRemoved(false);
            }
          }
        }
      } catch (err) {
        console.error('Gagal mengambil jadwal ananda:', err);
      } finally {
        setIsLoadingSchedules(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedChildId) {
      void fetchSchedulesForChild(
        selectedChildId,
        initialScheduleId || editingHistoryItem?.scheduleId,
        Boolean(editingHistoryItem)
      );
    }
  }, [selectedChildId, initialScheduleId, editingHistoryItem, fetchSchedulesForChild]);

  const handleSelectSchedule = (sch: UpcomingScheduleItem) => {
    if (isExistingLeave) return;
    setSelectedScheduleId(sch.id);
    setFeedbackMessage(null);
    setAbsenceStatus('IZIN');
    setAbsenceNotes('');
    setAttachmentPreview(null);
    setAttachmentData(null);
    setIsAttachmentRemoved(false);
  };

  const handleRemoveAttachment = () => {
    setAttachmentData(null);
    setAttachmentPreview(null);
    setIsAttachmentRemoved(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning(
        'Hanya file gambar (JPG, PNG, WEBP) yang didukung untuk lampiran surat.'
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Ukuran gambar maksimal adalah 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAttachmentData(result);
      setAttachmentPreview(result);
      setIsAttachmentRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId || !selectedScheduleId) {
      toast.warning('Silakan pilih ananda dan sesi jadwal pengajian.');
      return;
    }

    const willBeUpdate = isExistingLeave;

    startTransition(async () => {
      try {
        const res = await submitParentAbsenceRequest({
          studentId: selectedChildId,
          scheduleId: selectedScheduleId,
          status: absenceStatus,
          notes: absenceNotes,
          attachmentData: attachmentData || undefined,
          removeAttachment: isAttachmentRemoved,
        });

        if (res.success) {
          const finalAttachment =
            res.attachmentUrl !== undefined
              ? res.attachmentUrl
              : isAttachmentRemoved
                ? null
                : attachmentPreview;

          setFeedbackMessage({
            text:
              res.message ||
              (willBeUpdate
                ? `Surat Izin untuk ${selectedChild?.fullName || 'ananda'} berhasil diperbarui.`
                : `Surat Izin Digital untuk ${selectedChild?.fullName || 'ananda'} berhasil dikirimkan.`),
            type: 'success',
          });

          onSubmitSuccess({
            studentId: selectedChildId,
            scheduleId: selectedScheduleId,
            absenceStatus,
            absenceNotes,
            confirmationId: res.confirmationId,
            finalAttachment,
            scheduleTitle: selectedSchedule?.title || 'Sesi Pengajian',
            scheduleStartTime:
              selectedSchedule?.startTime || new Date().toISOString(),
          });

          setTimeout(() => {
            onClose();
            triggerMicroCsatPrompt('parent_absence_request');
          }, 1500);
        }
      } catch (err: unknown) {
        const error = err as Error;
        setFeedbackMessage({
          text: error.message || 'Gagal mengirimkan surat izin digital.',
          type: 'error',
        });
      }
    });
  };

  if (!mounted) return null;

  return (
    <>
      {createPortal(
        <div
          ref={modalPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label={
            isExistingLeave
              ? 'Perbarui Surat Izin atau Sakit'
              : 'Ajukan Surat Izin atau Sakit'
          }
          className="!mt-0 fixed inset-0 z-50 flex flex-col bg-slate-50 animate-fade-in"
        >
          <div
            className={`flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 border-b border-slate-200/80 shadow-xs ${
              isExistingLeave ? 'bg-amber-50/80' : 'bg-white/90'
            } backdrop-blur-sm`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center border shadow-xs ${
                  isExistingLeave
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                {isExistingLeave ? (
                  <FileEdit className="w-4.5 h-4.5 text-amber-600" />
                ) : (
                  <FileText className="w-4.5 h-4.5 text-indigo-600" />
                )}
              </div>
              <div>
                <h2
                  className={`font-extrabold text-sm sm:text-base leading-tight ${
                    isExistingLeave ? 'text-amber-900' : 'text-slate-900'
                  }`}
                >
                  {isExistingLeave
                    ? 'Perbarui Surat Izin / Sakit'
                    : 'Ajukan Surat Izin / Sakit'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  {isExistingLeave
                    ? 'Perbarui keterangan ketidakhadiran atau berkas bukti surat izin ananda'
                    : 'Pengajuan digital resmi langsung ke lembar presensi Pengajar'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer text-base leading-none"
              aria-label="Tutup modal"
            >
              ✕
            </button>
          </div>

          <form
            id="absence-request-form"
            onSubmit={handleSubmitAbsence}
            className="flex-1 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
              {isExistingLeave && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold">Mode Perbarui Surat Izin / Sakit</span>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Santri dan sesi pengajian terkunci sesuai surat yang dibuat. Anda dapat memperbarui <strong>status kehadiran (izin/sakit)</strong>, <strong>keterangan</strong>, dan <strong>bukti foto lampiran</strong>.
                    </p>
                  </div>
                </div>
              )}

              {feedbackMessage && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                    feedbackMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedbackMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedbackMessage.text}</span>
                </div>
              )}

              {isExistingLeave ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Santri Terkait
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
                      Sesuai Surat
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-200">
                        {selectedChild?.fullName ? (
                          selectedChild.fullName.slice(0, 2).toUpperCase()
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {selectedChild?.fullName ||
                            editingHistoryItem?.studentName ||
                            'Santri'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedChild?.className ||
                            selectedChild?.generationName ||
                            'Santri'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : childrenList.length > 1 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Pilih Santri / Ananda
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStudentBottomSheetOpen(true)}
                    className="w-full p-3.5 rounded-2xl border border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-xs text-left flex items-center justify-between gap-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-100">
                        {selectedChild?.fullName ? (
                          selectedChild.fullName.slice(0, 2).toUpperCase()
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {selectedChild?.fullName || 'Pilih Santri'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedChild?.className ||
                            selectedChild?.generationName ||
                            'Santri'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold">
                      Ganti
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Santri / Ananda
                  </span>
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-200">
                      {selectedChild?.fullName ? (
                        selectedChild.fullName.slice(0, 2).toUpperCase()
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {selectedChild?.fullName || 'Santri'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedChild?.className ||
                          selectedChild?.generationName ||
                          'Santri'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isExistingLeave ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Sesi Jadwal Terkait
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
                      Sesuai Surat
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100/80 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {selectedSchedule?.title ||
                          editingHistoryItem?.scheduleTitle ||
                          'Sesi Pengajian'}
                      </span>
                      {selectedSchedule?.className && (
                        <span className="text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-semibold">
                          {selectedSchedule.className}
                        </span>
                      )}
                    </div>
                    {(selectedSchedule?.startTime ||
                      editingHistoryItem?.scheduleStartTime) && (
                      <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(
                            selectedSchedule?.startTime ||
                              editingHistoryItem!.scheduleStartTime
                          ).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(
                            selectedSchedule?.startTime ||
                              editingHistoryItem!.scheduleStartTime
                          ).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {selectedSchedule?.endTime && (
                            <>
                              {' '}
                              –{' '}
                              {new Date(
                                selectedSchedule.endTime
                              ).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </>
                          )}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Pengajar:{' '}
                      {selectedSchedule?.primaryTeacherName ||
                        editingHistoryItem?.verifiedByTeacherName ||
                        'Ustadz Pengampu'}
                      {selectedSchedule?.venuePlaceName &&
                        ` • ${selectedSchedule.venuePlaceName}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Pilih Sesi Jadwal Pengajian
                    </span>
                    {isLoadingSchedules && (
                      <span className="text-xs text-indigo-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Memuat jadwal...
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isLoadingSchedules}
                    onClick={() => setIsSessionBottomSheetOpen(true)}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${
                      selectedSchedule
                        ? 'border-indigo-500 bg-white shadow-xs hover:border-indigo-600 hover:shadow-sm'
                        : 'border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'
                    } disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
                  >
                    {selectedSchedule ? (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-sm font-bold text-slate-900">
                            {selectedSchedule.title}
                          </span>
                          {selectedSchedule.className && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-semibold">
                              {selectedSchedule.className}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(
                              selectedSchedule.startTime
                            ).toLocaleDateString('id-ID', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              timeZone: 'Asia/Jakarta',
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(
                              selectedSchedule.startTime
                            ).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Jakarta',
                            })}
                            {selectedSchedule.endTime && (
                              <>
                                {' '}
                                –{' '}
                                {new Date(
                                  selectedSchedule.endTime
                                ).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Jakarta',
                                })}
                              </>
                            )}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Pengajar: {selectedSchedule.primaryTeacherName}
                          {selectedSchedule.venuePlaceName &&
                            ` • ${selectedSchedule.venuePlaceName}`}
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0 py-1">
                        <p className="text-sm font-semibold text-slate-500">
                          {isLoadingSchedules
                            ? 'Memuat daftar sesi...'
                            : 'Pilih sesi pengajian'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Rentang: 1 minggu lalu · hari ini · 1 minggu mendatang
                        </p>
                      </div>
                    )}

                    <div
                      className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        selectedSchedule
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {selectedSchedule ? 'Ganti' : 'Pilih'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  {upcomingSchedules.length === 0 && !isLoadingSchedules && (
                    <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-2xl text-xs text-amber-800">
                      Tidak ada jadwal tersedia dalam rentang 1 minggu untuk santri ini.
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Jenis Alasan Ketidakhadiran
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAbsenceStatus('IZIN')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      absenceStatus === 'IZIN'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5 text-xs">
                      <BookOpen
                        className={`w-5 h-5 ${
                          absenceStatus === 'IZIN'
                            ? 'text-indigo-600'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>Izin Ada Keperluan</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAbsenceStatus('SAKIT')}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      absenceStatus === 'SAKIT'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-xs ring-1 ring-amber-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5 text-xs">
                      <HeartPulse
                        className={`w-5 h-5 ${
                          absenceStatus === 'SAKIT'
                            ? 'text-amber-600'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>Sakit / Kurang Sehat</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="absence-notes-textarea"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
                >
                  Keterangan / Alasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="absence-notes-textarea"
                  name="absenceNotes"
                  value={absenceNotes}
                  onChange={(e) => setAbsenceNotes(e.target.value)}
                  required
                  rows={4}
                  placeholder={
                    absenceStatus === 'SAKIT'
                      ? 'Contoh: Ananda sedang demam sejak kemarin malam dan perlu istirahat di rumah.'
                      : 'Contoh: Ada acara keluarga di luar kota yang tidak dapat ditinggalkan.'
                  }
                  className="w-full text-sm p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none bg-white shadow-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                  <span>
                    Foto Bukti / Surat Dokter{' '}
                    <span className="font-normal text-slate-500 normal-case">
                      (Opsional)
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 font-normal">
                    Max 5MB · JPG/PNG
                  </span>
                </div>

                {attachmentPreview ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center gap-3">
                    <img
                      src={attachmentPreview}
                      alt="Preview Lampiran"
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0 shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        Foto Lampiran Terpilih
                      </p>
                      <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Siap dikirim
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      aria-label="Hapus lampiran"
                      className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center font-bold cursor-pointer border border-rose-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="absence-attachment-input"
                    className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
                  >
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2" />
                    <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">
                      Unggah foto surat / bukti
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Foto kamera HP atau pilih dari galeri
                    </span>
                    <input
                      id="absence-attachment-input"
                      name="absenceAttachment"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="h-20" />
            </div>
          </form>

          <div className="border-t border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] gap-2">
            <div className="flex justify-between items-center gap-1">
              <div>
                {isExistingLeave && selectedConfirmationId && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onCancelRequest(selectedConfirmationId)}
                    className="min-h-[44px] py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    title="Batalkan dan hapus surat izin ini"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span className="hidden sm:inline">Batalkan Surat</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="min-h-[44px] flex-1 sm:flex-none py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  form="absence-request-form"
                  type="submit"
                  disabled={
                    isPending || !selectedScheduleId || !absenceNotes.trim()
                  }
                  className={`min-h-[44px] py-2 px-3 rounded-xl text-white text-sm font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer ${
                    isExistingLeave
                      ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {isExistingLeave ? 'Menyimpan...' : 'Mengirimkan...'}
                      </span>
                    </>
                  ) : isExistingLeave ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Simpan Izin</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Kirim Izin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted &&
        isSessionBottomSheetOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pilih Sesi Pengajian"
            className="!mt-0 fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsSessionBottomSheetOpen(false);
            }}
          >
            <div
              ref={sessionSheetRef}
              className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95"
            >
              <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Pilih Sesi Pengajian
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rentang: 1 minggu lalu · hari ini · 1 minggu mendatang
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSessionBottomSheetOpen(false)}
                  aria-label="Tutup daftar sesi"
                  className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {isLoadingSchedules ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="text-sm">Memuat jadwal...</span>
                  </div>
                ) : selectableSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-600">
                        Tidak ada sesi yang dapat dipilih
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs">
                        Semua sesi pengajian dalam rentang 1 minggu ini sudah memiliki surat izin atau belum ada jadwal.
                      </p>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const today = new Date();
                    const todayStr = today.toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    });
                    let lastDateStr = '';
                    return selectableSchedules.map((sch) => {
                      const schDate = new Date(sch.startTime);
                      const schDateStr = schDate.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });
                      const isToday = schDateStr === todayStr;
                      const isPast = schDate < today && !isToday;
                      const showDateHeader = schDateStr !== lastDateStr;
                      lastDateStr = schDateStr;
                      const isSelected = sch.id === selectedScheduleId;

                      return (
                        <React.Fragment key={sch.id}>
                          {showDateHeader && (
                            <div className="flex items-center gap-2 pt-2 pb-0.5">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  isToday
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : isPast
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {isToday ? 'HARI INI' : isPast ? 'LAMPAU' : 'MENDATANG'}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                {schDateStr}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectSchedule(sch);
                              setIsSessionBottomSheetOpen(false);
                            }}
                            className={`w-full p-3.5 rounded-2xl border text-left flex items-start justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 shadow-xs ring-1 ring-indigo-500/20'
                                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900">
                                  {sch.title}
                                </span>
                                {sch.className && (
                                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
                                    {sch.className}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {schDate.toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZone: 'Asia/Jakarta',
                                  })}
                                  {sch.endTime && (
                                    <>
                                      {' '}
                                      –{' '}
                                      {new Date(sch.endTime).toLocaleTimeString(
                                        'id-ID',
                                        {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          timeZone: 'Asia/Jakarta',
                                        }
                                      )}
                                    </>
                                  )}
                                </span>
                                {sch.venuePlaceName && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {sch.venuePlaceName}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {sch.primaryTeacherName}
                              </p>
                            </div>
                            <div
                              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600'
                                  : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </button>
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                <div className="h-3" />
              </div>

              <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsSessionBottomSheetOpen(false)}
                  className="w-full min-h-[44px] py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {mounted &&
        isStudentBottomSheetOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pilih Santri atau Ananda"
            className="!mt-0 fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsStudentBottomSheetOpen(false);
            }}
          >
            <div
              ref={studentSheetRef}
              className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95"
            >
              <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Pilih Santri / Ananda
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih ananda yang akan diajukan surat izin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStudentBottomSheetOpen(false)}
                  aria-label="Tutup daftar santri"
                  className="min-w-[40px] min-h-[40px] rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {childrenList.map((c) => {
                  const isSelected = c.id === selectedChildId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedChildId(c.id);
                        setSelectedScheduleId('');
                        setIsStudentBottomSheetOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 shadow-xs ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}
                        >
                          {c.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {c.fullName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {c.className || c.generationName || 'Santri'}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
                <div className="h-2" />
              </div>

              <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsStudentBottomSheetOpen(false)}
                  className="w-full min-h-[44px] py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
