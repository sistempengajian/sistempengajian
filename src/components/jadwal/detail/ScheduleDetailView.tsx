'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  UserCheck,
  QrCode,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  BookOpen,
  ArrowLeft,
  Building2,
  GraduationCap,
  Layers,
  FileText,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Target,
  ShieldCheck,
  Check,
  MessageSquare,
  Calendar1,
} from 'lucide-react';
import { ScheduleStatus, ScheduleType, TierLevel, RollingTargetScope } from '@prisma/client';
import {
  assignSubstituteTeacher,
  removeSubstituteTeacher,
  updateScheduleStatus,
  deleteSchedule,
  approveScheduleProposal,
  rejectScheduleProposal,
} from '@/app/(protected)/jadwal/actions';
import ScheduleFormModal from '../ScheduleFormModal';
import {
  AvailableTeacher,
  AvailableClass,
  AvailableMaterial,
  AvailableGeneration,
  ScopedOrganization,
} from '../InteractiveCalendar';
import CircularProgressBar from '@/components/kurikulum/CircularProgressBar';

export interface ScheduleChecklistItemProgress {
  checklistItemId: string;
  totalStudents: number;
  completedCount: number;
  percentage: number;
  averageScore: number;
}

export interface ScheduleMaterialProgress {
  materialId: string;
  totalItems: number;
  completedItemsSum: number;
  totalPossibleCompletions: number;
  percentage: number;
  averageScore: number;
  totalStudents: number;
  completedStudents: number;
  checklistItemsProgress: Record<string, ScheduleChecklistItemProgress>;
}

export interface ClassProgressBreakdown {
  classId: string;
  className: string;
  totalStudents: number;
  materialsProgress: Record<string, ScheduleMaterialProgress>;
}

export interface StudentPersonalChecklistItemProgress {
  checklistItemId: string;
  isCompleted: boolean;
  score: number | null;
  teacherFeedback?: string | null;
  feedbackTags?: string[];
  evaluatedAt?: string | null;
}

export interface StudentPersonalMaterialProgress {
  materialId: string;
  totalItems: number;
  completedItems: number;
  percentage: number;
  averageScore: number;
  isCompleted: boolean;
  checklistItems: Record<string, StudentPersonalChecklistItemProgress>;
}

export interface StudentPersonalData {
  studentId: string;
  studentName: string;
  avatarUrl?: string | null;
  materialsProgress: Record<string, StudentPersonalMaterialProgress>;
}

export interface ScheduleProgressData {
  mode: 'COLLECTIVE' | 'PERSONAL';
  totalTargetStudents?: number;
  combined?: {
    totalStudents: number;
    scopeLabel: string;
    materialsProgress: Record<string, ScheduleMaterialProgress>;
  };
  classesBreakdown?: ClassProgressBreakdown[];
  studentsPersonal?: StudentPersonalData[];
  activeStudentId?: string;
  userRoleCategory?: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ';
}

interface ScheduleDetailViewProps {
  schedule: any;
  canManage: boolean;
  canDelegateBadal?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  requestedByUser?: { id: string; fullName: string; avatarUrl?: string | null } | null;
  currentUserId?: string;
  availableTeachers?: AvailableTeacher[];
  availableClasses?: AvailableClass[];
  availableMaterials?: AvailableMaterial[];
  availableGenerations?: AvailableGeneration[];
  scopedOrganizations?: ScopedOrganization[];
  currentUserOrgId?: string | null;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  roleCodes?: string[];
  progressData?: ScheduleProgressData;
}

