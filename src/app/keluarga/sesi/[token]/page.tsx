import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getFamilyActionHubData } from '@/app/keluarga/actions';
import FamilyActionHubClientView from './FamilyActionHubClientView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return {
    title: 'Portal Aksi Pengajian Keluarga | Sistem Pengajian',
    description: 'Portal mandiri keluarga untuk konfirmasi kehadiran santri dan pengajuan izin terpadu langsung dari WhatsApp.',
  };
}

export default async function FamilyActionHubPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const data = await getFamilyActionHubData(token);

  if (!data.success || !data.parent || !data.schedule || !data.childrenData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Tautan Portal Tidak Berlaku
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {data.error ||
              'Tautan portal pengajian keluarga ini tidak sah atau masa berlakunya telah berakhir (berlaku 72 jam sejak pesan WhatsApp dikirimkan).'}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Masuk ke Aplikasi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FamilyActionHubClientView
      token={token}
      parent={data.parent as any}
      schedule={data.schedule as any}
      initialChildrenData={data.childrenData as any}
    />
  );
}
