import React, { useId } from 'react';
import { Check } from 'lucide-react';

export type ProgressColorScheme = 'auto' | 'emerald' | 'blue' | 'rose' | 'indigo' | 'amber';

interface ProgressCircleProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  colorScheme?: ProgressColorScheme;
  showPercentSymbol?: boolean;
  className?: string;
}

const COLOR_SCHEME_STYLES: Record<
  Exclude<ProgressColorScheme, 'auto'>,
  { strokeStops: [string, string]; track: string; completeText: string }
> = {
  emerald: {
    strokeStops: ['#34d399', '#059669'],
    track: 'stroke-emerald-100/90',
    completeText: 'text-emerald-600',
  },
  blue: {
    strokeStops: ['#60a5fa', '#2563eb'],
    track: 'stroke-blue-100/90',
    completeText: 'text-blue-600',
  },
  rose: {
    strokeStops: ['#fb7185', '#e11d48'],
    track: 'stroke-rose-100/90',
    completeText: 'text-rose-600',
  },
  indigo: {
    strokeStops: ['#818cf8', '#4f46e5'],
    track: 'stroke-indigo-100/90',
    completeText: 'text-indigo-600',
  },
  amber: {
    strokeStops: ['#fcd34d', '#d97706'],
    track: 'stroke-amber-100/90',
    completeText: 'text-amber-600',
  },
};

function resolveRingColors(
  colorScheme: ProgressColorScheme,
  isZero: boolean,
  isFull: boolean
): {
  strokeStops: [string, string] | null;
  trackColor: string;
  textColor: string;
} {
  if (colorScheme === 'auto') {
    if (isFull) {
      return {
        strokeStops: ['#34d399', '#059669'],
        trackColor: 'stroke-emerald-100/90',
        textColor: 'text-emerald-600',
      };
    }
    if (isZero) {
      return {
        strokeStops: null,
        trackColor: 'stroke-slate-100',
        textColor: 'text-slate-600',
      };
    }
    return {
      strokeStops: ['#fbbf24', '#f59e0b'],
      trackColor: 'stroke-amber-100/90',
      textColor: 'text-amber-700',
    };
  }

  const scheme = COLOR_SCHEME_STYLES[colorScheme];
  if (isZero) {
    return {
      strokeStops: null,
      trackColor: 'stroke-slate-100',
      textColor: 'text-slate-500',
    };
  }
  return {
    strokeStops: scheme.strokeStops,
    trackColor: scheme.track,
    textColor: isFull ? scheme.completeText : 'text-slate-800',
  };
}

/**
 * ProgressCircle Component
 * Menampilkan indikator progres melingkar dengan SVG linearGradient dinamis yang halus.
 * - Mendukung mode 'auto' maupun skema warna eksplisit per kartu ('emerald' | 'blue' | 'rose' | 'indigo' | 'amber').
 */
export default function ProgressCircle({
  percentage,
  size = 46,
  strokeWidth = 3.5,
  colorScheme = 'auto',
  showPercentSymbol = true,
  className = '',
}: ProgressCircleProps) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `progress-ring-grad-${uid}`;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const roundedPercentage = Math.round(clampedPercentage);
  const isFull = roundedPercentage >= 100;
  const isZero = roundedPercentage === 0;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  const { strokeStops, trackColor, textColor } = resolveRingColors(colorScheme, isZero, isFull);
  const iconSizeClass = size <= 40 ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const labelSizeClass = size >= 46 ? 'text-xs' : 'text-[11px]';

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={`${roundedPercentage}% Selesai`}
      aria-label={`Progress: ${roundedPercentage}%`}
    >
      <svg
        className="w-full h-full -rotate-90 transform"
        viewBox={`0 0 ${size} ${size}`}
      >
        {strokeStops && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeStops[0]} />
              <stop offset="100%" stopColor={strokeStops[1]} />
            </linearGradient>
          </defs>
        )}

        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${trackColor} transition-colors`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Dynamic Gradient Ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeStops ? `url(#${gradientId})` : undefined}
          className={`${strokeStops ? '' : 'stroke-slate-300'} transition-all duration-700 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Center indicator: checkmark only when 100% completed, percentage/number otherwise */}
      <div className={`absolute inset-0 flex items-center justify-center ${textColor} transition-colors`}>
        {isFull ? (
          <Check className={`${iconSizeClass} stroke-[2.5]`} />
        ) : (
          <span className={`${labelSizeClass} font-bold leading-none tabular-nums`}>
            {showPercentSymbol ? `${roundedPercentage}%` : roundedPercentage}
          </span>
        )}
      </div>
    </div>
  );
}
