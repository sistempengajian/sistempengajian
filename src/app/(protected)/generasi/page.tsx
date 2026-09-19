import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGenerationsData } from './queries';
import GenerationManagementView from '@/components/generasi/GenerationManagementView';

export const metadata: Metadata = {
  title: 'Kelola Jenjang Generasi | Sistem Pengajian',
  description: 'Pengaturan jenjang usia baku santri, kurikulum bertahap, dan pengelompokan kelas binaan',
};

export default async function GenerasiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const data = await getGenerationsData(user.id);
  if (!data.userPermissions.canView) {
    redirect('/dashboard');
  }

  return <GenerationManagementView initialData={data} />;
}
