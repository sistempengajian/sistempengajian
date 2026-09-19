/**
 * Helper untuk mem-parsing data checklist amalan harian (DAILY_HABIT)
 * serta parsing tautan multi-media (audio dan foto).
 */

export const DEFAULT_HABIT_ITEMS = [
  ' '
];

export interface ParsedHabitData {
  habits: string[];
  notes: string | null;
}

export interface HabitProgressInfo {
  allItems: string[];
  completed: string[];
  uncompleted: string[];
  count: number;
  total: number;
  percentage: number;
  progressText: string;
}

/**
 * Parsing teks submission checklist menjadi array habit yang dicentang dan catatan santri.
 */
export function parseHabitData(rawText: string | null | undefined): ParsedHabitData {
  if (!rawText) return { habits: [], notes: null };

  try {
    const parsed = JSON.parse(rawText);

    // Format 1: Array string murni ["Sholat 5 waktu", ...]
    if (Array.isArray(parsed)) {
      return {
        habits: parsed.filter((item): item is string => typeof item === 'string'),
        notes: null,
      };
    }

    // Format 2: Objek { completedHabits: [...], notes: '...' }
    if (parsed && typeof parsed === 'object') {
      const habits = Array.isArray(parsed.completedHabits)
        ? parsed.completedHabits.filter((item: any): item is string => typeof item === 'string')
        : Array.isArray(parsed.habits)
          ? parsed.habits.filter((item: any): item is string => typeof item === 'string')
          : [];

      const notes = typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes.trim() : null;
      return { habits, notes };
    }

    return { habits: [String(parsed)], notes: null };
  } catch {
    // Fallback jika rawText bukan JSON (misal teks plain biasa)
    return { habits: [rawText], notes: null };
  }
}

/**
 * Menghitung progress amalan yang sudah dikerjakan vs belum dikerjakan,
 * mengembalikan format 'selesai/jumlah' (contoh: '4/5 Selesai') serta persentase.
 */
export function getHabitProgress(
  completedHabits: string[],
  customAllItems?: string[]
): HabitProgressInfo {
  const baseItems = customAllItems && customAllItems.length > 0 ? customAllItems : DEFAULT_HABIT_ITEMS;

  // Gabungkan baseItems dengan completedHabits untuk memastikan semua habit yang pernah dicentang masuk
  const allSet = new Set([...baseItems, ...completedHabits]);
  const allItems = Array.from(allSet);

  const completed = allItems.filter((item) => completedHabits.includes(item));
  const uncompleted = allItems.filter((item) => !completedHabits.includes(item));
  const total = allItems.length;
  const count = completed.length;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return {
    allItems,
    completed,
    uncompleted,
    count,
    total,
    percentage,
    progressText: `${count}/${total} Selesai`,
  };
}

/**
 * Parsing mediaFileUrl yang dapat berupa URL tunggal atau JSON array string multi-URL
 * menjadi array string URL yang bersih.
 */
export function parseMediaUrls(rawText: string | null | undefined): string[] {
  if (!rawText) return [];
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // bukan JSON, anggap single URL
  }

  return [trimmed];
}
