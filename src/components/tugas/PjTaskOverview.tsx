'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Award,
  Users,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Clock,
  Search,
} from 'lucide-react';
import { TaskType } from '@prisma/client';
import TaskListCard from './list/TaskListCard';

export interface PjAssignmentItem {
  id: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  requiresParentVerification: boolean;
  dueDate: string | null;
  pointsReward: number;
  parentBonusPoints: number;
  teacherName: string;
  organizationName: string;
  organizationType?: string | null;
  tierLevel?: string | null;
  materialTitle?: string | null;
  className: string;
  totalSubmissions: number;
  targetStudentsCount?: number;
  verifiedCount: number;
  gradedCount: number;
}

interface PjTaskOverviewProps {
  stats: {
    totalAssignments: number;
    totalSubmissions: number;
    totalParentVerified: number;
    totalGraded: number;
    parentEngagementRate: number;
  };
  assignments: PjAssignmentItem[];
  organizationName?: string;
}

export default function PjTaskOverview({
  stats,
  assignments,
  organizationName = 'Wilayah',
}: PjTaskOverviewProps) {
  const [search, setSearch] = useState('');

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.teacherName.toLowerCase().includes(search.toLowerCase()) ||
    a.className.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* 1. Empat Kartu KPI Utama Supervisi */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Tugas Terbit */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tugas Terbit</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200/60 shrink-0">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">{stats.totalAssignments}</span>
            <span className="text-[11px] font-medium text-slate-500">tugas</span>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">Di seluruh kelas {organizationName}</span>
        </div>

        {/* Card 2: Terkumpul */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Setoran Masuk</span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200/60 shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-teal-700">{stats.totalSubmissions}</span>
            <span className="text-[11px] font-medium text-teal-600">santri</span>
          </div>
          <span className="text-[10px] text-teal-600/80 block truncate">Total terkumpul</span>
        </div>

        {/* Card 3: Sinergi Paraf Ortu */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Paraf Ortu</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60 shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-purple-700">{stats.parentEngagementRate}%</span>
            <span className="text-[11px] font-medium text-purple-600">sinergi</span>
          </div>
          <span className="text-[10px] text-purple-600/80 block truncate">{stats.totalParentVerified} tugas diparaf</span>
        </div>

        {/* Card 4: Tuntas Dinilai */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tuntas Dinilai</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700">{stats.totalGraded}</span>
            <span className="text-[11px] font-medium text-emerald-600">selesai</span>
          </div>
          <span className="text-[10px] text-emerald-600/80 block truncate">Telah dievaluasi guru</span>
        </div>
      </div>

      {/* 2. Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Daftar Penugasan Aktif Wilayah</h3>
          <p className="text-xs text-slate-500">Supervisi pengumpulan dan keterlibatan orang tua santri</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari tugas, guru, atau kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200/80 text-xs text-slate-800 bg-slate-50 focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
      </div>

      {/* 3. Grid of TaskListCards */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          Tidak ada data penugasan yang sesuai pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <TaskListCard
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              taskType={item.taskType}
              dueDate={item.dueDate}
              pointsReward={item.pointsReward}
              parentBonusPoints={item.parentBonusPoints}
              requiresParentVerification={item.requiresParentVerification}
              className={item.className}
              teacherName={item.teacherName}
              organizationName={item.organizationName}
              organizationType={item.organizationType}
              tierLevel={item.tierLevel}
              materialTitle={item.materialTitle}
              totalSubmissions={item.totalSubmissions}
              targetStudentsCount={item.targetStudentsCount}
              gradedCount={item.gradedCount}
              verifiedCount={item.verifiedCount}
              role="PJ"
            />
          ))}
        </div>
      )}
    </div>
  );
}
