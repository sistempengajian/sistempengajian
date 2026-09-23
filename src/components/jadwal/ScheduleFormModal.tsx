'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  UserCheck,
  Sparkles,
  Repeat,
  Building2,
  CheckCircle2,
  AlertCircle,
  Users,
  BookOpen,
  Plus,
  Trash2,
  GraduationCap,
  Layers,
  Search,
  Check,
  Globe,
  Send,
} from 'lucide-react';
import { TierLevel, ScheduleStatus, RollingTargetScope } from '@prisma/client';
import { createSchedule, updateSchedule } from '@/app/(protected)/jadwal/actions';
import { ScheduleItem } from './ScheduleCard';
import {
  AvailableTeacher,
  AvailableClass,
  AvailableMaterial,
  AvailableGeneration,
  ScopedOrganization,
} from './InteractiveCalendar';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleToEdit?: ScheduleItem | null;
  isProposalMode?: boolean;
  availableTeachers: AvailableTeacher[];
  availableClasses: AvailableClass[];
  availableMaterials?: AvailableMaterial[];
  availableGenerations?: AvailableGeneration[];
  scopedOrganizations?: ScopedOrganization[];
  currentUserOrgId?: string | null;
  userTierLevel?: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  roleCodes?: string[];
  defaultDate?: Date;
  onSuccess: () => void;
}

