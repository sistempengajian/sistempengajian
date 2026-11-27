import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ParentAttendanceMonitor from '@/components/presensi/ParentAttendanceMonitor';
import type { RoleTabItem } from '@/components/navigation/RoleNavTabs';
import {
  PresensiUserProfile,
  loadParentMonitorData,
} from '../lib/presensi-queries';

interface ParentMonitorServerProps {
  userProfile: PresensiUserProfile;
  availablePresensiRoles: RoleTabItem[];
  preselectedScheduleId?: string;
  preselectedStudentId?: string;
  tabParam?: string;
}

export default async function ParentMonitorServer({
  userProfile,
  availablePresensiRoles: _availablePresensiRoles,
  preselectedScheduleId,
  preselectedStudentId,
  tabParam,
}: ParentMonitorServerProps) {
  const { childrenData, absenceHistory } =
    await loadParentMonitorData(userProfile);

  const initialActiveTab = tabParam === 'leave' ? 'leave' : 'monitor';

  return (
    <PageContainer variant="standard" className="space-y-5">
      <ErrorBoundary sectionName="Monitor Kehadiran Ananda">
        <ParentAttendanceMonitor
          childrenData={childrenData}
          initialAbsenceHistory={absenceHistory}
          preselectedScheduleId={preselectedScheduleId}
          preselectedStudentId={preselectedStudentId}
          initialTab={initialActiveTab}
        />
      </ErrorBoundary>
    </PageContainer>
  );
}
