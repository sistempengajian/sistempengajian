'use client';

import React from 'react';
import { type RoleTabItem, type RoleTabId } from '@/components/navigation/RoleNavTabs';
import { useSyncedPageRole } from '@/components/navigation/ActiveRoleContext';
import InteractiveCalendar from '@/components/jadwal/InteractiveCalendar';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import PageContainer from '@/components/ui/PageContainer';
import { getRoleTheme } from '@/lib/theme';
import { getScopedRoleCodesForTab } from '@/lib/role-context';

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
  const activeRole = useSyncedPageRole(initialActiveRole, roleDataMap);
  const scopedRoleCodes = getScopedRoleCodesForTab(activeRole, roleCodes as string[]);
  const theme = getRoleTheme(scopedRoleCodes);

  const currentRoleData = roleDataMap[activeRole] || roleDataMap[initialActiveRole] || {
    schedules: [],
    canManage: false,
    canPropose: false,
    userTierLevel: null,
    headerTitle: 'Jadwal Pengajian',
    headerSubtitle: '',
  };

  return (
    <PageContainer variant="standard" className="space-y-3.5 sm:space-y-4 animate-fade-in">
      {/* Top Header: Ringkas tanpa kotak, selaras dengan DashboardHero */}
      <header className="pt-1 pb-0.5 pr-12 sm:pr-0 pl-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
          {currentRoleData.headerTitle}
        </h1>
        {currentRoleData.headerSubtitle && (
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {currentRoleData.headerSubtitle}
          </p>
        )}
      </header>

      {/* Interactive Calendar & Agenda View Component */}
      <ErrorBoundary sectionName="Kalender Pengajian">
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
          theme={theme}
        />
      </ErrorBoundary>
    </PageContainer>
  );
}
