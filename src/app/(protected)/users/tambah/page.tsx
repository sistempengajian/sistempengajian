import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getEffectiveAuthUser } from '@/lib/auth';
import { UserRole } from '@prisma/client';
import { getFormReferenceData } from '../queries';
import { getManageableRoles } from '@/lib/scoped-access';
import CreateUserForm from '@/components/users/form/CreateUserForm';

export const metadata: Metadata = {
  title: 'Tambah Pengguna Baru | Sistem Pengajian',
  description: 'Daftarkan akun santri, orang tua, pengajar, atau pengurus wilayah baru.',
};

export default async function TambahUserPage() {
  const { authUser, effectiveUserId, dbUser } = await getEffectiveAuthUser();

  if (!authUser || !effectiveUserId || !dbUser) {
    redirect('/login');
  }

  const roleCodes = dbUser.roles.map((r) => r.role) || [];
  const isAdmin = roleCodes.includes('ADMIN_MASTER');
  const isPjDaerah = roleCodes.includes('PJ_DAERAH');
  const isPjDesa = roleCodes.includes('PJ_DESA');
  const isPjKelompok = roleCodes.includes('PJ_KELOMPOK');

  const canManage = isAdmin || isPjDaerah || isPjDesa || isPjKelompok;
  if (!canManage) {
    redirect('/users');
  }

  const allowedRoles = getManageableRoles(roleCodes);

  let userScopeRole: UserRole = 'SANTRI';
  if (isAdmin) userScopeRole = 'ADMIN_MASTER';
  else if (isPjDaerah) userScopeRole = 'PJ_DAERAH';
  else if (isPjDesa) userScopeRole = 'PJ_DESA';
  else if (isPjKelompok) userScopeRole = 'PJ_KELOMPOK';

  const referenceData = await getFormReferenceData(effectiveUserId);

  return (
    <CreateUserForm
      referenceData={referenceData}
      allowedRoles={allowedRoles}
      userScopeRole={userScopeRole}
      managerRoles={roleCodes}
    />
  );
}
