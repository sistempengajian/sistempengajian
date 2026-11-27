import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProtectedAuth } from '@/lib/auth';
import { getGenerationsData } from './queries';
import GenerationManagementView from '@/components/generasi/GenerationManagementView';

export const metadata: Metadata = {
  title: 'Kelola Jenjang Generasi | Sistem Pengajian',
  description: 'Pengaturan jenjang usia baku santri, kurikulum bertahap, dan pengelompokan kelas binaan',
};

export default async function GenerasiPage() {
  const { effectiveUserId } = await requireProtectedAuth();

  const data = await getGenerationsData(effectiveUserId);
  if (!data.userPermissions.canView) {
    redirect('/dashboard');
  }

  return <GenerationManagementView initialData={data} />;
}
