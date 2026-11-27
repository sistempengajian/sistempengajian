import React from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requireProtectedAuth } from '@/lib/auth';
import { getGenerationById } from '../../queries';
import EditGenerationForm from '@/components/generasi/form/EditGenerationForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const gen = await prisma.generation.findUnique({
      where: { id },
      select: { name: true, code: true },
    });
    return {
      title: gen ? `Edit Jenjang: ${gen.name} (${gen.code}) | Sistem Pengajian` : 'Edit Jenjang Generasi',
    };
  } catch {
    return {
      title: 'Edit Jenjang Generasi | Sistem Pengajian',
    };
  }
}

export default async function EditGenerasiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { effectiveUserId } = await requireProtectedAuth();

  const { canEdit, generation } = await getGenerationById(id, effectiveUserId);

  if (!canEdit) {
    redirect('/generasi');
  }

  if (!generation) {
    notFound();
  }

  return <EditGenerationForm generation={generation} />;
}
