import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import RollingPengajianListView from '@/components/jadwal/rolling-pengajian/RollingPengajianListView';
import { getRollingPengajianList, getRollingReferenceData } from './actions';

export const metadata = {
  title: 'Pengajian Rolling | Sistem Pengajian Terstruktur',
  description: 'Blueprint terpadu kegiatan pengajian bergulir memadukan silabus materi dan dewan pengajar.',
};

export default async function RollingPengajianPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const userProfile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: true,
      organization: true,
    },
  });

  if (!userProfile) {
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
    userId: user.id,
    organizationId: userProfile.organizationId,
    roleCodes: roleCodes as any,
  };

  // Ambil data referensi & list pengajian rolling secara paralel tanpa duplicate auth
  const [listRes, refRes] = await Promise.all([
    getRollingPengajianList(userCtx),
    getRollingReferenceData(userCtx),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <RollingPengajianListView
        initialList={listRes.data || []}
        referenceData={refRes.data}
        canManage={canManage}
      />
    </div>
  );
}
