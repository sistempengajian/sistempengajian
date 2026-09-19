import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistem Manajemen Pengajian & Pembinaan Generasi Qur'ani",
    short_name: "PengajianApp",
    description: "Sistem Pengajian Terstruktur, Smart Absensi QR, Sinergi Orang Tua, dan Gamifikasi Berjenjang",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#10B981",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    categories: ["education", "lifestyle", "productivity"],
  };
}
