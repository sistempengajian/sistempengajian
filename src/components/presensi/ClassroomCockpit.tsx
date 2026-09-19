'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  UserCheck,
  Camera,
  Award,
  Sparkles,
  Clock,
  MapPin,
  Users,
  RefreshCw,
  School,
  ArrowLeftRight,
  ChevronDown,
  Check,
  Calendar,
  Lock,
  Loader2,
} from 'lucide-react';
import { AttendanceStatus } from '@prisma/client';
import { getSessionAttendanceRecords } from '@/app/(protected)/presensi/actions';
import DynamicQrDisplay, { InitialQrPayload } from './DynamicQrDisplay';
import ManualAttendanceSheet, { StudentAttendanceItem } from './ManualAttendanceSheet';
import BatchCardScanner from './BatchCardScanner';
import RealtimeEvaluationSheet, { MaterialWithChecklists, StudentProgressData } from './RealtimeEvaluationSheet';

export interface ScheduleTeacherInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  isSubstitute: boolean;
}

export interface AvailableScheduleItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  className?: string;
  venueName?: string;
  tierLevel?: string;
}

interface ClassroomCockpitProps {
  sessionId: string;
  scheduleId: string;
  scheduleTitle: string;
  scheduleTierLevel?: 'KELOMPOK' | 'DESA' | 'DAERAH';
  organizationName?: string;
  venueName?: string;
  scheduleDate?: string;
  startTime: string;
  endTime: string;
  students: StudentAttendanceItem[];
  classes?: Array<{ id: string; name: string }>;
  teacherInfo?: { name: string; isSubstitute: boolean };
  teachersList?: ScheduleTeacherInfo[];
  materials?: MaterialWithChecklists[];
  initialProgress?: StudentProgressData[];
  canCompleteDaerah?: boolean;
  canCompleteDesa?: boolean;
  availableSchedules?: AvailableScheduleItem[];
  isSessionActive?: boolean;
  closedAt?: string | null;
  initialQrPayload?: InitialQrPayload | null;
  initialTotalMaterials?: number;
  initialHasMore?: boolean;
  generations?: Array<{ id: string; name: string; code: string }>;
}

type CockpitTab = 'DYNAMIC_QR' | 'MANUAL_SHEET' | 'BATCH_SCAN' | 'EVALUATION';

