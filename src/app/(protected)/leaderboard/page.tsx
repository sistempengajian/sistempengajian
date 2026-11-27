import React from 'react';
import { Metadata } from 'next';
import { requireProtectedAuth } from '@/lib/auth';
import { getLeaderboardData } from '@/app/(protected)/gamifikasi/actions';
import LeaderboardClientWrapper from '@/components/leaderboard/LeaderboardClientWrapper';
import PageContainer from '@/components/ui/PageContainer';

export const metadata: Metadata = {
  title: 'Leaderboard & Papan Juara Wilayah | Sistem Pengajian',
  description: 'Papan peringkat santri dan podium bintang generasi berdasarkan tingkatan kelompok, desa, dan daerah.',
};

export default async function LeaderboardPage() {
  await requireProtectedAuth();

  // Fetch initial leaderboard data with default Kelompok tier
  const initialData = await getLeaderboardData({ regionTier: 'KELOMPOK' });

  return (
    <PageContainer variant="medium" className="py-6 sm:py-8">
      <LeaderboardClientWrapper initialData={initialData} />
    </PageContainer>
  );
}