export default function ScheduleDetailView({
  schedule,
  canManage,
  canDelegateBadal = false,
  canEdit = false,
  canDelete = false,
  canApprove = false,
  requestedByUser = null,
  currentUserId,
  availableTeachers = [],
  availableClasses = [],
  availableMaterials = [],
  availableGenerations = [],
  scopedOrganizations = [],
  currentUserOrgId = null,
  userTierLevel,
  roleCodes = [],
  progressData,
}: ScheduleDetailViewProps) {
  const router = useRouter();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBadalModalOpen, setIsBadalModalOpen] = useState(false);
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const isPersonal = progressData?.mode === 'PERSONAL';

  // State untuk filter personal (pilih anak jika orang tua memiliki >1 anak)
  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    return progressData?.activeStudentId || progressData?.studentsPersonal?.[0]?.studentId || '';
  });

  const activePersonalStudent = React.useMemo(() => {
    if (!progressData?.studentsPersonal) return null;
    return (
      progressData.studentsPersonal.find((s) => s.studentId === selectedChildId) ||
      progressData.studentsPersonal[0] ||
      null
    );
  }, [progressData?.studentsPersonal, selectedChildId]);

  // State filter per kelas untuk sesi gabungan (Mode Kolektif)
  const [selectedClassFilter, setSelectedClassFilter] = useState<'ALL' | string>('ALL');

  const activeMaterialsProgress = React.useMemo(() => {
    if (!progressData || isPersonal) return {};
    if (selectedClassFilter === 'ALL') {
      return progressData.combined?.materialsProgress || {};
    }
    const foundClass = progressData.classesBreakdown?.find(
      (c) => c.classId === selectedClassFilter
    );
    return foundClass ? foundClass.materialsProgress : progressData.combined?.materialsProgress || {};
  }, [progressData, selectedClassFilter, isPersonal]);

  const activeTotalStudents = React.useMemo(() => {
    if (!progressData || isPersonal) return 0;
    if (selectedClassFilter === 'ALL') {
      return progressData.combined?.totalStudents || 0;
    }
    const foundClass = progressData.classesBreakdown?.find(
      (c) => c.classId === selectedClassFilter
    );
    return foundClass ? foundClass.totalStudents : progressData.combined?.totalStudents || 0;
  }, [progressData, selectedClassFilter, isPersonal]);

  // State accordion untuk Capaian Materi
  const [expandedMaterialIds, setExpandedMaterialIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (schedule.scheduleMaterials && schedule.scheduleMaterials.length > 0) {
      // Default: buka materi pertama agar capaian langsung terlihat oleh pengguna
      const firstId = schedule.scheduleMaterials[0].material?.id || schedule.scheduleMaterials[0].id || 'mat-0';
      initial[firstId] = true;
    }
    return initial;
  });

  const toggleMaterialAccordion = (id: string) => {
    setExpandedMaterialIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const areAllMaterialsExpanded =
    (schedule.scheduleMaterials?.length ?? 0) > 0 &&
    schedule.scheduleMaterials.every(
      (sm: any, idx: number) => expandedMaterialIds[sm.material?.id || sm.id || `mat-${idx}`]
    );

  const toggleAllMaterials = () => {
    if (areAllMaterialsExpanded) {
      setExpandedMaterialIds({});
    } else {
      const allOpen: Record<string, boolean> = {};
      schedule.scheduleMaterials?.forEach((sm: any, idx: number) => {
        const id = sm.material?.id || sm.id || `mat-${idx}`;
        allOpen[id] = true;
      });
      setExpandedMaterialIds(allOpen);
    }
  };

  const start = new Date(schedule.startTime);
  const end = new Date(schedule.endTime);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

  const primaryTeacherRel = schedule.teachers?.find((t: any) => t.isPrimary);
  const coTeacherRels = schedule.teachers?.filter((t: any) => !t.isPrimary && !t.isSubstitute) || [];
  const substituteTeacherRel = schedule.teachers?.find((t: any) => t.isSubstitute);

  const isScheduleCompleted = schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED';
  const hasActiveSession = !isScheduleCompleted && schedule.attendanceSessions?.some((s: any) => s.isActive);
  const latestSession = schedule.attendanceSessions?.[0];
  const isCombined = (schedule.targetClasses?.length ?? 0) > 1;

  // Total santri sasaran jadwal
  const totalTargetStudents =
    progressData?.totalTargetStudents ??
    progressData?.combined?.totalStudents ??
    (isPersonal ? (progressData?.studentsPersonal?.length || 1) : 0);

  // Hitung ringkasan presensi jika ada catatan
  const attendanceRecords = latestSession?.records || [];
  const hadirCount = attendanceRecords.filter((r: any) => r.status === 'HADIR' || r.status === 'TERLAMBAT').length;
  const izinCount = attendanceRecords.filter((r: any) => r.status === 'IZIN').length;
  const sakitCount = attendanceRecords.filter((r: any) => r.status === 'SAKIT').length;
  const explicitAlpaCount = attendanceRecords.filter((r: any) => r.status === 'ALPA').length;

  const totalAccountedPresentOrExcused = hadirCount + izinCount + sakitCount;
  // Jika ada totalTargetStudents, santri yang belum absen otomatis terhitung sebagai ALPA / Belum Absen
  const alpaCount = Math.max(
    explicitAlpaCount,
    Math.max(0, totalTargetStudents - totalAccountedPresentOrExcused)
  );

  const handleStatusChange = (newStatus: ScheduleStatus) => {
    startTransition(async () => {
      const res = await updateScheduleStatus(schedule.id, newStatus);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleAssignBadal = () => {
    if (!selectedSubstituteId) return;
    startTransition(async () => {
      const res = await assignSubstituteTeacher(schedule.id, selectedSubstituteId);
      if (res.error) {
        alert(res.error);
      } else {
        setIsBadalModalOpen(false);
        setSelectedSubstituteId('');
        router.refresh();
      }
    });
  };

  const handleRemoveBadal = () => {
    if (!confirm('Cabut delegasi ustadz badal dan kembalikan ke Ustadz utama?')) return;
    startTransition(async () => {
      const res = await removeSubstituteTeacher(schedule.id);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal pengajian ini? Tindakan ini tidak dapat dibatalkan.')) return;
    startTransition(async () => {
      const res = await deleteSchedule(schedule.id);
      if (res.error) {
        alert(res.error);
      } else {
        router.push('/jadwal');
      }
    });
  };

  const handleApprove = () => {
    if (!confirm('Setujui pengajuan jadwal pengajian ini agar resmi aktif bagi seluruh santri & pengajar?')) return;
    startTransition(async () => {
      const res = await approveScheduleProposal(schedule.id);
      if (res.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Alasan penolakan pengajuan wajib diisi.');
      return;
    }
    startTransition(async () => {
      const res = await rejectScheduleProposal(schedule.id, rejectionReason);
      if (res.error) {
        alert(res.error);
      } else {
        setRejectModalOpen(false);
        router.refresh();
      }
    });
  };

  // Status badge styling
  const getStatusBadge = (status: ScheduleStatus) => {
    if (schedule.approvalStatus === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Menunggu Persetujuan PJ
        </span>
      );
    }
    if (schedule.approvalStatus === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-900 border border-rose-300">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          Pengajuan Ditolak
        </span>
      );
    }

    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            Sedang Berlangsung
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Selesai
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Diliburkan
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Terjadwal
          </span>
        );
    }
  };

  const getTierBadge = (tier: TierLevel) => {
    switch (tier) {
      case 'DAERAH':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold mr-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            Daerah
          </span>
        );
      case 'DESA':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold mr-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            Desa
          </span>
        );
      case 'KELOMPOK':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold mr-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            Kelompok
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in pb-16">
      {/* 1. Top Navigation & Breadcrumbs */}
      <div className="flex flex-col items-start justify-between gap-3">
        <div>
          <Link
            href="/jadwal"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100/80 border border-slate-200/80 transition-all active:scale-95 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Jadwal</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Link href="/jadwal" className="hover:text-teal-700 transition-colors">
            Jadwal
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-700 font-semibold truncate max-w-[200px]">
            {schedule.title}
          </span>
        </div>
      </div>

      {/* Approval Status Banner */}
      {schedule.approvalStatus === 'PENDING' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 border border-amber-200/80 shadow-2xs space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                <Clock className="w-5 h-5 text-amber-700" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-amber-950">
                    Pengajuan Jadwal / Sesi Pengajian
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                    Menunggu Persetujuan PJ
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {requestedByUser
                    ? `Diajukan oleh ${requestedByUser.fullName} (${schedule.requesterType === 'WALI_KELAS' ? 'Wali Kelas' : 'Pengajar'}). `
                    : 'Jadwal ini diajukan oleh Pengajar / Wali Kelas dan sedang menunggu peninjauan. '}
                  Sesi ini belum muncul pada kalender santri &amp; orang tua hingga disahkan oleh Pengurus Wilayah.
                </p>
              </div>
            </div>

            {canApprove && (
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui Jadwal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tolak Pengajuan</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {schedule.approvalStatus === 'REJECTED' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-50/90 border border-rose-200/80 shadow-2xs flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200">
            <XCircle className="w-5 h-5 text-rose-700" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-950">Pengajuan Jadwal Ditolak</h3>
            <p className="text-xs text-rose-800 leading-relaxed">
              Pengajuan sesi ini ditolak oleh Pengurus Wilayah. Silakan tinjau catatan berikut:
            </p>
            {schedule.notes && (
              <p className="text-xs font-medium text-rose-800 whitespace-pre-wrap bg-white/80 p-3 rounded-xl border border-rose-200/80 mt-1.5">
                {schedule.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. Hero Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {getStatusBadge(schedule.status)}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
              {schedule.title}
              {isCombined && (
                <span className="ml-1">
                  Gabungan
                </span>
              )}
            </h1>
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 flex-wrap items-center text-[11px] font-semibold">
                <Calendar1 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {schedule.scheduleType === 'REGULAR_ROUTINE' ? 'Rutin Mingguan' : 'Sesi Pengajian'}</span>
              </p>
              <div className='flex flex-wrap'>
                {getTierBadge(schedule.tierLevel)}
                {schedule.organization?.name && (
                  <span className="inline-flex items-center text-[11px] font-semibold">
                    <span>{schedule.organization.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            {/* Tombol Cockpit Presensi QR */}
            <Link
              href={`/presensi?scheduleId=${schedule.id}`}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs active:scale-95 w-full sm:w-auto ${hasActiveSession
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40 animate-pulse'
                : isScheduleCompleted
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>
                {hasActiveSession
                  ? 'Cockpit Presensi (Aktif)'
                  : isScheduleCompleted
                  ? 'Lihat Data Presensi'
                  : 'Buka Presensi QR'}
              </span>
            </Link>

            {/* Tombol Ajukan Surat Izin Mandiri (Orang Tua) */}
            {progressData?.userRoleCategory === 'ORANG_TUA' && !isScheduleCompleted && (
              <Link
                href={`/presensi?tab=leave&scheduleId=${schedule.id}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-2xs active:scale-95 w-full sm:w-auto"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>Ajukan Surat Izin</span>
              </Link>
            )}

            {(canEdit || canDelete) && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Edit3 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Edit</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200 transition-all cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                    title="Hapus Jadwal"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Status Bar for Managers */}
        {canManage && (schedule.approvalStatus === 'APPROVED' || !schedule.approvalStatus) && (
          <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span>Status Sesi Cepat:</span>
              </span>
              {isPending && (
                <span className="text-[11px] font-medium text-teal-600 sm:hidden animate-pulse">
                  Memperbarui...
                </span>
              )}
            </div>

            {/* 4 Tombol Status: grid 2x2 pada layar kecil, 4 baris horizontal pada layar desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 w-full sm:w-auto">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(ScheduleStatus.SCHEDULED)}
                className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${schedule.status === 'SCHEDULED'
                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs ring-1 ring-amber-300/60'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Terjadwal</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(ScheduleStatus.ACTIVE)}
                className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${schedule.status === 'ACTIVE'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs ring-1 ring-emerald-400/60'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 animate-pulse" />
                <span>Berlangsung</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(ScheduleStatus.COMPLETED)}
                className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${schedule.status === 'COMPLETED'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs ring-1 ring-indigo-300/60'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Selesai</span>
              </button>

              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(ScheduleStatus.CANCELLED)}
                className={`px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${schedule.status === 'CANCELLED'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs ring-1 ring-rose-300/60'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Diliburkan</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Executive Summary (4 Grid Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Waktu & Tanggal */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Waktu Sesi</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900">
              {start.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
              {end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </div>
            <div className="text-[11px] text-teal-700 font-semibold pt-1">
              Durasi: {durationMinutes} Menit
            </div>
          </div>
        </div>

        {/* Card 2: Lokasi Pelaksanaan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-teal-600" />
            <span>Lokasi Kajian</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900 truncate">
              {schedule.venuePlaceName}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              Tipe: {schedule.venueType || 'MASJID'}
            </div>
            <div className="text-[11px] text-slate-500 truncate pt-1">
              Wilayah: {schedule.organization?.name || 'Kelompok'}
            </div>
          </div>
        </div>

        {/* Card 3: Target Peserta */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Users className="w-4 h-4 text-teal-600" />
            <span>Target Peserta</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900">
              {schedule.targetScope === 'GENERASI'
                ? 'Berdasarkan Jenjang Usia'
                : schedule.targetScope === 'KELAS'
                  ? 'Berdasarkan Kelas Khusus'
                  : 'Umum Se-wilayah'}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {schedule.targetScope === 'GENERASI'
                ? `${schedule.targetGenerations?.length || 0} Jenjang Terpilih`
                : schedule.targetScope === 'KELAS'
                  ? `${schedule.targetClasses?.length || 0} Kelas Binaan`
                  : `Terbuka untuk Jamaah ${schedule.organization?.name || ''}`}
            </div>
          </div>
        </div>

        {/* Card 4: Pengajar Utama */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <User className="w-4 h-4 text-teal-600" />
            <span>Ustadz Utama</span>
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-bold text-slate-900 truncate">
              {primaryTeacherRel?.teacher?.fullName || 'Belum Ditentukan'}
            </div>
            <div className="text-xs text-slate-600 font-medium">
              {coTeacherRels.length > 0 ? `+${coTeacherRels.length} Guru Pendamping` : 'Pengampu Tunggal'}
            </div>
            {substituteTeacherRel && (
              <div className="text-[11px] text-amber-700 font-semibold pt-1 truncate">
                Badal: {substituteTeacherRel.teacher?.fullName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Section: Tim Pengajar & Ustadz Badal */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <User className="w-4 h-4 text-teal-600" />
            <span>Pengajar &amp; Badal</span>
          </div>
          {canDelegateBadal && !substituteTeacherRel && (
            <button
              type="button"
              onClick={() => setIsBadalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-all cursor-pointer active:scale-95"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Badal</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Ustadz Utama */}
          <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/40 flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
              {primaryTeacherRel?.teacher?.fullName.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[10px] font-bold">
                  Pengampu Utama
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">
                {primaryTeacherRel?.teacher?.fullName || 'Belum Ditentukan'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Penanggung jawab materi &amp; presensi</p>
            </div>
          </div>

          {/* Pengampu Pendamping */}
          {coTeacherRels.map((ct: any) => (
            <div
              key={ct.teacher.id}
              className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                {ct.teacher.fullName.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                  Pengampu Pendamping
                </span>
                <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">{ct.teacher.fullName}</h4>
                <p className="text-xs text-slate-500 mt-0.5">Ustadz pengampu bersama</p>
              </div>
            </div>
          ))}

          {/* Ustadz Badal */}
          {substituteTeacherRel ? (
            <div className="p-3.5 rounded-2xl border border-amber-300 bg-amber-50/50 flex items-start gap-3 relative">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white text-[10px] font-bold">
                    Ustadz Badal (Pengganti)
                  </span>
                  {canDelegateBadal && (
                    <button
                      type="button"
                      onClick={handleRemoveBadal}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Cabut
                    </button>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">
                  {substituteTeacherRel.teacher?.fullName}
                </h4>
                <p className="text-xs text-amber-800/80 mt-0.5">Menerima delegasi pengajaran sesi ini</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 5. Section: Materi Pengajian & Capaian Pembelajaran */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Materi Pengajian &amp; Capaian Pembelajaran</span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {schedule.scheduleMaterials?.length || 0} Materi Terjadwal
            </span>
            {schedule.scheduleMaterials && schedule.scheduleMaterials.length > 1 && (
              <button
                type="button"
                onClick={toggleAllMaterials}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
              >
                {areAllMaterialsExpanded ? 'Tutup Semua' : 'Buka Semua'}
              </button>
            )}
          </div>
        </div>

        {/* Switcher Filter (Orang Tua: Pilih Anak | Pengajar/PJ: Pilih Kelas Gabungan) */}
        {isPersonal && progressData?.studentsPersonal && progressData.studentsPersonal.length > 1 ? (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto no-scrollbar border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-500 px-2 shrink-0 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Pilih Ananda:</span>
            </span>
            {progressData.studentsPersonal.map((st) => (
              <button
                key={st.studentId}
                type="button"
                onClick={() => setSelectedChildId(st.studentId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${selectedChildId === st.studentId
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{st.studentName}</span>
              </button>
            ))}
          </div>
        ) : !isPersonal && progressData?.classesBreakdown && progressData.classesBreakdown.length > 1 ? (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl overflow-x-auto no-scrollbar border border-slate-200/60">
            <button
              type="button"
              onClick={() => setSelectedClassFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${selectedClassFilter === 'ALL'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Seluruh Peserta Gabungan ({progressData.combined?.totalStudents || 0} Santri)</span>
            </button>
            {progressData.classesBreakdown.map((cls) => (
              <button
                key={cls.classId}
                type="button"
                onClick={() => setSelectedClassFilter(cls.classId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${selectedClassFilter === cls.classId
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{cls.className} ({cls.totalStudents} Santri)</span>
              </button>
            ))}
          </div>
        ) : null}

        {schedule.scheduleMaterials && schedule.scheduleMaterials.length > 0 ? (
          <div className="space-y-3">
            {schedule.scheduleMaterials.map((sm: any, idx: number) => {
              const materialId = sm.material?.id || sm.id || `mat-${idx}`;
              const isExpanded = Boolean(expandedMaterialIds[materialId]);
              const checklistItems = sm.material?.checklistItems || [];
              const matProgress = activeMaterialsProgress[materialId];
              const personalMat = activePersonalStudent?.materialsProgress?.[materialId];

              return (
                <div
                  key={materialId}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isExpanded
                    ? 'bg-white border-teal-200/90 shadow-2xs ring-1 ring-teal-500/10'
                    : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                    }`}
                >
                  {/* Header Accordion (Bisa diklik untuk toggle buka/tutup) */}
                  <button
                    type="button"
                    onClick={() => toggleMaterialAccordion(materialId)}
                    aria-expanded={isExpanded}
                    className="w-full text-left p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between gap-3 cursor-pointer transition-colors select-none"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[10px] sm:text-[11px] font-bold shrink-0">
                          {sm.slotIndex === 0 ? 'Materi Utama' : `Materi Slot #${sm.slotIndex + 1}`}
                        </span>
                        {sm.material?.targetGeneration?.name && (
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                            {sm.material.targetGeneration.name}
                          </span>
                        )}
                        {isPersonal && activePersonalStudent && (
                          <span className="text-[10px] sm:text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 shrink-0 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{activePersonalStudent.studentName}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-row justify-between items-center gap-2 sm:gap-3 shrink-0">
                        <div className="flex flex-col gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                            {sm.material?.title || 'Materi Tanpa Judul'}
                          </h4>
                          {!isExpanded && sm.material?.description && (
                            <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                              {sm.material.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 text-left items-center">
                            {isPersonal ? (
                              personalMat && (
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-left">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold ${personalMat.isCompleted
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : personalMat.completedItems > 0
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                  >
                                    {personalMat.isCompleted
                                      ? '✓ Tuntas Modul'
                                      : personalMat.completedItems > 0
                                        ? `${personalMat.completedItems}/${personalMat.totalItems} Capaian Selesai`
                                        : 'Belum Tuntas'}
                                  </span>
                                  {personalMat.completedItems > 0 && personalMat.averageScore > 0 && (
                                    <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                      ★ Nilai: {personalMat.averageScore}
                                    </span>
                                  )}
                                </div>
                              )
                            ) : (
                              matProgress &&
                              matProgress.totalStudents > 0 && (
                                <>
                                  <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 leading-tight">
                                    {matProgress.completedStudents}/{matProgress.totalStudents}
                                  </span>
                                  <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight">
                                    Santri Tuntas
                                  </span>
                                  {matProgress.completedStudents > 0 && matProgress.averageScore > 0 && (
                                    <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 leading-tight">
                                      ★ {matProgress.averageScore}
                                    </span>
                                  )}
                                </>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 sm:gap-3 shrink-0">
                          {/* Circular Progress & Capaian Tuntas */}
                          {isPersonal ? (
                            personalMat && (
                              <CircularProgressBar
                                value={personalMat.percentage}
                                size={42}
                                strokeWidth={3.5}
                              />
                            )
                          ) : (
                            matProgress &&
                            matProgress.totalStudents > 0 && (
                              <CircularProgressBar
                                value={matProgress.percentage}
                                size={42}
                                strokeWidth={3.5}
                              />
                            )
                          )}

                          <div className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 bg-white border border-slate-200/60 shrink-0 shadow-2xs">
                            <ChevronDown
                              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-teal-600' : ''
                                }`}
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </button>

                  {/* Body Accordion (Konten & Capaian Pembelajaran) */}
                  {isExpanded && (
                    <div className="px-3.5 sm:px-4.5 pb-4 sm:pb-5 pt-1 space-y-3.5 border-t border-slate-100 animate-in fade-in-50 duration-150">
                      {/* Deskripsi Materi Lengkap */}
                      {sm.material?.description && (
                        <div className="pt-2">
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                            {sm.material.description}
                          </p>
                        </div>
                      )}

                      {/* Dokumen E-Kitab / Materi jika ada */}
                      {sm.material?.fileUrl && (
                        <div>
                          <a
                            href={sm.material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/70 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Buka E-Kitab / Dokumen Materi</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {/* Catatan Sesi Pengajar jika ada */}
                      {sm.notes && (
                        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                          <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold text-amber-950">Catatan Khusus Sesi Pengajian:</span>
                            <p className="text-amber-900 leading-relaxed whitespace-pre-line">{sm.notes}</p>
                          </div>
                        </div>
                      )}

                      {/* Rincian Butir Capaian Materi (Kurikulum) */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                            <Target className="w-3.5 h-3.5 text-teal-600" />
                            <span>Target Capaian ({checklistItems.length})</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Indikator kompetensi santri
                          </span>
                        </div>

                        {checklistItems.length > 0 ? (
                          <div className="space-y-2">
                            {checklistItems.map((item: any, cIdx: number) => {
                              const isDaerah = item.completionTierLevel === 'DAERAH_ONLY';
                              const isDesa = item.completionTierLevel === 'DESA_AND_ABOVE';
                              const itemProg = matProgress?.checklistItemsProgress?.[item.id];
                              const personalItemProg = personalMat?.checklistItems?.[item.id];

                              return (
                                <div
                                  key={item.id || `chk-${cIdx}`}
                                  className="p-3 rounded-xl bg-white border border-slate-200/90 hover:border-teal-300 transition-colors shadow-2xs flex flex-col gap-2"
                                >
                                  <div className="flex items-start gap-2.5 sm:gap-3">
                                    <span className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/80 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                      {cIdx + 1}
                                    </span>

                                    <div className="flex-1 min-w-0 space-y-1">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                                          {item.itemTitle}
                                        </span>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {item.pointsWeight > 0 && (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                              +{item.pointsWeight} Poin
                                            </span>
                                          )}
                                          {item.completionTierLevel && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200">
                                              {isDaerah
                                                ? 'Otoritas Daerah'
                                                : isDesa
                                                  ? 'Otoritas Desa+'
                                                  : 'Semua Jenjang'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    {item.description && (
                                      <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
                                        {item.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Indikator Progres Capaian Santri: Mode Personal vs Mode Kolektif */}
                                  {isPersonal ? (
                                    <div className="mt-0.5 pt-1.5 border-t border-slate-100 flex flex-col gap-1.5">
                                      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          {personalItemProg?.isCompleted ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                              <span>Tuntas</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium">
                                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              <span>Belum Selesai</span>
                                            </span>
                                          )}
                                        </div>

                                        {personalItemProg?.isCompleted &&
                                          personalItemProg?.score !== null &&
                                          personalItemProg?.score !== undefined &&
                                          personalItemProg.score > 0 && (
                                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                              <span>Nilai:</span>
                                              <strong>{personalItemProg.score}/100</strong>
                                            </span>
                                          )}
                                      </div>

                                      {personalItemProg?.teacherFeedback && (
                                        <div className="p-2.5 rounded-lg bg-teal-50/70 border border-teal-200/60 text-xs text-teal-950 flex items-start gap-2 mt-0.5">
                                          <MessageSquare className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                                          <div className="space-y-0.5">
                                            <span className="font-bold text-[11px] text-teal-800">
                                              Catatan Ustadz Pengampu:
                                            </span>
                                            <p className="text-teal-900 leading-relaxed italic">
                                              &ldquo;{personalItemProg.teacherFeedback}&rdquo;
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    itemProg &&
                                    itemProg.totalStudents > 0 && (
                                      <div className="mt-0.5 pt-1 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap mb-0.5">
                                          <span className="text-slate-600 font-medium">
                                            <strong className="text-slate-800 font-bold">
                                              {itemProg.completedCount} / {itemProg.totalStudents} Santri
                                            </strong>
                                          </span>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {itemProg.completedCount > 0 && itemProg.averageScore > 0 && (
                                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                                ★ {itemProg.averageScore}
                                              </span>
                                            )}
                                            <span
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${itemProg.percentage >= 80
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : itemProg.percentage >= 60
                                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}
                                            >
                                              {itemProg.percentage}% Tuntas
                                            </span>
                                          </div>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${itemProg.percentage >= 80
                                              ? 'bg-emerald-500'
                                              : itemProg.percentage >= 60
                                                ? 'bg-amber-500'
                                                : 'bg-teal-500'
                                              }`}
                                            style={{ width: `${itemProg.percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                            Belum ada rincian butir capaian spesifik pada master materi ini (kajian umum/tematik).
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Action Banner: Mode Personal vs Mode Pengajar */}
            {isPersonal ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50/90 to-emerald-50/70 border border-teal-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>
                      {progressData?.userRoleCategory === 'ORANG_TUA'
                        ? 'Pemantauan Capaian Belajar Ananda'
                        : 'Pemantauan Capaian Pembelajaran Mandiri'}
                    </span>
                  </h5>
                  <p className="text-xs text-slate-600">
                    {progressData?.userRoleCategory === 'ORANG_TUA'
                      ? 'Capaian dan evaluasi diverifikasi langsung oleh Ustadz Pengampu selama sesi pengajian berlangsung.'
                      : 'Checklist dan nilai capaian dievaluasi oleh Ustadz Pengampu saat sesi pengajian berlangsung.'}
                  </p>
                </div>
                {schedule.scheduleMaterials?.some((sm: any) => sm.material?.fileUrl) && (
                  <a
                    href={schedule.scheduleMaterials.find((sm: any) => sm.material?.fileUrl)?.material.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Buka E-Kitab</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50/90 to-emerald-50/70 border border-teal-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5">
                  <h5 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Penilaian Capaian Santri Sesi Ini</span>
                  </h5>
                  <p className="text-xs text-slate-600">
                    Input checklist ketercapaian materi &amp; evaluasi nilai per santri secara langsung melalui lembar presensi sesi.
                  </p>
                </div>
                <Link
                  href={`/presensi?scheduleId=${schedule.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Input Nilai di Presensi</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
            <BookOpen className="w-7 h-7 text-slate-300" />
            <span className="font-semibold text-slate-700">
              Belum ada materi kurikulum yang dijadwalkan secara spesifik.
            </span>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-teal-700 font-bold hover:underline cursor-pointer"
              >
                + Edit Jadwal untuk Memilih Materi
              </button>
            )}
          </div>
        )
        }
      </div >

      {/* 6. Section: Rincian Target Peserta */}
      < div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4" >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <GraduationCap className="w-4 h-4 text-teal-600" />
            <span>Peserta Pengajian</span>
          </div>
          {schedule.targetClasses && schedule.targetClasses.length > 1 && (
            <span className="text-[12px] font-medium">
              {schedule.targetClasses.length} Kelas
            </span>
          )}
        </div>

        {/* Jika Berdasarkan Kelas */}
        {
          schedule.targetScope === 'KELAS' && schedule.targetClasses && schedule.targetClasses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {schedule.targetClasses.map((tc: any) => (
                <div
                  key={tc.class.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{tc.class.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {tc.class.generation?.name || 'Umum'} • {tc.class.tierLevel}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                </div>
              ))}
            </div>
          ) : schedule.targetScope === 'GENERASI' && schedule.targetGenerations && schedule.targetGenerations.length > 0 ? (
            /* Jika Berdasarkan Jenjang Usia */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {schedule.targetGenerations.map((tg: any) => (
                <div
                  key={tg.generation.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{tg.generation.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Kode: {tg.generation.code}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                    Target Usia
                  </span>
                </div>
              ))}
            </div>
          ) : (
            /* Umum se-wilayah */
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Sesi pengajian ini terbuka untuk <strong>seluruh santri dan jamaah</strong> di lingkungan{' '}
                <strong>{schedule.organization?.name || 'Wilayah'}</strong>.
              </span>
            </div>
          )
        }
      </div >

      {/* 7. Section: Catatan Teknis Sesi */}
      {
        schedule.notes && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileText className="w-4 h-4 text-teal-600" />
              <span>Catatan Khusus Sesi Pengajian</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
              {schedule.notes}
            </div>
          </div>
        )
      }

      {/* 8. Section: Presensi Sesi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <QrCode className="w-4 h-4 text-teal-600" />
            <span>Ringkasan Presensi</span>
          </div>
          <Link
            href={`/presensi?scheduleId=${schedule.id}`}
            className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
          >
            <span>Buka Halaman Presensi</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <span className="text-xl font-bold text-emerald-800">{hadirCount}</span>
            <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">Hadir</p>
          </div>
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-center">
            <span className="text-xl font-bold text-sky-800">{izinCount}</span>
            <p className="text-[11px] font-semibold text-sky-700 mt-0.5">Izin</p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <span className="text-xl font-bold text-amber-800">{sakitCount}</span>
            <p className="text-[11px] font-semibold text-amber-700 mt-0.5">Sakit</p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
            <span className="text-xl font-bold text-rose-800">{alpaCount}</span>
            <p className="text-[11px] font-semibold text-rose-700 mt-0.5">Alpa / Belum Absen</p>
          </div>
        </div>

        {progressData?.userRoleCategory === 'ORANG_TUA' && !isScheduleCompleted && (
          <div className="pt-2 flex justify-end">
            <Link
              href={`/presensi?tab=leave&scheduleId=${schedule.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              <span>Ajukan Izin / Sakit Ananda untuk Sesi Ini</span>
            </Link>
          </div>
        )}
      </div>

      {/* Modal Edit Jadwal Terpadu */}
      {
        isEditModalOpen && (
          <ScheduleFormModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            scheduleToEdit={schedule}
            availableTeachers={availableTeachers}
            availableClasses={availableClasses}
            availableMaterials={availableMaterials}
            availableGenerations={availableGenerations}
            scopedOrganizations={scopedOrganizations}
            currentUserOrgId={currentUserOrgId}
            userTierLevel={userTierLevel}
            roleCodes={roleCodes}
            onSuccess={() => {
              setIsEditModalOpen(false);
              router.refresh();
            }}
          />
        )
      }

      {/* Modal Delegasi Badal Cepat */}
      {
        isBadalModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full space-y-4 shadow-xl animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Delegasikan Ustadz Badal</h3>
                <button
                  type="button"
                  onClick={() => setIsBadalModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Pilih Ustadz Badal:</label>
                <select
                  value={selectedSubstituteId}
                  onChange={(e) => setSelectedSubstituteId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-medium"
                >
                  <option value="">-- Pilih Ustadz Pengganti --</option>
                  {availableTeachers
                    .filter((t) => !schedule.teachers?.some((st: any) => st.teacherId === t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBadalModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAssignBadal}
                  disabled={!selectedSubstituteId || isPending}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  Simpan Badal
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal Alasan Penolakan Pengajuan Jadwal */}
      {
        rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tolak Pengajuan Jadwal</h3>
                  <p className="text-xs text-slate-500">Berikan alasan penolakan agar pengajar dapat memperbaikinya</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Jam pelaksanaan bentrok dengan pengajian umum desa / Mohon sesuaikan materi..."
                  rows={3}
                  className="w-full p-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectionReason('');
                  }}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isPending || !rejectionReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isPending ? 'Menolak...' : 'Konfirmasi Tolak'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
