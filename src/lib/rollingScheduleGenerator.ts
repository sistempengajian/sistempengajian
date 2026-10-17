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
  materialRolling?: {
    id: string;
    rollingType: RollingIntervalType;
    itemsPerSession: number;
    queues: MaterialQueue[];
  } | null;
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
  startDate: Date | string;
  endDate: Date | string;
  /** Indeks awal antrean materi (0-based, default 0) */
  startMaterialStep?: number;
  /** Indeks awal antrean pengajar (0-based, default 0) */
  startTeacherStep?: number;
  /** ID batch unik untuk grouping (akan di-generate jika tidak diberikan) */
  batchId?: string;
  /** Timezone name (default: "Asia/Jakarta") */
  timeZone?: string;
}

export interface GeneratedSessionTeacher {
  slotIndex: number;
  teacherId: string;
  teacherName: string;
  isPrimary: boolean;
  substituteTeacherId?: string | null;
  substituteTeacherName?: string | null;
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
  /** Daftar seluruh pengajar (utama & pendamping) dan badal pada sesi ini */
  teachers: GeneratedSessionTeacher[];
  /** Pengajar primary */
  primaryTeacherId: string;
  primaryTeacherName: string;
  /** Pengajar pengganti (badal), jika ada */
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
}

export interface GeneratorSummarySession {
  date: string; // "YYYY-MM-DD"
  dayName: string;
  timeRange: string;
  materialTitle: string;
  teacherName: string;
  stepOrder: number;
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
    sampleSessions: GeneratorSummarySession[];
  };
}

// ── Calendar Date Helpers ─────────────────────────────────────────────────────

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayOfWeek: number; // 0=Ahad, 1=Sen, ..., 6=Sab
  dateString: string; // "YYYY-MM-DD"
}

const DAY_NAMES_ID = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];

/**
 * Parsing input tanggal (string "YYYY-MM-DD", ISO string, atau objek Date)
 * menjadi representasi kalender murni pada timezone tertentu (default: Asia/Jakarta).
 */
export function parseCalendarDate(
  input: string | Date,
  timeZone: string = 'Asia/Jakarta'
): CalendarDate {
  let year: number;
  let month: number;
  let day: number;

  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const parts = input.trim().split('-').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    const dateObj = typeof input === 'string' ? new Date(input) : input;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.format(dateObj); // "YYYY-MM-DD"
    const [y, m, d] = parts.split('-').map(Number);
    year = y;
    month = m;
    day = d;
  }

  // Hari dalam seminggu dihitung deterministik via UTC date
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = utcDate.getUTCDay(); // 0 = Ahad, 1 = Senin, ...
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return { year, month, day, dayOfWeek, dateString };
}

/**
 * Kumpulkan semua tanggal kalender dalam rentang [startDate, endDate]
 * yang cocok dengan hari yang dipilih (selectedDays: 0=Ahad..6=Sabtu).
 */
export function collectSessionCalendarDates(
  startDateInput: string | Date,
  endDateInput: string | Date,
  selectedDays: number[],
  timeZone: string = 'Asia/Jakarta'
): CalendarDate[] {
  const start = parseCalendarDate(startDateInput, timeZone);
  const end = parseCalendarDate(endDateInput, timeZone);

  const curUtc = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endUtc = new Date(Date.UTC(end.year, end.month - 1, end.day));

  const results: CalendarDate[] = [];

  while (curUtc <= endUtc) {
    const dow = curUtc.getUTCDay();
    if (selectedDays.includes(dow)) {
      const year = curUtc.getUTCFullYear();
      const month = curUtc.getUTCMonth() + 1;
      const day = curUtc.getUTCDate();
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      results.push({
        year,
        month,
        day,
        dayOfWeek: dow,
        dateString,
      });
    }
    curUtc.setUTCDate(curUtc.getUTCDate() + 1);
  }

  return results;
}

/**
 * Menggabungkan tanggal kalender dan string jam "HH:mm" menjadi objek Date
 * dengan timezone offset yang eksplisit (+07:00 untuk Asia/Jakarta / WIB).
 */
export function buildDateTimeWithTimezone(
  dateInfo: CalendarDate,
  timeStr: string,
  timeZone: string = 'Asia/Jakarta'
): Date {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = String(Number(hoursStr) || 0).padStart(2, '0');
  const minutes = String(Number(minutesStr) || 0).padStart(2, '0');
  const offset = timeZone === 'Asia/Jakarta' ? '+07:00' : '+07:00';
  return new Date(`${dateInfo.dateString}T${hours}:${minutes}:00${offset}`);
}

