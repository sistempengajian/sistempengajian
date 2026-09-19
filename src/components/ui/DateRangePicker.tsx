"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

// ── Helper ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function toMidnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameDay(a: Date, b: Date): boolean {
  return toMidnight(a) === toMidnight(b);
}

function isDateBetween(date: Date, start: Date, end: Date): boolean {
  const d = toMidnight(date);
  const s = toMidnight(start);
  const e = toMidnight(end);
  const min = Math.min(s, e);
  const max = Math.max(s, e);
  return d > min && d < max;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0 = Ahad
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: Date;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DateRangePicker({ value, onChange, minDate }: DateRangePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(value.startDate ?? today)
  );
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // Sync month view when value changes externally
  useEffect(() => {
    if (value.startDate) setCurrentMonth(startOfMonth(value.startDate));
  }, [value.startDate]);

  const { startDate, endDate } = value;
  const days = buildCalendarDays(
    currentMonth.getFullYear(),
    currentMonth.getMonth()
  );

  function handleDayClick(day: Date) {
    if (minDate && toMidnight(day) < toMidnight(minDate)) return;
    if (!startDate || (startDate && endDate)) {
      // Reset: start new selection
      onChange({ startDate: day, endDate: null });
    } else {
      // Already have startDate, now set endDate
      if (toMidnight(day) < toMidnight(startDate)) {
        onChange({ startDate: day, endDate: startDate });
      } else {
        onChange({ startDate, endDate: day });
      }
    }
  }

  function applyPreset(months: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = addMonths(start, months);
    end.setDate(end.getDate() - 1);
    onChange({ startDate: start, endDate: end });
    setCurrentMonth(startOfMonth(start));
  }

  // Preview end for hover highlighting when only startDate is set
  const previewEnd: Date | null = !endDate ? hoverDate : null;
  const effectiveStart = startDate;
  const effectiveEnd = endDate ?? previewEnd;

  function getDayClass(day: Date): string {
    const base =
      "w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs sm:text-sm rounded-full cursor-pointer transition-all duration-150 select-none z-10 relative";
    const isStart = !!(effectiveStart && isSameDay(day, effectiveStart));
    const isEnd = !!(effectiveEnd && isSameDay(day, effectiveEnd));
    const inRange = !!(
      effectiveStart &&
      effectiveEnd &&
      isDateBetween(day, effectiveStart, effectiveEnd)
    );
    const isDisabled = !!(minDate && toMidnight(day) < toMidnight(minDate));
    const isToday = isSameDay(day, today);

    if (isDisabled)
      return `${base} text-slate-300 cursor-not-allowed opacity-40`;
    if (isStart || isEnd)
      return `${base} bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 scale-105 font-black ring-2 ring-white`;
    if (inRange)
      return `${base} bg-blue-200/95 text-blue-950 font-black border border-blue-300/80 shadow-2xs hover:bg-blue-300 hover:scale-105`;
    if (isToday)
      return `${base} border-2 border-blue-500 text-blue-700 font-bold hover:bg-blue-50`;
    return `${base} text-slate-700 hover:bg-slate-200/70 hover:text-slate-950 font-semibold`;
  }

  function getRangeRowClass(day: Date, dayOfWeek: number): string {
    if (!effectiveStart || !effectiveEnd) return "";
    const isStart = isSameDay(day, effectiveStart);
    const isEnd = isSameDay(day, effectiveEnd);
    const inRange = isDateBetween(day, effectiveStart, effectiveEnd);

    if (isSameDay(effectiveStart, effectiveEnd)) return "";

    const sTime = toMidnight(effectiveStart);
    const eTime = toMidnight(effectiveEnd);
    const isReversed = eTime < sTime;
    const actualStart = isReversed ? isEnd : isStart;
    const actualEnd = isReversed ? isStart : isEnd;

    if (actualStart) {
      return "bg-gradient-to-r from-transparent via-blue-100/70 to-blue-100/90 rounded-l-full";
    }
    if (actualEnd) {
      return "bg-gradient-to-r from-blue-100/90 via-blue-100/70 to-transparent rounded-r-full";
    }
    if (inRange) {
      let rounded = "";
      if (dayOfWeek === 0) rounded += " rounded-l-full";
      if (dayOfWeek === 6) rounded += " rounded-r-full";
      return `bg-blue-100/90${rounded}`;
    }
    return "";
  }

  // Calculate day difference if both are selected
  const dayCount =
    startDate && endDate
      ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : null;

  return (
    <div className="w-full space-y-4">
      {/* Selected range display */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs transition-all">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Tanggal Mulai
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            {startDate ? (
              formatDate(startDate)
            ) : (
              <span className="text-slate-400 font-normal italic">Pilih tanggal awal...</span>
            )}
          </p>
        </div>

        <div className="text-slate-300 font-bold text-sm sm:text-base shrink-0">→</div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs transition-all">
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Tanggal Akhir
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            {endDate ? (
              formatDate(endDate)
            ) : (
              <span className="text-slate-400 font-normal italic">Pilih tanggal akhir...</span>
            )}
          </p>
        </div>
      </div>

      {dayCount && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200/80 rounded-xl text-xs text-blue-800 font-bold shadow-2xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Rentang Terpilih:
          </span>
          <span className="font-extrabold text-blue-900 text-sm">{dayCount} Hari</span>
        </div>
      )}

      {/* Calendar Navigation Header */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
          className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all shadow-2xs cursor-pointer active:scale-95"
          aria-label="Bulan Sebelumnya"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-slate-900 tracking-tight">
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all shadow-2xs cursor-pointer active:scale-95"
          aria-label="Bulan Berikutnya"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 bg-slate-100/90 rounded-xl py-1.5 border border-slate-200/80">
        {DAY_NAMES.map((name, idx) => (
          <div
            key={name}
            className={`text-center text-[11px] font-bold ${idx === 0 ? "text-rose-600" : idx === 5 ? "text-emerald-700" : "text-slate-600"
              }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const isDisabled = !!(minDate && toMidnight(day) < toMidnight(minDate));
          const dayOfWeek = idx % 7;
          return (
            <div
              key={day.toISOString()}
              className={`relative flex items-center justify-center py-0.5 ${getRangeRowClass(day, dayOfWeek)}`}
            >
              <div
                className={getDayClass(day)}
                onClick={() => !isDisabled && handleDayClick(day)}
                onMouseEnter={() => {
                  if (!isDisabled && startDate && !endDate) setHoverDate(day);
                }}
                onMouseLeave={() => setHoverDate(null)}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 border-t border-slate-200">
        <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">
          Cepat:
        </span>
        {[
          { label: "1 Bulan", months: 1 },
          { label: "3 Bulan", months: 3 },
          { label: "6 Bulan", months: 6 },
          { label: "1 Tahun", months: 12 },
        ].map(({ label, months }) => (
          <button
            key={label}
            type="button"
            onClick={() => applyPreset(months)}
            className="flex-1 text-xs py-1.5 px-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-xl transition-all font-bold shadow-2xs cursor-pointer active:scale-95 text-center"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

