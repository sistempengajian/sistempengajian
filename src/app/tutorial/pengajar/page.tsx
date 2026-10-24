import React from 'react';
import type { Metadata } from 'next';
import PengajarProductTour from '@/pages/tutorial/PengajarProductTour';

export const metadata: Metadata = {
  title: 'Tur Produk Interaktif Pengajar | Sistem Pengajian',
  description: 'Interactive Branching Product Tour untuk Guru dan Pengajar TPQ / Madrasah',
};

export default function TutorialPengajarPage() {
  return <PengajarProductTour />;
}
