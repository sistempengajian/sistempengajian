import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes conditionally without style conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency to IDR
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format timestamp to localized Indonesian format in WIB (Asia/Jakarta)
 */
export function formatIndonesianDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    ...(options || {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }).format(d);
}

export const formatWibDate = formatIndonesianDate;

/**
 * Format time to HH:mm (WIB - Asia/Jakarta)
 */
export function formatWibTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/**
 * Get start and end of day in WIB (Asia/Jakarta)
 */
export function getWibTodayRange(baseDate?: Date): { startOfToday: Date; endOfToday: Date } {
  const dateObj = baseDate || new Date();
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dateObj); // YYYY-MM-DD
  return {
    startOfToday: new Date(`${dateStr}T00:00:00+07:00`),
    endOfToday: new Date(`${dateStr}T23:59:59.999+07:00`),
  };
}

