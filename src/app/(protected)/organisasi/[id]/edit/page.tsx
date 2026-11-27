import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireProtectedAuth } from '@/lib/auth';
import { getOrganizationById } from '../../queries';
import EditOrganizationForm from '@/components/organisasi/form/EditOrganizationForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const org = await prisma.organization.findUnique({
      where: { id },
      select: { name: true, type: true },
    });
    return {
      title: org
        ? `Edit Wilayah: ${org.name} (${org.type}) | Sistem Pengajian`
        : 'Edit Tingkatan Wilayah',
    };
  } catch {
    return {
      title: 'Edit Tingkatan Wilayah | Sistem Pengajian',
    };
  }
}

export default async function EditOrganisasiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { effectiveUserId } = await requireProtectedAuth();

  const { canEdit, organization, parentOptions } = await getOrganizationById(
    id,
    effectiveUserId
  );

  if (!canEdit) {
    redirect('/organisasi');
  }

  if (!organization) {
    notFound();
  }

  return (
    <EditOrganizationForm
      organization={organization}
      parentOptions={parentOptions}
    />
  );
}
