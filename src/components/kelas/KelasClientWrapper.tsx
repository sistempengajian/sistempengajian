'use client';

import React, { useState, useEffect } from 'react';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';
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
  availableRoles,
  roleDataMap,
  initialStudentTab,
  initialTeacherTab,
  userName,
}: KelasClientWrapperProps) {
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

  // Container width yang selaras dengan masing-masing view role
  const containerMaxWidth =
    activeRole === 'manage'
      ? 'max-w-7xl px-4 sm:px-6 lg:px-8'
      : activeRole === 'teacher'
      ? 'max-w-5xl px-4 sm:px-6'
      : 'max-w-4xl px-4 sm:px-6';

  return (
    <div className="space-y-3 sm:space-y-4 pb-20 sm:pb-8">
      {/* Role Navigation Switcher jika memiliki > 1 peran */}
      {availableRoles.length > 1 && (
        <div className={`${containerMaxWidth} mx-auto pt-4 sm:pt-6`}>
          <RoleNavTabs
            title="Ganti Peran Ruang Kelas"
            description="Pilih peran untuk melihat dan mengelola ruang kelas sesuai wewenang Anda."
            availableRoles={availableRoles}
            activeRole={activeRole}
            userName={userName}
            variant="bottom-sheet"
            onRoleChange={handleRoleChange}
          />
        </div>
      )}

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
