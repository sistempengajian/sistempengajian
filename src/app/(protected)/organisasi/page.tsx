import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOrganizationsData } from './queries';
import OrganizationManagementView from '@/components/organisasi/OrganizationManagementView';

export const metadata: Metadata = {
  title: 'Kelola Tingkatan & Wilayah Binaan | Sistem Pengajian',
  description: 'Pengaturan hierarki wilayah pengajian: Daerah, Desa, dan Kelompok binaan.',
};

import { getEffectiveAuthUser } from '@/lib/auth';

export default async function OrganisasiPage() {
  const { authUser: user, effectiveUserId } = await getEffectiveAuthUser();

  if (!user || !effectiveUserId) {
    redirect('/login');
  }

  const data = await getOrganizationsData(effectiveUserId);
  if (!data.userPermissions.canView) {
    redirect('/dashboard');
  }

  return <OrganizationManagementView initialData={data} />;
}
