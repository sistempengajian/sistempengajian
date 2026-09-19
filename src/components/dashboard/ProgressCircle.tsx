import React from 'react';
import { Check } from 'lucide-react';

interface ProgressCircleProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * ProgressCircle Component
 * Menggantikan progress bar horizontal dengan circle line bar.
 * - Sisi kanan progress item.
 * - Icon checklist di tengah.
 * - Belum full (< 100%): Line dan checklist berwarna kuning (amber).
 * - Penuh (>= 100%): Line dan checklist berwarna hijau (emerald).
 */
export default function ProgressCircle({
  percentage,
  size = 46,
  strokeWidth = 3.5,
  className = '',
}: ProgressCircleProps) {
  const isFull = percentage >= 100;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  // Warna sesuai spesifikasi:
  // Belum penuh = Kuning (Amber)
  // Penuh = Hijau (Emerald)
  const strokeColor = isFull ? 'stroke-emerald-500' : 'stroke-amber-400';
  const trackColor = isFull ? 'stroke-emerald-100' : 'stroke-amber-100';
  const iconColor = isFull ? 'text-emerald-600' : 'text-amber-500';
  const iconSizeClass = size <= 40 ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`${percentage}% Selesai`}
      aria-label={`Progress: ${percentage}%`}
    >
      <svg
        className="w-full h-full -rotate-90 transform"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${trackColor} transition-colors`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Dynamic Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${strokeColor} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Centered Checklist Icon */}
      <div className={`absolute inset-0 flex items-center justify-center ${iconColor} transition-colors`}>
        <Check className={`${iconSizeClass} stroke-[2.5]`} />
      </div>
    </div>
  );
}
