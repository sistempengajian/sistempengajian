import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import MaterialRollingListView from '@/components/jadwal/rolling-materi/MaterialRollingListView';
import { getMaterialRollings } from './actions';

export const metadata = {
  title: 'Rolling Materi Pengajian | Sistem Pengajian Terstruktur',
  description: 'Konfigurasi antrean materi bergulir per pengajian, mingguan, dan bulanan.',
};

export default async function RollingMateriPage() {
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

  // Ambil daftar jenjang usia / generasi & data rolling materi secara paralel
  const [generations, rollingsRes] = await Promise.all([
    prisma.generation.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { minAge: 'asc' },
    }),
    getMaterialRollings(undefined, {
      userId: user.id,
      organizationId: userProfile.organizationId,
      roleCodes: roleCodes as any,
    }),
  ]);

  const rollings = rollingsRes.data || [];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <MaterialRollingListView
        initialRollings={rollings}
        generations={generations}
        canManage={canManage}
      />
    </div>
  );
}
