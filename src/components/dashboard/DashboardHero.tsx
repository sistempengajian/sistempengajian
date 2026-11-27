import React from 'react';

interface DashboardHeroProps {
  fullName: string;
  generationName?: string | null;
  kelompokName?: string | null;
  theme: {
    roleKey?: 'SANTRI' | 'PENGAJAR' | 'ORANG_TUA' | 'PJ' | 'ADMIN_MASTER';
    roleTitle: string;
    badgeClass: string;
    heroNameColor?: string;
    [key: string]: any;
  };
  isSantri?: boolean;
  isPengajar?: boolean;
  isWaliKelas?: boolean;
  isOrangTua?: boolean;
}

export default function DashboardHero({
  fullName,
  generationName,
  kelompokName,
  theme,
}: DashboardHeroProps) {
  const contextLabel = [generationName, kelompokName].filter(Boolean).join(' • ');

  return (
    <section className="pt-1 pb-0.5 pl-1">
      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug pr-10 pl-4 sm:pr-0">
        Assalamu&apos;alaikum,{' '}
        <span className={theme.heroNameColor || 'text-emerald-800'}>
          {fullName}
        </span>
      </h1>

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs ${theme.badgeClass}`}
        >
          {theme.roleTitle}
        </span>

        {contextLabel && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/85 backdrop-blur-sm text-slate-700 border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)]">
            {contextLabel}
          </span>
        )}
      </div>
    </section>
  );
}
