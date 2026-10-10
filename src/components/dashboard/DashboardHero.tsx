import React from 'react';

interface DashboardHeroProps {
  fullName: string;
  generationName?: string | null;
  kelompokName?: string | null;
  theme: {
    roleTitle: string;
    badgeClass: string;
    [key: string]: any;
  };
  isSantri: boolean;
  isPengajar: boolean;
  isWaliKelas: boolean;
  isOrangTua: boolean;
}

export default function DashboardHero({
  fullName,
  generationName,
  kelompokName,
  theme,
  isSantri,
  isPengajar,
  isWaliKelas,
  isOrangTua,
}: DashboardHeroProps) {
  return (
    <section className="rounded-2xl bg-white/1 backdrop-blur-xl border border-slate-200/10 p-5 sm:p-6 transition-all space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Assalamu&apos;alaikum, {fullName}
          </h1>

          {/* Badge Generasi User & Nama Wilayah (Kelompoknya Saja) */}
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {generationName ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                {generationName}
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.badgeClass}`}
              >
                {theme.roleTitle}
              </span>
            )}

            {kelompokName && (
              <span
                className={`bg-white/60 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.badgeClass}`}
              >
                {kelompokName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Kalimat Support Singkat */}
      <p className="text-xs sm:text-[13px] text-slate-600 font-normal leading-relaxed pt-2 border-t border-slate-200/50">
        {isSantri
          ? "Semoga senantiasa bersemangat dalam mempelajari Al-Qur'an dan menggapai generasi unggul berkarakter."
          : isPengajar || isWaliKelas
            ? "Selamat berkhidmah membina generasi Penerus dengan keikhlasan dan kesabaran."
            : isOrangTua
              ? "Mendampingi ananda tumbuh menjadi generasi unggul yang faham, faqih, dan berakhlak mulia."
              : "Mengemban amanah tata kelola pembinaan pengajian dengan rapi dan terstruktur."}
      </p>
    </section>
  );
}
