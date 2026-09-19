import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getUserById, getFormReferenceData } from '../../queries';
import { getManageableRoles } from '@/lib/scoped-access';
import EditUserForm from '@/components/users/form/EditUserForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { fullName: true },
    });
    return {
      title: user
        ? `Edit Pengguna: ${user.fullName} | Sistem Pengajian`
        : 'Edit Pengguna | Sistem Pengajian',
    };
  } catch {
    return {
      title: 'Edit Pengguna | Sistem Pengajian',
    };
  }
}

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');

  const canManage = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;
  if (!canManage) {
    redirect('/users');
  }

  const allowedRoles = getManageableRoles(roleCodes);

  const [targetUser, referenceData] = await Promise.all([
    getUserById(id, authUser.id),
    getFormReferenceData(authUser.id),
  ]);

  // Jika target user tidak ditemukan atau akses ditolak oleh Scoped RBAC
  if (!targetUser) {
    redirect('/users');
  }

  return (
    <EditUserForm
      user={targetUser}
      referenceData={referenceData}
      allowedRoles={allowedRoles}
      managerRoles={roleCodes}
    />
  );
}
