'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpDown,
  GraduationCap,
  MessageCircle,
  Trophy,
  AlertTriangle,
  UserCheck,
  Sparkles,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { PerformerStudentItem } from '@/app/(protected)/analisis/types';

interface StudentCohortTableProps {
  students: PerformerStudentItem[];
  isPrivacyMode: boolean;
}

type FilterStatus = 'ALL' | 'TOP' | 'STABLE' | 'AT_RISK';
type SortField = 'fullName' | 'attendanceRate' | 'curriculumRate' | 'characterScore' | 'compositeScore';

export const StudentCohortTable: React.FC<StudentCohortTableProps> = ({
  students,
  isPrivacyMode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [sortField, setSortField] = useState<SortField>('compositeScore');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Mask name helper for privacy mode
  const formatName = (name: string) => {
    if (!isPrivacyMode) return name;
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].slice(0, 3) + '***';
    }
    return `${parts[0]} ${parts.slice(1).map((p) => p[0] + '***').join(' ')}`;
  };

  const handleWhatsApp = (student: PerformerStudentItem) => {
    if (!student.parentPhone) return;
    const cleanPhone = student.parentPhone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    const message = encodeURIComponent(
      `Assalamu'alaikum Wr. Wb. Bapak/Ibu ${student.parentName || 'Wali Santri'} dari ${formatName(student.fullName)}. Kami menginformasikan rekapitulasi evaluasi pembinaan pengajian ananda saat ini: Presensi: ${student.attendanceRate}%, Capaian Kurikulum: ${student.curriculumRate}%, dan Karakter: ${student.characterScore}/100. Terima kasih atas dukungan dan kerja samanya. Jazakumullahu khaira.`
    );

    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q) ||
          s.organizationName.toLowerCase().includes(q) ||
          s.generationName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    return result;
  }, [students, searchTerm, statusFilter, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredAndSortedStudents.length / pageSize) || 1;
  const paginatedStudents = filteredAndSortedStudents.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
    setPage(1);
  };

  const topCount = students.filter((s) => s.status === 'TOP').length;
  const atRiskCount = students.filter((s) => s.status === 'AT_RISK').length;
  const stableCount = students.filter((s) => s.status === 'STABLE').length;

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-200/70 shadow-2xs">
              <UserCheck className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base">Rekapitulasi Kohort Santri</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {filteredAndSortedStudents.length} santri
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Daftar komprehensif seluruh santri dalam cakupan, evaluasi multi-dimensi, dan akses cepat ke rapor individual
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Cari santri / kelas..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Filter Tabs & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Semua ({students.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('TOP');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'TOP'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100'
            }`}
          >
            <Trophy className="h-3 w-3 text-amber-300" />
            Unggul ({topCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('STABLE');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'STABLE'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200/70 hover:bg-blue-100'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-blue-500" />
            Stabil ({stableCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('AT_RISK');
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'AT_RISK'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200/70 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="h-3 w-3 text-rose-500" />
            Perlu Penguatan ({atRiskCount})
          </button>
        </div>

        {isPrivacyMode && (
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 shadow-2xs">
            <Shield className="h-3.5 w-3.5 text-amber-600" />
            <span>Mode Privasi Aktif (Nama Disamarkan)</span>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
            <tr>
              <th className="px-4 py-3.5">No &amp; Santri</th>
              <th className="px-4 py-3.5">Status</th>
              <th
                onClick={() => handleSort('attendanceRate')}
                className="px-4 py-3.5 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Presensi</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('curriculumRate')}
                className="px-4 py-3.5 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Kurikulum</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('characterScore')}
                className="px-4 py-3.5 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Karakter</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('compositeScore')}
                className="px-4 py-3.5 cursor-pointer hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Skor Komposit</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="px-4 py-3.5 text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-semibold text-xs">
                  Tidak ada data santri yang cocok dengan kriteria pencarian/filter.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, idx) => {
                const globalIdx = (page - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={student.studentId}
                    className="group transition-colors hover:bg-slate-50/70"
                  >
                    {/* Santri Info */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">
                          {globalIdx}
                        </span>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold shrink-0 shadow-2xs ${
                            student.gender === 'MALE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {student.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                            {formatName(student.fullName)}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-medium">
                            <span>{student.className}</span>
                            <span>•</span>
                            <span className="truncate">{student.organizationName}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      {student.status === 'TOP' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <Trophy className="h-3 w-3 text-emerald-600" />
                          Unggul
                        </span>
                      )}
                      {student.status === 'STABLE' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                          Stabil
                        </span>
                      )}
                      {student.status === 'AT_RISK' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                          <AlertTriangle className="h-3 w-3 text-rose-600" />
                          Butuh Penguatan
                        </span>
                      )}
                    </td>

                    {/* Presensi */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 w-24">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-black ${
                              student.attendanceRate >= 90
                                ? 'text-emerald-700'
                                : student.attendanceRate >= 75
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {student.attendanceRate}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full ${
                              student.attendanceRate >= 90
                                ? 'bg-emerald-500'
                                : student.attendanceRate >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Kurikulum */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 w-24">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-black ${
                              student.curriculumRate >= 80
                                ? 'text-cyan-700'
                                : student.curriculumRate >= 50
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {student.curriculumRate}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full ${
                              student.curriculumRate >= 80
                                ? 'bg-cyan-500'
                                : student.curriculumRate >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, student.curriculumRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Karakter */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <span className="font-black text-purple-900 text-sm">
                          {student.characterScore}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">/100</span>
                      </div>
                    </td>

                    {/* Skor Komposit */}
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-800 border border-slate-200">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        <span>{student.compositeScore}</span>
                      </div>
                    </td>

                    {/* Tindakan */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {student.parentPhone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsApp(student)}
                            title="Hubungi Wali Santri via WhatsApp"
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white cursor-pointer shadow-2xs"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                        <Link
                          href={`/laporan?studentId=${student.studentId}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-all hover:border-teal-400 hover:text-teal-700 shadow-2xs"
                          title="Buka Rapor Individual"
                        >
                          <GraduationCap className="h-3.5 w-3.5 text-teal-600" />
                          <span className="hidden sm:inline">Rapor</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 text-xs font-semibold text-slate-500">
          <div>
            Halaman <span className="font-black text-slate-900">{page}</span> dari{' '}
            <span className="font-black text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs font-bold cursor-pointer"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition-colors shadow-2xs font-bold cursor-pointer"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default StudentCohortTable;
