import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getClassFormReferenceData } from '../queries';
import CreateClassForm from '@/components/kelas/form/CreateClassForm';

export const metadata: Metadata = {
  title: 'Tambah Kelas Pengajian | Sistem Pengajian',
  description: 'Daftarkan ruang kelas pengajian baru dengan jenjang usia, wilayah binaan, dan wali kelas.',
};

export default async function TambahKelasPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      organizationId: true,
      roles: {
        select: { role: true },
      },
    },
  });

  if (!currentUser) {
    redirect('/login');
  }

  const roleCodes = currentUser.roles.map((r) => r.role);
  const isManager =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  if (!isManager) {
    redirect('/kelas');
  }

  const referenceData = await getClassFormReferenceData(currentUser);

  return (
    <CreateClassForm
      referenceData={referenceData}
      managerRoles={roleCodes}
    />
  );
}