export default function ScheduleFormModal({
  isOpen,
  onClose,
  scheduleToEdit,
  isProposalMode = false,
  availableTeachers = [],
  availableClasses = [],
  availableMaterials = [],
  availableGenerations = [],
  scopedOrganizations = [],
  currentUserOrgId = null,
  userTierLevel,
  roleCodes = [],
  defaultDate,
  onSuccess,
}: ScheduleFormModalProps) {
  const isEditMode = Boolean(scheduleToEdit);

  // Form states
  const [title, setTitle] = useState('');
  const [tierLevel, setTierLevel] = useState<TierLevel>(TierLevel.KELOMPOK);
  const [organizationId, setOrganizationId] = useState<string>('');

  // Target Peserta State
  const [targetScope, setTargetScope] = useState<RollingTargetScope>(RollingTargetScope.WILAYAH_UMUM);
  const [primaryClassId, setPrimaryClassId] = useState<string>('');
  const [isCombinedSession, setIsCombinedSession] = useState<boolean>(false);
  const [additionalClassIds, setAdditionalClassIds] = useState<string[]>([]);
  const [selectedGenerationId, setSelectedGenerationId] = useState<string>('');
  const [classSearchQuery, setClassSearchQuery] = useState('');

  // Materi Kajian State (Maks. 3)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

  // Waktu & Tempat
  const [dateStr, setDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('19:30');
  const [endTimeStr, setEndTimeStr] = useState('21:00');
  const [isRecurringWeekly, setIsRecurringWeekly] = useState(false);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [venuePlaceName, setVenuePlaceName] = useState('');
  const [venueType, setVenueType] = useState('MASJID');

  // Pengajar (Multi-Pengajar) & Badal
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [primaryTeacherId, setPrimaryTeacherId] = useState<string>('');
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string>('');

  // Status & Catatan
  const [status, setStatus] = useState<ScheduleStatus>(ScheduleStatus.SCHEDULED);
  const [notes, setNotes] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Batasan peran PJ:
  // - PJ Kelompok: tingkat wilayah tidak bisa diubah (otomatis Kelompok & organisasi kelompoknya)
  // - PJ Desa: hanya Desa & Kelompok
  // - PJ Daerah: Daerah, Desa, Kelompok
  const isPjKelompokOnly = userTierLevel === 'KELOMPOK';
  const canChooseDaerah = userTierLevel === 'DAERAH';
  const canChooseDesa = userTierLevel === 'DAERAH' || userTierLevel === 'DESA';

  // Daftar organisasi yang cocok dengan tingkat wilayah yang sedang aktif dipilih
  const filteredOrganizations = useMemo(() => {
    if (scopedOrganizations.length === 0) return [];
    return scopedOrganizations.filter((o) => o.type === tierLevel);
  }, [scopedOrganizations, tierLevel]);

  // Daftar kelas yang relevan dengan organisasi terpilih (atau seluruh kelas jika umum)
  const filteredClasses = useMemo(() => {
    let classes = availableClasses;
    if (organizationId) {
      const orgClasses = availableClasses.filter((c) => c.organizationId === organizationId);
      if (orgClasses.length > 0) classes = orgClasses;
    }
    if (!classSearchQuery.trim()) return classes;
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(classSearchQuery.toLowerCase()) ||
        c.generation?.name.toLowerCase().includes(classSearchQuery.toLowerCase())
    );
  }, [availableClasses, organizationId, classSearchQuery]);

  // Inisialisasi data saat modal dibuka atau scheduleToEdit berubah
  useEffect(() => {
    if (!isOpen) return;

    if (scheduleToEdit) {
      setTitle(scheduleToEdit.title || '');

      // Inisialisasi tingkatan wilayah & organisasi
      const schTier = scheduleToEdit.tierLevel || TierLevel.KELOMPOK;
      setTierLevel(schTier);

      const schOrgId =
        scheduleToEdit.organization?.id || scheduleToEdit.organizationId || currentUserOrgId || '';
      setOrganizationId(schOrgId);

      // Inisialisasi Target Peserta
      if (scheduleToEdit.targetScope) {
        setTargetScope(scheduleToEdit.targetScope as RollingTargetScope);
      } else if (scheduleToEdit.targetGenerations && scheduleToEdit.targetGenerations.length > 0) {
        setTargetScope(RollingTargetScope.GENERASI);
      } else if (scheduleToEdit.targetClasses && scheduleToEdit.targetClasses.length > 0) {
        setTargetScope(RollingTargetScope.KELAS);
      } else if (scheduleToEdit.class?.id) {
        setTargetScope(RollingTargetScope.KELAS);
      } else {
        setTargetScope(RollingTargetScope.WILAYAH_UMUM);
      }

      // Classes
      if (scheduleToEdit.targetClasses && scheduleToEdit.targetClasses.length > 0) {
        const cIds = scheduleToEdit.targetClasses.map((tc) => tc.class.id);
        setPrimaryClassId(cIds[0] || '');
        if (cIds.length > 1) {
          setIsCombinedSession(true);
          setAdditionalClassIds(cIds.slice(1));
        } else {
          setIsCombinedSession(false);
          setAdditionalClassIds([]);
        }
      } else if (scheduleToEdit.class?.id) {
        setPrimaryClassId(scheduleToEdit.class.id);
        setIsCombinedSession(false);
        setAdditionalClassIds([]);
      } else {
        setPrimaryClassId('');
        setIsCombinedSession(false);
        setAdditionalClassIds([]);
      }

      // Generations
      if (scheduleToEdit.targetGenerations && scheduleToEdit.targetGenerations.length > 0) {
        setSelectedGenerationId(scheduleToEdit.targetGenerations[0].generation.id);
      } else {
        setSelectedGenerationId('');
      }

      // Materials (maks 3)
      if (scheduleToEdit.scheduleMaterials && scheduleToEdit.scheduleMaterials.length > 0) {
        const sortedMat = [...scheduleToEdit.scheduleMaterials].sort(
          (a, b) => a.slotIndex - b.slotIndex
        );
        setSelectedMaterialIds(sortedMat.map((sm) => sm.material.id));
      } else {
        setSelectedMaterialIds([]);
      }

      // Waktu & Tempat
      setVenuePlaceName(scheduleToEdit.venuePlaceName || '');
      setVenueType(scheduleToEdit.venueType || 'MASJID');
      setStatus(scheduleToEdit.status || ScheduleStatus.SCHEDULED);
      setNotes(scheduleToEdit.notes || '');

      const start = new Date(scheduleToEdit.startTime);
      const end = new Date(scheduleToEdit.endTime);

      const yyyy = start.getFullYear();
      const mm = String(start.getMonth() + 1).padStart(2, '0');
      const dd = String(start.getDate()).padStart(2, '0');
      setDateStr(`${yyyy}-${mm}-${dd}`);

      setStartTimeStr(
        `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
      );
      setEndTimeStr(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      );

      // Pengajar & Badal
      const nonSubTeachers = scheduleToEdit.teachers
        .filter((t) => !t.isSubstitute)
        .map((t) => t.teacher.id);
      setSelectedTeacherIds(nonSubTeachers);

      const primary = scheduleToEdit.teachers.find((t) => t.isPrimary)?.teacher;
      setPrimaryTeacherId(primary?.id || nonSubTeachers[0] || '');

      const substitute = scheduleToEdit.teachers.find((t) => t.isSubstitute)?.teacher;
      setSubstituteTeacherId(substitute?.id || '');

      setIsRecurringWeekly(false);
    } else {
      // Mode Tambah Baru
      setTitle('');

      // Default tier level
      const initialTier = (userTierLevel as TierLevel) || TierLevel.KELOMPOK;
      setTierLevel(initialTier);

      // Default organization
      const matchingOrgs = scopedOrganizations.filter((o) => o.type === initialTier);
      if (matchingOrgs.length > 0) {
        setOrganizationId(matchingOrgs[0].id);
      } else if (currentUserOrgId) {
        setOrganizationId(currentUserOrgId);
      } else {
        setOrganizationId('');
      }

      // Default target scope
      setTargetScope(RollingTargetScope.WILAYAH_UMUM);
      setPrimaryClassId('');
      setIsCombinedSession(false);
      setAdditionalClassIds([]);
      setSelectedGenerationId('');
      setSelectedMaterialIds([]);

      // Tanggal & Jam
      const baseDate = defaultDate || new Date();
      const yyyy = baseDate.getFullYear();
      const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
      const dd = String(baseDate.getDate()).padStart(2, '0');
      setDateStr(`${yyyy}-${mm}-${dd}`);

      setStartTimeStr('19:30');
      setEndTimeStr('21:00');
      setIsRecurringWeekly(false);
      setRecurringWeeks(4);
      setVenuePlaceName('Masjid Al-Barokah');
      setVenueType('MASJID');

      // Pengajar default
      if (availableTeachers.length > 0) {
        setSelectedTeacherIds([availableTeachers[0].id]);
        setPrimaryTeacherId(availableTeachers[0].id);
      } else {
        setSelectedTeacherIds([]);
        setPrimaryTeacherId('');
      }
      setSubstituteTeacherId('');

      setStatus(ScheduleStatus.SCHEDULED);
      setNotes('');
    }

    setErrorMessage(null);
    setClassSearchQuery('');
  }, [
    isOpen,
    scheduleToEdit,
    defaultDate,
    userTierLevel,
    currentUserOrgId,
    scopedOrganizations,
    availableTeachers,
  ]);

  // Handler saat tingkat wilayah diubah oleh PJ Desa / PJ Daerah
  const handleTierChange = (newTier: TierLevel) => {
    setTierLevel(newTier);
    const orgs = scopedOrganizations.filter((o) => o.type === newTier);
    if (orgs.length > 0) {
      setOrganizationId(orgs[0].id);
    } else {
      setOrganizationId('');
    }
  };

  // Helper toggle additional class for combined session
  const toggleAdditionalClass = (classId: string) => {
    setAdditionalClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // Helper multi-teacher
  const handleAddTeacher = (teacherId: string) => {
    if (!teacherId || selectedTeacherIds.includes(teacherId)) return;
    setSelectedTeacherIds((prev) => {
      const next = [...prev, teacherId];
      if (!primaryTeacherId) setPrimaryTeacherId(teacherId);
      return next;
    });
  };

  const handleRemoveTeacher = (teacherId: string) => {
    if (selectedTeacherIds.length <= 1) {
      setErrorMessage('Minimal harus ada satu Ustadz pengajar yang ditugaskan.');
      return;
    }
    const next = selectedTeacherIds.filter((id) => id !== teacherId);
    setSelectedTeacherIds(next);
    if (primaryTeacherId === teacherId) {
      setPrimaryTeacherId(next[0] || '');
    }
  };

  // Helper multi-materi (maks 3)
  const handleAddMaterial = (materialId: string) => {
    if (!materialId || selectedMaterialIds.includes(materialId)) return;
    if (selectedMaterialIds.length >= 3) {
      setErrorMessage('Maksimal materi pengajian yang dapat dijadwalkan adalah 3 materi.');
      return;
    }
    setSelectedMaterialIds((prev) => [...prev, materialId]);
  };

  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterialIds((prev) => prev.filter((id) => id !== materialId));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage('Judul sesi pengajian wajib diisi.');
      return;
    }
    if (!venuePlaceName.trim()) {
      setErrorMessage('Nama tempat / masjid pelaksanaan wajib diisi.');
      return;
    }
    if (!dateStr || !startTimeStr || !endTimeStr) {
      setErrorMessage('Tanggal dan rentang waktu pelaksanaan wajib ditentukan.');
      return;
    }
    if (selectedTeacherIds.length === 0 || !primaryTeacherId) {
      setErrorMessage('Minimal 1 Ustadz pengajar utama wajib dipilih.');
      return;
    }

    const finalClassIds = primaryClassId
      ? isCombinedSession
        ? [primaryClassId, ...additionalClassIds]
        : [primaryClassId]
      : [];

    if (targetScope === RollingTargetScope.KELAS && !primaryClassId) {
      setErrorMessage('Anda memilih target Berdasarkan Kelas, silakan pilih Kelas Utama.');
      return;
    }

    if (targetScope === RollingTargetScope.GENERASI && !selectedGenerationId) {
      setErrorMessage('Anda memilih target Berdasarkan Jenjang Usia, silakan pilih satu jenjang usia santri.');
      return;
    }

    const finalGenerationIds = selectedGenerationId ? [selectedGenerationId] : [];

    const startDateTime = new Date(`${dateStr}T${startTimeStr}:00`);
    const endDateTime = new Date(`${dateStr}T${endTimeStr}:00`);

    if (endDateTime <= startDateTime) {
      setErrorMessage('Waktu selesai harus lebih lambat dari waktu mulai.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('tierLevel', tierLevel);
    if (organizationId) formData.append('organizationId', organizationId);
    formData.append('targetScope', targetScope);

    formData.append('selectedClassIds', JSON.stringify(finalClassIds));
    formData.append('selectedGenerationIds', JSON.stringify(finalGenerationIds));
    if (primaryClassId) {
      formData.append('classId', primaryClassId);
    }
    formData.append('selectedMaterialIds', JSON.stringify(selectedMaterialIds));
    formData.append('selectedTeacherIds', JSON.stringify(selectedTeacherIds));
    formData.append('primaryTeacherId', primaryTeacherId);
    if (substituteTeacherId) formData.append('substituteTeacherId', substituteTeacherId);

    formData.append('venuePlaceName', venuePlaceName.trim());
    formData.append('venueType', venueType);
    formData.append('startTime', startDateTime.toISOString());
    formData.append('endTime', endDateTime.toISOString());
    if (notes.trim()) formData.append('notes', notes.trim());

    startTransition(async () => {
      setErrorMessage(null);
      if (isEditMode && scheduleToEdit) {
        formData.append('scheduleId', scheduleToEdit.id);
        formData.append('status', status);
        const res = await updateSchedule(formData);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          onSuccess();
          onClose();
        }
      } else {
        formData.append('isRecurringWeekly', isRecurringWeekly ? 'true' : 'false');
        formData.append('recurringWeeks', String(recurringWeeks));
        const res = await createSchedule(formData);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          onSuccess();
          onClose();
        }
      }
    });
  };

  const selectedOrgObj = scopedOrganizations.find((o) => o.id === organizationId);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col w-full h-full overflow-hidden animate-fade-in">
      {/* Header Modal Full Screen */}
      <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md shrink-0">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs shrink-0 ${isProposalMode
                ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                : 'bg-teal-50 text-teal-700 border-teal-200/60'
                }`}
            >
              {isProposalMode ? <Send className="w-5 h-5" /> : <CalendarIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isProposalMode
                  ? isEditMode
                    ? 'Edit Pengajuan Jadwal Pengajian'
                    : 'Ajukan Jadwal Pengajian Baru'
                  : isEditMode
                    ? 'Edit Jadwal Pengajian'
                    : 'Tambah Jadwal Pengajian Baru'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isProposalMode
                  ? isEditMode
                    ? 'Perbarui rincian pengajuan sesi sebelum diverifikasi oleh PJ Wilayah'
                    : 'Ajukan sesi pengajian baru untuk ditinjau dan disetujui oleh PJ Wilayah'
                  : isEditMode
                    ? 'Perbarui rincian sesi, pengajar, materi, atau sasaran peserta'
                    : 'Buat sesi pengajian baru flat/satuan mandiri atau berulang pekanan'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body Modal: Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-50/50">
        <form id="schedule-form" onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-5">
          {/* Banner Informasi Mode Pengajuan */}
          {isProposalMode && (
            <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex items-start gap-3 text-xs sm:text-sm text-amber-900 shadow-2xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-950">Mode Pengajuan Jadwal Pengajian</span>
                <span className="text-amber-800 text-xs">
                  Jadwal yang Anda ajukan akan berstatus <strong>Menunggu Persetujuan</strong> dan belum akan tampil bagi santri maupun orang tua hingga disetujui oleh PJ Wilayah.
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2.5 text-xs sm:text-sm text-rose-800 animate-in fade-in shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* CARD 1: INFORMASI WILAYAH & JUDUL PENGAJIAN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>1. Cakupan Wilayah &amp; Judul Sesi</span>
            </div>

            {/* Wilayah & Tingkatan */}
            {!isPjKelompokOnly ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                {/* Opsi Tingkat Wilayah (Hanya untuk PJ Desa & PJ Daerah) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Tingkat Wilayah Pengajian</span>
                    <span className="text-[10px] text-slate-400 font-normal">Sesuai wewenang</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {canChooseDaerah && (
                      <button
                        type="button"
                        onClick={() => handleTierChange(TierLevel.DAERAH)}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${tierLevel === TierLevel.DAERAH
                          ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        Daerah
                      </button>
                    )}
                    {canChooseDesa && (
                      <button
                        type="button"
                        onClick={() => handleTierChange(TierLevel.DESA)}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${tierLevel === TierLevel.DESA
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                      >
                        Desa
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTierChange(TierLevel.KELOMPOK)}
                      className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${tierLevel === TierLevel.KELOMPOK
                        ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                      Kelompok
                    </button>
                  </div>
                </div>

                {/* Dropdown Nama Wilayah Sesuai Tingkatan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Pilih Nama Wilayah ({tierLevel})</span>
                    <span className="text-[10px] text-teal-600 font-medium">
                      {filteredOrganizations.length} unit tersedia
                    </span>
                  </label>
                  <select
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-medium text-slate-800"
                    required
                  >
                    {filteredOrganizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Untuk PJ Kelompok: Tingkat wilayah otomatis disembunyikan */
              <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-200/60 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-teal-900">
                  <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="font-semibold">
                    Wilayah {selectedOrgObj?.name || 'Kelompok Binaan Anda'}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  Kelompok
                </span>
              </div>
            )}

            {/* Judul Pengajian */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Judul Sesi Pengajian <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Kajian Tafsir Juz 'Amma, Halaqah Tajwid & Tahsin, Tarbiyatul Aulad..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all text-slate-900 font-medium"
                required
              />
            </div>
          </div>

          {/* CARD 2: TARGET PESERTA PENGAJIAN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <Users className="w-4 h-4 text-teal-600" />
                <span>2. Target Peserta Pengajian</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Tentukan audiens kajian</span>
            </div>

            {/* 3 Tab Pilihan Target Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope(RollingTargetScope.WILAYAH_UMUM)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${targetScope === RollingTargetScope.WILAYAH_UMUM
                  ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <Globe className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold leading-snug">Umum Se-wilayah</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Terbuka bagi seluruh jamaah &amp; santri di wilayah
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope(RollingTargetScope.KELAS)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${targetScope === RollingTargetScope.KELAS
                  ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <GraduationCap className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold leading-snug">Berdasarkan Kelas</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Pilih satu atau lebih kelas/halaqah khusus
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope(RollingTargetScope.GENERASI)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${targetScope === RollingTargetScope.GENERASI
                  ? 'bg-teal-50/70 border-teal-500 text-teal-900 ring-1 ring-teal-400/30 shadow-2xs'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <Layers className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold leading-snug">Berdasarkan Jenjang Usia</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Pilih satu atau lebih jenjang usia santri
                  </p>
                </div>
              </button>
            </div>

            {/* Opsi 1: Umum Se-wilayah */}
            {targetScope === RollingTargetScope.WILAYAH_UMUM && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  Sesi ini ditujukan untuk <strong>seluruh peserta / jamaah umum</strong> pada cakupan{' '}
                  <strong className="text-slate-900">{selectedOrgObj?.name || 'wilayah terpilih'}</strong>.
                </span>
              </div>
            )}

            {/* Opsi 2: Berdasarkan Kelas (Kelas Utama + Sesi Gabungan Opsional) */}
            {targetScope === RollingTargetScope.KELAS && (
              <div className="space-y-4 pt-1">
                {/* 2A: Pilih Kelas Utama */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-teal-600" />
                      <span>Kelas Utama (Induk Sesi) <span className="text-rose-500">*</span></span>
                    </label>
                    <span className="text-[11px] text-slate-400">Wajib dipilih</span>
                  </div>

                  <select
                    value={primaryClassId}
                    onChange={(e) => {
                      const newPrimary = e.target.value;
                      setPrimaryClassId(newPrimary);
                      setAdditionalClassIds((prev) => prev.filter((id) => id !== newPrimary));
                    }}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-medium text-slate-800"
                    required={targetScope === RollingTargetScope.KELAS}
                  >
                    <option value="">-- Pilih Kelas Utama --</option>
                    {filteredClasses.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} {cls.generation?.name ? `(${cls.generation.name})` : ''} — {cls.tierLevel}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2B: Toggle Sesi Gabungan */}
                {primaryClassId && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isCombinedSession}
                        onChange={(e) => {
                          setIsCombinedSession(e.target.checked);
                          if (!e.target.checked) setAdditionalClassIds([]);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <span>Sesi Gabungan (Gabung dengan Kelas Lain)</span>
                      {isCombinedSession && additionalClassIds.length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 ml-auto">
                          +{additionalClassIds.length} Kelas Tambahan
                        </span>
                      )}
                    </label>
                    <p className="text-[11px] text-slate-500 pl-6.5">
                      Centang jika pengajian ini diselenggarakan bersama dengan kelas binaan lain di tempat/waktu yang sama.
                    </p>

                    {/* 2C: Checklist Kelas Tambahan */}
                    {isCombinedSession && (
                      <div className="pt-2 pl-6.5 space-y-2 border-t border-slate-200/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">Pilih Kelas yang Digabungkan:</span>
                          <span className="text-[10px] text-slate-400">
                            Total {1 + additionalClassIds.length} kelas dalam sesi ini
                          </span>
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1 p-1 border border-slate-200/80 rounded-xl bg-white">
                          {filteredClasses.filter((c) => c.id !== primaryClassId).length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              Tidak ada kelas lain yang tersedia di wilayah ini.
                            </div>
                          ) : (
                            filteredClasses
                              .filter((c) => c.id !== primaryClassId)
                              .map((cls) => {
                                const isSelected = additionalClassIds.includes(cls.id);
                                return (
                                  <div
                                    key={cls.id}
                                    onClick={() => toggleAdditionalClass(cls.id)}
                                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${isSelected
                                      ? 'bg-teal-50/80 border-teal-400/80 text-teal-950 font-semibold shadow-2xs'
                                      : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50'
                                      }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${isSelected
                                          ? 'bg-teal-600 border-teal-600 text-white'
                                          : 'border-slate-300 bg-white'
                                          }`}
                                      >
                                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                      <span className="text-xs truncate">{cls.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 text-[10px]">
                                      {cls.generation?.name && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                          {cls.generation.name}
                                        </span>
                                      )}
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                        {cls.tierLevel}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Opsi 3: Berdasarkan Jenjang Usia (Single Select) */}
            {targetScope === RollingTargetScope.GENERASI && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Pilih 1 Jenjang Usia Sasaran:</span>
                  <span className="text-[11px] text-slate-400">Kurikulum pengajian disesuaikan per jenjang</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {availableGenerations.map((gen) => {
                    const isSelected = selectedGenerationId === gen.id;
                    return (
                      <button
                        key={gen.id}
                        type="button"
                        onClick={() => setSelectedGenerationId(gen.id)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${isSelected
                          ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-2 ring-teal-400/30 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                      >
                        <span className="text-xs">{gen.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{gen.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CARD 3: PILIH MATERI PENGAJIAN (OPSIONAL, MAKS. 3) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span>3. Materi Pengajian</span>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/80">
                {selectedMaterialIds.length} / 3 Materi
              </span>
            </div>

            {/* List Materi Terpilih */}
            {selectedMaterialIds.length > 0 && (
              <div className="space-y-2">
                {selectedMaterialIds.map((matId, idx) => {
                  const matObj = availableMaterials.find((m) => m.id === matId);
                  return (
                    <div
                      key={matId}
                      className="p-2.5 rounded-xl border border-teal-200/80 bg-teal-50/50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[10px] font-bold shrink-0">
                          {idx === 0 ? 'Materi Utama' : `Materi #${idx + 1}`}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {matObj?.title || 'Materi Terpilih'}
                        </span>
                        {matObj?.targetGeneration?.name && (
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({matObj.targetGeneration.name})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(matId)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Hapus materi ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input Dropdown Tambah Materi (Jika < 3) */}
            {selectedMaterialIds.length < 3 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">
                  + Tambah Materi ke Sesi (Slot #{selectedMaterialIds.length + 1}):
                </label>
                <select
                  value=""
                  onChange={(e) => handleAddMaterial(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                >
                  <option value="">-- Pilih Materi dari Kurikulum Aktif --</option>
                  {availableMaterials
                    .filter((m) => !selectedMaterialIds.includes(m.id))
                    .map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.title} {mat.targetGeneration?.name ? `(${mat.targetGeneration.name})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* CARD 4: TIM PENGAJAR (BISA LEBIH DARI SATU) & BADAL */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <User className="w-4 h-4 text-teal-600" />
                <span>4. Pengajar &amp; Badal</span>
              </div>
            </div>

            {/* List Pengajar Terpilih */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">
                Ustadz Pengajar Bertugas <span className="text-rose-500">*</span>:
              </label>

              <div className="space-y-2">
                {selectedTeacherIds.map((tId) => {
                  const teacher = availableTeachers.find((t) => t.id === tId);
                  const isPrimary = tId === primaryTeacherId;
                  return (
                    <div
                      key={tId}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${isPrimary
                        ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/20'
                        : 'bg-slate-50/60 border-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-teal-700 font-bold shrink-0">
                          {teacher?.fullName.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {teacher?.fullName || 'Ustadz'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isPrimary ? 'Pengampu Utama' : 'Pengampu Pendamping'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryTeacherId(tId)}
                            className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 px-2 py-1 rounded-lg hover:bg-teal-100/60 transition-colors cursor-pointer"
                          >
                            Jadikan Utama
                          </button>
                        )}
                        {isPrimary && (
                          <span className="px-2.5 py-1 rounded-lg bg-teal-600 text-white font-bold text-[10px]">
                            Ustadz Utama
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveTeacher(tId)}
                          disabled={selectedTeacherIds.length <= 1}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                          title="Hapus dari tim"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dropdown Tambah Pengajar */}
              <div className="pt-1">
                <select
                  value=""
                  onChange={(e) => handleAddTeacher(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-700 font-medium"
                >
                  <option value="">+ Tambah Pengajar Lain ke Sesi Pengajian...</option>
                  {availableTeachers
                    .filter((t) => !selectedTeacherIds.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Badal Pengganti (Opsional) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Ustadz Badal (Delegasi Pengganti - Opsional)</span>
              </label>
              <select
                value={substituteTeacherId}
                onChange={(e) => setSubstituteTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-800 font-medium"
              >
                <option value="">-- Tidak Ada Badal (Dikelola Saat Diperlukan) --</option>
                {availableTeachers
                  .filter((t) => !selectedTeacherIds.includes(t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* CARD 5: WAKTU, TEMPAT & PENGULANGAN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>5. Waktu &amp; Tempat Pelaksanaan</span>
            </div>

            {/* Waktu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tanggal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Mulai (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Selesai (WIB) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                  required
                />
              </div>
            </div>

            {/* Tempat */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Nama Tempat / Masjid <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={venuePlaceName}
                  onChange={(e) => setVenuePlaceName(e.target.value)}
                  placeholder="Contoh: Masjid Al-Barokah, Gedung Pertemuan..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Tipe Tempat</label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium"
                >
                  <option value="MASJID">Masjid / Musholla</option>
                  <option value="RUMAH">Rumah Jamaah</option>
                  <option value="AULA">Aula / Gedung</option>
                  <option value="ONLINE">Daring (Online)</option>
                </select>
              </div>
            </div>

            {/* Catatan Sesi Pengajian */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Catatan Sesi Pengajian (Opsional)</span>
                <span className="text-[10px] text-slate-400 font-normal">Maks. 500 karakter</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Contoh: Membawa perlengkapan alat tulis dan mushaf Al-Qur'an, hadir tepat waktu..."
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 text-slate-800 font-medium placeholder:text-slate-400 resize-none"
              />
            </div>

            {/* Pengulangan Pekanan (Hanya Mode Tambah Baru) */}
            {!isEditMode && (
              <div className="pt-2 border-t border-slate-100">
                <div
                  onClick={() => setIsRecurringWeekly(!isRecurringWeekly)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${isRecurringWeekly
                    ? 'bg-teal-50/60 border-teal-300 ring-1 ring-teal-400/30'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded-lg flex items-center justify-center border mt-0.5 transition-colors ${isRecurringWeekly
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'border-slate-300 bg-white'
                      }`}
                  >
                    {isRecurringWeekly && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-teal-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Ulangi Setiap Pekan (Otomatis Buat 4 Pekan ke Depan)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Sistem akan membuat 4 sesi mandiri per pekan pada jam dan materi yang sama.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD 6: STATUS SESI (MODE EDIT - HANYA UNTUK PJ WILAYAH) */}
          {isEditMode && !isProposalMode && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
              <label className="text-xs font-bold text-slate-700">Status Sesi Pengajian</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(ScheduleStatus.SCHEDULED)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${status === ScheduleStatus.SCHEDULED
                    ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Terjadwal
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(ScheduleStatus.ACTIVE)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${status === ScheduleStatus.ACTIVE
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Berlangsung
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(ScheduleStatus.COMPLETED)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${status === ScheduleStatus.COMPLETED
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Selesai
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(ScheduleStatus.CANCELLED)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${status === ScheduleStatus.CANCELLED
                    ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Diliburkan
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Sticky Footer Action Bar */}
      <div className="border-t border-slate-200/80 bg-white/95 backdrop-blur-md shrink-0 px-4 sm:px-6 py-3.5 mb-2">
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isProposalMode ? 'Mengirim Pengajuan...' : 'Menyimpan...'}</span>
              </>
            ) : (
              <span>
                {isProposalMode
                  ? isEditMode
                    ? 'Perbarui Pengajuan'
                    : 'Kirim Pengajuan Jadwal'
                  : isEditMode
                    ? 'Simpan Perubahan'
                    : 'Simpan Jadwal'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
