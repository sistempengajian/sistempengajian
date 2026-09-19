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

export default async function OrganisasiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const data = await getOrganizationsData(user.id);
  if (!data.userPermissions.canView) {
    redirect('/dashboard');
  }

  return <OrganizationManagementView initialData={data} />;
}
