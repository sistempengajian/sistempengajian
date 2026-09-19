'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  Zap,
  Info,
  ChevronDown,
  ChevronRight,
  MapPin,
  Users,
  BookOpen,
} from 'lucide-react';
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker';
import {
  getRollingPengajianForSchedule,
  previewRollingScheduleSessions,
  generateAndSaveRollingSchedule,
  type PreviewInput,
} from '@/app/(protected)/jadwal/rolling-jadwal/actions';
import { getRoleRollingTheme } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Jika diberikan, langsung pre-pilih blueprint ini */
  initialBlueprintId?: string | null;
  roleCodes?: string[];
}

type BlueprintOption = Awaited<
  ReturnType<typeof getRollingPengajianForSchedule>
>['data'] extends infer D ? (D extends any[] ? D[number] : never) : never;

type PreviewData = {
  totalSessions: number;
  totalMaterialRotations: number;
  totalTeacherRotations: number;
  sessionDates: string[]; // ISO strings
};

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', "Jum'", 'Sab'];
const DAY_COLORS = [
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
  'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
];
const DAY_ACTIVE = [
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
  'bg-emerald-600 border-emerald-600 text-white shadow-xs',
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

const SCOPE_LABELS: Record<string, string> = {
  KELAS: 'Per Kelas',
  GENERASI: 'Per Generasi',
  WILAYAH_UMUM: 'Umum Se-wilayah',
};

const ROLLING_TYPE_LABELS: Record<string, string> = {
  PER_PENGAJIAN: 'Per Pengajian',
  MINGGUAN: 'Mingguan',
  BULANAN: 'Bulanan',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RollingScheduleGeneratorModal({
  isOpen,
  onClose,
  onSuccess,
  initialBlueprintId,
  roleCodes = [],
}: Props) {
  const theme = getRoleRollingTheme(roleCodes);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([]);
  const [isLoadingBlueprints, setIsLoadingBlueprints] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [selectedBlueprintId, setSelectedBlueprintId] = useState(initialBlueprintId ?? '');
  const [selectedDays, setSelectedDays] = useState<number[]>([0]); // Ahad default
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('20:00');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [startMaterialStep, setStartMaterialStep] = useState(0);
  const [startTeacherStep, setStartTeacherStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isSubmitPending, startSubmitTransition] = useTransition();
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // ── Load blueprints on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (blueprints.length > 0) return;
    setIsLoadingBlueprints(true);
    getRollingPengajianForSchedule().then((res) => {
      if (res.success && res.data) {
        setBlueprints(res.data);
        if (initialBlueprintId) {
          const found = res.data.find((b) => b.id === initialBlueprintId);
          if (found) setSelectedBlueprintId(found.id);
        }
      }
      setIsLoadingBlueprints(false);
    });
  }, [isOpen, initialBlueprintId, blueprints.length]);

  // ── Reset on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setPreviewError(null);
      setSubmitResult(null);
      setSelectedBlueprintId(initialBlueprintId ?? '');
      setSelectedDays([0]);
      setStartTime('18:30');
      setEndTime('20:00');
      setDateRange({ startDate: null, endDate: null });
      setStartMaterialStep(0);
      setStartTeacherStep(0);
      setShowAdvanced(false);
    }
  }, [isOpen, initialBlueprintId]);

  const selectedBlueprint = blueprints.find((b) => b.id === selectedBlueprintId) ?? null;

  // ── Build preview input ───────────────────────────────────────────────────
  const buildInput = useCallback((): PreviewInput | null => {
    if (!selectedBlueprintId || selectedDays.length === 0 || !dateRange.startDate || !dateRange.endDate) return null;
    return {
      rollingPengajianId: selectedBlueprintId,
      selectedDays,
      startTime,
      endTime,
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
      startMaterialStep,
      startTeacherStep,
    };
  }, [selectedBlueprintId, selectedDays, startTime, endTime, dateRange, startMaterialStep, startTeacherStep]);

  // ── Preview handler ───────────────────────────────────────────────────────
  function handlePreview() {
    const inp = buildInput();
    if (!inp) return;
    setPreviewError(null);
    startPreviewTransition(async () => {
      const res = await previewRollingScheduleSessions(inp);
      if (res.success && res.data) {
        setPreview({
          totalSessions: res.data.summary.totalSessions,
          totalMaterialRotations: res.data.summary.totalMaterialRotations,
          totalTeacherRotations: res.data.summary.totalTeacherRotations,
          sessionDates: res.data.summary.sessionDates.map((d) =>
            d instanceof Date ? d.toISOString() : String(d)
          ),
        });
      } else {
        setPreviewError(res.error ?? 'Gagal memuat preview');
      }
    });
  }

  // ── Submit handler ────────────────────────────────────────────────────────
  function handleGenerate() {
    const inp = buildInput();
    if (!inp) return;
    startSubmitTransition(async () => {
      const res = await generateAndSaveRollingSchedule(inp);
      if (res.success) {
        setSubmitResult({ success: true, message: `Berhasil membuat ${res.totalCreated} sesi jadwal rolling!` });
        onSuccess?.();
      } else {
        setSubmitResult({ success: false, message: res.error ?? 'Terjadi kesalahan' });
      }
    });
  }

  const isFormValid = !!selectedBlueprintId && selectedDays.length > 0 && !!dateRange.startDate && !!dateRange.endDate;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white/95 backdrop-blur-xl animate-fade-in flex flex-col justify-between">
      {/* Container Utama */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 flex-1 flex flex-col justify-between space-y-6">
        {/* ── Top Header Navigation Bar ── */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <div></div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                  Generator Jadwal Rolling
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Buat sesi jadwal otomatis dari blueprint Pengajian Rolling ke kalender terpadu.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shadow-2xs"
            aria-label="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 space-y-6">
          {/* ── Pilih Blueprint ── */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Pilih Blueprint Pengajian Rolling
            </h3>
            {isLoadingBlueprints ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-4 bg-slate-50 border border-slate-200 rounded-2xl justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Memuat daftar blueprint pengajian rolling...
              </div>
            ) : blueprints.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                <p className="text-amber-800 text-sm font-medium">
                  Belum ada blueprint Pengajian Rolling. Buat terlebih dahulu pada menu <strong>Pengajian Rolling (Tahap 3)</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {blueprints.map((bp) => {
                  const isSelected = bp.id === selectedBlueprintId;
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => { setSelectedBlueprintId(bp.id); setPreview(null); }}
                      className={`text-left w-full p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${isSelected
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-400/30 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                        }`}
                    >
                      <div>
                        <div className="flex flex-col items-start gap-2">
                          <p className={`text-sm font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                            {bp.name}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="">{bp.venuePlaceName}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                            {SCOPE_LABELS[bp.targetScope] ?? bp.targetScope}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            Materi: {ROLLING_TYPE_LABELS[bp.materialRolling.rollingType]}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                            Pengajar: {ROLLING_TYPE_LABELS[bp.teacherRolling.rollingType]}
                          </span>
                        </div>
                      </div>

                      {/* Target classes/generations preview */}
                      {isSelected && (
                        <div className="mt-3 pt-2.5 border-t border-blue-200/60 flex flex-wrap gap-1">
                          {bp.targetClasses.map((tc) => (
                            <span key={tc.classId} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                              {tc.class.name}
                            </span>
                          ))}
                          {bp.targetGenerations.map((tg) => (
                            <span key={tg.generationId} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-medium">
                              {tg.generation.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selectedBlueprintId && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ── Left Column: Konfigurasi Parameter (7 cols) ── */}
              <div className="lg:col-span-7 space-y-6">
                {/* ── Hari Rutin ── */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Hari Pengajian Rutin
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, idx) => {
                      const active = selectedDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedDays((prev) =>
                              active ? prev.filter((d) => d !== idx) : [...prev, idx]
                            );
                            setPreview(null);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${active ? DAY_ACTIVE[idx] : DAY_COLORS[idx]
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDays.length === 0 && (
                    <p className="text-xs text-red-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Pilih minimal 1 hari rutin
                    </p>
                  )}
                </section>

                {/* ── Jam ── */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Jam Pengajian
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jam Mulai</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => { setStartTime(e.target.value); setPreview(null); }}
                        className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jam Selesai</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => { setEndTime(e.target.value); setPreview(null); }}
                        className="w-full bg-slate-50/70 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>
                </section>

                {/* ── Rentang Tanggal ── */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Rentang Periode Tanggal
                  </h3>
                  <div className="bg-slate-50/50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                    <DateRangePicker
                      value={dateRange}
                      onChange={(range) => { setDateRange(range); setPreview(null); }}
                    />
                  </div>
                </section>

                {/* ── Advanced / Titik Awal Antrean ── */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    {showAdvanced ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    Pengaturan Lanjutan (Titik Awal Antrean)
                  </button>
                  {showAdvanced && (
                    <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mulai Antrean Materi</label>
                        <select
                          value={startMaterialStep}
                          onChange={(e) => setStartMaterialStep(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none"
                        >
                          {selectedBlueprint?.materialRolling.queues.map((q) => (
                            <option key={q.stepOrder} value={q.stepOrder - 1}>
                              Antrean #{q.stepOrder} {q.title ? `— ${q.title}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mulai Antrean Pengajar</label>
                        <select
                          value={startTeacherStep}
                          onChange={(e) => setStartTeacherStep(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none"
                        >
                          {selectedBlueprint?.teacherRolling.queues.map((q) => (
                            <option key={q.stepOrder} value={q.stepOrder - 1}>
                              Antrean #{q.stepOrder} {q.title ? `— ${q.title}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* ── Right Column: Preview Sesi & Summary (5 cols) ── */}
              <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-8">
                {/* ── Preview Sesi ── */}
                <section className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      Preview & Simulasi Sesi
                    </h3>
                    <button
                      type="button"
                      onClick={handlePreview}
                      disabled={!isFormValid || isPreviewPending}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                    >
                      {isPreviewPending ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Menghitung...</>
                      ) : (
                        <><></> Hitung Preview</>
                      )}
                    </button>
                  </div>

                  {previewError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {previewError}
                    </div>
                  )}

                  {preview && !previewError && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      {/* Summary chips */}
                      <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
                        <div className="px-3 py-3 text-center">
                          <p className="text-2xl font-black text-blue-600">{preview.totalSessions}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Total Sesi</p>
                        </div>
                        <div className="px-3 py-3 text-center">
                          <p className="text-2xl font-black text-emerald-600">{preview.totalMaterialRotations}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Rotasi Materi</p>
                        </div>
                        <div className="px-3 py-3 text-center">
                          <p className="text-2xl font-black text-amber-600">{preview.totalTeacherRotations}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">Rotasi Pengajar</p>
                        </div>
                      </div>

                      {/* Session date list */}
                      {preview.sessionDates.length > 0 && (
                        <div className="border-t border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setPreviewExpanded(!previewExpanded)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <span>
                              {previewExpanded ? 'Sembunyikan' : 'Lihat'} tanggal sesi ({preview.sessionDates.length} hari)
                            </span>
                            {previewExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          {previewExpanded && (
                            <div className="px-4 pb-3 max-h-56 overflow-y-auto">
                              <div className="flex flex-wrap gap-1.5">
                                {preview.sessionDates.map((d) => (
                                  <span key={d} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200 font-medium">
                                    {formatDate(d)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!preview && !previewError && !isPreviewPending && isFormValid && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <span>
                        Parameter form lengkap. Klik <strong>&ldquo;Hitung Preview&rdquo;</strong> untuk melihat simulasi jumlah sesi dan rotasi sebelum dieksekusi.
                      </span>
                    </div>
                  )}
                </section>

                {/* ── Result message ── */}
                {submitResult && (
                  <div className={`flex items-center gap-2 rounded-2xl p-4 text-sm border ${submitResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                    {submitResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <span>{submitResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500 text-center sm:text-left">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Semua sesi jadwal yang digenerate akan terdistribusi ke kalender pengajian wilayah Anda secara otomatis.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer shadow-2xs"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!isFormValid || isSubmitPending || !!submitResult?.success}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r ${theme.card4Button} ${theme.card4ButtonShadow} border ${theme.card4ButtonBorder} disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95`}
            >
              {isSubmitPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Membuat Sesi...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Generate Jadwal</>
              )}
            </button>
          </div>
        </div>
      </div >
    </div >
  );
}
