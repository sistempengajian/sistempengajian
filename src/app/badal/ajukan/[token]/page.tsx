import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock } from 'lucide-react';
import { getSubstituteRequestPageData } from '@/app/badal/actions';
import SubstituteRequestClientView from './SubstituteRequestClientView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return {
    title: 'Pengajuan Guru Badal | Sistem Pengajian',
    description: 'Layanan mandiri pengajuan Ustadz Badal pengganti sesi pengajian langsung dari notifikasi WhatsApp.',
  };
}

export default async function SubstituteRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const pageData = await getSubstituteRequestPageData(token);

  if (!pageData.success || !pageData.schedule || !pageData.requesterTeacher) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Tautan Pengajuan Tidak Berlaku
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {pageData.error ||
              'Tautan pengajuan badal ini tidak valid atau telah kedaluwarsa. Masa aktif tautan adalah 72 jam sejak notifikasi WhatsApp dikirimkan.'}
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
    <SubstituteRequestClientView
      token={token}
      schedule={pageData.schedule as any}
      requesterTeacher={pageData.requesterTeacher}
      availableTeachers={pageData.availableTeachers || []}
      initialRequest={(pageData.currentRequest as any) || null}
    />
  );
}
