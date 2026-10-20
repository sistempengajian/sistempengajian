'use client';

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'outline';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface LoadingButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button content */
  children: ReactNode;
  /** Show loading spinner and disable */
  isLoading?: boolean;
  /** Text to display while loading. If not provided, children are shown with spinner. */
  loadingText?: string;
  /** Button visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon to render before children */
  icon?: ReactNode;
  /** Make the button take full width */
  fullWidth?: boolean;
}

// ── Variant & Size Configs ───────────────────────────────────────────────────

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: `
    bg-emerald-600 text-white
    hover:bg-emerald-700 active:bg-emerald-800
    shadow-xs shadow-emerald-600/20
    border border-emerald-600/30
  `,
  secondary: `
    bg-slate-100 text-slate-700
    hover:bg-slate-200 active:bg-slate-300
    border border-slate-200/80
  `,
  danger: `
    bg-rose-600 text-white
    hover:bg-rose-700 active:bg-rose-800
    shadow-xs shadow-rose-600/20
    border border-rose-600/30
  `,
  ghost: `
    bg-transparent text-slate-600
    hover:bg-slate-100 active:bg-slate-200
    border border-transparent
  `,
  outline: `
    bg-white text-slate-700
    hover:bg-slate-50 active:bg-slate-100
    border border-slate-200
    shadow-2xs
  `,
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'text-[11px] px-2.5 py-1.5 min-h-[32px] rounded-lg gap-1',
  sm: 'text-xs px-3 py-2 min-h-[36px] rounded-xl gap-1.5',
  md: 'text-[13px] px-4 py-2.5 min-h-[44px] rounded-xl gap-2',
  lg: 'text-sm px-5 py-3 min-h-[48px] rounded-2xl gap-2',
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-4.5 h-4.5',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function LoadingButton({
  children,
  isLoading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  ...rest
}: LoadingButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center font-semibold',
        'transition-all duration-150 ease-out',
        'cursor-pointer select-none',
        'active:scale-[0.98]',
        'disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100',
        // Focus ring
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-1',
        // Variant
        VARIANT_CLASSES[variant],
        // Size
        SIZE_CLASSES[size],
        // Full width
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <>
          <Loader2
            className={cn('animate-spin shrink-0', SPINNER_SIZES[size])}
          />
          {loadingText ? (
            <span>{loadingText}</span>
          ) : (
            <span className="opacity-80">{children}</span>
          )}
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
