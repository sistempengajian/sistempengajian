import React from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getStudentAbsencePageData } from '@/app/izin/actions';
import StudentAbsenceRequestClientView from './StudentAbsenceRequestClientView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return {
    title: 'Pengajuan Izin Santri | Sistem Pengajian',
    description: 'Layanan mandiri pengajuan izin/sakit santri untuk sesi pengajian langsung dari WhatsApp.',
  };
}

export default async function StudentAbsenceRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const pageData = await getStudentAbsencePageData(token);

  if (!pageData.success || !pageData.schedule || !pageData.student) {
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
              'Tautan pengajuan izin ini tidak valid atau telah kedaluwarsa. Masa aktif tautan adalah 72 jam sejak pesan WhatsApp dikirimkan.'}
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
    <StudentAbsenceRequestClientView
      token={token}
      schedule={pageData.schedule as any}
      student={pageData.student as any}
      submitter={pageData.submitter as any}
      submitterRole={pageData.submitterRole as any}
      initialRequest={(pageData.currentRequest as any) || null}
    />
  );
}
