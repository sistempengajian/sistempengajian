'use client';

import React, { useState, useEffect } from 'react';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
import KurikulumInfiniteList from '@/components/kurikulum/KurikulumInfiniteList';
import { MaterialData } from '@/components/kurikulum/MaterialCard';
import { BookOpen } from 'lucide-react';

export interface KurikulumRoleConfigData {
  userRoleCategory: 'SANTRI' | 'ORANG_TUA' | 'TEACHER' | 'PJ';
  canManage: boolean;
  activeStudentId: string | null;
  activeClassId: string | null;
  availableStudents: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    generationCode?: string | null;
    generationName?: string;
  }[];
  currentGenCode: string;
  headerTitle: string;
  headerSubtitle: string;
  initialPaginatedData: {
    items: any[];
    total: number;
    hasMore: boolean;
  };
}

interface KurikulumClientWrapperProps {
  initialActiveRole: RoleTabId;
  availableRoles: RoleTabItem[];
  roleDataMap: Record<string, KurikulumRoleConfigData>;
  generations: {
    id: string;
    code: string;
    name: string;
    minAge: number;
    maxAge: number;
    description: string | null;
  }[];
  userTierLevel: 'DAERAH' | 'DESA' | 'KELOMPOK' | null;
  userOrganizationId: string | null;
  userOrganizationName: string;
  parentOrganizationName: string;
  homeroomClasses: any[];
  subOrganizations: any[];
  activeFilterOrgId: string | null;
  userName?: string;
}

export default function KurikulumClientWrapper({
  initialActiveRole,
  availableRoles,
  roleDataMap,
  generations,
  userTierLevel,
  userOrganizationId,
  userOrganizationName,
  parentOrganizationName,
  homeroomClasses,
  subOrganizations,
  activeFilterOrgId,
  userName,
}: KurikulumClientWrapperProps) {
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

  const currentRoleData = roleDataMap[activeRole] || roleDataMap[initialActiveRole];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 animate-fade-in pb-20 sm:pb-8">
      {/* Top Multi-Role Switcher jika user memiliki > 1 peran */}
      {availableRoles.length > 1 && (
        <RoleNavTabs
          title="Ganti Peran Tampilan Kurikulum"
          description="Pilih sudut pandang kurikulum & rapor sesuai peran yang ingin Anda gunakan."
          availableRoles={availableRoles}
          activeRole={activeRole}
          userName={userName}
          variant="bottom-sheet"
          onRoleChange={handleRoleChange}
        />
      )}

      {/* Header Banner */}
      {currentRoleData && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-slate-200/70 shadow-2xs transition-all duration-300">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60 shadow-2xs shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span>{currentRoleData.headerTitle}</span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-1">
              {currentRoleData.headerSubtitle}
            </p>
          </div>
        </div>
      )}

      {/* Kurikulum Client Container: Tabs, Focus Banner, Caching & Infinite Scroll List */}
      {currentRoleData && (
        <KurikulumInfiniteList
          key={activeRole}
          initialMaterials={currentRoleData.initialPaginatedData.items as MaterialData[]}
          initialTotal={currentRoleData.initialPaginatedData.total}
          initialHasMore={currentRoleData.initialPaginatedData.hasMore}
          currentGenCode={currentRoleData.currentGenCode}
          generations={generations}
          canManage={currentRoleData.canManage}
          userTierLevel={userTierLevel}
          userOrganizationId={userOrganizationId}
          userOrganizationName={userOrganizationName}
          parentOrganizationName={parentOrganizationName}
          activeStudentId={currentRoleData.activeStudentId}
          availableStudents={currentRoleData.availableStudents}
          userRoleCategory={currentRoleData.userRoleCategory}
          homeroomClasses={homeroomClasses}
          activeClassId={currentRoleData.activeClassId}
          subOrganizations={subOrganizations}
          activeFilterOrgId={activeFilterOrgId}
        />
      )}
    </div>
  );
}
