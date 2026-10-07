'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  QrCode,
  Calendar,
  BookOpen,
  School,
  FileText,
  CheckSquare,
  UserCheck,
  Award,
  Users,
  Building2,
  LayoutDashboard,
  Sparkles,
  LucideIcon,
} from 'lucide-react';
import RubElHizbAnimation from './animations/RubElHizbAnimation';

interface RouteMeta {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function getRouteMeta(pathname: string): RouteMeta {
  if (pathname.startsWith('/presensi')) {
    return {
      title: 'Presensi & Kehadiran',
      subtitle: 'Menyiapkan sesi & pemindai QR santri...',
      icon: QrCode,
      color: 'text-emerald-500',
      bg: 'from-emerald-500 to-teal-600',
    };
  }
  if (pathname.startsWith('/jadwal')) {
    return {
      title: 'Jadwal Pengajian',
      subtitle: 'Sinkronisasi kalender pengajian...',
      icon: Calendar,
      color: 'text-teal-500',
      bg: 'from-teal-500 to-emerald-600',
    };
  }
  if (pathname.startsWith('/kurikulum')) {
    return {
      title: 'Kurikulum & Hafalan',
      subtitle: 'Memuat silabus & target kompetensi...',
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'from-emerald-600 to-green-600',
    };
  }
  if (pathname.startsWith('/kelas')) {
    return {
      title: 'Kelas Halaqah',
      subtitle: 'Memuat data rombel santri...',
      icon: School,
      color: 'text-cyan-600',
      bg: 'from-cyan-500 to-teal-600',
    };
  }
  if (pathname.startsWith('/laporan')) {
    return {
      title: 'Rapor Belajar',
      subtitle: 'Merekapitulasi penilaian santri...',
      icon: FileText,
      color: 'text-indigo-500',
      bg: 'from-indigo-500 to-blue-600',
    };
  }
  if (pathname.startsWith('/tugas')) {
    return {
      title: 'Tugas & Evaluasi',
      subtitle: 'Menyiapkan soal & koreksi nilai...',
      icon: CheckSquare,
      color: 'text-amber-500',
      bg: 'from-amber-500 to-orange-500',
    };
  }
  if (pathname.startsWith('/profil')) {
    return {
      title: 'Profil Akun',
      subtitle: 'Memuat pengaturan & data akun...',
      icon: UserCheck,
      color: 'text-blue-500',
      bg: 'from-blue-500 to-indigo-600',
    };
  }
  if (pathname.startsWith('/gamifikasi') || pathname.startsWith('/leaderboard')) {
    return {
      title: 'Papan Peringkat',
      subtitle: 'Menghitung poin bintang santri...',
      icon: Award,
      color: 'text-amber-500',
      bg: 'from-amber-500 to-yellow-500',
    };
  }
  if (pathname.startsWith('/users')) {
    return {
      title: 'Kelola Pengguna',
      subtitle: 'Memuat direktori akun sistem...',
      icon: Users,
      color: 'text-purple-500',
      bg: 'from-purple-500 to-indigo-600',
    };
  }
  if (pathname.startsWith('/organisasi')) {
    return {
      title: 'Tata Kelola Wilayah',
      subtitle: 'Memuat struktur daerah & kelompok...',
      icon: Building2,
      color: 'text-sky-500',
      bg: 'from-sky-500 to-blue-600',
    };
  }
  if (pathname === '/' || pathname.startsWith('/dashboard')) {
    return {
      title: 'Dashboard Utama',
      subtitle: 'Menyiapkan ringkasan aktivitas...',
      icon: LayoutDashboard,
      color: 'text-emerald-500',
      bg: 'from-emerald-500 to-teal-600',
    };
  }
  return {
    title: 'Memuat Halaman',
    subtitle: 'Sedang mengambil data terbaru...',
    icon: Sparkles,
    color: 'text-emerald-500',
    bg: 'from-emerald-500 to-teal-600',
  };
}

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Progress Bar State
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Transition Target Metadata
  const [targetPath, setTargetPath] = useState<string>('');

  const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // When pathname or searchParams change, navigation has finished!
  useEffect(() => {
    if (failsafeTimerRef.current) {
      clearTimeout(failsafeTimerRef.current);
      failsafeTimerRef.current = null;
    }

    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
        setTargetPath('');
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links to start progress instantly (0ms response)
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target.target === '_blank' ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      try {
        const targetUrl = new URL(href, window.location.href);
        const currentUrl = new URL(window.location.href);

        if (
          targetUrl.origin === currentUrl.origin &&
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        // Start transition feedback immediately
        setTargetPath(targetUrl.pathname);
        setLoading(true);
        setProgress(30);

        const t1 = setTimeout(() => setProgress(65), 100);
        const t2 = setTimeout(() => setProgress(85), 300);

        // Failsafe safety timeout: Otomatis lepaskan overlay jika navigasi macet > 7 detik
        if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
        failsafeTimerRef.current = setTimeout(() => {
          setLoading(false);
          setProgress(0);
          setTargetPath('');
        }, 7000);

        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } catch {
        // ignore invalid URL
      }
    };

    document.addEventListener('click', handleDocumentClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      if (failsafeTimerRef.current) clearTimeout(failsafeTimerRef.current);
    };
  }, []);

  const meta = getRouteMeta(targetPath || pathname || '/');

  return (
    <>
      {/* 1. TOP PROGRESS BAR (Slim & Glowing) */}
      {(loading || progress > 0) && (
        <div
          aria-hidden="true"
          className="fixed top-0 inset-x-0 z-[9999] h-[3px] pointer-events-none overflow-hidden bg-transparent"
        >
          <div
            className="h-full bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-300 shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-200 ease-out"
            style={{
              width: `${progress}%`,
              opacity: progress === 100 ? 0 : 1,
              transitionProperty: 'width, opacity',
            }}
          />
        </div>
      )}

      {/* 2. MINI SPLASH TRANSITION SCREEN (GEOMETRI RUB EL HIZB - TEMA CERAH & CLICK-LOCK) */}
      {loading && (
        <div
          className="fixed inset-0 z-[9998] bg-white/85 backdrop-blur-md flex items-center justify-center pointer-events-auto cursor-wait select-none animate-fade-in transition-all"
          // pointer-events-auto mengunci klik layar agar user tidak memicu klik ganda selama loading
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="p-6 sm:p-7 rounded-3xl bg-white/95 border border-emerald-100 shadow-[0_20px_50px_rgba(16,185,129,0.12)] flex flex-col items-center text-center max-w-xs mx-4 transform transition-all duration-300">
            {/* Animasi Vektor SVG Murni Rub el Hizb (Tema Cerah Zamrud, Putih Bersih & Emas) */}
            <div className="relative mb-3 flex items-center justify-center">
              <RubElHizbAnimation size={86} />
            </div>

            <h4 className="text-base font-bold text-slate-800 tracking-tight mt-1">
              Membuka {meta.title}
            </h4>

            <p className="text-xs text-slate-500 font-medium mt-1">
              {meta.subtitle}
            </p>

            {/* Mini Progress Bar Line */}
            <div className="w-36 h-1.5 bg-emerald-50 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full animate-pulse w-3/4" />
            </div>

            {/* Indikator Halus Kunci Layar */}
            <span className="text-[10px] text-slate-400 font-normal mt-2">
              Mohon tunggu sebentar...
            </span>
          </div>
        </div>
      )}
    </>
  );
}
