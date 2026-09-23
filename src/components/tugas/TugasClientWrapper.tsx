'use client';

import React, { useState, useEffect } from 'react';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import StudentTaskView from '@/components/tugas/StudentTaskView';
import TeacherAssignmentView from '@/components/tugas/TeacherAssignmentView';
import ParentTaskView from '@/components/tugas/ParentTaskView';
import PjTaskOverview from '@/components/tugas/PjTaskOverview';
import {
  CheckSquare,
  Award,
  FileText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface TugasClientWrapperProps {
  initialActiveRole: RoleTabId;
  availableRoles: RoleTabItem[];
  roleDataMap: Record<string, any>;
}

export default function TugasClientWrapper({
  initialActiveRole,
  availableRoles,
  roleDataMap,
}: TugasClientWrapperProps) {
  const [activeRole, setActiveRole] = useState<RoleTabId>(initialActiveRole);

  const handleRoleChange = (newRole: RoleTabId) => {
    setActiveRole(newRole);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('role', newRole);
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const roleFromUrl = (params.get('role') || params.get('view') || '').toLowerCase() as RoleTabId;
      if (roleFromUrl && roleDataMap[roleFromUrl]) {
        setActiveRole(roleFromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [roleDataMap]);

  const data = roleDataMap[activeRole] || roleDataMap[initialActiveRole];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* Tab Navigasi Multi-Role Pengguna dengan Modal Bawah (Bottom Sheet) */}
      <RoleNavTabs
        title="Ganti Peran Tampilan Tugas"
        description="Pilih peran untuk melihat dan mengelola tugas sesuai hak akses Anda."
        availableRoles={availableRoles}
        activeRole={activeRole}
        variant="bottom-sheet"
        onRoleChange={handleRoleChange}
      />

      {/* Header Card Minimalis & Clean Sesuai Role Pengguna */}
      {data && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/75 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-xs transition-all duration-300">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {activeRole === 'student' && (
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shadow-2xs shrink-0">
                  <CheckSquare className="w-4 h-4" />
                </div>
              )}
              {activeRole === 'teacher' && (
                <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              )}
              {activeRole === 'parent' && (
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/60 shadow-2xs shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              )}
              {activeRole === 'manage' && (
                <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200/60 shadow-2xs shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {activeRole === 'student' && 'Tugas & Setoran Mandiri'}
                  {activeRole === 'teacher' && 'Pusat Penugasan & Koreksi'}
                  {activeRole === 'parent' && 'Pendampingan & Paraf Orang Tua'}
                  {activeRole === 'manage' && 'Monitoring Penugasan Wilayah'}
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-1.5 leading-relaxed max-w-xl">
              {activeRole === 'student' &&
                'Setor rekaman hafalan mandiri, lengkapi amalan harian, dan kumpulkan poin capaian santri.'}
              {activeRole === 'teacher' &&
                'Kelola tugas pasca-pengajian, koreksi setoran audio santri, dan berikan evaluasi belajar.'}
              {activeRole === 'parent' &&
                'Dengarkan hafalan ananda di rumah, periksa amalan harian, dan berikan paraf digital orang tua.'}
              {activeRole === 'manage' &&
                `Pantau kepatuhan penugasan kelas dan tingkat sinergi paraf orang tua di ${
                  data.userProfile?.organization?.name || 'wilayah binaan'
                }.`}
            </p>
          </div>

          {/* Badge Poin Khusus Santri */}
          {activeRole === 'student' && (
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 self-start sm:self-center shadow-2xs">
              <Award className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600/90 leading-tight">
                  Poin Santri
                </span>
                <span className="text-sm font-extrabold text-emerald-800 leading-tight">
                  {data.userProfile?.gamification?.totalPoints || 0} XP
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Konten Tampilan Berdasarkan Role Pengguna */}
      {data && (
        <div key={activeRole}>
          {activeRole === 'student' && (
            <StudentTaskView
              assignments={data.assignments}
              studentName={data.userProfile.fullName}
            />
          )}

          {activeRole === 'teacher' && (
            <TeacherAssignmentView
              assignments={data.assignments}
              gradingQueue={data.gradingQueue}
              availableGenerations={data.availableGenerations}
              availableClasses={data.availableClasses}
              availableMaterials={data.availableMaterials}
              availableStudents={data.availableStudents}
            />
          )}

          {activeRole === 'parent' && (
            <ParentTaskView
              childrenList={data.children}
              activeChildId={data.activeChildId}
              assignments={data.assignments}
              allAssignmentsByChild={data.allAssignmentsByChild}
            />
          )}

          {activeRole === 'manage' && (
            <PjTaskOverview
              stats={data.stats}
              assignments={data.assignments}
              organizationName={data.userProfile.organization?.name}
            />
          )}
        </div>
      )}
    </div>
  );
}
