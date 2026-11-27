import React from 'react';
import PageContainer from '@/components/ui/PageContainer';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import StudentQrScanner from '@/components/presensi/StudentQrScanner';
import type { RoleTabItem } from '@/components/navigation/RoleNavTabs';
import {
  PresensiUserProfile,
  loadStudentScannerData,
  resolveSantriTab,
} from '../lib/presensi-queries';

interface StudentScannerServerProps {
  userProfile: PresensiUserProfile;
  requestedScheduleId?: string;
  tabParam?: string;
  availablePresensiRoles: RoleTabItem[];
}

export default async function StudentScannerServer({
  userProfile,
  requestedScheduleId,
  tabParam,
  availablePresensiRoles: _availablePresensiRoles,
}: StudentScannerServerProps) {
  const { activeSchedule, isAlreadyPresent, checkInTime } =
    await loadStudentScannerData({
      userProfile,
      requestedScheduleId,
    });

  return (
    <PageContainer variant="standard" className="space-y-4">
      <ErrorBoundary sectionName="Scanner Presensi Santri">
        <StudentQrScanner
          studentId={userProfile.id}
          studentName={userProfile.fullName}
          generationName={userProfile.generation?.name || 'Santri'}
          organizationName={
            userProfile.organization?.name || 'Kelompok Pengajian'
          }
          activeSchedule={activeSchedule}
          isAlreadyPresent={isAlreadyPresent}
          checkInTime={checkInTime}
          initialTab={resolveSantriTab(tabParam)}
        />
      </ErrorBoundary>
    </PageContainer>
  );
}
