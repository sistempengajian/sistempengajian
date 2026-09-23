'use client';

import React from 'react';
import RoleNavTabs, { RoleTabItem, RoleTabId } from '@/components/navigation/RoleNavTabs';

export type ClassRoleType = RoleTabId;
export type ClassRoleTabItem = RoleTabItem;

interface ClassRoleNavProps {
  availableRoles: ClassRoleTabItem[];
  activeRole: ClassRoleType;
  userName?: string;
  variant?: 'grid' | 'bottom-sheet';
  onRoleChange?: (roleId: ClassRoleType) => void;
}

export default function ClassRoleNav({
  availableRoles,
  activeRole,
  userName,
  variant = 'bottom-sheet',
  onRoleChange,
}: ClassRoleNavProps) {
  return (
    <RoleNavTabs
      title="Ganti Peran Ruang Kelas"
      description="Pilih peran untuk melihat dan mengelola ruang kelas sesuai wewenang Anda."
      availableRoles={availableRoles}
      activeRole={activeRole}
      userName={userName}
      variant={variant}
      onRoleChange={onRoleChange}
    />
  );
}
