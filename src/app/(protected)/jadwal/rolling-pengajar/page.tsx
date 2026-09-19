import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import TeacherRollingListView from '@/components/jadwal/rolling-pengajar/TeacherRollingListView';
import { getTeacherRollings } from './actions';

export const metadata = {
  title: 'Rolling Pengajar Pengajian | Sistem Pengajian Terstruktur',
  description: 'Konfigurasi antrean dewan pengajar/ustadz bergulir per pengajian, mingguan, dan bulanan.',
};

export default async function RollingPengajarPage() {
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

  // Ambil data rolling pengajar
  const { data: rollings = [] } = await getTeacherRollings({
    userId: user.id,
    organizationId: userProfile.organizationId,
    roleCodes: roleCodes as any,
  });

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      <TeacherRollingListView
        initialRollings={rollings}
        canManage={canManage}
      />
    </div>
  );
}
