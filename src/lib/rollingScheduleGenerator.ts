/**
 * Rolling Schedule Generator Engine — Tahap 4
 *
 * Mengkonversi blueprint RollingPengajian + parameter jadwal menjadi
 * array sesi konkret yang siap disimpan ke tabel Schedule.
 */

import type { RollingIntervalType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MaterialQueue {
  stepOrder: number;
  title?: string | null;
  items: { slotIndex: number; materialId: string; materialTitle: string }[];
}

export interface TeacherQueue {
  stepOrder: number;
  title?: string | null;
  items: {
    slotIndex: number;
    teacherId: string;
    teacherName: string;
    substituteTeacherId?: string | null;
    substituteTeacherName?: string | null;
  }[];
}

/** Subset dari RollingPengajian yang dibutuhkan generator. */
export interface RollingBlueprint {
  id: string;
  name: string;
  targetScope: "KELAS" | "GENERASI" | "WILAYAH_UMUM";
  organizationId: string;
  tierLevel: "KELOMPOK" | "DESA" | "DAERAH";
  venuePlaceName: string;
  venueType?: string | null;
  materialRolling: {
    id: string;
    rollingType: RollingIntervalType;
    itemsPerSession: number;
    queues: MaterialQueue[];
  };
  teacherRolling: {
    id: string;
    rollingType: RollingIntervalType;
    teachersPerSession: number;
    queues: TeacherQueue[];
  };
  targetClasses: { classId: string; className: string }[];
  targetGenerations: { generationId: string; generationName: string }[];
}

export interface GeneratorInput {
  blueprint: RollingBlueprint;
  /** 0=Ahad, 1=Sen, ..., 6=Sab */
  selectedDays: number[];
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  startDate: Date;
  endDate: Date;
  /** Indeks awal antrean materi (0-based, default 0) */
  startMaterialStep?: number;
  /** Indeks awal antrean pengajar (0-based, default 0) */
  startTeacherStep?: number;
  /** ID batch unik untuk grouping (akan di-generate jika tidak diberikan) */
  batchId?: string;
}

/** Satu sesi yang akan disimpan ke tabel `Schedule` */
export interface GeneratedSession {
  title: string;
  organizationId: string;
  tierLevel: "KELOMPOK" | "DESA" | "DAERAH";
  classId: string | null;
  targetScope: "KELAS" | "GENERASI" | "WILAYAH_UMUM";
  targetClassIds: string[];
  targetGenerationIds: string[];
  /** Untuk target GENERASI, ini adalah ID generasi (bukan classId) */
  generationTargetId: string | null;
  venuePlaceName: string;
  venueType: string | null;
  startTime: Date;
  endTime: Date;
  rollingPengajianId: string;
  rollingBatchId: string;
  rollingMaterialStepOrder: number;
  rollingTeacherStepOrder: number;
  /** Materi yang dijadwalkan pada sesi ini */
  scheduleMaterials: { materialId: string; materialTitle: string; slotIndex: number }[];
  /** Pengajar primary */
  primaryTeacherId: string;
  primaryTeacherName: string;
  /** Pengajar pengganti (badal), jika ada */
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
}

export interface GeneratorResult {
  batchId: string;
  sessions: GeneratedSession[];
  /** Ringkasan untuk preview */
  summary: {
    totalSessions: number;
    totalMaterialRotations: number;
    totalTeacherRotations: number;
    sessionDates: Date[];
  };
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/** Kumpulkan semua tanggal dalam rentang yang sesuai hari yang dipilih */
function collectSessionDates(
  startDate: Date,
  endDate: Date,
  selectedDays: number[]
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    if (selectedDays.includes(current.getDay())) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Hitung indeks antrian berdasarkan tipe rolling */
function resolveQueueStepIndex(params: {
  sessionIndex: number;
  sessionDate: Date;
  startDate: Date;
  rollingType: RollingIntervalType;
  totalSteps: number;
  startStep: number;
}): number {
  const { sessionIndex, sessionDate, startDate, rollingType, totalSteps, startStep } = params;
  if (totalSteps === 0) return 0;

  let rawStep: number;

  switch (rollingType) {
    case "PER_PENGAJIAN":
      rawStep = startStep + sessionIndex;
      break;

    case "MINGGUAN": {
      // Hitung selisih minggu dari startDate
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksDiff = Math.floor(
        (sessionDate.getTime() - startDate.getTime()) / msPerWeek
      );
      rawStep = startStep + weeksDiff;
      break;
    }

    case "BULANAN": {
      // Hitung selisih bulan dari startDate
      const monthsDiff =
        (sessionDate.getFullYear() - startDate.getFullYear()) * 12 +
        (sessionDate.getMonth() - startDate.getMonth());
      rawStep = startStep + monthsDiff;
      break;
    }

    default:
      rawStep = startStep + sessionIndex;
  }

  return rawStep % totalSteps;
}

/** Buat objek Date dari tanggal sesi + string jam */
function combineDateTime(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
}

// ── Main Generator ────────────────────────────────────────────────────────────

export function generateRollingScheduleSessions(
  input: GeneratorInput
): GeneratorResult {
  const {
    blueprint,
    selectedDays,
    startTime,
    endTime,
    startDate,
    endDate,
    startMaterialStep = 0,
    startTeacherStep = 0,
  } = input;

  const batchId = input.batchId ?? crypto.randomUUID();

  // 1. Kumpulkan semua tanggal sesi
  const sessionDates = collectSessionDates(startDate, endDate, selectedDays);
  if (sessionDates.length === 0) {
    return {
      batchId,
      sessions: [],
      summary: {
        totalSessions: 0,
        totalMaterialRotations: 0,
        totalTeacherRotations: 0,
        sessionDates: [],
      },
    };
  }

  const matQueues = blueprint.materialRolling.queues.sort(
    (a, b) => a.stepOrder - b.stepOrder
  );
  const tchQueues = blueprint.teacherRolling.queues.sort(
    (a, b) => a.stepOrder - b.stepOrder
  );

  // 2. Siapkan target kelas dan target generasi untuk sesi gabungan
  const targetClassIds =
    blueprint.targetScope === "KELAS"
      ? blueprint.targetClasses.map((tc) => tc.classId)
      : [];

  const targetGenerationIds =
    blueprint.targetScope === "GENERASI"
      ? blueprint.targetGenerations.map((tg) => tg.generationId)
      : [];

  const primaryClassId = targetClassIds.length > 0 ? targetClassIds[0] : null;
  const primaryGenerationId =
    targetGenerationIds.length > 0 ? targetGenerationIds[0] : null;

  // 3. Generate sesi gabungan per tanggal pertemuan
  const sessions: GeneratedSession[] = [];

  sessionDates.forEach((date, sessionIndex) => {
    // Resolve material step
    const matStepIdx = resolveQueueStepIndex({
      sessionIndex,
      sessionDate: date,
      startDate,
      rollingType: blueprint.materialRolling.rollingType,
      totalSteps: matQueues.length,
      startStep: startMaterialStep,
    });

    // Resolve teacher step
    const tchStepIdx = resolveQueueStepIndex({
      sessionIndex,
      sessionDate: date,
      startDate,
      rollingType: blueprint.teacherRolling.rollingType,
      totalSteps: tchQueues.length,
      startStep: startTeacherStep,
    });

    const matQueue = matQueues[matStepIdx];
    const tchQueue = tchQueues[tchStepIdx];

    // Materi sesi ini
    const scheduleMaterials = matQueue
      ? matQueue.items
          .sort((a, b) => a.slotIndex - b.slotIndex)
          .slice(0, blueprint.materialRolling.itemsPerSession)
          .map((item) => ({
            materialId: item.materialId,
            materialTitle: item.materialTitle,
            slotIndex: item.slotIndex,
          }))
      : [];

    // Pengajar sesi ini
    const primaryItem = tchQueue?.items
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .at(0);
    if (!primaryItem) return; // skip jika tidak ada pengajar

    // Judul sesi: Cukup nama blueprint saja sesuai instruksi user
    const title = blueprint.name;

    sessions.push({
      title,
      organizationId: blueprint.organizationId,
      tierLevel: blueprint.tierLevel,
      classId: primaryClassId,
      targetScope: blueprint.targetScope,
      targetClassIds,
      targetGenerationIds,
      generationTargetId: primaryGenerationId,
      venuePlaceName: blueprint.venuePlaceName,
      venueType: blueprint.venueType ?? null,
      startTime: combineDateTime(date, startTime),
      endTime: combineDateTime(date, endTime),
      rollingPengajianId: blueprint.id,
      rollingBatchId: batchId,
      rollingMaterialStepOrder: matStepIdx,
      rollingTeacherStepOrder: tchStepIdx,
      scheduleMaterials,
      primaryTeacherId: primaryItem.teacherId,
      primaryTeacherName: primaryItem.teacherName,
      substituteTeacherId: primaryItem.substituteTeacherId ?? null,
      substituteTeacherName: primaryItem.substituteTeacherName ?? null,
    });
  });

  // 4. Hitung statistik
  const matStepSet = new Set(sessions.map((s) => s.rollingMaterialStepOrder));
  const tchStepSet = new Set(sessions.map((s) => s.rollingTeacherStepOrder));

  return {
    batchId,
    sessions,
    summary: {
      totalSessions: sessions.length,
      totalMaterialRotations: matStepSet.size,
      totalTeacherRotations: tchStepSet.size,
      sessionDates,
    },
  };
}
