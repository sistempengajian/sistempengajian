import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type Soft3DColorScheme = 'emerald' | 'blue' | 'rose' | 'indigo' | 'amber';
export type Soft3DShape = 'circle' | 'squircle';
export type Soft3DSize = 'md' | 'lg';

interface Soft3DIconProps {
  icon: LucideIcon;
  colorScheme?: Soft3DColorScheme;
  shape?: Soft3DShape;
  size?: Soft3DSize;
  className?: string;
}

const ORB_PALETTE: Record<Soft3DColorScheme, { gradient: string; glow: string }> = {
  emerald: {
    gradient: 'from-emerald-300 via-emerald-500 to-teal-600',
    glow: '0 10px 22px -4px rgba(16, 185, 129, 0.48)',
  },
  blue: {
    gradient: 'from-sky-300 via-blue-500 to-indigo-600',
    glow: '0 10px 22px -4px rgba(59, 130, 246, 0.48)',
  },
  rose: {
    gradient: 'from-rose-300 via-pink-500 to-rose-600',
    glow: '0 10px 22px -4px rgba(244, 63, 94, 0.46)',
  },
  indigo: {
    gradient: 'from-indigo-300 via-indigo-500 to-violet-600',
    glow: '0 10px 22px -4px rgba(99, 102, 241, 0.48)',
  },
  amber: {
    gradient: 'from-amber-300 via-amber-400 to-orange-500',
    glow: '0 10px 22px -4px rgba(245, 158, 11, 0.46)',
  },
};

const SIZE_CLASSES: Record<Soft3DSize, { box: string; icon: string }> = {
  md: {
    box: 'w-11 h-11',
    icon: 'w-5 h-5',
  },
  lg: {
    box: 'w-11 h-11 sm:w-12 sm:h-12',
    icon: 'w-5 h-5 sm:w-[22px] sm:h-[22px]',
  },
};

/**
 * 3D satin/clay badge wrapping a Lucide icon with pure CSS specular highlight and colored ambient shadow.
 * Supports both circular progress icons and squircle quick-action launcher icons.
 */
export default function Soft3DIcon({
  icon: Icon,
  colorScheme = 'emerald',
  shape = 'circle',
  size = 'lg',
  className = '',
}: Soft3DIconProps) {
  const palette = ORB_PALETTE[colorScheme];
  const sizeStyles = SIZE_CLASSES[size];
  const radiusClass = shape === 'squircle' ? 'rounded-2xl' : 'rounded-full';

  return (
    <div
      className={`relative overflow-hidden ${sizeStyles.box} ${radiusClass} bg-gradient-to-br ${palette.gradient} flex items-center justify-center shrink-0 ${className}`}
      style={{ boxShadow: palette.glow }}
      aria-hidden="true"
    >
      <span
        className={`pointer-events-none absolute inset-0 ${radiusClass}`}
        style={{
          background:
            'radial-gradient(circle at 28% 22%, rgba(255, 255, 255, 0.48) 0%, rgba(255, 255, 255, 0.08) 42%, rgba(255, 255, 255, 0) 68%)',
          boxShadow:
            'inset 0 2px 4px rgba(255, 255, 255, 0.48), inset 0 -4px 7px rgba(15, 23, 42, 0.18)',
        }}
      />
      <Icon
        className={`relative z-10 ${sizeStyles.icon} text-white [filter:drop-shadow(0_1px_2px_rgba(15,23,42,0.18))]`}
        strokeWidth={2.2}
      />
    </div>
  );
}