/**
 * Menggabungkan tanggal kalender dan jam selesai "HH:mm".
 * Jika jam selesai lebih awal atau sama dengan jam mulai (misal 23:00 - 00:00),
 * jam selesai otomatis berpindah ke keesokan harinya.
 */
export function buildEndDateTimeWithTimezone(
  dateInfo: CalendarDate,
  startTimeStr: string,
  endTimeStr: string,
  timeZone: string = 'Asia/Jakarta'
): Date {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const isNextDay = endH < startH || (endH === startH && endM <= startM);

  if (!isNextDay) {
    return buildDateTimeWithTimezone(dateInfo, endTimeStr, timeZone);
  }

  const nextUtc = new Date(Date.UTC(dateInfo.year, dateInfo.month - 1, dateInfo.day));
  nextUtc.setUTCDate(nextUtc.getUTCDate() + 1);
  const nextDateInfo: CalendarDate = {
    year: nextUtc.getUTCFullYear(),
    month: nextUtc.getUTCMonth() + 1,
    day: nextUtc.getUTCDate(),
    dayOfWeek: nextUtc.getUTCDay(),
    dateString: `${nextUtc.getUTCFullYear()}-${String(nextUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(nextUtc.getUTCDate()).padStart(2, '0')}`,
  };

  return buildDateTimeWithTimezone(nextDateInfo, endTimeStr, timeZone);
}

