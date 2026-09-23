import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getAnalyticsFilterOptions, getAnalyticsDashboardData } from './actions';
import { AnalyticsPeriod, AnalyticsScopeType } from './types';
import AnalisisClientWrapper from '@/components/analisis/AnalisisClientWrapper';
import { UserX, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Analitika & Presentasi Eksekutif | Sistem Pengajian',
  description:
    'Analisis multi-skop data santri, agregasi kehadiran, ketuntasan kurikulum, evaluasi karakter, serta mode presentasi layar penuh untuk rapat pengurus.',
};

export default async function AnalisisPage({
  searchParams,
}: {
  searchParams: Promise<{
    scopeType?: string;
    scopeId?: string;
    period?: string;
  }>;
}) {
  const resolvedParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  // 1. Verifikasi RBAC pengguna
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      roles: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  const roleCodes = user.roles.map((r) => r.role);
  const canAccess =
    roleCodes.includes('ADMIN_MASTER') ||
    roleCodes.includes('PJ_DAERAH') ||
    roleCodes.includes('PJ_DESA') ||
    roleCodes.includes('PJ_KELOMPOK') ||
    roleCodes.includes('WALI_KELAS') ||
    roleCodes.includes('PENGAJAR');

  if (!canAccess) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto shadow-2xs">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Akses Dibatasi</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Halaman Analitika &amp; Presentasi Eksekutif hanya dapat diakses oleh Pengajar, Wali Kelas, dan Pengurus Wilayah (PJ Kelompok / Desa / Daerah).
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition-colors shadow-2xs"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // 2. Ambil opsi filter yang diizinkan untuk pengguna ini
  const filterOptions = await getAnalyticsFilterOptions(authUser.id);

  // Jika tidak ada kelas atau santri yang terhubung
  if (
    filterOptions.classes.length === 0 &&
    filterOptions.kelompoks.length === 0 &&
    filterOptions.desas.length === 0 &&
    filterOptions.daerahs.length === 0 &&
    filterOptions.availableStudents.length === 0
  ) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 mx-auto shadow-2xs">
            <UserX className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Belum Ada Data Terhubung</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Akun Anda belum memiliki kelas binaan atau organisasi wilayah yang ditugaskan. Hubungi administrator untuk penugasan kelas atau wilayah.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition-colors shadow-2xs"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // 3. Tentukan skop & periode awal
  const validPeriods: AnalyticsPeriod[] = ['THIS_MONTH', 'LAST_MONTH', 'THIS_SEMESTER', 'ALL'];
  const targetPeriod: AnalyticsPeriod = validPeriods.includes(resolvedParams.period as AnalyticsPeriod)
    ? (resolvedParams.period as AnalyticsPeriod)
    : 'THIS_MONTH';

  let targetScopeType: AnalyticsScopeType = filterOptions.defaultScope.type;
  let targetScopeId: string | undefined = filterOptions.defaultScope.id;

  if (resolvedParams.scopeType && filterOptions.allowedScopeTypes.includes(resolvedParams.scopeType as AnalyticsScopeType)) {
    targetScopeType = resolvedParams.scopeType as AnalyticsScopeType;
    if (resolvedParams.scopeId) {
      targetScopeId = resolvedParams.scopeId;
    }
  }

  // 4. Ambil data analitika awal
  const initialData = await getAnalyticsDashboardData(authUser.id, {
    scopeType: targetScopeType,
    scopeId: targetScopeId,
    period: targetPeriod,
  });

  return (
    <AnalisisClientWrapper
      userId={authUser.id}
      filterOptions={filterOptions}
      initialData={initialData}
    />
  );
}
