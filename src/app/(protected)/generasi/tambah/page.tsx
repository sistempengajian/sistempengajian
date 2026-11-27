import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireProtectedAuth } from '@/lib/auth';
import CreateGenerationForm from '@/components/generasi/form/CreateGenerationForm';

export const metadata: Metadata = {
  title: 'Tambah Jenjang Generasi Baru | Sistem Pengajian',
  description: 'Daftarkan jenjang kelompok usia santri baku atau kustom dengan fokus kurikulum bertahap',
};

export default async function TambahGenerasiPage() {
  const { dbUser } = await requireProtectedAuth();

  // Verifikasi wewenang Pengelola
  const roleCodes = dbUser.roles.map((r) => r.role);
  const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

  if (!canEdit) {
    redirect('/generasi');
  }

  return <CreateGenerationForm />;
}
