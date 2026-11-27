import React from 'react';
import Link from 'next/link';
import { QrCode, ChevronRight } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';
import { TOUCH_TARGET } from '@/lib/design-tokens';

export default function TeacherClassEvaluationSection() {
  return (
    <section id="presensi" className={COMMON_THEME.cardClassPadded}>
      <h2 className={`${COMMON_THEME.sectionTitleClass} mb-3`}>
        Tugas &amp; Presensi Mengajar
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/90 hover:bg-slate-100/80 flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-900">
              Presensi Sesi Pengajian
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Tampilkan Dynamic QR TOTP di kelas
            </div>
          </div>
          <Link
            href="/presensi?role=teacher"
            prefetch={true}
            className={`${TOUCH_TARGET.minButton} px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Buka QR</span>
          </Link>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/90 hover:bg-slate-100/80 flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-900">
              Delegasi Badal Guru
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              Tunjuk ustadz pengganti sementara
            </div>
          </div>
          <Link
            href="/jadwal?role=teacher"
            prefetch={true}
            className={`${TOUCH_TARGET.minButton} px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1 shadow-2xs`}
          >
            <span>Ajukan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
