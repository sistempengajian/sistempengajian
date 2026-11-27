'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  MapPin,
  User,
  UserCheck,
  QrCode,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Users,
  BookOpen,
  CircleUser,
  Sparkles,
  X,
} from 'lucide-react';
import { ScheduleStatus, ScheduleType, TierLevel } from '@prisma/client';
import { updateScheduleStatus } from '@/app/(protected)/jadwal/actions';
import ScheduleChangeNotificationModal, {
  ScheduleNotificationData,
} from './ScheduleChangeNotificationModal';
import { useToast } from '@/components/ui/Toast';
import type { RoleTheme } from '@/lib/theme';

export interface TeacherRelation {
  teacher: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  isPrimary: boolean;
  isSubstitute: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  scheduleType: ScheduleType;
  tierLevel: TierLevel;
  targetScope?: 'KELAS' | 'GENERASI' | 'WILAYAH_UMUM';
  organizationId?: string;
  venuePlaceName: string;
  venueType?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  recurringRule?: string | null;
  status: ScheduleStatus;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  requestedByUserId?: string | null;
  requesterType?: string | null;
  approvalNotes?: string | null;
  notes?: string | null;
  teachers: TeacherRelation[];
  class?: {
    id: string;
    name: string;
    tierLevel: string;
    homeroomTeacherId?: string | null;
    generation?: {
      name: string;
      code: string;
    } | null;
  } | null;
  targetClasses?: {
    class: {
      id: string;
      name: string;
      tierLevel: string;
      homeroomTeacherId?: string | null;
    };
  }[];
  targetGenerations?: {
    generation: {
      id: string;
      name: string;
      code: string;
      color?: string | null;
    };
  }[];
  scheduleMaterials?: {
    slotIndex: number;
    material: {
      id: string;
      title: string;
    };
  }[];
  organization?: {
    id: string;
    name: string;
    type: string;
  } | null;
  attendanceSessions?: {
    id: string;
    isActive: boolean;
    openedAt?: Date | string | null;
  }[];
  connectedStudents?: {
    id: string;
    fullName: string;
  }[];
  connectedClasses?: string[];
}

interface ScheduleCardProps {
  schedule: ScheduleItem;
  canManage: boolean;
  canPropose?: boolean;
  currentUserId?: string | null;
  availableTeachers?: { id: string; fullName: string }[];
  activeRole?: 'manage' | 'teacher' | 'parent' | 'student';
  roleKey?: RoleTheme['roleKey'];
  onEdit: (schedule: ScheduleItem) => void;
  onDelete: (scheduleId: string) => void;
}

const ROLE_ICON_COLOR_MAP: Record<RoleTheme['roleKey'], string> = {
  SANTRI: 'text-emerald-600',
  PENGAJAR: 'text-teal-600',
  ORANG_TUA: 'text-indigo-600',
  PJ: 'text-blue-600',
  ADMIN_MASTER: 'text-purple-600',
};

const ROLE_USER_CIRCLE_MAP: Record<RoleTheme['roleKey'], string> = {
  SANTRI: 'bg-emerald-50 border-emerald-200/80 text-emerald-600',
  PENGAJAR: 'bg-teal-50 border-teal-200/80 text-teal-600',
  ORANG_TUA: 'bg-indigo-50 border-indigo-200/80 text-indigo-600',
  PJ: 'bg-blue-50 border-blue-200/80 text-blue-600',
  ADMIN_MASTER: 'bg-purple-50 border-purple-200/80 text-purple-600',
};

const TIME_FORMATTER_WIB = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});

