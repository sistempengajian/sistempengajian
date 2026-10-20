'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface SkeletonBaseProps {
  className?: string;
  /** Apply a subtle shimmer animation */
  animate?: boolean;
}

// ── Shimmer Animation Base ───────────────────────────────────────────────────

const SHIMMER_CLASS =
  'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent';

// ── Skeleton Primitives ──────────────────────────────────────────────────────

/**
 * Generic skeleton block — base primitive for all skeleton patterns.
 */
export function Skeleton({
  className,
  animate = true,
}: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        'bg-slate-200/60 rounded-lg',
        animate && SHIMMER_CLASS,
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton line — simulates a text line.
 */
export function SkeletonLine({
  width = '100%',
  height = '12px',
  className,
  animate = true,
}: SkeletonBaseProps & {
  width?: string | number;
  height?: string | number;
}) {
  return (
    <Skeleton
      animate={animate}
      className={cn('rounded-md', className)}
      {...({ style: { width, height } } as any)}
    />
  );
}

/**
 * Skeleton circle — simulates avatars or icons.
 */
export function SkeletonCircle({
  size = 40,
  className,
  animate = true,
}: SkeletonBaseProps & {
  size?: number;
}) {
  return (
    <Skeleton
      animate={animate}
      className={cn('rounded-full shrink-0', className)}
      {...({
        style: { width: size, height: size },
      } as any)}
    />
  );
}

/**
 * Skeleton card — simulates a content card with title, text lines, and optional avatar.
 */
export function SkeletonCard({
  lines = 3,
  showAvatar = false,
  className,
  animate = true,
}: SkeletonBaseProps & {
  lines?: number;
  showAvatar?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white/40 border border-slate-200/50 rounded-2xl p-4 space-y-3',
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        {showAvatar && <SkeletonCircle size={36} animate={animate} />}
        <div className="flex-1 space-y-2">
          <Skeleton
            animate={animate}
            className="h-3.5 rounded-md"
            {...({ style: { width: '60%' } } as any)}
          />
          <Skeleton
            animate={animate}
            className="h-2.5 rounded-md"
            {...({ style: { width: '40%' } } as any)}
          />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          animate={animate}
          className="h-2.5 rounded-md"
          {...({
            style: { width: `${85 - i * 15}%` },
          } as any)}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton table row — simulates a data row with columns.
 */
export function SkeletonTableRow({
  columns = 4,
  className,
  animate = true,
}: SkeletonBaseProps & {
  columns?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 px-4 border-b border-slate-100',
        className
      )}
      aria-hidden="true"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          animate={animate}
          className="h-3 rounded-md"
          {...({
            style: {
              width: i === 0 ? '30%' : `${Math.max(10, 20 - i * 3)}%`,
              flex: i === 0 ? '1' : undefined,
            },
          } as any)}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton stat — simulates a metric/stat number with label.
 */
export function SkeletonStat({
  className,
  animate = true,
}: SkeletonBaseProps) {
  return (
    <div
      className={cn(
        'bg-white/40 border border-slate-200/50 rounded-xl p-3 space-y-2',
        className
      )}
      aria-hidden="true"
    >
      <Skeleton
        animate={animate}
        className="h-2 rounded-sm"
        {...({ style: { width: '50%' } } as any)}
      />
      <Skeleton
        animate={animate}
        className="h-6 rounded-md"
        {...({ style: { width: '70%' } } as any)}
      />
    </div>
  );
}

/**
 * Skeleton page — full page loading skeleton with header, stats row, and cards.
 * Matches the existing loading.tsx patterns found across the app.
 */
export function SkeletonPage({
  title = true,
  stats = 3,
  cards = 3,
  className,
  animate = true,
}: SkeletonBaseProps & {
  title?: boolean;
  stats?: number;
  cards?: number;
}) {
  return (
    <div
      className={cn('space-y-5 px-4 sm:px-6 py-4', className)}
      aria-hidden="true"
      aria-label="Memuat halaman..."
    >
      {/* Title skeleton */}
      {title && (
        <div className="space-y-2">
          <Skeleton
            animate={animate}
            className="h-5 rounded-lg"
            {...({ style: { width: '40%' } } as any)}
          />
          <Skeleton
            animate={animate}
            className="h-3 rounded-md"
            {...({ style: { width: '65%' } } as any)}
          />
        </div>
      )}

      {/* Stats row */}
      {stats > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonStat key={i} animate={animate} />
          ))}
        </div>
      )}

      {/* Cards */}
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} showAvatar={i === 0} animate={animate} />
      ))}
    </div>
  );
}
