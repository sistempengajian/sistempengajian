'use client';

import React from 'react';

export interface CircularGaugeSegment {
  value: number; // percentage 0-100
  color: string; // Tailwind stroke class or hex color e.g. 'stroke-emerald-500'
}

export interface CircularGaugeProps {
  value?: number; // 0-100
  size?: number;
  strokeWidth?: number;
  strokeColor?: string;
  trackColor?: string;
  className?: string;
  segments?: CircularGaugeSegment[];
  children?: React.ReactNode;
}

/**
 * CircularGauge Component (Circle Line)
 * Visualisasi lingkaran cincin berbasis SVG native berpresisi tinggi.
 * Mendukung single-ring gauge dan multi-segment cincin proporsional.
 */
export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value = 0,
  size = 64,
  strokeWidth = 6,
  strokeColor = 'stroke-emerald-500',
  trackColor = 'stroke-slate-100',
  className = '',
  segments,
  children,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Track Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={`${trackColor} transition-colors`}
        />

        {/* Multi-segment Ring Mode */}
        {segments && segments.length > 0 ? (
          (() => {
            let accumulatedPercent = 0;
            return segments.map((seg, idx) => {
              const segVal = Math.min(Math.max(seg.value, 0), 100);
              const segStrokeDasharray = `${(segVal / 100) * circumference} ${circumference}`;
              const segStrokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += segVal;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeDasharray={segStrokeDasharray}
                  strokeDashoffset={segStrokeDashoffset}
                  strokeLinecap="round"
                  className={`${seg.color} transition-all duration-700 ease-out`}
                />
              );
            });
          })()
        ) : (
          /* Single Ring Value Mode */
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

      {/* Center Label / Icon / Children */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          {children}
        </div>
      )}
    </div>
  );
};

export default CircularGauge;
