import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistem Manajemen Pengajian & Pembinaan Generasi Penerus",
    short_name: "SiPanji",
    description: "Sistem Pengajian Terstruktur, Smart Absensi QR, Sinergi Orang Tua, dan Gamifikasi Berjenjang",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#1773ba",
    theme_color: "#1773ba",
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
    screenshots: [
      {
        src: "/splash-screen.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Sistem Pengajian SiPanji",
      },
    ],
    categories: ["education", "lifestyle", "productivity"],
    launch_handler: {
      client_mode: ["focus-existing", "navigate-new"],
    },
  };
}