/** Hitung indeks antrian berdasarkan tipe rolling secara deterministik murni */
export function resolveQueueStepIndex(params: {
  sessionIndex: number;
  sessionDateInfo: CalendarDate;
  startDateInfo: CalendarDate;
  rollingType: RollingIntervalType;
  totalSteps: number;
  startStep: number;
}): number {
  const { sessionIndex, sessionDateInfo, startDateInfo, rollingType, totalSteps, startStep } = params;
  if (totalSteps === 0) return 0;

  let rawStep: number;

  switch (rollingType) {
    case 'PER_PENGAJIAN':
      rawStep = startStep + sessionIndex;
      break;

    case 'MINGGUAN': {
      // Hitung selisih minggu kalender berbasis Senin
      const startUtc = Date.UTC(startDateInfo.year, startDateInfo.month - 1, startDateInfo.day);
      const sessionUtc = Date.UTC(sessionDateInfo.year, sessionDateInfo.month - 1, sessionDateInfo.day);
      const daysDiff = Math.round((sessionUtc - startUtc) / 86400000);
      const startDowMon = (startDateInfo.dayOfWeek + 6) % 7; // Senin = 0, Ahad = 6
      const weeksDiff = Math.floor((daysDiff + startDowMon) / 7);
      rawStep = startStep + Math.max(0, weeksDiff);
      break;
    }

    case 'BULANAN': {
      // Hitung selisih bulan kalender dari bulan mulai
      const monthsDiff =
        (sessionDateInfo.year - startDateInfo.year) * 12 +
        (sessionDateInfo.month - startDateInfo.month);
      rawStep = startStep + Math.max(0, monthsDiff);
      break;
    }

    default:
      rawStep = startStep + sessionIndex;
  }

  return ((rawStep % totalSteps) + totalSteps) % totalSteps;
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
    timeZone = 'Asia/Jakarta',
  } = input;

  const batchId = input.batchId ?? crypto.randomUUID();

  // 1. Kumpulkan semua tanggal sesi kalender
  const sessionCalendarDates = collectSessionCalendarDates(startDate, endDate, selectedDays, timeZone);
  if (sessionCalendarDates.length === 0) {
    return {
      batchId,
      sessions: [],
      summary: {
        totalSessions: 0,
        totalMaterialRotations: 0,
        totalTeacherRotations: 0,
        sessionDates: [],
        sampleSessions: [],
      },
    };
  }

  const startDateInfo = parseCalendarDate(startDate, timeZone);

  const matQueues = blueprint.materialRolling?.queues
    ? blueprint.materialRolling.queues.sort((a, b) => a.stepOrder - b.stepOrder)
    : [];
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

  sessionCalendarDates.forEach((dateInfo, sessionIndex) => {
    // Resolve material step
    const matStepIdx =
      blueprint.materialRolling && matQueues.length > 0
        ? resolveQueueStepIndex({
            sessionIndex,
            sessionDateInfo: dateInfo,
            startDateInfo,
            rollingType: blueprint.materialRolling.rollingType,
            totalSteps: matQueues.length,
            startStep: startMaterialStep,
          })
        : 0;

    // Resolve teacher step
    const tchStepIdx = resolveQueueStepIndex({
      sessionIndex,
      sessionDateInfo: dateInfo,
      startDateInfo,
      rollingType: blueprint.teacherRolling.rollingType,
      totalSteps: tchQueues.length,
      startStep: startTeacherStep,
    });

    const matQueue = matQueues[matStepIdx];
    const tchQueue = tchQueues[tchStepIdx];

    // Materi sesi ini
    const scheduleMaterials =
      matQueue && blueprint.materialRolling
        ? matQueue.items
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .slice(0, blueprint.materialRolling.itemsPerSession)
            .map((item) => ({
              materialId: item.materialId,
              materialTitle: item.materialTitle,
              slotIndex: item.slotIndex,
            }))
        : [];

    // Pengajar sesi ini (seluruh slot aktif)
    const sortedTchItems = (tchQueue?.items || [])
      .slice()
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .slice(0, blueprint.teacherRolling.teachersPerSession || 1);

    if (sortedTchItems.length === 0) return; // skip jika tidak ada pengajar

    const sessionTeachers: GeneratedSessionTeacher[] = sortedTchItems.map((item, idx) => ({
      slotIndex: item.slotIndex,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      isPrimary: idx === 0,
      substituteTeacherId: item.substituteTeacherId ?? null,
      substituteTeacherName: item.substituteTeacherName ?? null,
    }));

    const primaryItem = sessionTeachers[0];

    // Judul sesi: Cukup nama blueprint saja sesuai instruksi user
    const title = blueprint.name;

    const startDateTime = buildDateTimeWithTimezone(dateInfo, startTime, timeZone);
    const endDateTime = buildEndDateTimeWithTimezone(dateInfo, startTime, endTime, timeZone);

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
      startTime: startDateTime,
      endTime: endDateTime,
      rollingPengajianId: blueprint.id,
      rollingBatchId: batchId,
      rollingMaterialStepOrder: matQueue ? matQueue.stepOrder : matStepIdx + 1,
      rollingTeacherStepOrder: tchQueue ? tchQueue.stepOrder : tchStepIdx + 1,
      scheduleMaterials,
      teachers: sessionTeachers,
      primaryTeacherId: primaryItem.teacherId,
      primaryTeacherName: primaryItem.teacherName,
      substituteTeacherId: primaryItem.substituteTeacherId ?? null,
      substituteTeacherName: primaryItem.substituteTeacherName ?? null,
    });
  });

  // 4. Hitung statistik & sample sesi untuk preview
  const matStepSet = new Set(sessions.map((s) => s.rollingMaterialStepOrder));
  const tchStepSet = new Set(sessions.map((s) => s.rollingTeacherStepOrder));

  const sampleSessions: GeneratorSummarySession[] = [];
  const seenStepOrders = new Set<number>();

  sessions.forEach((s, idx) => {
    const isFirstFew = idx < 3;
    const isNewRotation = !seenStepOrders.has(s.rollingMaterialStepOrder);
    seenStepOrders.add(s.rollingMaterialStepOrder);

    if ((isFirstFew || isNewRotation) && sampleSessions.length < 12) {
      const cal = parseCalendarDate(s.startTime, timeZone);
      sampleSessions.push({
        date: cal.dateString,
        dayName: DAY_NAMES_ID[cal.dayOfWeek] || '',
        timeRange: `${startTime} - ${endTime} WIB`,
        materialTitle: s.scheduleMaterials.map((m) => m.materialTitle).join(', ') || 'Kurikulum Bulanan',
        teacherName: s.primaryTeacherName,
        stepOrder: s.rollingMaterialStepOrder,
      });
    }
  });

  return {
    batchId,
    sessions,
    summary: {
      totalSessions: sessions.length,
      totalMaterialRotations: matStepSet.size,
      totalTeacherRotations: tchStepSet.size,
      sessionDates: sessions.map((s) => s.startTime),
      sampleSessions,
    },
  };
}
