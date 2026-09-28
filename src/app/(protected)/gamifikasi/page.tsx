import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getGamificationDashboardData } from './actions';
import GamifikasiClientWrapper from '@/components/gamifikasi/GamifikasiClientWrapper';

export const metadata: Metadata = {
  title: 'Gamifikasi & Papan Juara Santri | Sistem Pengajian',
  description: 'Papan peringkat, podium bintang generasi, misi amal sholih, dan lemari trofi lencana kehormatan santri.',
};

export default async function GamifikasiPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // Fetch initial gamification data
  const initialData = await getGamificationDashboardData();

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <GamifikasiClientWrapper initialData={initialData} />
    </div>
  );
}
