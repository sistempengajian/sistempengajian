import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getEffectiveAuthUser } from '@/lib/auth';
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

  const { authUser, effectiveUserId, dbUser } = await getEffectiveAuthUser();

  if (!authUser || !effectiveUserId || !dbUser) {
    redirect('/login');
  }

  const [initialData, referenceData] = await Promise.all([
    getUsersOverview(effectiveUserId, resolvedSearchParams),
    getFormReferenceData(effectiveUserId),
  ]);

  return (
    <UserManagementView
      initialData={initialData}
      referenceData={referenceData}
    />
  );
}
