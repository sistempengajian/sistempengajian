'use client';

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react';
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
  ArrowRight,
  ShieldCheck,
  CircleUser,
  GroupIcon,
  UserRoundCog,
  Group,
  User2Icon,
} from 'lucide-react';
import { ScheduleStatus, ScheduleType, TierLevel } from '@prisma/client';
import {
  updateScheduleStatus,
} from '@/app/(protected)/jadwal/actions';

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
  onEdit: (schedule: ScheduleItem) => void;
  onDelete: (scheduleId: string) => void;
}

export default function ScheduleCard({
  schedule,
  canManage,
  canPropose = false,
  currentUserId = null,
  availableTeachers = [],
  activeRole,
  onEdit,
  onDelete,
}: ScheduleCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Tutup tooltip saat klik di luar
  useEffect(() => {
    if (!isTooltipOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsTooltipOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipOpen]);

  const start = new Date(schedule.startTime);
  const end = new Date(schedule.endTime);

  const primaryTeacher = schedule.teachers.find((t) => t.isPrimary)?.teacher;
  const coTeachers = schedule.teachers.filter((t) => !t.isPrimary && !t.isSubstitute);
  const substituteTeacher = schedule.teachers.find((t) => t.isSubstitute)?.teacher;
  const hasActiveSession = schedule.attendanceSessions?.some((s) => s.isActive);

  // Deteksi peran pengguna: Pengampu langsung vs Wali Kelas yang memantau
  const isUserTeaching = currentUserId
    ? schedule.teachers.some((t) => t.teacher.id === currentUserId)
    : false;
  const isUserHomeroom = !isUserTeaching && Boolean(
    currentUserId &&
    (schedule.class?.homeroomTeacherId === currentUserId ||
      schedule.targetClasses?.some((tc) => tc.class.homeroomTeacherId === currentUserId))
  );

  // Santri terhubung (khusus Orang Tua)
  const connectedStudents = schedule.connectedStudents || [];

  // Kelas terhubung (untuk Wali Kelas / Pengajar)
  const connectedClasses = useMemo(() => {
    if (schedule.connectedClasses && schedule.connectedClasses.length > 0) {
      return schedule.connectedClasses;
    }
    const list: string[] = [];
    if (schedule.class?.name && !list.includes(schedule.class.name)) {
      list.push(schedule.class.name);
    }
    if (schedule.targetClasses) {
      for (const tc of schedule.targetClasses) {
        if (tc.class?.name && !list.includes(tc.class.name)) {
          list.push(tc.class.name);
        }
      }
    }
    return list;
  }, [schedule.class?.name, schedule.targetClasses, schedule.connectedClasses]);

  const showStudentIndicator =
    (activeRole === 'parent' || connectedStudents.length > 0) && connectedStudents.length > 0;
  const showClassIndicator =
    !showStudentIndicator &&
    (activeRole === 'teacher' || isUserHomeroom) &&
    connectedClasses.length > 0;

  // Status & hak akses proposal
  const isOwnPendingProposal =
    schedule.requestedByUserId === currentUserId && schedule.approvalStatus === 'PENDING';
  const canEdit = canManage || isOwnPendingProposal;
  const canDelete = canManage || isOwnPendingProposal;
  const isApproved = schedule.approvalStatus === 'APPROVED' || !schedule.approvalStatus;
  const canChangeStatus = canManage && isApproved;

  // Tier badge styling & labels
  const getTierBadge = (tier: TierLevel) => {
    switch (tier) {
      case 'DAERAH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
            Daerah
          </span>
        );
      case 'DESA':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            Desa
          </span>
        );
      case 'KELOMPOK':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            Kelompok
          </span>
        );
    }
  };

  // Status badge styling & labels
  const getStatusBadge = (status: ScheduleStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Berlangsung
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            Selesai
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-600" />
            Diliburkan
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
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
        alert(res.error);
      }
    });
  };

  // Target peserta label ringkas
  // Target peserta label ringkas
  const getTargetBadge = () => {
    // 1. Target Kelas
    const classesCount = schedule.targetClasses?.length ?? (schedule.class ? 1 : 0);
    if (classesCount > 1) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold"
          title={schedule.targetClasses?.map((tc) => tc.class.name).join(', ')}
        >
          <Users className="w-3 h-3 text-teal-600 shrink-0" />
          <span>{classesCount} Kelas</span>
        </span>
      );
    }
    if (classesCount === 1) {
      const clsName = schedule.targetClasses?.[0]?.class.name || schedule.class?.name || '1 Kelas';
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold">
          <Users className="w-3 h-3 text-teal-600 shrink-0" />
          <span>{clsName}</span>
        </span>
      );
    }

    // 2. Target Generasi
    if (schedule.targetScope === 'GENERASI' || (schedule.targetGenerations?.length ?? 0) > 0) {
      const genName = schedule.targetGenerations?.[0]?.generation.name || 'Jenjang Usia';
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold">
          <Users className="w-3 h-3 text-teal-600 shrink-0" />
          <span>{genName}</span>
        </span>
      );
    }

    // 3. Umum Se-wilayah
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold">
        <Users className="w-3 h-3 text-teal-600 shrink-0" />
        <span>Umum {schedule.organization?.name ? `(${schedule.organization.name})` : 'Se-wilayah'}</span>
      </span>
    );
  };

  const materialsCount = schedule.scheduleMaterials?.length ?? 0;
  const isCombined = (schedule.targetClasses?.length ?? 0) > 1;

  return (
    <div className="group relative p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/30 hover:border-slate-300/80 transition-all duration-200 shadow-2xs hover:shadow-xs space-y-2.5">
      {/* 0. Top Indicator: Santri Terhubung (Khusus Orang Tua) atau Kelas Terhubung (Wali Kelas) */}
      {showStudentIndicator && (
        <div className="flex items-center justify-between gap-2">
          <div
            ref={tooltipRef}
            className="relative inline-block"
            onMouseEnter={() => setIsTooltipOpen(true)}
            onMouseLeave={() => setIsTooltipOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsTooltipOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/90 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 text-xs font-bold transition-all cursor-pointer shadow-2xs group/chip active:scale-95"
              title="Klik atau arahkan kursor untuk melihat daftar santri terhubung"
            >
              <CircleUser className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[170px] sm:max-w-[220px]">
                {connectedStudents[0]?.fullName}
              </span>
              {connectedStudents.length > 1 && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-indigo-200/80 text-indigo-900 text-[10px] font-extrabold">
                  +{connectedStudents.length - 1}
                </span>
              )}
            </button>

            {/* Tooltip Hover / Click Popover Daftar Santri */}
            {isTooltipOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-30 w-56 sm:w-64 p-3 bg-white rounded-2xl shadow-xl border border-slate-200/90 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                    <CircleUser className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Santri Terhubung</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    {connectedStudents.length} Anak
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {connectedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 text-slate-800 font-medium transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-indigo-200">
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

      {showClassIndicator && !showStudentIndicator && (
        <div className="flex items-center justify-between gap-2">
          <div
            ref={tooltipRef}
            className="relative inline-block"
            onMouseEnter={() => setIsTooltipOpen(true)}
            onMouseLeave={() => setIsTooltipOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsTooltipOpen((prev) => !prev);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50/90 hover:bg-teal-100 text-teal-800 border border-teal-200/80 text-xs font-bold transition-all cursor-pointer shadow-2xs group/chip active:scale-95"
              title="Klik atau arahkan kursor untuk melihat daftar kelas terhubung"
            >
              <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="truncate max-w-[170px] sm:max-w-[220px]">
                {connectedClasses[0]}
              </span>
              {connectedClasses.length > 1 && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-teal-200/80 text-teal-900 text-[10px] font-extrabold">
                  +{connectedClasses.length - 1}
                </span>
              )}
            </button>

            {/* Tooltip Hover / Click Popover Daftar Kelas */}
            {isTooltipOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-30 w-56 sm:w-64 p-3 bg-white rounded-2xl shadow-xl border border-slate-200/90 text-xs animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                    <Users className="w-3.5 h-3.5 text-teal-600" />
                    <span>Kelas Terhubung</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                    {connectedClasses.length} Kelas
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {connectedClasses.map((clsName, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-teal-50/50 text-slate-800 font-medium transition-colors"
                    >
                      <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 font-extrabold text-[10px] flex items-center justify-center shrink-0 border border-teal-200">
                        {idx + 1}
                      </div>
                      <span className="truncate text-xs font-semibold">{clsName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1. Header Bar: Badges Status & Action Menu */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {getTierBadge(schedule.tierLevel)}
          {getStatusBadge(schedule.status)}
          {/* Badge Khusus Wali Kelas jika bukan pengampu sesi langsung */}
          {isUserHomeroom && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-300"
              title="Sesi ini dijadwalkan untuk kelas binaan Anda"
            >
              <ShieldCheck className="w-3 h-3 text-teal-600" />
              Kelas Binaan Anda
            </span>
          )}
          {/* Badge Status Persetujuan PJ Wilayah */}
          {schedule.approvalStatus === 'PENDING' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <Clock className="w-3 h-3 text-amber-600 animate-spin" />
              Menunggu Persetujuan
            </span>
          )}
          {schedule.approvalStatus === 'REJECTED' && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300"
              title={schedule.approvalNotes ? `Alasan: ${schedule.approvalNotes}` : undefined}
            >
              <XCircle className="w-3 h-3 text-rose-600" />
              Ditolak
            </span>
          )}
        </div>

        {/* Action buttons (Edit, Delete, Status Toggle) */}
        {(canEdit || canDelete || canChangeStatus) && (
          <div className="flex items-center gap-0.5 shrink-0 relative">
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(schedule)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                title={isOwnPendingProposal ? 'Edit Pengajuan Jadwal' : 'Edit Rincian Jadwal'}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(schedule.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title={isOwnPendingProposal ? 'Batalkan Pengajuan' : 'Hapus Jadwal'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canChangeStatus && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ubah Status Sesi"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 p-1 bg-white rounded-xl shadow-lg border border-slate-200 text-xs space-y-0.5 animate-in fade-in">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Ubah Status Sesi
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.SCHEDULED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${schedule.status === 'SCHEDULED'
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      Terjadwal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.ACTIVE)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${schedule.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      Sedang Berlangsung
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.COMPLETED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium transition-colors ${schedule.status === 'COMPLETED'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                        }`}
                    >
                      Selesai
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(ScheduleStatus.CANCELLED)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg font-medium text-rose-600 transition-colors ${schedule.status === 'CANCELLED'
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

      {/* 2. Judul Sesi (Clickable to /jadwal/[id]) */}
      <div>
        <Link
          href={`/jadwal/${schedule.id}`}
          className="group/title inline-block font-bold text-sm sm:text-base text-slate-900 hover:text-teal-700 transition-colors leading-snug tracking-tight"
        >
          {isCombined && (
            <span className="mr-1 group/title inline-block font-bold text-sm sm:text-base text-slate-900 hover:text-teal-700 transition-colors leading-snug tracking-tight">
              Gabungan
            </span>
          )}
          {schedule.title}
        </Link>
      </div>

      {/* 3. Metadata Row (Waktu, Lokasi, Target / Jumlah Kelas, & Jumlah Materi) */}
      <div className="flex flex-col items-start gap-1 text-xs text-slate-600">
        {/* Waktu Pelaksanaan (dipindahkan dari header) */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold">
          <Clock className="w-3 h-3 text-teal-600 shrink-0" />
          <span>
            {start.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
            {end.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </span>
        </span>

        {/* Lokasi */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold max-w-[180px] truncate">
          <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
          <span className="truncate">{schedule.venuePlaceName}</span>
        </span>

        {/* Target Peserta / Jumlah Kelas */}
        {getTargetBadge()}

        {/* Indikator Jumlah Materi */}
        {materialsCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 text-[11px] font-semibold">
            <BookOpen className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{materialsCount} Materi</span>
          </span>
        )}
      </div>

      {/* 4. Footer Row: Ustadz Pengampu & Action Links */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        {/* Info Pengajar */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px] flex items-center justify-center shrink-0 border border-teal-200">
            {primaryTeacher?.fullName.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex items-center gap-1 text-xs">
            <span className="font-semibold text-slate-800 truncate max-w-[140px] sm:max-w-[180px]">
              {primaryTeacher?.fullName || 'Belum Ditentukan'}
            </span>
            {coTeachers.length > 0 && (
              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                +{coTeachers.length}
              </span>
            )}
            {substituteTeacher && (
              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold shrink-0">
                Badal: {substituteTeacher.fullName}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons: Presensi QR & Detail Link */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Presensi Button (Hanya jika jadwal sudah disetujui) */}
          {isApproved && (
            <Link
              href={`/presensi?scheduleId=${schedule.id}`}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${hasActiveSession
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs animate-pulse'
                : 'bg-teal-50 hover:bg-teal-100/80 text-teal-800 border border-teal-200/70'
                }`}
              title="Buka Presensi QR Sesi Ini"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {hasActiveSession ? 'QR Aktif' : 'Absensi'}
              </span>
            </Link>
          )}

          {/* Tombol Lihat Detail Sesi */}
          <Link
            href={`/jadwal/${schedule.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-teal-800 hover:bg-slate-100 border border-slate-200/80 transition-all active:scale-95"
            title="Lihat Detail Lengkap Sesi Ini"
          >
            <span>Detail</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
