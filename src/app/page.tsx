"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  QrCode,
  HeartHandshake,
  Award,
  Users,
  ShieldCheck,
  Zap,
  Smartphone,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
  Layers,
  Flame,
  Star,
  Compass,
  Bell,
  Activity,
  Check,
  ChevronRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"roles" | "design" | "architecture">("roles");
  const [selectedRole, setSelectedRole] = useState<number>(0);
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(false);
  const [simulatedOnline, setSimulatedOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check PWA display mode
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsPwaInstalled(isStandalone);
      setSimulatedOnline(navigator.onLine);

      const handleOnline = () => setSimulatedOnline(true);
      const handleOffline = () => setSimulatedOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const roles = [
    {
      id: "santri",
      title: "Santri & Generasi Qur'ani",
      badge: "Target Pengguna",
      color: "from-pastel-mint-400 to-pastel-mint-600",
      accentBg: "bg-pastel-mint-50 border-pastel-mint-200 text-pastel-mint-800",
      icon: BookOpen,
      tagline: "Gamifikasi Berjenjang, Pohon Kebajikan & QR Santri",
      features: [
        "Kartu QR Santri Digital untuk Check-in Cepat",
        "Pohon Kebajikan Interaktif & Streak Harian (Gamifikasi)",
        "Rapor Digital & Lencana Pencapaian 5 Bintang",
        "Target Hafalan Tahsin, Tahfidz, & Hadits Mandiri",
      ],
      previewStats: { xp: "1,250 XP", streak: "14 Hari", level: "Bintang 3 (Kuning)" },
    },
    {
      id: "orangtua",
      title: "Orang Tua / Wali Santri",
      badge: "Sinergi Keluarga",
      color: "from-pastel-periwinkle-400 to-pastel-periwinkle-600",
      accentBg: "bg-pastel-periwinkle-50 border-pastel-periwinkle-200 text-pastel-periwinkle-800",
      icon: HeartHandshake,
      tagline: "Monitoring Real-time, Konfirmasi Izin Magic Link 24 Jam",
      features: [
        "Notifikasi WhatsApp Instan Kehadiran & Kepulangan",
        "Signed Magic Link (24 Jam) Konfirmasi Sakit/Izin tanpa Login",
        "Verifikasi Amalan Yaumiyah di Rumah (Sholat 5 Waktu & Mengaji)",
        "Multi-anak Switcher dalam 1 Akun Terpadu",
      ],
      previewStats: { anak: "2 Santri Aktif", verifikasi: "100% Terverifikasi", kehadiran: "96.4%" },
    },
    {
      id: "pengajar",
      title: "Pengajar / Ustadz & Ustadzah",
      badge: "Garda Terdepan",
      color: "from-pastel-amber-400 to-pastel-amber-600",
      accentBg: "bg-pastel-amber-50 border-pastel-amber-200 text-pastel-amber-800",
      icon: QrCode,
      tagline: "Smart QR Scanner Kamera, Absen Manual Cepat & Mutaba'ah",
      features: [
        "Mode Kios Scanner Kamera QR Code Terintegrasi Audio Beep",
        "Input Absensi Manual Cepat (Sakit, Izin, Alfa, Terlambat)",
        "Form Mutaba'ah Materi & Setoran Hafalan Cepat",
        "Queue Offline Dexie.js (Auto-sync saat internet kembali)",
      ],
      previewStats: { santriHadir: "28/30 Santri", kelas: "Caberawit B", statusKios: "Aktif" },
    },
    {
      id: "wali_kelas",
      title: "Wali Kelas / Koordinator",
      badge: "Manajemen Kelas",
      color: "from-pastel-mint-500 to-pastel-periwinkle-500",
      accentBg: "bg-pastel-cream-50 border-pastel-cream-300 text-pastel-slate-800",
      icon: Users,
      tagline: "Rekap Kehadiran, Approval Izin & Rapor Evaluasi Bulanan",
      features: [
        "Dashboard Evaluasi Kehadiran & Kedisiplinan Kelas",
        "Review & Approval Tiket Izin / Sakit dari Orang Tua",
        "Kenaikan Jenjang Generasi & Penilaian Rapor Semester",
        "Export Laporan PDF & Excel Rekapitulasi Pembinaan",
      ],
      previewStats: { totalSantri: "32 Santri", pendingIzin: "1 Tiket", avgRapor: "88.5" },
    },
    {
      id: "pj_wilayah",
      title: "Pengurus Wilayah (Kelompok/Desa/Daerah)",
      badge: "Supervisi Bertingkat",
      color: "from-pastel-slate-700 to-pastel-slate-900",
      accentBg: "bg-pastel-slate-100 border-pastel-slate-300 text-pastel-slate-800",
      icon: ShieldCheck,
      tagline: "Scoped Hierarchical RBAC, Multi-Kelompok & User Management",
      features: [
        "Hierarki Wilayah: Daerah > Desa > Kelompok Pengajian",
        "Kelola Akun & Penugasan Pengajar / Wali Kelas di Bawahnya",
        "Statistik Kehadiran Makro & Sebaran Tingkat Generasi",
        "Audit Log Aktivitas Pengurus & Keamanan Terenkripsi",
      ],
      previewStats: { cakupan: "4 Kelompok / 1 Desa", totalGuru: "12 Ustadz", aktifSantri: "142 Santri" },
    },
  ];

  const designTokens = [
    {
      name: "Pastel Mint",
      role: "Warna Utama & Spirit Islami",
      shades: [
        { name: "50", hex: "#ECFDF5", bg: "bg-pastel-mint-50" },
        { name: "200", hex: "#A7F3D0", bg: "bg-pastel-mint-200" },
        { name: "500", hex: "#10B981", bg: "bg-pastel-mint-500", text: "text-white" },
        { name: "600", hex: "#059669", bg: "bg-pastel-mint-600", text: "text-white" },
      ],
    },
    {
      name: "Pastel Periwinkle",
      role: "Warna Sekunder & Aksen Fitur",
      shades: [
        { name: "50", hex: "#EEF2FF", bg: "bg-pastel-periwinkle-50" },
        { name: "200", hex: "#C7D2FE", bg: "bg-pastel-periwinkle-200" },
        { name: "500", hex: "#6366F1", bg: "bg-pastel-periwinkle-500", text: "text-white" },
        { name: "600", hex: "#4F46E5", bg: "bg-pastel-periwinkle-600", text: "text-white" },
      ],
    },
    {
      name: "Pastel Amber",
      role: "Gamifikasi & Bintang Prestasi",
      shades: [
        { name: "50", hex: "#FFFBEB", bg: "bg-pastel-amber-50" },
        { name: "200", hex: "#FDE68A", bg: "bg-pastel-amber-200" },
        { name: "500", hex: "#F59E0B", bg: "bg-pastel-amber-500", text: "text-white" },
      ],
    },
    {
      name: "Pastel Coral",
      role: "Indikator Dot Calendar & Alert",
      shades: [
        { name: "50", hex: "#FFF1F2", bg: "bg-pastel-coral-50" },
        { name: "200", hex: "#FECDD3", bg: "bg-pastel-coral-200" },
        { name: "500", hex: "#F43F5E", bg: "bg-pastel-coral-500", text: "text-white" },
      ],
    },
    {
      name: "Pastel Cream & Slate",
      role: "Background Lembut & Tipografi Nyaman",
      shades: [
        { name: "Cream 100", hex: "#F8F6F0", bg: "bg-pastel-cream-100" },
        { name: "Slate 100", hex: "#F1F5F9", bg: "bg-pastel-slate-100" },
        { name: "Slate 700", hex: "#334155", bg: "bg-pastel-slate-700", text: "text-white" },
        { name: "Slate 900", hex: "#0F172A", bg: "bg-pastel-slate-900", text: "text-white" },
      ],
    },
  ];

  const archPillars = [
    {
      title: "Next.js 15 & React 19 App Router",
      desc: "Server Components dengan streaming SSR super cepat, Partial Prerendering & dynamic caching.",
      icon: Zap,
      status: "Siap & Terkonfigurasi",
    },
    {
      title: "PWA Standalone & Serwist Worker",
      desc: "Instalasi native-like di smartphone, Service Worker v9 caching, dan Safe Area Insets iOS/Android.",
      icon: Smartphone,
      status: "Service Worker Aktif",
    },
    {
      title: "Supabase PostgreSQL & Strict RLS",
      desc: "Database relational multi-tenant dengan Row Level Security granular untuk Daerah, Desa, dan Kelompok.",
      icon: Database,
      status: "Schema & RLS Ready",
    },
    {
      title: "Hierarchical RBAC & Scoped Access",
      desc: "PJ Wilayah dapat mengelola akun di bawah cakupan wilayahnya tanpa eskalasi hak istimewa global.",
      icon: Lock,
      status: "Role Enums Defined",
    },
    {
      title: "Dexie.js Offline Queue & Auto Sync",
      desc: "Absensi & input nilai tetap berjalan lancar saat sinyal lemah di lokasi pengajian.",
      icon: Layers,
      status: "IndexedDB Storage Ready",
    },
    {
      title: "Petapod WAHA & Upstash Rate Limiter",
      desc: "WhatsApp automation dengan Signed Magic Link 24 jam dan proteksi DDoS/Brute Force Redis token bucket.",
      icon: ShieldCheck,
      status: "Middleware Protected",
    },
  ];

  return (
    <div className="min-h-screen bg-pastel-slate-50 flex flex-col font-sans pb-safe">
      {/* Top Notification Bar */}
      <div className="bg-gradient-to-r from-pastel-mint-600 via-pastel-mint-500 to-pastel-periwinkle-600 text-white text-xs sm:text-sm py-2 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pastel-mint-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="font-medium">
              Fase 0: Pondasi Arsitektur, PWA Serwist & Design Tokens Aktif
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-4 text-pastel-mint-50 text-xs">
            <span>Next.js 15.1.7</span>
            <span>•</span>
            <span>React 19</span>
            <span>•</span>
            <span>Serwist PWA</span>
            <span>•</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full font-semibold">v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-pastel-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pastel-mint-500 to-pastel-mint-400 flex items-center justify-center text-white shadow-pastel-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-pastel-slate-800 leading-tight">
                Sistem Pengajian
              </h1>
              <p className="text-xs text-pastel-slate-500 hidden sm:block">
                Pembinaan Generasi Qur'ani Terstruktur
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-pastel-mint-50 border border-pastel-mint-200 text-pastel-mint-700 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-pastel-mint-500 animate-pulse" />
              <span>{simulatedOnline ? "Online Ready" : "Offline Cache"}</span>
            </div>

            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-full bg-pastel-mint-600 hover:bg-pastel-mint-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Masuk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        <section className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-pastel-mint-100/70 border border-pastel-mint-200 text-pastel-mint-800 text-xs font-semibold mb-4">
            <Sparkles className="w-4 h-4 text-pastel-mint-600" />
            <span>Platform Pengajian Generasi Qur'ani Masa Depan</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-pastel-slate-900 tracking-tight leading-snug">
            Sistem Manajemen Pengajian & Pembinaan Terpadu
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-pastel-slate-600 leading-relaxed">
            Menghubungkan <strong>Santri</strong>, <strong>Orang Tua</strong>, <strong>Pengajar</strong>,{" "}
            <strong>Wali Kelas</strong>, dan <strong>Pengurus Wilayah</strong> dalam satu ekosistem
            digital yang aman, cepat, dan menyenangkan.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-pastel-slate-200 text-pastel-slate-700 shadow-sm flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-pastel-mint-600" /> Smart Absensi QR
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-pastel-slate-200 text-pastel-slate-700 shadow-sm flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-pastel-periwinkle-600" /> WhatsApp & Magic Link 24 Jam
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-pastel-slate-200 text-pastel-slate-700 shadow-sm flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-pastel-amber-500" /> Gamifikasi Bintang & XP
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-pastel-slate-200 text-pastel-slate-700 shadow-sm flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-pastel-mint-700" /> RBAC Wilayah Bertingkat
            </span>
          </div>

          {/* Action CTAs for Fase 1 */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pastel-mint-600 to-teal-500 hover:from-pastel-mint-500 hover:to-teal-400 text-white font-bold text-sm shadow-md shadow-pastel-mint-600/20 hover:shadow-lg hover:shadow-pastel-mint-600/30 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Masuk ke Aplikasi</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-2xl bg-white hover:bg-pastel-slate-100 border border-pastel-slate-300 text-pastel-slate-800 font-semibold text-sm shadow-sm active:scale-95 transition-all flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-pastel-mint-600" />
              <span>Buka Demo Dashboard</span>
            </Link>
          </div>
        </section>

        {/* Interactive Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 bg-pastel-slate-200/70 rounded-2xl border border-pastel-slate-300/80">
            <button
              onClick={() => setActiveTab("roles")}
              className={`flex items-center space-x-2 px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "roles"
                  ? "bg-white text-pastel-slate-900 shadow-pastel-sm"
                  : "text-pastel-slate-600 hover:text-pastel-slate-900"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>5 Peran Pengguna</span>
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={`flex items-center space-x-2 px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "design"
                  ? "bg-white text-pastel-slate-900 shadow-pastel-sm"
                  : "text-pastel-slate-600 hover:text-pastel-slate-900"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Soft Pastel Design Tokens</span>
            </button>
            <button
              onClick={() => setActiveTab("architecture")}
              className={`flex items-center space-x-2 px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeTab === "architecture"
                  ? "bg-white text-pastel-slate-900 shadow-pastel-sm"
                  : "text-pastel-slate-600 hover:text-pastel-slate-900"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Kesiapan Arsitektur</span>
            </button>
          </div>
        </div>

        {/* Tab 1: 5 User Roles */}
        {activeTab === "roles" && (
          <div className="space-y-6 animate-fade-in">
            {/* Role Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
              {roles.map((role, idx) => {
                const IconComponent = role.icon;
                const isSelected = selectedRole === idx;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(idx)}
                    className={`p-3 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "bg-white border-pastel-mint-400 shadow-pastel-md ring-2 ring-pastel-mint-400/20"
                        : "bg-white/60 hover:bg-white border-pastel-slate-200 hover:border-pastel-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? "bg-pastel-mint-500 text-white"
                            : "bg-pastel-slate-100 text-pastel-slate-600"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-pastel-mint-500"></span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-pastel-slate-400">
                        Peran 0{idx + 1}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-pastel-slate-800 line-clamp-1">
                        {role.title.split(" ")[0]}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Role Detail Card */}
            <div className="bg-white rounded-3xl border border-pastel-slate-200 shadow-pastel-md overflow-hidden">
              <div
                className={`bg-gradient-to-r ${roles[selectedRole].color} p-6 sm:p-8 text-white relative overflow-hidden`}
              >
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-white mb-2">
                      {roles[selectedRole].badge}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold">
                      {roles[selectedRole].title}
                    </h3>
                    <p className="text-sm text-white/90 mt-1">
                      {roles[selectedRole].tagline}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                    {React.createElement(roles[selectedRole].icon, {
                      className: "w-7 h-7 text-white",
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Features List */}
                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-xs uppercase font-bold text-pastel-slate-400 tracking-wider">
                      Fitur Utama Pada Dashboard
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {roles[selectedRole].features.map((feat, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-start space-x-2.5 p-3 rounded-xl bg-pastel-slate-50 border border-pastel-slate-200/80 text-xs sm:text-sm text-pastel-slate-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-pastel-mint-600 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preview Stats / Mock Widget */}
                  <div className="bg-pastel-slate-50 rounded-2xl p-4 border border-pastel-slate-200 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs uppercase font-bold text-pastel-slate-400 tracking-wider mb-3">
                        Indikator Real-Time
                      </h4>
                      <div className="space-y-2.5">
                        {Object.entries(roles[selectedRole].previewStats).map(([key, val]) => (
                          <div
                            key={key}
                            className="bg-white p-2.5 rounded-xl border border-pastel-slate-200 flex items-center justify-between text-xs"
                          >
                            <span className="capitalize text-pastel-slate-500">{key}:</span>
                            <span className="font-bold text-pastel-slate-800">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-pastel-slate-200 text-[11px] text-pastel-slate-500 flex items-center justify-between">
                      <span>Status: Terotorisasi</span>
                      <span className="text-pastel-mint-600 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Blueprint V2
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Soft Pastel Design Tokens */}
        {activeTab === "design" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-pastel-slate-200 shadow-pastel-md">
              <div className="max-w-2xl mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-pastel-slate-800">
                  Palet Warna Soft Pastel yang Ramah & Menenangkan
                </h3>
                <p className="text-xs sm:text-sm text-pastel-slate-500 mt-1">
                  Didesain khusus untuk kenyamanan visual santri anak-anak, orang tua, dan ustadz,
                  menghindari warna kontras tajam (merah/hijau pekat) demi keterbacaan tinggi.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {designTokens.map((palette, pIdx) => (
                  <div
                    key={pIdx}
                    className="p-4 rounded-2xl bg-pastel-slate-50 border border-pastel-slate-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-sm text-pastel-slate-800">{palette.name}</h4>
                      <span className="text-xs text-pastel-slate-500">{palette.role}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {palette.shades.map((shade, sIdx) => (
                        <div
                          key={sIdx}
                          className={`${shade.bg} ${
                            shade.text || "text-pastel-slate-700"
                          } p-2.5 rounded-xl text-center border border-black/5 flex flex-col justify-between h-18`}
                        >
                          <span className="text-[10px] font-bold">{shade.name}</span>
                          <span className="text-[9px] font-mono opacity-80">{shade.hex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Component UI Examples */}
              <div className="mt-8 pt-6 border-t border-pastel-slate-200">
                <h4 className="text-xs uppercase font-bold text-pastel-slate-400 tracking-wider mb-4">
                  Contoh Penerapan Elemen UI & Badge
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="badge-mint flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Hadir Tepat Waktu
                  </span>
                  <span className="badge-amber flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" /> 150 XP Diperoleh
                  </span>
                  <span className="badge-periwinkle flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> Izin Sakit Diterima
                  </span>
                  <span className="badge-coral flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Alfa / Belum Konfirmasi
                  </span>
                  <button className="btn-primary text-xs py-2 px-4 shadow-pastel-sm">
                    Button Primary Mint
                  </button>
                  <button className="btn-secondary text-xs py-2 px-4">
                    Button Secondary Soft
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Architecture Readiness */}
        {activeTab === "architecture" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {archPillars.map((pillar, aIdx) => {
                const IconComp = pillar.icon;
                return (
                  <div
                    key={aIdx}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-pastel-slate-200 shadow-pastel-sm hover:shadow-pastel-md transition-shadow duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-2xl bg-pastel-mint-50 border border-pastel-mint-200 text-pastel-mint-700 flex items-center justify-center mb-4">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-pastel-slate-800 mb-1.5">
                        {pillar.title}
                      </h4>
                      <p className="text-xs text-pastel-slate-600 leading-relaxed">
                        {pillar.desc}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-pastel-slate-100 flex items-center justify-between text-xs">
                      <span className="text-pastel-slate-400">Status Modul</span>
                      <span className="inline-flex items-center text-pastel-mint-700 font-semibold bg-pastel-mint-50 px-2 py-0.5 rounded-full text-[11px]">
                        <Check className="w-3 h-3 mr-1" /> {pillar.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architecture Roadmap Banner */}
            <div className="bg-gradient-to-r from-pastel-slate-800 to-pastel-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-pastel-md">
              <div className="space-y-2">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 text-pastel-mint-300 text-xs font-semibold">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Roadmap Eksekusi Bertahap (Sprint 0 - 8)</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold">
                  Fase 0 Telah Siap. Siap Melanjutkan ke Fase 1!
                </h3>
                <p className="text-xs sm:text-sm text-pastel-slate-300 max-w-xl">
                  Langkah berikutnya adalah pembangunan <strong>Database Schema Supabase</strong>,{" "}
                  <strong>Row Level Security (RLS)</strong>, dan <strong>Scoped User Management</strong> untuk Pengurus Wilayah.
                </p>
              </div>
              <div className="shrink-0">
                <div className="px-5 py-3 rounded-2xl bg-pastel-mint-500 hover:bg-pastel-mint-600 text-white font-semibold text-xs sm:text-sm shadow-pastel-sm flex items-center space-x-2 transition-colors">
                  <span>Siap Fase 1: Supabase DB & Auth</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* PWA Mobile Bottom Navigation Mockup */}
      <footer className="bg-white border-t border-pastel-slate-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between text-xs text-pastel-slate-500 gap-4">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-pastel-mint-600" />
            <span className="font-semibold text-pastel-slate-700">
              Sistem Manajemen Pengajian & Pembinaan Generasi Qur'ani
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Blueprint v2.0.0</span>
            <span>•</span>
            <span>Next.js 15 PWA</span>
            <span>•</span>
            <span>Soft Pastel Design System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
