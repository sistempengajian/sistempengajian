'use client';

import React, { useState, useEffect } from 'react';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import InteractiveCalendar from '@/components/jadwal/InteractiveCalendar';
import { CalendarIcon } from 'lucide-react';

export interface RoleConfigData {
  schedules: any[];
  canManage: boolean;
  canPropose: boolean;
  userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  headerTitle: string;
  headerSubtitle: string;
}

interface JadwalClientWrapperProps {
  initialActiveRole: RoleTabId;
  availableRoles: RoleTabItem[];
  roleDataMap: Record<string, RoleConfigData>;
  teachers: any[];
  classes: any[];
  materials: any[];
  generations: any[];
  scopedOrganizations: any[];
  currentUserOrgId: string | null;
  currentUserId: string;
  roleCodes: any[];
}

export default function JadwalClientWrapper({
  initialActiveRole,
  availableRoles,
  roleDataMap,
  teachers,
  classes,
  materials,
  generations,
  scopedOrganizations,
  currentUserOrgId,
  currentUserId,
  roleCodes,
}: JadwalClientWrapperProps) {
  const [activeRole, setActiveRole] = useState<RoleTabId>(initialActiveRole);

  // Tangani perpindahan role secara instan (0 ms delay) tanpa server roundtrip
  const handleRoleChange = (newRole: RoleTabId) => {
    setActiveRole(newRole);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('role', newRole);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Sinkronisasi navigasi tombol browser Back/Forward
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

  const currentRoleData = roleDataMap[activeRole] || roleDataMap[initialActiveRole] || {
    schedules: [],
    canManage: false,
    canPropose: false,
    userTierLevel: null,
    headerTitle: 'Jadwal Pengajian',
    headerSubtitle: '',
  };

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* Trigger & Modal Bawah Ganti Peran (Hanya tampil jika user memiliki > 1 role) */}
      <RoleNavTabs
        title="Ganti Peran Tampilan Jadwal"
        description="Pilih peran untuk melihat dan mengelola data jadwal & sesi sesuai hak akses Anda."
        availableRoles={availableRoles}
        activeRole={activeRole}
        variant="bottom-sheet"
        onRoleChange={handleRoleChange}
      />

      {/* Top Header: Clean & Modern Glassmorphic Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs transition-all duration-300">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {currentRoleData.headerTitle}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-1">
            {currentRoleData.headerSubtitle}
          </p>
        </div>
      </div>

      {/* Interactive Calendar & Agenda View Component */}
      <InteractiveCalendar
        key={activeRole}
        schedules={currentRoleData.schedules}
        availableTeachers={teachers}
        availableClasses={classes}
        availableMaterials={materials}
        availableGenerations={generations}
        scopedOrganizations={scopedOrganizations}
        currentUserOrgId={currentUserOrgId}
        canManage={currentRoleData.canManage}
        canPropose={currentRoleData.canPropose}
        currentUserId={currentUserId}
        userTierLevel={currentRoleData.userTierLevel}
        roleCodes={roleCodes}
        activeRole={activeRole}
      />
    </div>
  );
}
