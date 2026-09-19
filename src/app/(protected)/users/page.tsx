import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUsersOverview, getFormReferenceData } from './queries';
import UserManagementView from '@/components/users/UserManagementView';

export const metadata: Metadata = {
  title: 'Kelola Pengguna & Hak Akses | Sistem Pengajian',
  description:
    'Manajemen akun pengguna sistem pengajian: santri binaan, dewan pengajar, wali kelas, pengurus wilayah, dan relasi orang tua.',
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const [initialData, referenceData] = await Promise.all([
    getUsersOverview(authUser.id, resolvedSearchParams),
    getFormReferenceData(authUser.id),
  ]);

  return (
    <UserManagementView
      initialData={initialData}
      referenceData={referenceData}
    />
  );
}
