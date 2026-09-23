'use client';

import React, { useState } from 'react';
import { BenchmarkComparisonItem } from '@/app/(protected)/analisis/types';
import { Layers, ArrowUpDown, Award, CheckCircle2, BarChart2, Table as TableIcon } from 'lucide-react';

interface BenchmarkComparisonTableProps {
  benchmarks: BenchmarkComparisonItem[];
  onSelectUnit?: (unitId: string) => void;
}

export const BenchmarkComparisonTable: React.FC<BenchmarkComparisonTableProps> = ({
  benchmarks,
  onSelectUnit,
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [sortField, setSortField] = useState<'attendance' | 'curriculum' | 'character' | 'students'>('attendance');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!benchmarks || benchmarks.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-xs">
        Belum ada data pembanding untuk unit yang setara.
      </div>
    );
  }

  const sortedList = [...benchmarks].sort((a, b) => {
    let diff = 0;
    if (sortField === 'attendance') diff = a.attendanceRate - b.attendanceRate;
    else if (sortField === 'curriculum') diff = a.curriculumRate - b.curriculumRate;
    else if (sortField === 'character') diff = a.characterScore - b.characterScore;
    else if (sortField === 'students') diff = a.studentCount - b.studentCount;
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (field: 'attendance' | 'curriculum' | 'character' | 'students') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header & Toggle Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/70 shadow-2xs">
                <Layers className="h-4 w-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-base">Benchmark Komparasi Antar Unit</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Perbandingan performa multi-unit pembinaan dalam naungan</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Legend for Grouped Columns */}
            {viewMode === 'chart' && (
              <div className="hidden md:flex items-center gap-2.5 text-[11px] font-bold text-slate-600 mr-2">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Presensi
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-cyan-500" /> Kurikulum
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-purple-500" /> Karakter
                </span>
              </div>
            )}

            {/* View Mode Toggle: Grouped Column Chart vs Detail Table */}
            <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/70">
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                title="Tampilkan Grafik Kolom Komparasi"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'chart'
                    ? 'bg-white text-indigo-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Grafik Kolom</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Tampilkan Tabel Detail"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
            </div>
          </div>
        </div>

        {/* View 1: GROUPED COLUMN CHART */}
        {viewMode === 'chart' ? (
          <div className="mt-5">
            <div className="overflow-x-auto pb-2">
              <div
                className="grid gap-4 sm:gap-6 items-end h-56 border-b border-slate-100 pb-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(benchmarks.length, 2)}, minmax(80px, 1fr))`,
                  minWidth: `${Math.max(benchmarks.length * 90, 320)}px`,
                }}
              >
                {sortedList.map((unit) => {
                  const attH = Math.max(12, unit.attendanceRate);
                  const curH = Math.max(12, unit.curriculumRate);
                  const chrH = Math.max(12, unit.characterScore);

                  return (
                    <div
                      key={unit.id}
                      onClick={() => onSelectUnit && onSelectUnit(unit.id)}
                      className="group flex flex-col items-center justify-end h-full cursor-pointer select-none"
                    >
                      {/* Top Overall Rating Badge */}
                      <span className="text-[10px] font-black text-slate-700 mb-1 group-hover:text-indigo-600 transition-colors">
                        {Math.round((unit.attendanceRate + unit.curriculumRate + unit.characterScore) / 3)}%
                      </span>

                      {/* Grouped Vertical Columns Container */}
                      <div className="flex items-end gap-1 w-full max-w-[60px] h-40 px-1 bg-slate-50/80 rounded-t-xl group-hover:bg-slate-100 transition-colors">
                        {/* 1. Presensi Column */}
                        <div className="flex-1 flex flex-col justify-end h-full" title={`Presensi: ${unit.attendanceRate}%`}>
                          <div
                            className="w-full bg-emerald-500 rounded-t-md transition-all duration-500 group-hover:brightness-105"
                            style={{ height: `${attH}%` }}
                          />
                        </div>

                        {/* 2. Kurikulum Column */}
                        <div className="flex-1 flex flex-col justify-end h-full" title={`Kurikulum: ${unit.curriculumRate}%`}>
                          <div
                            className="w-full bg-cyan-500 rounded-t-md transition-all duration-500 group-hover:brightness-105"
                            style={{ height: `${curH}%` }}
                          />
                        </div>

                        {/* 3. Karakter Column */}
                        <div className="flex-1 flex flex-col justify-end h-full" title={`Karakter: ${unit.characterScore}/100`}>
                          <div
                            className="w-full bg-purple-500 rounded-t-md transition-all duration-500 group-hover:brightness-105"
                            style={{ height: `${chrH}%` }}
                          />
                        </div>
                      </div>

                      {/* Unit Name X-Axis Label */}
                      <span
                        className="mt-2 text-[11px] font-bold text-slate-700 text-center truncate max-w-full group-hover:text-indigo-700 transition-colors"
                        title={unit.name}
                      >
                        {unit.name}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">
                        {unit.studentCount} santri
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Legend */}
            <div className="flex md:hidden items-center justify-center gap-3 text-[10px] font-bold text-slate-600 mt-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Presensi
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-cyan-500" /> Kurikulum
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-purple-500" /> Karakter
              </span>
            </div>
          </div>
        ) : (
          /* View 2: DETAIL TABLE */
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 pl-4">Unit / Kelas</th>
                  <th
                    className="py-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => toggleSort('students')}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Santri</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => toggleSort('attendance')}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Presensi</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => toggleSort('curriculum')}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Kurikulum</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="py-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors"
                    onClick={() => toggleSort('character')}
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Adab</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3.5 text-right pr-4">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedList.map((item, idx) => {
                  const avg = Math.round((item.attendanceRate + item.curriculumRate + item.characterScore) / 3);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectUnit && onSelectUnit(item.id)}
                      className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-700">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{item.type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center text-slate-700 font-bold">
                        {item.studentCount}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 font-bold text-xs ${
                            item.attendanceRate >= 85
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : item.attendanceRate >= 70
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {item.attendanceRate}%
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-block rounded-lg px-2 py-0.5 font-bold text-xs ${
                            item.curriculumRate >= 80
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                              : item.curriculumRate >= 60
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {item.curriculumRate}%
                        </span>
                      </td>
                      <td className="py-3 text-center font-bold text-purple-700">
                        {item.characterScore}
                      </td>
                      <td className="py-3 text-right pr-4">
                        {avg >= 85 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                            <Award className="h-3 w-3 text-emerald-600" /> Sangat Baik
                          </span>
                        ) : avg >= 70 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 border border-cyan-200">
                            <CheckCircle2 className="h-3 w-3 text-cyan-600" /> Baik
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                            Perlu Bina
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Klik pada kolom / baris untuk menganalisis unit secara spesifik</span>
        <span className="font-bold text-slate-700">{benchmarks.length} unit terkomparasi</span>
      </div>
    </div>
  );
};

export default BenchmarkComparisonTable;
