import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireProtectedAuth } from '@/lib/auth';
import { getClassDetail, getClassFormReferenceData } from '../../queries';
import EditClassForm from '@/components/kelas/form/EditClassForm';

export const metadata: Metadata = {
  title: 'Ubah Kelas Pengajian | Sistem Pengajian',
  description: 'Perbarui informasi ruang kelas pengajian, jenjang, atau wali kelas pengampu.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditKelasPage({ params }: PageProps) {
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

  const { id } = await params;

  try {
    const [{ classData }, referenceData] = await Promise.all([
      getClassDetail(currentUser, id),
      getClassFormReferenceData(currentUser),
    ]);

    return (
      <EditClassForm
        classData={classData}
        referenceData={referenceData}
        managerRoles={roleCodes}
      />
    );
  } catch (error) {
    console.error('Failed to load class for editing:', error);
    notFound();
  }
}
