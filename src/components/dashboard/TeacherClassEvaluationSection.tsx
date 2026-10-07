import React from 'react';
import Link from 'next/link';
import { QrCode, ChevronRight } from 'lucide-react';
import { COMMON_THEME } from '@/lib/theme';

export default function TeacherClassEvaluationSection() {
  return (
    <section id="presensi" className={COMMON_THEME.cardClassPadded}>
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={COMMON_THEME.sectionTitleClass}>
              Tugas &amp; Presensi Kelas Mengajar
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Kelola dynamic QR presensi santri dan penugasan badal halaqah
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white/40 hover:bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3 shadow-2xs transition-all">
          <div>
            <div className="font-bold text-xs text-slate-900">
              Presensi Sesi Pengajian
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Tampilkan Dynamic QR TOTP di layar kelas
            </div>
          </div>
          <Link
            href="/presensi"
            prefetch={true}
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Buka QR</span>
          </Link>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-200/60 bg-white/40 hover:bg-white/60 backdrop-blur-sm flex items-center justify-between gap-3 shadow-2xs transition-all">
          <div>
            <div className="font-bold text-xs text-slate-900">
              Delegasi Badal Guru
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Tunjuk ustadz pengganti saat berhalangan
            </div>
          </div>
          <Link
            href="/jadwal"
            prefetch={true}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
          >
            <span>Ajukan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
