import React from 'react';
import { Metadata } from 'next';
import { requireProtectedAuth } from '@/lib/auth';
import { getStudentGamificationData } from './actions';
import GamifikasiClientWrapper from '@/components/gamifikasi/GamifikasiClientWrapper';
import PageContainer from '@/components/ui/PageContainer';

export const metadata: Metadata = {
  title: 'Misi & Lemari Trofi Santri | Sistem Pengajian',
  description: 'Capaian amal sholih, misi harian & pekanan, serta lemari trofi lencana kehormatan santri.',
};

export default async function GamifikasiPage() {
  await requireProtectedAuth();

  // Fetch student personal gamification data
  const initialData = await getStudentGamificationData();

  return (
    <PageContainer variant="medium" className="py-6 sm:py-8">
      <GamifikasiClientWrapper initialData={initialData} />
    </PageContainer>
  );
}
