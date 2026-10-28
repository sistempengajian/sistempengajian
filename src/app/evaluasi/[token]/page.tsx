import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, BookOpen } from 'lucide-react';
import { getMonthlyEvaluationData } from './actions';
import EvaluationSheetClient from './EvaluationSheetClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const data = await getMonthlyEvaluationData(token);

  if (!data.success || !data.studentsData || data.studentsData.length === 0) {
    return {
      title: 'Lembar Evaluasi Santri | Sistem Pengajian SiPanji',
      description: 'Laporan capaian belajar, presensi, dan evaluasi karakter santri bulanan.',
    };
  }

  const firstStudent = data.studentsData[0];
  const countLabel = data.studentsData.length > 1 ? ` & ${data.studentsData.length - 1} Santri Lainnya` : '';

  return {
    title: `Lembar Evaluasi ${firstStudent.student.fullName}${countLabel} - ${firstStudent.period.monthName} | SiPanji`,
    description: `Lembar Evaluasi Resmi Hasil Belajar dan Presensi Pengajian ananda ${firstStudent.student.fullName} periode ${firstStudent.period.monthName}.`,
  };
}

export default async function EvaluasiTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  const data = await getMonthlyEvaluationData(token);

  if (!data.success || !data.studentsData || data.studentsData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/70 shadow-2xs">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base sm:text-lg font-black text-slate-900">
              Tautan Lembar Evaluasi Tidak Berlaku
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {data.error ||
                'Tautan evaluasi bulanan ini tidak valid atau masa berlakunya telah berakhir (berlaku 45 hari sejak diterbitkan).'}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95 shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-300" />
              <span>Buka Aplikasi SiPanji</span>
            </Link>
            <p className="text-[11px] text-slate-400">
              Silakan hubungi Ustadz / Pengurus Wilayah untuk mendapatkan tautan terbaru.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <EvaluationSheetClient studentsData={data.studentsData} />;
}
