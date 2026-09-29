import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import RollingJadwalBatchList from '@/components/jadwal/rolling-jadwal/RollingJadwalBatchList';
import { getRollingJadwalBatches } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Riwayat Jadwal Rolling | Sistem Pengajian',
  description: 'Kelola riwayat batch jadwal rolling yang telah dibuat dari blueprint Pengajian Rolling.',
};

import { getEffectiveAuthUser } from '@/lib/auth';

export default async function RollingJadwalPage() {
  const { authUser: user, dbUser: userProfile, effectiveUserId } = await getEffectiveAuthUser();

  if (!user || !userProfile || !userProfile.organizationId || !effectiveUserId) {
    redirect('/login');
  }

  const roleCodes = userProfile.roles.map((r) => r.role);
  const canManage =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK');

  if (!canManage) {
    redirect('/jadwal');
  }

  const userCtx = {
    userId: effectiveUserId,
    organizationId: userProfile.organizationId,
    roleCodes: roleCodes as any,
  };

  const result = await getRollingJadwalBatches(userCtx);
  const batches = result.success && result.data ? result.data : [];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <RollingJadwalBatchList
        initialBatches={batches}
        canManage={canManage}
        roleCodes={roleCodes}
      />
    </div>
  );
}
