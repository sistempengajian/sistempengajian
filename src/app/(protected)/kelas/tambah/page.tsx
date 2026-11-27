import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProtectedAuth } from '@/lib/auth';
import { getClassFormReferenceData } from '../queries';
import CreateClassForm from '@/components/kelas/form/CreateClassForm';

export const metadata: Metadata = {
  title: 'Tambah Kelas Pengajian | Sistem Pengajian',
  description: 'Daftarkan ruang kelas pengajian baru dengan jenjang usia, wilayah binaan, dan wali kelas.',
};

export default async function TambahKelasPage() {
  const { dbUser } = await requireProtectedAuth();

  const currentUser = {
    id: dbUser.id,
    organizationId: dbUser.organizationId,
    roles: dbUser.roles,
  };

  const roleCodes = currentUser.roles.map((r) => r.role);
  const isManager =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  if (!isManager) {
    redirect('/kelas');
  }

  const referenceData = await getClassFormReferenceData(currentUser);

  return (
    <CreateClassForm
      referenceData={referenceData}
      managerRoles={roleCodes}
    />
  );
}