export default function ClassroomCockpit({
  sessionId,
  scheduleId,
  scheduleTitle,
  scheduleTierLevel,
  organizationName,
  venueName,
  scheduleDate,
  startTime,
  endTime,
  students: initialStudents,
  classes = [],
  teacherInfo,
  teachersList = [],
  materials = [],
  initialProgress = [],
  canCompleteDaerah = false,
  canCompleteDesa = false,
  availableSchedules = [],
  isSessionActive = true,
  closedAt,
  initialQrPayload,
  initialTotalMaterials,
  initialHasMore,
  generations = [],
}: ClassroomCockpitProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState<boolean>(false);
  const [switchingScheduleId, setSwitchingScheduleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CockpitTab>('DYNAMIC_QR');
  const [attendanceList, setAttendanceList] = useState<StudentAttendanceItem[]>(initialStudents);
  const [sessionActive, setSessionActive] = useState<boolean>(isSessionActive);
  const [isQrStarted, setIsQrStarted] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isScheduleDropdownOpen, setIsScheduleDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sinkronkan daftar santri saat props berubah (misal ganti sesi atau refresh)
  useEffect(() => {
    setAttendanceList(initialStudents);
  }, [initialStudents]);

  useEffect(() => {
    setSessionActive(isSessionActive);
  }, [isSessionActive]);

  useEffect(() => {
    setIsQrStarted(false);
  }, [sessionId]);

  const handleSelectSchedule = (targetScheduleId: string) => {
    if (targetScheduleId === scheduleId) {
      setIsScheduleDropdownOpen(false);
      return;
    }
    setSwitchingScheduleId(targetScheduleId);
    setIsScheduleDropdownOpen(false);
    router.push(`/presensi?scheduleId=${targetScheduleId}`);
    router.refresh();
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsScheduleDropdownOpen(false);
      }
    }
    if (isScheduleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isScheduleDropdownOpen]);

  // Fungsi sinkronisasi absensi terkini dari database
  const refreshAttendance = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await getSessionAttendanceRecords(sessionId);
      if (res.success && res.records) {
        setAttendanceList((prev) =>
          prev.map((student) => {
            const matched = res.records.find((r) => r.studentId === student.id);
            if (matched) {
              return {
                ...student,
                currentStatus: matched.status,
                method: matched.method,
                checkInTime: matched.checkInTime,
                absenceConfirmation: matched.absenceConfirmation as any,
              };
            }
            return student;
          })
        );
      }
    } catch (err) {
      console.error('Gagal menyinkronkan data presensi:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);

  // Request realtime hanya aktif saat tab Absensi Manual diklik
  const handleTabChange = (tab: CockpitTab) => {
    setActiveTab(tab);
    if (tab === 'MANUAL_SHEET') {
      refreshAttendance();
    }
  };

  // Handler optimistik saat status santri diubah manual
  const handleStudentStatusChange = (studentId: string, newStatus: AttendanceStatus) => {
    setAttendanceList((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          return {
            ...s,
            currentStatus: newStatus,
            checkInTime:
              newStatus === 'HADIR'
                ? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                : null,
          };
        }
        return s;
      })
    );
  };

  // Daftar santri yang HANYA berstatus HADIR atau TERLAMBAT untuk Jurnal Penilaian
  const presentStudents = useMemo(() => {
    return attendanceList.filter(
      (s) => s.currentStatus === 'HADIR' || s.currentStatus === 'TERLAMBAT'
    );
  }, [attendanceList]);

  // Hitung jumlah santri yang memiliki permohonan surat izin pending
  const pendingLeaveCount = useMemo(() => {
    return attendanceList.filter((s) => s.absenceConfirmation?.status === 'PENDING').length;
  }, [attendanceList]);

  const hadirCount = presentStudents.length;
  const totalCount = attendanceList.length;

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Header Informasi Ruang Kelas Pengajian */}
      <div className="bg-white/75 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-xs flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {scheduleTitle}
              </h2>
              {sessionActive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Presensi Aktif</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Sesi Selesai / Ditutup</span>
                </span>
              )}
            </div>
            <div className="flex flex-col items-start gap-x-3.5 gap-y-1.5 text-xs text-slate-500 mt-2">
              <div className="flex flex-col items-start gap-x-3 gap-y-1.5 ml-2">

                {scheduleDate && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{scheduleDate}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{startTime} - {endTime} WIB</span>
                </span>
                {venueName && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate max-w-[200px]">{venueName}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{totalCount} Santri ({hadirCount} Hadir)</span>
                </span>

                {classes.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <School className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>
                      {classes.length === 1
                        ? classes[0].name
                        : `${classes.map((c) => c.name).join(', ')}`}
                    </span>
                  </span>
                )}

                {/* Data Pengajar: Utama, Pendamping, dan Badal */}
                {teachersList && teachersList.length > 0 ? (
                  teachersList.map((t) => {
                    if (t.isSubstitute) {
                      return (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 font-medium text-slate-600"
                          title="Pengajar Pengganti (Badal)"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{t.name} (Badal)</span>
                        </span>
                      );
                    }
                    if (t.isPrimary) {
                      return (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 font-medium text-slate-600"
                          title="Pengajar Utama"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{t.name} (Utama)</span>
                        </span>
                      );
                    }
                    return (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1.5 font-medium text-slate-600"
                        title="Pengajar Pendamping"
                      >
                        <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>{t.name} (Pendamping)</span>
                      </span>
                    );
                  })
                ) : teacherInfo?.name ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                    <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>
                      {teacherInfo.name}
                      {teacherInfo.isSubstitute ? ' (Badal)' : ''}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Session Switcher jika ustadz memiliki lebih dari 1 sesi hari ini */}
          {availableSchedules && availableSchedules.length > 1 && (
            <div className="shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsScheduleDropdownOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Ganti Sesi ({availableSchedules.length} Sesi)</span>
                <ChevronDown className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              </button>

              {/* Modal Quick Switch Sesi Responsif (Portal ke Body, Anti-Tertutup & Anti-Terpotong di Mobile) */}
              {mounted && isScheduleDropdownOpen && createPortal(
                <div
                  className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
                  onClick={() => setIsScheduleDropdownOpen(false)}
                >
                  <div
                    ref={dropdownRef}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 max-h-[85vh] flex flex-col"
                  >
                    {/* Modal Header */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/80 shadow-2xs shrink-0">
                          <ArrowLeftRight className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                            Pilih Sesi Pengajian Hari Ini
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Tersedia {availableSchedules.length} sesi pengajian untuk Anda
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScheduleDropdownOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer shrink-0 ml-2"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Sesi List */}
                    <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto max-h-[60vh]">
                      {availableSchedules.map((s) => {
                        const isCurrent = s.id === scheduleId;
                        const isSwitching = switchingScheduleId === s.id;

                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={isSwitching}
                            onClick={() => handleSelectSchedule(s.id)}
                            className={`w-full text-left p-3.5 rounded-2xl text-xs transition-all flex items-start gap-3 cursor-pointer border ${
                              isCurrent
                                ? 'bg-teal-50/80 border-teal-300 shadow-2xs ring-2 ring-teal-500/20'
                                : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs active:scale-98'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {isSwitching ? (
                                <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                              ) : isCurrent ? (
                                <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-2xs">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                  <Clock className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className={`font-bold text-xs sm:text-sm truncate ${isCurrent ? 'text-teal-950' : 'text-slate-900'}`}>
                                  {s.title}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-600 text-white shadow-2xs shrink-0">
                                    Sesi Aktif
                                  </span>
                                )}
                                {isSwitching && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse shrink-0">
                                    Beralih...
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-700 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>{s.startTime} - {s.endTime} WIB</span>
                                </span>
                                {s.className && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-[10px]">
                                    {s.className}
                                  </span>
                                )}
                                {s.venueName && (
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="truncate">{s.venueName}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                      <span>Ketuk sesi untuk beralih ruang kelas</span>
                      <button
                        type="button"
                        onClick={() => setIsScheduleDropdownOpen(false)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 font-semibold transition-colors cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}
        </div>

        {/* Segmented Control 4 Tab dengan Scrollbar Elegan pada Layar Kecil */}
        <div className="w-full lg:w-auto overflow-hidden">
          <div className="flex justify-between items-center p-1 pb-2 sm:pb-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 overflow-x-auto max-w-full tab-scrollbar gap-2 touch-pan-x">
            <button
              type="button"
              onClick={() => handleTabChange('DYNAMIC_QR')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'DYNAMIC_QR'
                ? 'bg-white text-teal-800 font-bold shadow-xs border border-teal-100'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <QrCode className={`w-3.5 h-3.5 ${activeTab === 'DYNAMIC_QR' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Dynamic QR</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('MANUAL_SHEET')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'MANUAL_SHEET'
                ? 'bg-white text-teal-800 font-bold shadow-xs border border-teal-100'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <UserCheck className={`w-3.5 h-3.5 ${activeTab === 'MANUAL_SHEET' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Absensi Manual</span>
              {pendingLeaveCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse shadow-2xs">
                  {pendingLeaveCount} Izin
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('BATCH_SCAN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'BATCH_SCAN'
                ? 'bg-white text-teal-800 font-bold shadow-xs border border-teal-100'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Camera className={`w-3.5 h-3.5 ${activeTab === 'BATCH_SCAN' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Scan Kartu</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('EVALUATION')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${activeTab === 'EVALUATION'
                ? 'bg-white text-teal-800 font-bold shadow-xs border border-teal-100'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <Award className={`w-3.5 h-3.5 ${activeTab === 'EVALUATION' ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>Jurnal Nilai</span>
              {hadirCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'EVALUATION' ? 'bg-teal-100 text-teal-800' : 'bg-slate-200/80 text-slate-600'}`}>
                  {hadirCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Konten Tab Sesuai Pilihan Pengajar */}
      {
        activeTab === 'DYNAMIC_QR' && (
          <DynamicQrDisplay
            sessionId={sessionId}
            scheduleTitle={scheduleTitle}
            venueName={venueName}
            isActive={sessionActive}
            closedAt={closedAt}
            initialQrPayload={initialQrPayload}
            isStarted={isQrStarted}
            onStart={() => setIsQrStarted(true)}
            onPause={() => setIsQrStarted(false)}
            onSessionClosed={() => setSessionActive(false)}
            onSessionReopened={() => setSessionActive(true)}
          />
        )
      }

      {
        activeTab === 'MANUAL_SHEET' && (
          <ManualAttendanceSheet
            sessionId={sessionId}
            students={attendanceList}
            classes={classes}
            onRefresh={refreshAttendance}
            isRefreshing={isRefreshing}
            onStudentStatusChange={handleStudentStatusChange}
          />
        )
      }

      {
        activeTab === 'BATCH_SCAN' && (
          <BatchCardScanner
            sessionId={sessionId}
            onScanSuccess={refreshAttendance}
          />
        )
      }

      {
        activeTab === 'EVALUATION' && (
          <RealtimeEvaluationSheet
            scheduleId={scheduleId}
            scheduleTierLevel={scheduleTierLevel}
            organizationName={organizationName}
            students={presentStudents.map((s) => ({
              id: s.id,
              fullName: s.fullName,
              generationId: s.generationId,
              generationName: s.generationName,
              classId: s.classId,
              className: s.className,
              checkInTime: s.checkInTime,
              method: s.method,
            }))}
            classes={classes}
            materials={materials}
            initialProgress={initialProgress}
            canCompleteDaerah={canCompleteDaerah}
            canCompleteDesa={canCompleteDesa}
            totalStudentsCount={totalCount}
            initialTotalMaterials={initialTotalMaterials}
            initialHasMore={initialHasMore}
            generations={generations}
            onGoToAttendance={() => handleTabChange('MANUAL_SHEET')}
          />
        )
      }
    </div >
  );
}

