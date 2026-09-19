'use client';

import React from 'react';

interface CircularProgressBarProps {
  /** Nilai capaian 0 - 100 */
  value: number;
  /** Ukuran diameter lingkaran dalam pixel (default: 48) */
  size?: number;
  /** Ketebalan garis lingkaran dalam pixel (default: 3.5) */
  strokeWidth?: number;
  /** Menampilkan teks persentase/angka di tengah (default: true) */
  showText?: boolean;
  /** Label opsional di bawah angka (misal: "SKOR") */
  subLabel?: string;
  className?: string;
}

export default function CircularProgressBar({
  value,
  size = 48,
  strokeWidth = 3.5,
  showText = true,
  subLabel,
  className = '',
}: CircularProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  // Pewarnaan dinamis berdasarkan rentang nilai
  // Rendah (< 60): Merah
  // Sedang (60 - 79): Kuning / Amber
  // Tinggi (>= 80): Hijau / Emerald
  // Belum ada nilai (0): Abu-abu netral
  let strokeColor = 'stroke-slate-300';
  let textColor = 'text-slate-400';
  let bgColor = 'bg-slate-50/60';
  let borderColor = 'border-slate-200/50';

  if (clampedValue > 0 && clampedValue < 60) {
    strokeColor = 'stroke-rose-500';
    textColor = 'text-rose-600';
    bgColor = 'bg-rose-50/50';
    borderColor = 'border-rose-200/50';
  } else if (clampedValue >= 60 && clampedValue < 80) {
    strokeColor = 'stroke-amber-500';
    textColor = 'text-amber-600';
    bgColor = 'bg-amber-50/50';
    borderColor = 'border-amber-200/50';
  } else if (clampedValue >= 80) {
    strokeColor = 'stroke-emerald-500';
    textColor = 'text-emerald-600';
    bgColor = 'bg-emerald-50/50';
    borderColor = 'border-emerald-200/50';
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full border ${bgColor} ${borderColor} shadow-2xs shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`Ketercapaian Nilai: ${clampedValue}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 origin-center overflow-visible"
      >
        {/* Garis Dasar (Track): Abu-abu / putih samar saat belum terisi */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-200/80"
        />

        {/* Garis Isian Berwarna Dinamis (Fill Line) */}
        {clampedValue > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${strokeColor} transition-all duration-700 ease-out`}
          />
        )}
      </svg>

      {/* Nilai / Persentase di Tengah Lingkaran */}
      {showText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span
            className={`font-black tracking-tight leading-none ${textColor}`}
            style={{ fontSize: size * 0.28 }}
          >
            {clampedValue}
          </span>
          {subLabel && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-0.5"
              style={{ fontSize: size * 0.16 }}
            >
              {subLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
