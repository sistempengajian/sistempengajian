'use client';

import React from 'react';
import { type RoleTabItem, type RoleTabId } from '@/components/navigation/RoleNavTabs';
import { useSyncedPageRole } from '@/components/navigation/ActiveRoleContext';
import StudentClassView from '@/components/kelas/student/StudentClassView';
import HomeroomClassView from '@/components/kelas/teacher/HomeroomClassView';
import ParentClassView from '@/components/kelas/parent/ParentClassView';
import ClassManagementView from '@/components/kelas/ClassManagementView';
import {
  ClassesOverviewData,
  StudentClassData,
  HomeroomTeacherClassData,
  ParentClassData,
} from '@/components/kelas/types';

interface KelasClientWrapperProps {
  initialActiveRole: RoleTabId;
  availableRoles: RoleTabItem[];
  roleDataMap: {
    manage?: ClassesOverviewData;
    teacher?: HomeroomTeacherClassData;
    parent?: ParentClassData;
    student?: StudentClassData;
  };
  initialStudentTab?: 'jadwal' | 'tugas' | 'teman';
  initialTeacherTab?: 'santri' | 'jadwal' | 'tugas';
  userName?: string;
}

export default function KelasClientWrapper({
  initialActiveRole,
  availableRoles: _availableRoles,
  roleDataMap,
  initialStudentTab,
  initialTeacherTab,
  userName: _userName,
}: KelasClientWrapperProps) {
  const activeRole = useSyncedPageRole(initialActiveRole, roleDataMap);

  return (
    <div className="space-y-3 sm:space-y-4 pb-20 sm:pb-8">
      {/* Tampilan Konten Sesuai Role yang Dipilih (Instant 0ms in-memory render) */}
      <div key={activeRole} className="animate-fade-in">
        {activeRole === 'student' && roleDataMap.student && (
          <StudentClassView
            data={roleDataMap.student}
            initialTab={initialStudentTab}
          />
        )}
        {activeRole === 'parent' && roleDataMap.parent && (
          <ParentClassView data={roleDataMap.parent} />
        )}
        {activeRole === 'teacher' && roleDataMap.teacher && (
          <HomeroomClassView
            data={roleDataMap.teacher}
            initialTab={initialTeacherTab}
          />
        )}
        {activeRole === 'manage' && roleDataMap.manage && (
          <ClassManagementView initialData={roleDataMap.manage} />
        )}
      </div>
    </div>
  );
}
