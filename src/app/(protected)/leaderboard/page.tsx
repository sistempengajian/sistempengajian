import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/app/(protected)/gamifikasi/actions';
import LeaderboardClientWrapper from '@/components/leaderboard/LeaderboardClientWrapper';

export const metadata: Metadata = {
  title: 'Leaderboard & Papan Juara Wilayah | Sistem Pengajian',
  description: 'Papan peringkat santri dan podium bintang generasi berdasarkan tingkatan kelompok, desa, dan daerah.',
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // Fetch initial leaderboard data with default Kelompok tier
  const initialData = await getLeaderboardData({ regionTier: 'KELOMPOK' });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <LeaderboardClientWrapper initialData={initialData} />
    </div>
  );
}