const TIER_BADGE_MAP: Record<TierLevel, { label: string; className: string }> = {
  DAERAH: {
    label: 'Daerah',
    className: 'bg-purple-50 text-purple-700 border-purple-200/80',
  },
  DESA: {
    label: 'Desa',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  KELOMPOK: {
    label: 'Kelompok',
    className: 'bg-sky-50 text-sky-700 border-sky-200/80',
  },
};

function ScheduleCard({
  schedule,
  canManage,
  currentUserId = null,
  activeRole,
  roleKey = 'SANTRI',
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  const [, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [notificationModalData, setNotificationModalData] = useState<ScheduleNotificationData | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isTeacherTooltipOpen, setIsTeacherTooltipOpen] = useState(false);
  const teacherTooltipRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const iconAccent = ROLE_ICON_COLOR_MAP[roleKey] || 'text-emerald-600';
  const userCircleAccent =
    ROLE_USER_CIRCLE_MAP[roleKey] || 'bg-emerald-50 border-emerald-200/80 text-emerald-600';

  // Tutup tooltip & status menu saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!isTooltipOpen && !isTeacherTooltipOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsTooltipOpen(false);
      }
      if (teacherTooltipRef.current && !teacherTooltipRef.current.contains(e.target as Node)) {
        setIsTeacherTooltipOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTooltipOpen(false);
        setIsTeacherTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTooltipOpen, isTeacherTooltipOpen]);

  const start = new Date(schedule.startTime);
  const end = new Date(schedule.endTime);

  const primaryTeacher = schedule.teachers.find((t) => t.isPrimary)?.teacher;
  const coTeachers = schedule.teachers.filter((t) => !t.isPrimary && !t.isSubstitute);
  const substituteTeachers = schedule.teachers.filter((t) => t.isSubstitute);
  const hasBadal = substituteTeachers.length > 0;
  const displayedTeacherName = hasBadal
    ? substituteTeachers[0].teacher.fullName
    : primaryTeacher?.fullName || 'Belum Ditentukan';
  const additionalTeachersCount =
    substituteTeachers.length > 1
      ? coTeachers.length + (substituteTeachers.length - 1)
      : coTeachers.length;
  const hasMultipleTeachersOrBadal = coTeachers.length > 0 || substituteTeachers.length > 0;
  const hasActiveSession = Boolean(schedule.attendanceSessions?.some((s) => s.isActive));

  const connectedStudents = schedule.connectedStudents || [];
  const showStudentIndicator =
    (activeRole === 'parent' || connectedStudents.length > 0) && connectedStudents.length > 0;

  const isOwnPendingProposal =
    schedule.requestedByUserId === currentUserId && schedule.approvalStatus === 'PENDING';
  const canEdit = canManage || isOwnPendingProposal;
  const canDelete = canManage || isOwnPendingProposal;
  const isApproved = schedule.approvalStatus === 'APPROVED' || !schedule.approvalStatus;
  const canChangeStatus = canManage && isApproved;

  // Kontekstual QR action:
  // - Orang Tua: disembunyikan (fokus Detail / menu Presensi Anak)
  // - Santri: hanya tampil saat sesi sedang berlangsung (ACTIVE atau sesi QR terbuka)
  // - Pengajar / PJ: tampil pada semua sesi disetujui yang tidak diliburkan
  const isLiveSession = hasActiveSession || schedule.status === 'ACTIVE';
  const showQrAction =
    isApproved &&
    schedule.status !== 'CANCELLED' &&
    activeRole !== 'parent' &&
    (activeRole !== 'student' || isLiveSession);

  const tierBadge = TIER_BADGE_MAP[schedule.tierLevel] || TIER_BADGE_MAP.KELOMPOK;

  const renderStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Berlangsung
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            Selesai
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-600" />
            Diliburkan
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
            <Clock className="w-3 h-3 text-amber-600" />
            Terjadwal
          </span>
        );
    }
  };

  const handleStatusChange = (newStatus: ScheduleStatus) => {
    setShowStatusMenu(false);
    startTransition(async () => {
      const res = await updateScheduleStatus(schedule.id, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else if (res.needsConfirmation && res.notificationData) {
        setNotificationModalData(res.notificationData);
      }
    });
  };

  const resolveTargetLabel = () => {
    const classesCount = schedule.targetClasses?.length ?? (schedule.class ? 1 : 0);
    if (classesCount > 1) return `${classesCount} Kelas`;
    if (classesCount === 1) {
      return schedule.targetClasses?.[0]?.class.name || schedule.class?.name || '1 Kelas';
    }
    if (schedule.targetScope === 'GENERASI' || (schedule.targetGenerations?.length ?? 0) > 0) {
      return schedule.targetGenerations?.[0]?.generation.name || 'Jenjang Usia';
    }
    return schedule.organization?.name ? `Umum (${schedule.organization.name})` : 'Umum Se-wilayah';
  };

  const materialsCount = schedule.scheduleMaterials?.length ?? 0;
  const isCombined = (schedule.targetClasses?.length ?? 0) > 1;
  const startTimeText = TIME_FORMATTER_WIB.format(start);
  const endTimeText = TIME_FORMATTER_WIB.format(end);

  return (
    <div className="group relative p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 bg-white/95 hover:border-slate-300/90 transition-all duration-200 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.07)] hover:shadow-[0_10px_24px_-6px_rgba(15,23,42,0.11)] space-y-2.5">
      {/* 0. Indicator Santri Terhubung (khusus Orang Tua / santri terhubung) */}
      {showStudentIndicator && (
        <div className="flex items-center justify-between gap-2">
          <div
            ref={tooltipRef}
            className="relative inline-block"
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') setIsTooltipOpen(true);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setIsTooltipOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setIsTooltipOpen((prev) => !prev)}
              aria-expanded={isTooltipOpen}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50/90 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Klik untuk melihat daftar santri terhubung"
            >
              <CircleUser className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[170px] sm:max-w-[220px]">
                {connectedStudents[0]?.fullName}
              </span>
              {connectedStudents.length > 1 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-200/80 text-indigo-900 text-[11px] font-extrabold leading-none">
                  +{connectedStudents.length - 1}
                </span>
              )}
            </button>

            {isTooltipOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-30 w-56 sm:w-64 p-3 bg-white rounded-2xl shadow-xl border border-slate-200/90 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                    <CircleUser className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Santri Terhubung</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    {connectedStudents.length} Anak
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {connectedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 text-slate-800 font-medium"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-indigo-200">
                        {student.fullName.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate text-xs font-semibold">{student.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Header Bar Ringkas: Tier + Status + Persetujuan & Tombol Manajemen */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierBadge.className}`}
          >
            {tierBadge.label}
          </span>
          {renderStatusBadge(schedule.status)}
          {schedule.scheduleType === 'PRIVATE_REMEDIAL' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              Private / Remedial
            </span>
          )}
          {schedule.approvalStatus === 'PENDING' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Clock className="w-3 h-3 text-amber-600" />
              Menunggu
            </span>
          )}
          {schedule.approvalStatus === 'REJECTED' && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-300"
              title={schedule.approvalNotes ? `Alasan: ${schedule.approvalNotes}` : undefined}
            >
              <XCircle className="w-3 h-3 text-rose-600" />
              Ditolak
            </span>
          )}
        </div>

        {(canEdit || canDelete || canChangeStatus) && (
          <div className="flex items-center gap-0.5 shrink-0 relative">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(schedule)}
                className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title={isOwnPendingProposal ? 'Edit Pengajuan Jadwal' : 'Edit Rincian Jadwal'}
                aria-label={isOwnPendingProposal ? 'Edit Pengajuan Jadwal' : 'Edit Rincian Jadwal'}
              >
                <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(schedule.id)}
                className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title={isOwnPendingProposal ? 'Batalkan Pengajuan' : 'Hapus Jadwal'}
                aria-label={isOwnPendingProposal ? 'Batalkan Pengajuan' : 'Hapus Jadwal'}
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
            {canChangeStatus && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ubah Status Sesi"
                  aria-label="Ubah Status Sesi"
                >
                  <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>

                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 p-1 bg-white rounded-xl shadow-lg border border-slate-200 text-xs space-y-0.5 animate-in fade-in">
                    <div className="px-2.5 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Ubah Status Sesi
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.SCHEDULED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        schedule.status === 'SCHEDULED'
                          ? 'bg-amber-50 text-amber-800 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      Terjadwal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.ACTIVE)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        schedule.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      Sedang Berlangsung
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.COMPLETED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                        schedule.status === 'COMPLETED'
                          ? 'bg-indigo-50 text-indigo-800 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      Selesai
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.CANCELLED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium text-rose-600 transition-colors ${
                        schedule.status === 'CANCELLED'
                          ? 'bg-rose-50 font-bold'
                          : 'hover:bg-rose-50/50'
                      }`}
                    >
                      Diliburkan
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Clickable Main Body: Judul + Metadata Grid 2x2 Kompak */}
      <Link
        href={`/jadwal/${schedule.id}`}
        prefetch={true}
        className="block group/body space-y-2 rounded-xl focus:outline-none"
      >
        <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover/body:text-emerald-800 transition-colors leading-snug tracking-tight truncate">
          {isCombined ? `Gabungan ${schedule.title}` : schedule.title}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-slate-800 min-w-0">
            <Clock className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
            <span className="truncate tabular-nums">
              {startTimeText} – {endTimeText} WIB
            </span>
          </div>

          <div className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
            <MapPin className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
            <span className="truncate">{schedule.venuePlaceName}</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
            <Users className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
            <span className="truncate">{resolveTargetLabel()}</span>
          </div>

          <div className="flex items-center gap-2 font-medium text-slate-600 min-w-0">
            {materialsCount > 0 ? (
              <>
                <BookOpen className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
                <span className="truncate">+{materialsCount} Materi Tambahan</span>
              </>
            ) : (
              <>
                <Sparkles className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
                <span className="truncate">Target Bulanan</span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* 3. Footer Row: Tim Pengajar 1-Baris Ringkas & Aksi QR Kontekstual */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div
          ref={teacherTooltipRef}
          className="relative flex-1 min-w-0"
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse' && hasMultipleTeachersOrBadal) {
              setIsTeacherTooltipOpen(true);
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') {
              setIsTeacherTooltipOpen(false);
            }
          }}
        >
          {(() => {
            const teacherContent = (
              <div className="flex items-center gap-2 min-w-0">
                {hasBadal ? (
                  <span
                    aria-label="Pengajar Badal"
                    className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${userCircleAccent}`}
                  >
                    <User className="w-3.5 h-3.5" />
                  </span>
                )}

                <div className="min-w-0 flex items-center gap-1.5 flex-1">
                  <span
                    className={`text-xs font-semibold truncate ${
                      hasBadal ? 'text-amber-900' : 'text-slate-900'
                    }`}
                  >
                    {displayedTeacherName}
                  </span>

                  {additionalTeachersCount > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 text-[11px] font-bold leading-none shrink-0">
                      +{additionalTeachersCount}
                    </span>
                  )}
                </div>
              </div>
            );

            if (!hasMultipleTeachersOrBadal) {
              return teacherContent;
            }

            return (
              <button
                type="button"
                onClick={() => setIsTeacherTooltipOpen((prev) => !prev)}
                aria-expanded={isTeacherTooltipOpen}
                aria-label="Lihat rincian tim pengajar dan badal"
                title="Klik untuk melihat rincian tim pengajar dan badal"
                className="w-full text-left rounded-lg py-0.5 -my-0.5 pr-1 hover:bg-slate-50/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
              >
                {teacherContent}
              </button>
            );
          })()}

          {isTeacherTooltipOpen && hasMultipleTeachersOrBadal && (
            <div className="absolute left-0 bottom-full mb-2 z-40 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] p-3 bg-white rounded-2xl shadow-[0_14px_34px_-6px_rgba(15,23,42,0.18)] border border-slate-200/90 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className={`w-3.5 h-3.5 shrink-0 ${iconAccent}`} />
                  <span className="font-bold text-slate-900 text-xs truncate">
                    Tim Pengajar
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 leading-none">
                    {schedule.teachers.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTeacherTooltipOpen(false);
                  }}
                  aria-label="Tutup rincian tim pengajar"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {[
                  ...(primaryTeacher
                    ? [
                        {
                          id: primaryTeacher.id,
                          name: primaryTeacher.fullName,
                          roleLabel: 'Utama',
                          roleClass: 'bg-teal-50 text-teal-700 border-teal-200/70',
                          isSubstitute: false,
                        },
                      ]
                    : []),
                  ...coTeachers.map((ct) => ({
                    id: ct.teacher.id,
                    name: ct.teacher.fullName,
                    roleLabel: 'Pendamping',
                    roleClass: 'bg-slate-100 text-slate-600 border-slate-200/80',
                    isSubstitute: false,
                  })),
                  ...substituteTeachers.map((st) => ({
                    id: st.teacher.id,
                    name: st.teacher.fullName,
                    roleLabel: 'Badal',
                    roleClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
                    isSubstitute: true,
                  })),
                ].map((member, idx) => (
                  <div
                    key={`${member.id}-${member.roleLabel}-${idx}`}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-slate-50/85 border border-slate-100"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {member.isSubstitute ? (
                        <span className="w-6 h-6 rounded-full bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
                          <UserCheck className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span
                          className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                            member.roleLabel === 'Utama'
                              ? 'bg-teal-50 border-teal-200/70 text-teal-600'
                              : 'bg-slate-100 border-slate-200/80 text-slate-600'
                          }`}
                        >
                          <User className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-900 leading-snug break-words min-w-0">
                        {member.name}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border leading-none shrink-0 ${member.roleClass}`}
                    >
                      {member.roleLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tombol QR Kontekstual */}
        {showQrAction && (
          <Link
            href={`/presensi?scheduleId=${schedule.id}`}
            className={`min-h-[38px] shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              hasActiveSession
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs animate-pulse'
                : 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200/70'
            }`}
            title="Buka Presensi QR Sesi Ini"
            aria-label="Buka Presensi QR Sesi Ini"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>
              {activeRole === 'student'
                ? 'Scan QR'
                : hasActiveSession
                  ? 'QR Aktif'
                  : 'Absensi'}
            </span>
          </Link>
        )}
      </div>

      {notificationModalData && (
        <ScheduleChangeNotificationModal
          isOpen={!!notificationModalData}
          data={notificationModalData}
          onClose={() => setNotificationModalData(null)}
          onSuccess={() => setNotificationModalData(null)}
        />
      )}
    </div>
  );
}

export default React.memo(ScheduleCard);
