import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProtectedAuth } from '@/lib/auth';
import { getOrganizationsData } from './queries';
import OrganizationManagementView from '@/components/organisasi/OrganizationManagementView';

export const metadata: Metadata = {
  title: 'Kelola Tingkatan & Wilayah Binaan | Sistem Pengajian',
  description: 'Pengaturan hierarki wilayah pengajian: Daerah, Desa, dan Kelompok binaan.',
};

export default async function OrganisasiPage() {
  const { effectiveUserId } = await requireProtectedAuth();

  const data = await getOrganizationsData(effectiveUserId);
  if (!data.userPermissions.canView) {
    redirect('/dashboard');
  }

  return <OrganizationManagementView initialData={data} />;
}
