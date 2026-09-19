import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getParentOptions } from '../queries';
import CreateOrganizationForm from '@/components/organisasi/form/CreateOrganizationForm';

export const metadata: Metadata = {
  title: 'Tambah Tingkatan Wilayah Baru | Sistem Pengajian',
  description: 'Daftarkan wilayah tingkat Daerah, Desa, atau Kelompok binaan baru.',
};

export default async function TambahOrganisasiPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      roles: { select: { role: true } },
    },
  });

  const roleCodes = userProfile?.roles.map((r) => r.role) || [];
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');

  const canEdit = isAdmin || isPjDaerah || isPjDesa;
  if (!canEdit) {
    redirect('/organisasi');
  }

  const { daerahList, desaList } = await getParentOptions(authUser.id);

  return (
    <CreateOrganizationForm
      daerahList={daerahList}
      desaList={desaList}
      canCreateDaerah={isAdmin}
      canCreateDesa={isAdmin || isPjDaerah}
    />
  );
}
