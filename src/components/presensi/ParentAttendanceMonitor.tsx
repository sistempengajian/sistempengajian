'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import {
  Users,
  Clock,
  MapPin,
  UserCheck,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  Loader2,
  HeartPulse,
  Info,
  FileText,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Plus,
  Check,
  X,
  Eye,
  Edit3,
  RefreshCw,
  FileEdit,
  ChevronRight,
  Trash2,
  User,
  Camera,
  QrCode,
  Printer,
  Download,
  Sparkles,
} from 'lucide-react';
import {
  submitParentAbsenceRequest,
  cancelParentAbsenceRequest,
  getChildUpcomingSchedules,
  getParentAbsenceHistory,
  submitParentQrScan,
} from '@/app/(protected)/presensi/actions';

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
  todayAttendanceStatus?: 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'ALPA' | 'NOT_STARTED';
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
  const [childrenList, setChildrenList] = useState<ChildAttendanceSummary[]>(initialChildren);
  const [activeTab, setActiveTab] = useState<'monitor' | 'leave'>(initialTab);
  const [absenceHistory, setAbsenceHistory] = useState<AbsenceHistoryItem[]>(initialAbsenceHistory);

  // Modal State
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState<boolean>(
    Boolean(preselectedScheduleId || initialTab === 'leave')
  );
  const [selectedChildId, setSelectedChildId] = useState<string>(
    preselectedStudentId || (initialChildren[0]?.id ?? '')
  );
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(preselectedScheduleId || '');
  const [upcomingSchedules, setUpcomingSchedules] = useState<UpcomingScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState<boolean>(false);
  const [absenceStatus, setAbsenceStatus] = useState<'IZIN' | 'SAKIT'>('IZIN');
  const [absenceNotes, setAbsenceNotes] = useState<string>('');
  const [attachmentData, setAttachmentData] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isAttachmentRemoved, setIsAttachmentRemoved] = useState<boolean>(false);
  const [isSessionBottomSheetOpen, setIsSessionBottomSheetOpen] = useState<boolean>(false);
  const [isStudentBottomSheetOpen, setIsStudentBottomSheetOpen] = useState<boolean>(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<AbsenceHistoryItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [viewingAttachmentUrl, setViewingAttachmentUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  // Scanner Kamera Orang Tua State
  const [scanningChild, setScanningChild] = useState<ChildAttendanceSummary | null>(null);
  const [isParentScanModalOpen, setIsParentScanModalOpen] = useState<boolean>(false);
  const [isScanningCamera, setIsScanningCamera] = useState<boolean>(false);
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [scanSuccessData, setScanSuccessData] = useState<{
    studentName: string;
    scheduleTitle: string;
    points: number;
    time: string;
  } | null>(null);
  const parentScannerRef = useRef<Html5Qrcode | null>(null);
  const isScanCooldownRef = useRef<boolean>(false);
  const isScanStartingRef = useRef<boolean>(false);

  // Kartu QR Santri State
  const [selectedChildForCard, setSelectedChildForCard] = useState<ChildAttendanceSummary | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [childQrDataUrl, setChildQrDataUrl] = useState<string | null>(null);
  const [isGeneratingCardImage, setIsGeneratingCardImage] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Santri & Jadwal yang sedang dipilih di form
  const selectedChild = childrenList.find((c) => c.id === selectedChildId) || childrenList[0];
  const selectedSchedule = upcomingSchedules.find((s) => s.id === selectedScheduleId);
  const isExistingLeave = Boolean(editingHistoryItem);
  const selectedConfirmationId =
    editingHistoryItem?.id ||
    selectedSchedule?.existingRecord?.confirmationId ||
    absenceHistory.find((h) => h.scheduleId === selectedScheduleId && h.studentId === selectedChildId)?.id ||
    null;

  // Filter sesi pengajian: sesi yang sudah ada surat pengajuan JANGAN DITAMPILKAN LAGI
  const selectableSchedules = upcomingSchedules.filter((sch) => {
    const hasLeave = Boolean(
      sch.existingRecord?.confirmationStatus ||
      sch.existingRecord?.status === 'IZIN' ||
      sch.existingRecord?.status === 'SAKIT'
    );
    return !hasLeave;
  });

  // Helper untuk memilih sesi jadwal dalam mode buat baru
  const handleSelectSchedule = (sch: UpcomingScheduleItem) => {
    if (isExistingLeave) return; // Mode edit surat: sesi dikunci dan tidak dapat diganti
    setSelectedScheduleId(sch.id);
    setFeedbackMessage(null);
    setAbsenceStatus('IZIN');
    setAbsenceNotes('');
    setAttachmentPreview(null);
    setAttachmentData(null);
    setIsAttachmentRemoved(false);
  };

  // Fetch child's upcoming schedules & auto-select
  const fetchSchedulesForChild = useCallback(
    async (childId: string, scheduleIdToSelect?: string, isEditMode: boolean = false) => {
      if (!childId) return;
      setIsLoadingSchedules(true);
      try {
        const schedules = await getChildUpcomingSchedules(childId);
        setUpcomingSchedules(schedules as UpcomingScheduleItem[]);

        // Sesi yang belum diajukan izinnya untuk default selection
        const availableSchedules = (schedules as UpcomingScheduleItem[]).filter(
          (s) =>
            !s.existingRecord?.confirmationStatus &&
            s.existingRecord?.status !== 'IZIN' &&
            s.existingRecord?.status !== 'SAKIT'
        );

        let targetId = '';
        if (isEditMode && scheduleIdToSelect) {
          // Dalam mode edit surat, pilih jadwal yang sesuai surat yang sedang diedit
          targetId = scheduleIdToSelect;
        } else if (scheduleIdToSelect) {
          // Dalam mode buat baru dengan jadwal spesifik diminta
          const targetSch = schedules.find((s) => s.id === scheduleIdToSelect);
          const hasLeave = Boolean(
            targetSch?.existingRecord?.confirmationStatus ||
            targetSch?.existingRecord?.status === 'IZIN' ||
            targetSch?.existingRecord?.status === 'SAKIT'
          );
          if (!hasLeave) {
            targetId = scheduleIdToSelect;
          } else {
            targetId = availableSchedules[0]?.id || '';
          }
        } else {
          // Mode buat baru umum: pilih sesi pertama yang belum diajukan izinnya
          targetId = availableSchedules[0]?.id || '';
        }

        setSelectedScheduleId(targetId);

        // Hanya isi form jika dalam mode edit surat yang telah ada
        if (isEditMode && targetId) {
          const targetSch = schedules.find((s) => s.id === targetId);
          if (targetSch?.existingRecord) {
            if (targetSch.existingRecord.reasonType === 'SAKIT' || targetSch.existingRecord.status === 'SAKIT') {
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

  // Load upcoming schedules saat modal dibuka dalam mode buat baru atau anak diganti
  useEffect(() => {
    if (isAbsenceModalOpen && selectedChildId && !editingHistoryItem) {
      fetchSchedulesForChild(selectedChildId, undefined, false);
    }
  }, [isAbsenceModalOpen, selectedChildId, editingHistoryItem, fetchSchedulesForChild]);

  const handleOpenAbsenceModal = (child?: ChildAttendanceSummary, specificScheduleId?: string) => {
    setEditingHistoryItem(null);
    const targetChildId = child ? child.id : (selectedChildId || initialChildren[0]?.id || '');
    setSelectedChildId(targetChildId);
    const targetScheduleId = specificScheduleId || (child?.todaySchedule ? child.todaySchedule.scheduleId : '');
    setSelectedScheduleId(targetScheduleId || '');
    setAbsenceStatus('IZIN');
    setAbsenceNotes('');
    setAttachmentData(null);
    setAttachmentPreview(null);
    setIsAttachmentRemoved(false);
    setFeedbackMessage(null);
    setIsAbsenceModalOpen(true);
    fetchSchedulesForChild(targetChildId, targetScheduleId || undefined, false);
  };

  const handleEditExistingAbsence = (item: AbsenceHistoryItem) => {
    if (item.status !== 'PENDING') {
      alert('Surat izin yang telah diverifikasi atau disetujui ustadz pengampu tidak dapat diedit lagi.');
      return;
    }
    setEditingHistoryItem(item);
    setSelectedChildId(item.studentId);
    setSelectedScheduleId(item.scheduleId);
    setAbsenceStatus(item.reasonType === 'SAKIT' ? 'SAKIT' : 'IZIN');
    setAbsenceNotes(item.parentNotes || '');
    if (item.attachmentUrl) {
      setAttachmentPreview(item.attachmentUrl);
      setAttachmentData(null);
      setIsAttachmentRemoved(false);
    } else {
      setAttachmentPreview(null);
      setAttachmentData(null);
      setIsAttachmentRemoved(false);
    }
    setFeedbackMessage(null);
    setIsAbsenceModalOpen(true);
    fetchSchedulesForChild(item.studentId, item.scheduleId, true);
  };

  const handleCancelAbsenceRequest = async (confirmationId: string) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan dan menghapus surat permohonan izin ini?')) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await cancelParentAbsenceRequest(confirmationId);
        if (res.success) {
          const cancelledItem = absenceHistory.find((h) => h.id === confirmationId);
          const targetScheduleId = cancelledItem?.scheduleId || selectedScheduleId;
          const targetStudentId = cancelledItem?.studentId || selectedChildId;

          // Hapus dari riwayat izin
          setAbsenceHistory((prev) => prev.filter((h) => h.id !== confirmationId));

          // Reset di upcomingSchedules
          setUpcomingSchedules((prev) =>
            prev.map((s) => {
              if (s.id === targetScheduleId) {
                return { ...s, existingRecord: null };
              }
              return s;
            })
          );

          // Reset status presensi jika sesuai sesi hari ini
          setChildrenList((prev) =>
            prev.map((c) => {
              if (c.id === targetStudentId && c.todaySchedule?.scheduleId === targetScheduleId) {
                return {
                  ...c,
                  todayAttendanceStatus: 'NOT_STARTED',
                  todayNotes: null,
                };
              }
              return c;
            })
          );

          if (isAbsenceModalOpen && selectedScheduleId === targetScheduleId) {
            handleCloseAbsenceModal();
          }

          alert('Surat permohonan izin berhasil dibatalkan.');
        }
      } catch (err: unknown) {
        const error = err as Error;
        alert(error.message || 'Gagal membatalkan surat izin.');
      }
    });
  };

  const handleCloseAbsenceModal = () => {
    setIsAbsenceModalOpen(false);
    setEditingHistoryItem(null);
    setSelectedScheduleId('');
    setAbsenceStatus('IZIN');
    setAbsenceNotes('');
    setAttachmentData(null);
    setAttachmentPreview(null);
    setIsAttachmentRemoved(false);
    setFeedbackMessage(null);
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
      alert('Hanya file gambar (JPG, PNG, WEBP) yang didukung untuk lampiran surat.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal adalah 5MB.');
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
      alert('Silakan pilih ananda dan sesi jadwal pengajian.');
      return;
    }

    const selectedChild = childrenList.find((c) => c.id === selectedChildId);
    const targetSchedule = upcomingSchedules.find((s) => s.id === selectedScheduleId);
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

          // Optimistic update status if matches today's schedule
          if (selectedChild?.todaySchedule?.scheduleId === selectedScheduleId) {
            setChildrenList((prev) =>
              prev.map((c) => {
                if (c.id === selectedChildId) {
                  return {
                    ...c,
                    todayAttendanceStatus: absenceStatus,
                    todayNotes: absenceNotes ? `[Izin Orang Tua] ${absenceNotes}` : '[Izin Orang Tua] Diajukan oleh wali',
                  };
                }
                return c;
              })
            );
          }

          // Optimistic update upcoming schedules list
          setUpcomingSchedules((prev) =>
            prev.map((s) => {
              if (s.id === selectedScheduleId) {
                return {
                  ...s,
                  existingRecord: {
                    status: absenceStatus,
                    notes: absenceNotes,
                    confirmationStatus: 'PENDING',
                    reasonType: absenceStatus,
                    parentNotes: absenceNotes,
                    attachmentUrl: finalAttachment,
                    confirmationId: res.confirmationId,
                  },
                };
              }
              return s;
            })
          );

          // Update absence history: if already exists, update in place; otherwise prepend
          setAbsenceHistory((prev) => {
            const existingIdx = prev.findIndex(
              (h) => h.studentId === selectedChildId && h.scheduleId === selectedScheduleId
            );
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                reasonType: absenceStatus,
                parentNotes: absenceNotes || null,
                status: 'PENDING',
                confirmedAt: null,
                attachmentUrl: finalAttachment,
              };
              return updated;
            } else {
              const newHistoryItem: AbsenceHistoryItem = {
                id: res.confirmationId,
                studentId: selectedChildId,
                studentName: selectedChild?.fullName || 'Santri',
                scheduleId: selectedScheduleId,
                scheduleTitle: targetSchedule?.title || 'Sesi Pengajian',
                scheduleStartTime: targetSchedule?.startTime || new Date().toISOString(),
                reasonType: absenceStatus,
                status: 'PENDING',
                parentNotes: absenceNotes || null,
                attachmentUrl: finalAttachment,
                createdAt: new Date().toISOString(),
              };
              return [newHistoryItem, ...prev];
            }
          });

          setFeedbackMessage({
            text:
              res.message ||
              (willBeUpdate
                ? `Surat Izin untuk ${selectedChild?.fullName || 'ananda'} berhasil diperbarui.`
                : `Surat Izin Digital untuk ${selectedChild?.fullName || 'ananda'} berhasil dikirimkan.`),
            type: 'success',
          });

          setTimeout(() => {
            handleCloseAbsenceModal();
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

  // Lifecycle Scanner Kamera Orang Tua & Cleanup saat unmount
  useEffect(() => {
    if (isParentScanModalOpen && scanningChild) {
      const timer = setTimeout(() => {
        startParentScanner();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopParentScanner();
      };
    }
  }, [isParentScanModalOpen, scanningChild]);

  useEffect(() => {
    return () => {
      if (parentScannerRef.current) {
        try {
          if (parentScannerRef.current.isScanning) {
            parentScannerRef.current.stop().then(() => parentScannerRef.current?.clear()).catch(() => { });
          } else {
            parentScannerRef.current.clear();
          }
        } catch {
          // Abaikan
        }
      }
    };
  }, []);

  const stopParentScanner = async () => {
    setIsScanningCamera(false);
    const scanner = parentScannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch {
        // Abaikan
      } finally {
        parentScannerRef.current = null;
      }
    }
  };

  const startParentScanner = async () => {
    if (isScanStartingRef.current || !scanningChild) return;
    const container = document.getElementById('parent-camera-reader');
    if (!container) return;

    try {
      isScanStartingRef.current = true;
      setScanErrorMessage(null);

      if (parentScannerRef.current) {
        try {
          if (parentScannerRef.current.isScanning) {
            await parentScannerRef.current.stop();
          }
          parentScannerRef.current.clear();
        } catch {
          // Abaikan
        }
      }

      const scanner = new Html5Qrcode('parent-camera-reader');
      parentScannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(140, Math.min(250, Math.floor(minEdge * 0.75)));
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: 'environment',
            aspectRatio: 1.0,
          },
        },
        handleParentScanSuccess,
        () => { }
      );

      setIsScanningCamera(true);
    } catch (err: unknown) {
      console.error('Parent camera start error:', err);
      setScanErrorMessage('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser Anda.');
      setIsScanningCamera(false);
    } finally {
      isScanStartingRef.current = false;
    }
  };

  const handleParentScanSuccess = async (decodedText: string) => {
    if (isScanCooldownRef.current || isProcessingScan || !scanningChild?.todaySchedule) return;

    isScanCooldownRef.current = true;
    setIsProcessingScan(true);
    setScanErrorMessage(null);

    try {
      const res = await submitParentQrScan(
        decodedText,
        scanningChild.todaySchedule.scheduleId,
        scanningChild.id
      );

      if (res.success) {
        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        const nowTimeStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const targetChildName = scanningChild.fullName;
        const targetScheduleTitle = scanningChild.todaySchedule.scheduleTitle;

        // Optimistic update status kehadiran anak di daftar
        setChildrenList((prev) =>
          prev.map((c) => {
            if (c.id === scanningChild.id) {
              const wasPresent = c.todayAttendanceStatus === 'HADIR' || c.todayAttendanceStatus === 'TERLAMBAT';
              const newTotal = wasPresent ? c.monthlyStats.totalSessions : c.monthlyStats.totalSessions + 1;
              const newHadir = wasPresent ? c.monthlyStats.hadirCount : c.monthlyStats.hadirCount + 1;
              const newRate = newTotal > 0 ? Math.round((newHadir / newTotal) * 100) : 100;
              return {
                ...c,
                todayAttendanceStatus: 'HADIR',
                todayCheckInTime: res.checkInTime || nowTimeStr,
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

        await stopParentScanner();
        setIsParentScanModalOpen(false);
        setScanningChild(null);

        setScanSuccessData({
          studentName: targetChildName,
          scheduleTitle: targetScheduleTitle,
          points: res.pointsEarned || 10,
          time: res.checkInTime || nowTimeStr,
        });
      } else {
        setScanErrorMessage(res.message || 'QR code tidak valid atau sesi belum aktif.');
        setTimeout(() => {
          isScanCooldownRef.current = false;
        }, 2500);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setScanErrorMessage(error.message || 'Gagal memproses kode QR presensi.');
      setTimeout(() => {
        isScanCooldownRef.current = false;
      }, 2500);
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleOpenParentScanModal = (child: ChildAttendanceSummary) => {
    if (!child.todaySchedule) {
      alert('Tidak ada jadwal pengajian aktif untuk ananda hari ini.');
      return;
    }
    setScanningChild(child);
    setScanErrorMessage(null);
    setIsProcessingScan(false);
    isScanCooldownRef.current = false;
    setIsParentScanModalOpen(true);
  };

  const handleCloseParentScanModal = async () => {
    await stopParentScanner();
    setIsParentScanModalOpen(false);
    setScanningChild(null);
    setScanErrorMessage(null);
    setIsProcessingScan(false);
    isScanCooldownRef.current = false;
  };

  const handleOpenCardModal = async (child: ChildAttendanceSummary) => {
    setSelectedChildForCard(child);
    setIsCardModalOpen(true);
    try {
      const qrUrl = await QRCode.toDataURL(`santri:${child.id}`, {
        width: 360,
        margin: 1.5,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setChildQrDataUrl(qrUrl);
    } catch (err) {
      console.error('Gagal membuat QR santri:', err);
    }
  };

  const handleCloseCardModal = () => {
    setIsCardModalOpen(false);
    setSelectedChildForCard(null);
    setChildQrDataUrl(null);
  };

  const handleDownloadCardPng = async () => {
    if (!selectedChildForCard || !childQrDataUrl) return;
    setIsGeneratingCardImage(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 600;
      canvas.height = 850;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border luar
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Header Emerald
      ctx.fillStyle = '#059669';
      ctx.fillRect(16, 16, canvas.width - 32, 100);

      // Text Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SISTEM PENGAJIAN', canvas.width / 2, 55);

      ctx.fillStyle = '#d1fae5';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText("GENERASI QUR'ANI", canvas.width / 2, 85);

      // Nama Santri
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.fillText(selectedChildForCard.fullName, canvas.width / 2, 165);

      // Generasi & Kelompok
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Generasi: ${selectedChildForCard.generationName || 'Santri'}`, canvas.width / 2, 200);

      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      const subInfo = `${selectedChildForCard.className ? selectedChildForCard.className + ' • ' : ''}${selectedChildForCard.organizationName || 'Kelompok Binaan'}`;
      ctx.fillText(subInfo, canvas.width / 2, 225);

      // Divider
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 245);
      ctx.lineTo(canvas.width - 60, 245);
      ctx.stroke();

      // Gambar QR Code
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.src = childQrDataUrl;

      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = (e) => reject(e);
      });

      const qrSize = 340;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 275;

      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);
      ctx.fillRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30);

      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

      // ID Unik
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`ID: ${selectedChildForCard.id.slice(0, 18)}...`, canvas.width / 2, 665);

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('Kartu Presensi Resmi Santri • Simpan & Tunjukkan ke Pengajar', canvas.width / 2, 750);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `kartu-santri-${selectedChildForCard.fullName.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download card error:', err);
      alert('Gagal mengunduh kartu QR santri.');
    } finally {
      setIsGeneratingCardImage(false);
    }
  };

  const handlePrintCard = () => {
    if (!selectedChildForCard || !childQrDataUrl) return;
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      alert('Popup diblokir oleh browser. Izinkan popup untuk mencetak kartu santri.');
      return;
    }
    const child = selectedChildForCard;
    const qrUrl = childQrDataUrl;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Cetak Kartu Santri - ${child.fullName}</title>
          <style>
            @page {
              size: 85mm 125mm;
              margin: 0;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #ffffff;
              margin: 0;
              padding: 16px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .card {
              width: 80mm;
              height: 118mm;
              border: 2px solid #cbd5e1;
              border-radius: 12px;
              overflow: hidden;
              background: #ffffff;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              text-align: center;
              position: relative;
            }
            .header {
              background: #059669;
              color: #ffffff;
              padding: 12px 8px;
            }
            .header h1 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .header p {
              margin: 2px 0 0 0;
              font-size: 10px;
              opacity: 0.9;
              letter-spacing: 0.5px;
            }
            .body {
              padding: 10px 14px;
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
            }
            .name {
              font-size: 15px;
              font-weight: bold;
              color: #0f172a;
              margin: 4px 0 2px 0;
              line-height: 1.2;
            }
            .meta {
              font-size: 11px;
              color: #059669;
              font-weight: 600;
              margin: 0;
            }
            .submeta {
              font-size: 10px;
              color: #64748b;
              margin: 2px 0 8px 0;
            }
            .qr-container {
              background: #f8fafc;
              border: 1.5px solid #cbd5e1;
              border-radius: 10px;
              padding: 8px;
              display: inline-block;
            }
            .qr-img {
              width: 160px;
              height: 160px;
              display: block;
            }
            .student-id {
              font-family: monospace;
              font-size: 9px;
              color: #475569;
              margin-top: 4px;
            }
            .footer {
              font-size: 9px;
              color: #94a3b8;
              margin-top: 6px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 6px;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>Sistem Pengajian</h1>
              <p>GENERASI QUR'ANI</p>
            </div>
            <div class="body">
              <div>
                <div class="name">${child.fullName}</div>
                <div class="meta">Generasi: ${child.generationName || 'Santri'}</div>
                <div class="submeta">${child.className ? child.className + ' • ' : ''}${child.organizationName || 'Kelompok Binaan'}</div>
              </div>
              <div>
                <div class="qr-container">
                  <img class="qr-img" src="${qrUrl}" alt="QR Santri" />
                </div>
                <div class="student-id">ID: ${child.id.slice(0, 18)}...</div>
              </div>
              <div class="footer">
                Kartu Presensi Resmi Santri • Tunjukkan ke Pengajar Sesi
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (childrenList.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto border border-indigo-200/60">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Belum Ada Data Ananda Terhubung</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Akun orang tua Anda belum terhubung dengan santri binaan. Hubungi pengurus kelompok atau wali kelas untuk menghubungkan profil santri Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Info & Action Toolbar */}
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleOpenAbsenceModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Surat Izin Digital</span>
          </button>
        </div>
      </div>

      {/* Segmented Control Tab */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('monitor')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'monitor'
            ? 'bg-white text-indigo-900 shadow-xs border border-indigo-100'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Monitoring Kehadiran ({childrenList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'leave'
            ? 'bg-white text-indigo-900 shadow-xs border border-indigo-100'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Riwayat Surat Izin ({absenceHistory.length})</span>
        </button>
      </div>

      {/* TAB 1: MONITORING KEHADIRAN ANANDA */}
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
                {/* Header Kartu Santri */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">{child.fullName}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span className="font-semibold text-indigo-600">{child.generationName}</span>
                        {child.className && <span>• {child.className}</span>}
                        {child.organizationName && <span>• {child.organizationName}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Badge Status Kehadiran Hari Ini & Tombol Kartu QR */}
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal(child)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Lihat & Cetak Kartu Identitas QR Santri"
                    >
                      <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kartu QR Santri</span>
                    </button>
                    {child.todayAttendanceStatus === 'HADIR' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hadir {child.todayCheckInTime ? `(${child.todayCheckInTime} WIB)` : ''}</span>
                      </span>
                    )}
                    {child.todayAttendanceStatus === 'TERLAMBAT' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Terlambat {child.todayCheckInTime ? `(${child.todayCheckInTime} WIB)` : ''}</span>
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
                    {(!child.todayAttendanceStatus || child.todayAttendanceStatus === 'NOT_STARTED') && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Menunggu Sesi</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Badan Kartu: Detail Jadwal Hari Ini & Statistik Bulanan */}
                <div className="p-5 space-y-4">
                  {/* 1. Sesi Jadwal Hari Ini */}
                  {child.todaySchedule ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {child.todaySchedule.scheduleTitle}
                          </span>
                          {child.todaySchedule.status === 'ACTIVE' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-full animate-pulse">
                              SEDANG BERLANGSUNG
                            </span>
                          )}
                        </div>

                        {canRequestAbsence && (
                          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleOpenParentScanModal(child)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95"
                              title="Pindai QR code ustadz untuk presensi anak"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Scan QR Kehadiran</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAbsenceModal(child, child.todaySchedule?.scheduleId)}
                              className=
                              'px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 active:scale-95'
                            >

                              <FileText className="w-3.5 h-3.5" />
                              <span>Ajukan Surat Izin Sesi Ini</span>

                            </button>




                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {child.todaySchedule.startTime} - {child.todaySchedule.endTime} WIB
                          </span>
                        </div>
                        {child.todaySchedule.venueName && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{child.todaySchedule.venueName}</span>
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

                      {/* Materi yang dipelajari */}
                      {child.todaySchedule.materialTitles.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                            <span>Materi Kajian Hari Ini:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {child.todaySchedule.materialTitles.map((title, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs"
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Catatan Khusus Hari Ini jika ada */}
                      {child.todayNotes && (
                        <div className="text-xs text-slate-600 italic bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                          Catatan: {child.todayNotes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="w-8 h-8 text-slate-400 shrink-0" />
                        <span className="text-center">Tidak ada jadwal pengajian aktif untuk ananda hari ini.</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenAbsenceModal(child)}
                          className="px-3 py-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Izin Sesi Mendatang
                        </button>
                      </div>

                    </div>
                  )}

                  {/* 2. Statistik Kehadiran 30 Hari Terakhir */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700">Tingkat Kehadiran 30 Hari Terakhir</span>
                      <span className="font-extrabold text-indigo-600">{child.monthlyStats.attendanceRate}%</span>
                    </div>

                    {/* Progress Bar Multi-warna */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      {child.monthlyStats.totalSessions > 0 ? (
                        <>
                          <div
                            style={{
                              width: `${(child.monthlyStats.hadirCount / child.monthlyStats.totalSessions) * 100}%`,
                            }}
                            className="bg-emerald-500 transition-all duration-500"
                            title={`Hadir: ${child.monthlyStats.hadirCount}`}
                          />
                          <div
                            style={{
                              width: `${(child.monthlyStats.izinCount / child.monthlyStats.totalSessions) * 100}%`,
                            }}
                            className="bg-blue-400 transition-all duration-500"
                            title={`Izin: ${child.monthlyStats.izinCount}`}
                          />
                          <div
                            style={{
                              width: `${(child.monthlyStats.sakitCount / child.monthlyStats.totalSessions) * 100}%`,
                            }}
                            className="bg-orange-400 transition-all duration-500"
                            title={`Sakit: ${child.monthlyStats.sakitCount}`}
                          />
                          <div
                            style={{
                              width: `${(child.monthlyStats.alpaCount / child.monthlyStats.totalSessions) * 100}%`,
                            }}
                            className="bg-rose-400 transition-all duration-500"
                            title={`Alpa: ${child.monthlyStats.alpaCount}`}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-slate-200" />
                      )}
                    </div>

                    {/* Legenda Metrik Ringkas */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-2 font-medium">
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
                      <span className="text-slate-400">• Total {child.monthlyStats.totalSessions} Sesi</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div >
      )
      }

      {/* TAB 2: RIWAYAT SURAT IZIN DIGITAL */}
      {
        activeTab === 'leave' && (
          <div className="space-y-4">
            {absenceHistory.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200/60">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Belum Ada Pengajuan Surat Izin</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Anda belum pernah mengajukan surat izin atau sakit digital untuk ananda. Anda dapat mengajukannya kapan pun ananda berhalangan hadir.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAbsenceModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Surat Izin Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {absenceHistory.map((item) => {
                  const dateFormatted = new Date(item.scheduleStartTime).toLocaleDateString('id-ID', {
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
                          <span className="font-extrabold text-sm text-slate-900">{item.studentName}</span>
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

                          {/* Status Verifikasi Badge */}

                          {item.status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              MENUNGGU VERIFIKASI USTADZ
                            </span>
                          )}
                          {item.status === 'CONFIRMED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>DISETUJUI PENGAMPU</span>
                            </span>
                          )}
                          {item.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <X className="w-3 h-3" />
                              <span>DITOLAK (DITANDAI ALPA)</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 font-medium">
                          Sesi: <span className="text-slate-800 font-semibold">{item.scheduleTitle}</span> ({dateFormatted})
                        </div>

                        {item.parentNotes && (
                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 italic">
                            Catatan: &ldquo;{item.parentNotes}&rdquo;
                          </div>
                        )}

                        {item.verifiedByTeacherName && (
                          <div className="text-[11px] text-slate-500">
                            Diverifikasi oleh: <strong className="text-slate-700">{item.verifiedByTeacherName}</strong>
                          </div>
                        )}
                      </div>

                      {/* Aksi: Perbarui Izin & Batalkan (HANYA MUNCUL SEBELUM DISETUJUI PENGAJAR / STATUS PENDING) & Lihat Bukti Foto */}
                      <div className="shrink-0 self-start sm:self-center flex items-center gap-2">
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditExistingAbsence(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                              title="Perbarui alasan atau ganti berkas surat izin"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Perbarui</span>
                            </button>

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleCancelAbsenceRequest(item.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
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
                            onClick={() => setViewingAttachmentUrl(item.attachmentUrl!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
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
        )
      }

      {/* MODAL FULL SCREEN — AJUKAN / PERBARUI SURAT IZIN DIGITAL */}
      {
        mounted && isAbsenceModalOpen && createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 animate-fade-in">
            {/* Header Modal Full Screen */}
            <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3.5 sm:px-6 border-b border-slate-200/80 shadow-xs ${isExistingLeave ? 'bg-amber-50/80' : 'bg-white/90'} backdrop-blur-sm`}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center border shadow-xs ${isExistingLeave
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
                  <h2 className={`font-extrabold text-sm sm:text-base leading-tight ${isExistingLeave ? 'text-amber-900' : 'text-slate-900'}`}>
                    {isExistingLeave ? 'Perbarui Surat Izin / Sakit' : 'Ajukan Surat Izin / Sakit'}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                    {isExistingLeave
                      ? 'Perbarui keterangan ketidakhadiran atau berkas bukti surat izin ananda'
                      : 'Pengajuan digital resmi langsung ke lembar presensi Pengajar'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAbsenceModal}
                disabled={isPending}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold transition-colors cursor-pointer text-base leading-none"
                aria-label="Tutup modal"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form
              id="absence-request-form"
              onSubmit={handleSubmitAbsence}
              className="flex-1 overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
                {/* Notifikasi Batasan 1 Surat Izin Per Sesi */}
                {isExistingLeave && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 leading-relaxed">
                      <span className="font-bold">Mode Perbarui Surat Izin / Sakit</span>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Santri dan sesi pengajian terkunci sesuai surat yang dibuat. Anda dapat memperbarui <strong>status kehadiran (izin/sakit)</strong>, <strong>keterangan</strong>, dan <strong>bukti foto lampiran</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Pesan status / error */}
                {feedbackMessage && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${feedbackMessage.type === 'success'
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

                {/* 1. Santri / Ananda — Di edit mode dihilangkan tombol pilihnya & otomatis sesuai surat */}
                {isExistingLeave ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Santri Terkait</label>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
                        Sesuai Surat
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-200">
                          {selectedChild?.fullName ? selectedChild.fullName.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {selectedChild?.fullName || editingHistoryItem?.studentName || 'Santri'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{selectedChild?.className || selectedChild?.generationName || 'Santri'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : childrenList.length > 1 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pilih Santri / Ananda</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStudentBottomSheetOpen(true)}
                      className="w-full p-3.5 rounded-2xl border border-indigo-200 bg-white hover:border-indigo-400 hover:shadow-xs text-left flex items-center justify-between gap-3 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-100">
                          {selectedChild?.fullName ? selectedChild.fullName.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-slate-900 truncate">{selectedChild?.fullName || 'Pilih Santri'}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{selectedChild?.className || selectedChild?.generationName || 'Santri'}</p>
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
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Santri / Ananda</label>
                    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-200">
                        {selectedChild?.fullName ? selectedChild.fullName.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-900 truncate">{selectedChild?.fullName || 'Santri'}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{selectedChild?.className || selectedChild?.generationName || 'Santri'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Sesi Jadwal Pengajian — Di edit mode dikunci & tidak dapat diganti */}
                {isExistingLeave ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sesi Jadwal Terkait</label>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
                        Sesuai Surat
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-100/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {selectedSchedule?.title || editingHistoryItem?.scheduleTitle || 'Sesi Pengajian'}
                        </span>
                        {selectedSchedule?.className && (
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-semibold">
                            {selectedSchedule.className}
                          </span>
                        )}
                      </div>
                      {(selectedSchedule?.startTime || editingHistoryItem?.scheduleStartTime) && (
                        <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(
                              selectedSchedule?.startTime || editingHistoryItem!.scheduleStartTime
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
                              selectedSchedule?.startTime || editingHistoryItem!.scheduleStartTime
                            ).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {selectedSchedule?.endTime && (
                              <> – {new Date(selectedSchedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>
                            )}
                          </span>
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500">
                        Pengajar: {selectedSchedule?.primaryTeacherName || editingHistoryItem?.verifiedByTeacherName || 'Ustadz Pengampu'}
                        {selectedSchedule?.venuePlaceName && ` • ${selectedSchedule.venuePlaceName}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pilih Sesi Jadwal Pengajian</label>
                      {isLoadingSchedules && (
                        <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Memuat jadwal...
                        </span>
                      )}
                    </div>

                    {/* Tombol Trigger Sesi */}
                    <button
                      type="button"
                      disabled={isLoadingSchedules}
                      onClick={() => setIsSessionBottomSheetOpen(true)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${selectedSchedule
                        ? 'border-indigo-500 bg-white shadow-xs hover:border-indigo-600 hover:shadow-sm'
                        : 'border-dashed border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30'
                        } disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
                    >
                      {selectedSchedule ? (
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="text-sm font-bold text-slate-900">{selectedSchedule.title}</span>
                            {selectedSchedule.className && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-semibold">
                                {selectedSchedule.className}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(selectedSchedule.startTime).toLocaleDateString('id-ID', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(selectedSchedule.startTime).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                              {selectedSchedule.endTime && (
                                <> – {new Date(selectedSchedule.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>
                              )}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Pengajar: {selectedSchedule.primaryTeacherName}
                            {selectedSchedule.venuePlaceName && ` • ${selectedSchedule.venuePlaceName}`}
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0 py-1">
                          <p className="text-sm font-semibold text-slate-400">
                            {isLoadingSchedules ? 'Memuat daftar sesi...' : 'Pilih sesi pengajian'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Rentang: 1 minggu lalu · hari ini · 1 minggu mendatang
                          </p>
                        </div>
                      )}

                      <div className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${selectedSchedule
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                        : 'bg-slate-100 text-slate-500'
                        }`}>
                        {selectedSchedule ? 'Ganti' : 'Pilih'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {upcomingSchedules.length === 0 && !isLoadingSchedules && (
                      <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-2xl text-[11px] text-amber-800">
                        Tidak ada jadwal tersedia dalam rentang 1 minggu untuk santri ini.
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Tipe Alasan (Sakit vs Izin) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Jenis Alasan Ketidakhadiran</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAbsenceStatus('IZIN')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${absenceStatus === 'IZIN'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium hover:border-slate-300'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 text-xs">
                        <BookOpen className={`w-5 h-5 ${absenceStatus === 'IZIN' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span>Izin Ada Keperluan</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbsenceStatus('SAKIT')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${absenceStatus === 'SAKIT'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-xs ring-1 ring-amber-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium hover:border-slate-300'
                        }`}
                    >
                      <div className="flex flex-col items-center gap-1.5 text-xs">
                        <HeartPulse className={`w-5 h-5 ${absenceStatus === 'SAKIT' ? 'text-amber-600' : 'text-slate-400'}`} />
                        <span>Sakit / Kurang Sehat</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4. Catatan / Penjelasan Alasan */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Keterangan / Alasan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
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

                {/* 5. Lampiran Bukti / Surat Dokter (Opsional) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                    <span>Foto Bukti / Surat Dokter <span className="font-normal text-slate-400 normal-case">(Opsional)</span></span>
                    <span className="text-[10px] text-slate-400 font-normal">Max 5MB · JPG/PNG</span>
                  </label>

                  {attachmentPreview ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center gap-3">
                      <img
                        src={attachmentPreview}
                        alt="Preview Lampiran"
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0 shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">Foto Lampiran Terpilih</p>
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Siap dikirim
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center font-bold cursor-pointer border border-rose-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2" />
                      <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">
                        Unggah foto surat / bukti
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Foto kamera HP atau pilih dari galeri
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Spacer bottom untuk action button sticky */}
                <div className="h-20" />
              </div>
            </form>

            {/* Action Buttons — Sticky Footer */}
            <div className="border-t border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-3 safe-area-inset-bottom gap-2">
              <div className='flex justify-between item-center gap-1'>
                {isExistingLeave && selectedConfirmationId && (
                  < button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCancelAbsenceRequest(selectedConfirmationId)}
                    className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    title="Batalkan dan hapus surat izin ini"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span className="hidden sm:inline">Batalkan Surat</span>
                  </button>
                )}
                <div className='flex flex-wrap justify-between gap-2'>
                  <button
                    type="button"
                    onClick={handleCloseAbsenceModal}
                    disabled={isPending}
                    className="flex-1 sm:flex-none py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-bold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    form="absence-request-form"
                    type="submit"
                    disabled={isPending || !selectedScheduleId || !absenceNotes.trim()}
                    className={` py-2 px-3 rounded-xl text-white text-sm font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer ${isExistingLeave
                      ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                      }`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isExistingLeave ? 'Menyimpan...' : 'Mengirimkan...'}</span>
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
        )
      }

      {/* BOTTOM SHEET — PILIH SESI JADWAL PENGAJIAN */}
      {
        mounted && isSessionBottomSheetOpen && createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsSessionBottomSheetOpen(false);
            }}
          >
            <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
              {/* Drag Handle (mobile) */}
              <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              {/* Header Bottom Sheet */}
              <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Pilih Sesi Pengajian</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rentang: 1 minggu lalu · hari ini · 1 minggu mendatang
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSessionBottomSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Daftar Sesi */}
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
                      <p className="text-sm font-bold text-slate-600">Tidak ada sesi yang dapat dipilih</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Semua sesi pengajian dalam rentang 1 minggu ini sudah memiliki surat izin atau belum ada jadwal.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const today = new Date();
                      const todayStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                      let lastDateStr = '';
                      return selectableSchedules.map((sch) => {
                        const schDate = new Date(sch.startTime);
                        const schDateStr = schDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        const isToday = schDateStr === todayStr;
                        const isPast = schDate < today && !isToday;
                        const showDateHeader = schDateStr !== lastDateStr;
                        lastDateStr = schDateStr;
                        const isSelected = sch.id === selectedScheduleId;

                        return (
                          <React.Fragment key={sch.id}>
                            {showDateHeader && (
                              <div className="flex items-center gap-2 pt-2 pb-0.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : isPast
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-emerald-100 text-emerald-700'
                                  }`}>
                                  {isToday ? 'HARI INI' : isPast ? 'LAMPAU' : 'MENDATANG'}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">{schDateStr}</span>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectSchedule(sch);
                                setIsSessionBottomSheetOpen(false);
                              }}
                              className={`w-full p-3.5 rounded-2xl border text-left flex items-start justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${isSelected
                                ? 'border-indigo-600 bg-indigo-50 shadow-xs ring-1 ring-indigo-500/20'
                                : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xs'
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900">{sch.title}</span>
                                  {sch.className && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
                                      {sch.className}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {schDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                    {sch.endTime && (
                                      <> – {new Date(sch.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</>
                                    )}
                                  </span>
                                  {sch.venuePlaceName && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      {sch.venuePlaceName}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {sch.primaryTeacherName}
                                </p>
                              </div>
                              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5 ${isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-slate-300'
                                }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </button>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </>
                )}
                <div className="h-3" />
              </div>

              {/* Footer Bottom Sheet */}
              <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 safe-area-inset-bottom">
                <button
                  type="button"
                  onClick={() => setIsSessionBottomSheetOpen(false)}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* BOTTOM SHEET — PILIH SANTRI / ANANDA */}
      {
        mounted && isStudentBottomSheetOpen && createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/50 backdrop-blur-xs animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsStudentBottomSheetOpen(false);
            }}
          >
            <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
              {/* Drag Handle (mobile) */}
              <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
                <div className="w-10 h-1 bg-slate-300 rounded-full" />
              </div>

              {/* Header Bottom Sheet */}
              <div className="flex-shrink-0 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Pilih Santri / Ananda</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih ananda yang akan diajukan surat izin
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStudentBottomSheetOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-base leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Daftar Santri */}
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
                        fetchSchedulesForChild(c.id);
                        setIsStudentBottomSheetOpen(false);
                      }}
                      className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer ${isSelected
                        ? 'border-indigo-600 bg-indigo-50 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 hover:shadow-xs'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                          {c.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-slate-900 truncate">{c.fullName}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{c.className || c.generationName || 'Santri'}</p>
                        </div>
                      </div>
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'border-slate-300'
                        }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
                <div className="h-2" />
              </div>

              {/* Footer Bottom Sheet */}
              <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 safe-area-inset-bottom">
                <button
                  type="button"
                  onClick={() => setIsStudentBottomSheetOpen(false)}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* MODAL FULL PREVIEW GAMBAR ATTACHMENT */}
      {
        mounted && viewingAttachmentUrl && createPortal(
          <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white max-w-xl w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Lampiran Bukti Surat Izin</span>
                <button
                  type="button"
                  onClick={() => setViewingAttachmentUrl(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
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
        )
      }

      {/* MODAL SCAN QR KAMERA ORANG TUA UNTUK ANAK */}
      {
        mounted && isParentScanModalOpen && scanningChild && scanningChild.todaySchedule && createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isProcessingScan) handleCloseParentScanModal();
            }}
          >
            <div className="bg-white border border-slate-200/90 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/70 shadow-2xs">
                    <Camera className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Scan QR Presensi Sesi</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Untuk ananda: <span className="font-bold text-emerald-700">{scanningChild.fullName}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseParentScanModal}
                  disabled={isProcessingScan}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-50 transition-colors"
                  aria-label="Tutup kamera"
                >
                  ✕
                </button>
              </div>

              {/* Info Sesi */}
              <div className="px-5 py-2.5 bg-emerald-50/50 border-b border-emerald-100/70 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate font-bold text-slate-800">
                    {scanningChild.todaySchedule.scheduleTitle}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200/70 shadow-2xs shrink-0">
                  <Clock className="w-3 h-3 text-emerald-600" />
                  <span>{scanningChild.todaySchedule.startTime} - {scanningChild.todaySchedule.endTime} WIB</span>
                </div>
              </div>

              {/* Camera Viewport */}
              <div className="p-5 bg-slate-50/50 flex flex-col items-center">
                <div className="relative w-full aspect-square max-w-[300px] rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-200 shadow-md flex items-center justify-center">
                  <div
                    id="parent-camera-reader"
                    className="w-full h-full overflow-hidden flex items-center justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_video]:rounded-3xl"
                  />

                  {/* Laser Scanning Animation Overlay with Viewfinder Framing */}
                  {isScanningCamera && !isProcessingScan && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-400 rounded-2xl relative overflow-hidden shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]">
                        <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-bounce" />
                      </div>
                    </div>
                  )}

                  {/* Processing Overlay */}
                  {isProcessingScan && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center animate-in fade-in">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">Memverifikasi Kode Presensi...</p>
                        <p className="text-xs text-slate-500 mt-0.5">Mohon tunggu, mencatat kehadiran ananda</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message if any */}
                {scanErrorMessage && (
                  <div className="mt-3.5 w-full p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div className="flex-1 font-medium leading-relaxed">{scanErrorMessage}</div>
                  </div>
                )}

                {/* Instructions in system style card */}
                <div className="mt-3.5 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 text-[11px] text-indigo-900 flex items-center gap-2.5 w-full">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <p className="leading-relaxed">
                    Arahkan kamera ke layar ustadz yang menampilkan Dynamic QR Code presensi pengajian.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseParentScanModal}
                  disabled={isProcessingScan}
                  className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-[0.99]"
                >
                  Tutup Kamera
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* MODAL KARTU IDENTITAS DIGITAL SANTRI */}
      {
        mounted && isCardModalOpen && selectedChildForCard && createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isGeneratingCardImage) handleCloseCardModal();
            }}
          >
            <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Kartu QR Santri</h3>
                    <p className="text-[11px] text-slate-500">Kartu identitas presensi santri</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseCardModal}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Card Preview Container */}
              <div className="p-5 bg-slate-50 flex flex-col items-center">
                {/* ID Card Simulation */}
                <div className="w-full max-w-[280px] bg-white rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden text-center flex flex-col">
                  {/* Banner */}
                  <div className="bg-emerald-600 text-white p-3">
                    <h4 className="text-xs font-black tracking-wider uppercase">Sistem Pengajian</h4>
                    <p className="text-[9px] text-emerald-100 font-semibold tracking-widest mt-0.5">GENERASI QUR&apos;ANI</p>
                  </div>

                  {/* Profile info */}
                  <div className="p-3 pb-2">
                    <div className="w-11 h-11 mx-auto rounded-full bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center border-2 border-white shadow-2xs mb-2">
                      {selectedChildForCard.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <h5 className="font-extrabold text-sm text-slate-900 leading-tight">
                      {selectedChildForCard.fullName}
                    </h5>
                    <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                      {selectedChildForCard.generationName || 'Santri'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {selectedChildForCard.className ? `${selectedChildForCard.className} • ` : ''}
                      {selectedChildForCard.organizationName || 'Kelompok Binaan'}
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div className="px-4 py-2 flex flex-col items-center">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 inline-block shadow-inner">
                      {childQrDataUrl ? (
                        <img
                          src={childQrDataUrl}
                          alt="QR Santri"
                          className="w-40 h-40 object-contain mx-auto"
                        />
                      ) : (
                        <div className="w-40 h-40 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] font-mono text-slate-400 mt-1">
                      ID: {selectedChildForCard.id.slice(0, 16)}...
                    </p>
                  </div>

                  {/* Card footer note */}
                  <div className="py-2 px-3 border-t border-dashed border-slate-200 text-[9px] text-slate-400 bg-slate-50/50">
                    Tunjukkan kartu ini kepada Ustadz pengampu
                  </div>
                </div>

                {/* Informative Note */}
                <div className="mt-4 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    Kartu ini dapat dicetak (standar ID card) atau disimpan di HP untuk di-scan oleh pengajar jika anak tidak membawa smartphone.
                  </div>
                </div>
              </div>

              {/* Actions: Print and Download */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintCard}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Kartu</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCardPng}
                  disabled={isGeneratingCardImage}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingCardImage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{isGeneratingCardImage ? 'Menyiapkan...' : 'Download PNG'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* DIALOG POP-UP SUKSES PRESENSI ANANDA */}
      {
        mounted && scanSuccessData && createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-100 w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs mb-3">
                <Sparkles className="w-7 h-7 text-emerald-600 animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Alhamdulillah, Presensi Hadir!
              </h3>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Kehadiran ananda <span className="font-bold text-slate-900">{scanSuccessData.studentName}</span> pada sesi <span className="font-bold text-slate-900">{scanSuccessData.scheduleTitle}</span> berhasil dicatat pada jam {scanSuccessData.time} WIB.
              </p>

              <div className="mt-4 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-bold text-xs inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>+{scanSuccessData.points} Poin Istiqomah Santri</span>
              </div>

              <button
                type="button"
                onClick={() => setScanSuccessData(null)}
                className="mt-6 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Selesai &amp; Lihat Ringkasan
              </button>
            </div>
          </div>,
          document.body
        )
      }
    </div >
  );
}
