'use client';

import React, { useState } from 'react';
import { AttendanceTrendItem } from '@/app/(protected)/analisis/types';
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  LineChart as LineChartIcon,
  BarChart2,
} from 'lucide-react';

interface AttendanceTrendChartProps {
  trends: AttendanceTrendItem[];
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ trends }) => {
  const [chartMode, setChartMode] = useState<'line' | 'column'>('line');
  const [activeIdx, setActiveIdx] = useState<number>(trends.length - 1);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-xs">
        Belum ada data rekaman presensi pada periode ini.
      </div>
    );
  }

  const selectedIdx = hoveredIdx !== null ? hoveredIdx : activeIdx;
  const currentItem = trends[selectedIdx] || trends[trends.length - 1];
  const firstRate = trends[0]?.rate ?? 0;
  const lastRate = trends[trends.length - 1]?.rate ?? 0;
  const deltaRate = Math.round(lastRate - firstRate);

  // SVG Line Chart Dimensions & Coordinate Calculations
  const svgWidth = 560;
  const svgHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const points = trends.map((t, idx) => {
    const x =
      trends.length > 1
        ? paddingLeft + (idx / (trends.length - 1)) * plotWidth
        : paddingLeft + plotWidth / 2;
    const y = paddingTop + plotHeight - (Math.min(Math.max(t.rate, 0), 100) / 100) * plotHeight;
    return { x, y, item: t, idx };
  });

  // Generate smooth cubic bezier SVG path string
  const createSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const linePathD = createSmoothPath(points);
  const areaPathD =
    points.length > 0
      ? `${linePathD} L ${points[points.length - 1].x} ${paddingTop + plotHeight} L ${points[0].x} ${paddingTop + plotHeight} Z`
      : '';

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 shadow-2xs">
              <CalendarDays className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base">Tren Presensi Berkala</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Dinamika fluktuasi kehadiran santri per interval waktu</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Delta badge */}
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
              deltaRate >= 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {deltaRate >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-rose-600" />}
            <span>{deltaRate >= 0 ? `+${deltaRate}%` : `${deltaRate}%`}</span>
          </div>

          {/* Chart Mode Toggle: Line Chart vs Column Chart */}
          <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/70">
            <button
              type="button"
              onClick={() => setChartMode('line')}
              title="Tampilkan Grafik Garis (Line Chart)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'line'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LineChartIcon className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Garis</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('column')}
              title="Tampilkan Grafik Kolom (Column Chart)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'column'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Kolom</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Rendering Area */}
      <div className="mt-4">
        {chartMode === 'line' ? (
          /* ======================================================= */
          /* 1. GRAFIK GARIS (LINE CHART & SMOOTH AREA SPLINE)       */
          /* ======================================================= */
          <div className="relative w-full overflow-hidden select-none">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible"
            >
              <defs>
                {/* Area Gradient */}
                <linearGradient id="attendanceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.00" />
                </linearGradient>

                {/* Glow Filter */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Horizontal Grid Lines */}
              {[100, 75, 50, 25, 0].map((level) => {
                const y = paddingTop + plotHeight - (level / 100) * plotHeight;
                return (
                  <g key={level}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1.5"
                      strokeDasharray={level === 0 || level === 100 ? '0' : '4 4'}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-semibold font-mono"
                    >
                      {level}%
                    </text>
                  </g>
                );
              })}

              {/* Area Fill Under Curve */}
              {areaPathD && (
                <path
                  d={areaPathD}
                  fill="url(#attendanceAreaGradient)"
                  className="transition-all duration-500"
                />
              )}

              {/* Main Line Stroke */}
              {linePathD && (
                <path
                  d={linePathD}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-500"
                />
              )}

              {/* Interactive Point Nodes */}
              {points.map((pt) => {
                const isHovered = pt.idx === selectedIdx;
                return (
                  <g
                    key={pt.idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(pt.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => setActiveIdx(pt.idx)}
                  >
                    {/* Invisible Larger Hit Area for Easy Touch/Hover */}
                    <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                    {/* Vertical Guideline on Hover */}
                    {isHovered && (
                      <line
                        x1={pt.x}
                        y1={paddingTop}
                        x2={pt.x}
                        y2={paddingTop + plotHeight}
                        stroke="#10b981"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        className="animate-in fade-in duration-200"
                      />
                    )}

                    {/* Outer Halo */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 8 : 5}
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth={isHovered ? 3.5 : 2.5}
                      className="transition-all duration-200 shadow-sm"
                    />

                    {/* Center Dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 3.5 : 2}
                      fill="#059669"
                      className="transition-all duration-200"
                    />

                    {/* Label Badge above Point */}
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      className={`text-[11px] font-black transition-all ${
                        isHovered ? 'fill-emerald-800' : 'fill-slate-600'
                      }`}
                    >
                      {pt.item.rate}%
                    </text>

                    {/* X-axis Interval Label */}
                    <text
                      x={pt.x}
                      y={svgHeight - 12}
                      textAnchor="middle"
                      className={`text-[11px] transition-colors ${
                        isHovered ? 'fill-emerald-800 font-bold' : 'fill-slate-500 font-medium'
                      }`}
                    >
                      {pt.item.periodLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          /* ======================================================= */
          /* 2. GRAFIK KOLOM (COLUMN CHART VERTICAL)                 */
          /* ======================================================= */
          <div>
            <div className="grid grid-cols-4 gap-3 sm:gap-6 items-end h-48 border-b border-slate-100 pb-3">
              {trends.map((item, idx) => {
                const isSelected = activeIdx === idx;
                const total = item.hadir + item.terlambat + item.izin + item.sakit + item.alpa;
                const heightPercent = Math.max(18, Math.min(100, item.rate));

                return (
                  <div
                    key={idx}
                    onClick={() => setActiveIdx(idx)}
                    className="group flex flex-col items-center justify-end h-full cursor-pointer"
                  >
                    {/* Rate label on top of bar */}
                    <span
                      className={`text-xs font-black mb-1.5 transition-colors ${
                        isSelected ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-700'
                      }`}
                    >
                      {item.rate}%
                    </span>

                    {/* Vertical Column Bar */}
                    <div
                      className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-end ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 shadow-sm bg-slate-100'
                          : 'bg-slate-100 hover:bg-slate-200/80'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div
                        className="w-full bg-emerald-500 transition-all"
                        style={{
                          height: total > 0 ? `${(item.hadir / total) * 100}%` : '70%',
                        }}
                      />
                      {item.terlambat > 0 && (
                        <div
                          className="w-full bg-amber-400"
                          style={{ height: `${(item.terlambat / total) * 100}%` }}
                        />
                      )}
                      {item.izin + item.sakit > 0 && (
                        <div
                          className="w-full bg-sky-400"
                          style={{ height: `${((item.izin + item.sakit) / total) * 100}%` }}
                        />
                      )}
                      {item.alpa > 0 && (
                        <div
                          className="w-full bg-rose-500"
                          style={{ height: `${(item.alpa / total) * 100}%` }}
                        />
                      )}
                    </div>

                    {/* X-axis Label */}
                    <span
                      className={`mt-2 text-[11px] font-semibold text-center truncate max-w-full transition-colors ${
                        isSelected ? 'text-emerald-800 font-bold' : 'text-slate-500'
                      }`}
                      title={item.periodLabel}
                    >
                      {item.periodLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Interval Detail Card */}
        {currentItem && (
          <div className="mt-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-4">
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold text-slate-800">
                Rincian Presensi: <span className="text-emerald-700">{currentItem.periodLabel}</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                Kehadiran Total: <strong className="text-slate-900 font-black">{currentItem.rate}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 border border-emerald-200/70 shadow-2xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Hadir Tepat</span>
                  <span className="font-black text-emerald-800 text-sm">{currentItem.hadir} sesi</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 border border-amber-200/70 shadow-2xs">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Terlambat</span>
                  <span className="font-black text-amber-800 text-sm">{currentItem.terlambat} sesi</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 border border-sky-200/70 shadow-2xs">
                <AlertCircle className="h-4 w-4 text-sky-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Izin / Sakit</span>
                  <span className="font-black text-sky-800 text-sm">{currentItem.izin + currentItem.sakit} sesi</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 border border-rose-200/70 shadow-2xs">
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Alpa</span>
                  <span className="font-black text-rose-800 text-sm">{currentItem.alpa} sesi</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceTrendChart;
