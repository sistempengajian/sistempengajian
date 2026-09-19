import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import CreateGenerationForm from '@/components/generasi/form/CreateGenerationForm';

export const metadata: Metadata = {
  title: 'Tambah Jenjang Generasi Baru | Sistem Pengajian',
  description: 'Daftarkan jenjang kelompok usia santri baku atau kustom dengan fokus kurikulum bertahap',
};

export default async function TambahGenerasiPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // Verifikasi wewenang Pengelola
  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      roles: {
        select: { role: true },
      },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

  if (!canEdit) {
    redirect('/generasi');
  }

  return <CreateGenerationForm />;
}
