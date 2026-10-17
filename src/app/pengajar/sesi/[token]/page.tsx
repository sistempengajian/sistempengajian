import React from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { getTeacherLessonPlanData } from '@/app/pengajar/actions';
import TeacherLessonPlanClientView from './TeacherLessonPlanClientView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return {
    title: 'Portal Persiapan Ajar & Rencana Materi | Sistem Pengajian',
    description: 'Portal mandiri Dewan Pengajar untuk menentukan capaian ajar sesi pengajian, memonitor progres ketuntasan santri, dan menyematkan catatan pesan.',
  };
}

export default async function TeacherLessonPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const data = await getTeacherLessonPlanData(token);

  if (!data.success || !data.schedule || !data.teacher || !data.tabs) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Tautan Rencana Ajar Tidak Sah atau Kedaluwarsa
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {data.error ||
              'Tautan persiapan mengajar ini telah kedaluwarsa atau tidak valid (tautan berlaku selama 72 jam sejak pesan WhatsApp diterima).'}
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
    <TeacherLessonPlanClientView
      token={token}
      schedule={data.schedule}
      teacher={data.teacher}
      initialTabs={data.tabs}
    />
  );
}
