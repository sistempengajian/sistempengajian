import React, { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import TopProgressBar from "@/components/navigation/TopProgressBar";
import InitialAppSplash from "@/components/navigation/InitialAppSplash";
import PwaFloatingBanner from "@/components/pwa/PwaFloatingBanner";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Manajemen Pengajian & Pembinaan Generasi Penerus",
  description: "Platform Manajemen Pengajian Terstruktur, Smart Absensi QR, Sinergi Orang Tua, dan Gamifikasi Berjenjang",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SiPanji",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192x192.svg",
    apple: "/icons/icon-192x192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#1773ba",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable}`}>
      <head>
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (var r of registrations) { r.unregister(); }
                  });
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      for (var name of names) { caches.delete(name); }
                    });
                  }
                }
              `,
            }}
          />
        )}
        <link rel="apple-touch-startup-image" href="/splash-screen.png" />
        <link rel="preload" as="image" href="/splash-screen.png" fetchPriority="high" />
      </head>
      <body className="antialiased min-h-screen bg-white text-slate-700 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
        <InitialAppSplash />
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
        <PwaFloatingBanner />
      </body>
    </html>
  );
}
