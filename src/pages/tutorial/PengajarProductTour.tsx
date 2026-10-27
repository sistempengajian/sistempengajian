'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  QrCode,
  UserCheck,
  Camera,
  Award,
  Star,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  MessageCircle,
  FileCheck,
  Clock,
  Wifi,
  Battery,
  ShieldCheck,
  Zap,
  MapPin,
  Lock,
  Layers,
  Check,
  Target,
  BookOpen,
  ChevronDown,
  FastForward,
  Edit3,
  MessageSquare,
  Mic,
  MicOff,
} from 'lucide-react';

// ============================================================================
// 1. ARCHITECTURE & STATE MACHINE SPECIFICATION (TYPES)
// ============================================================================

export type StepId =
  | 'SCENE_1_WA_NOTIF_H1' // H-1: Notif WA muncul di atas layar HP & diklik
  | 'SCENE_1_WA_CHAT_H1' // H-1: Chat WA terbuka & klik link portal persiapan ajar
  | 'SCENE_1_SELECT_CAPAIAN' // H-1: Portal Persiapan Ajar -> centang materi prioritas & catatan siaran
  | 'SCENE_2_WA_NOTIF_H2JAM' // H-2 Jam: Notif WA lockscreen muncul & diklik
  | 'SCENE_2_WA_CHAT_H2JAM' // H-2 Jam: Chat WA pengingat & magic link 1-klik masuk ClassroomCockpit
  | 'SCENE_3_BRANCH_MENU' // PAUSE INTERAKTIF: ClassroomCockpit 4 Tab (Pilih mode presensi)
  | 'SCENE_3A_PRESENSI_QR' // Cabang 1: Tab Dynamic QR (00:15 countdown + live check-in santri)
  | 'SCENE_3A_QR_DINAMIS' // Alias backward-compatibility untuk Cabang 1
  | 'SCENE_3B_PRESENSI_MANUAL' // Cabang 2: Tab Absensi Manual (1-tap Hadir, Izin, Sakit per santri)
  | 'SCENE_3C_SCAN_KARTU' // Cabang 3: Tab Scan Kartu (Kamera membaca Kartu Santri ber-QR)
  | 'SCENE_4_JURNAL_PENILAIAN' // Tab Jurnal Nilai: Santri hadir, materi prioritas H-1 di atas, skor & tag
  | 'SCENE_5_COMPLETED'; // Selesai: Status sesi COMPLETED & apresiasi tuntas

export type BranchOption = 'QR_DINAMIS' | 'MANUAL' | 'SCAN_KARTU';

// ============================================================================
// 2. WEB AUDIO API SYNTHESIZER (Native Web Audio, No external assets for SFX)
// ============================================================================
class TourSoundEffects {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  public initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick() {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  playScanBeep() {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, now); // A6 crisp scanner chime
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  playActionComplete() {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {}
  }

  playFanfare() {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch {}
  }

  playNotification() {
    if (!this.enabled) return;
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1000, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }
}

const soundFx = new TourSoundEffects();

// ============================================================================
// 2B. ELEVENLABS VOICE OVER REGISTRY & MULTI-SUBSTEP ARCHITECTURE
// ============================================================================
export interface VoiceOverItem {
  id: string;
  stepId: StepId;
  triggerSubStep: number;
  multiSubStepEnd?: number; // Menjaga audio tetap mengalun tanpa cut-off
  audioUrl: string;
  text: string;
}

export const VO_REGISTRY: Record<string, VoiceOverItem> = {
  SCENE_1_WA_NOTIF_H1_1: {
    id: 'SCENE_1_WA_NOTIF_H1_1',
    stepId: 'SCENE_1_WA_NOTIF_H1',
    triggerSubStep: 1,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_1_WA_NOTIF_H1_1.mp3',
    text: 'Nah, malam sebelum hari mengajar, sistem otomatis mengirimkan pengingat jadwal lewat WhatsApp. Yuk, kita buka pesannya!',
  },
  SCENE_1_WA_CHAT_H1_1: {
    id: 'SCENE_1_WA_CHAT_H1_1',
    stepId: 'SCENE_1_WA_CHAT_H1',
    triggerSubStep: 1,
    multiSubStepEnd: 1,
    audioUrl: '/audio/tour/pengajar/SCENE_1_WA_CHAT_H1_1.mp3',
    text: 'Di sini ada info kelas dan santri yang akan diajar. Cukup klik tautan ini untuk menentukan materi yang mau kita ajarkan besok.',
  },
  SCENE_1_SELECT_CAPAIAN_1: {
    id: 'SCENE_1_SELECT_CAPAIAN_1',
    stepId: 'SCENE_1_SELECT_CAPAIAN',
    triggerSubStep: 1,
    multiSubStepEnd: 1,
    audioUrl: '/audio/tour/pengajar/SCENE_1_SELECT_CAPAIAN_1.mp3',
    text: 'Buka materi kelas kita. Di dalamnya sudah ada capaian pembelajaran yang siap kita tentukan.',
  },
  SCENE_1_SELECT_CAPAIAN_2: {
    id: 'SCENE_1_SELECT_CAPAIAN_2',
    stepId: 'SCENE_1_SELECT_CAPAIAN',
    triggerSubStep: 2,
    multiSubStepEnd: 3,
    audioUrl: '/audio/tour/pengajar/SCENE_1_SELECT_CAPAIAN_2.mp3',
    text: 'Tinggal centang capaian yang ingin diprioritaskan. Materi yang dicentang akan otomatis menjadi target ajar besok!',
  },
  SCENE_1_SELECT_CAPAIAN_4: {
    id: 'SCENE_1_SELECT_CAPAIAN_4',
    stepId: 'SCENE_1_SELECT_CAPAIAN',
    triggerSubStep: 5,
    multiSubStepEnd: 5,
    audioUrl: '/audio/tour/pengajar/SCENE_1_SELECT_CAPAIAN_4.mp3',
    text: 'Klik simpan, dan rencana mengajar kita sudah selesai disiapkan. Praktis banget, kan?',
  },
  SCENE_2_TIMELAPSE_COUNTDOWN_0: {
    id: 'SCENE_2_TIMELAPSE_COUNTDOWN_0',
    stepId: 'SCENE_1_SELECT_CAPAIAN',
    triggerSubStep: 99,
    multiSubStepEnd: 99,
    audioUrl: '/audio/tour/pengajar/SCENE_2_TIMELAPSE_COUNTDOWN_0.mp3',
    text: 'Waktu berjalan... Sekarang kita lompat ke dua jam sebelum sesi mengajar dimulai!',
  },
  SCENE_2_WA_NOTIF_H2JAM_1: {
    id: 'SCENE_2_WA_NOTIF_H2JAM_1',
    stepId: 'SCENE_2_WA_NOTIF_H2JAM',
    triggerSubStep: 1,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_2_WA_NOTIF_H2JAM_1.mp3',
    text: 'Dua jam sebelum kelas, ada notifikasi WhatsApp lagi untuk membuka ruang kelas digital kita.',
  },
  SCENE_2_WA_CHAT_H2JAM_1: {
    id: 'SCENE_2_WA_CHAT_H2JAM_1',
    stepId: 'SCENE_2_WA_CHAT_H2JAM',
    triggerSubStep: 1,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_2_WA_CHAT_H2JAM_1.mp3',
    text: 'Tinggal klik tautan ajaib ini. Kita langsung masuk ke ruang kendali kelas tanpa perlu repot login lagi.',
  },
  SCENE_3_BRANCH_MENU_0: {
    id: 'SCENE_3_BRANCH_MENU_0',
    stepId: 'SCENE_3_BRANCH_MENU',
    triggerSubStep: 0,
    multiSubStepEnd: 0,
    audioUrl: '/audio/tour/pengajar/SCENE_3_BRANCH_MENU_0.mp3',
    text: 'Sistem Pengajian punya tiga pilihan presensi: Q-R Dinamis, Absensi Manual, atau Scan Kartu. Pilih salah satu untuk melihat caranya!',
  },
  SCENE_3A_PRESENSI_QR_0: {
    id: 'SCENE_3A_PRESENSI_QR_0',
    stepId: 'SCENE_3A_PRESENSI_QR',
    triggerSubStep: 0,
    multiSubStepEnd: 0,
    audioUrl: '/audio/tour/pengajar/SCENE_3A_PRESENSI_QR_0.mp3',
    text: 'Ini mode Q-R Dinamis. Kode Q-R akan berganti otomatis setiap lima belas detik di layar ponsel kita.',
  },
  SCENE_3A_PRESENSI_QR_1: {
    id: 'SCENE_3A_PRESENSI_QR_1',
    stepId: 'SCENE_3A_PRESENSI_QR',
    triggerSubStep: 1,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_3A_PRESENSI_QR_1.mp3',
    text: 'Santri tinggal scan dari HP masing-masing, dan presensi langsung tercatat otomatis. Bebas titip absen!',
  },
  SCENE_3B_PRESENSI_MANUAL_0: {
    id: 'SCENE_3B_PRESENSI_MANUAL_0',
    stepId: 'SCENE_3B_PRESENSI_MANUAL',
    triggerSubStep: 0,
    multiSubStepEnd: 0,
    audioUrl: '/audio/tour/pengajar/SCENE_3B_PRESENSI_MANUAL_0.mp3',
    text: 'Kalau santri tidak bawa HP, pakai Absensi Manual. Secara bawaan, statusnya berada di Alfa.',
  },
  SCENE_3B_PRESENSI_MANUAL_1: {
    id: 'SCENE_3B_PRESENSI_MANUAL_1',
    stepId: 'SCENE_3B_PRESENSI_MANUAL',
    triggerSubStep: 1,
    multiSubStepEnd: 3,
    audioUrl: '/audio/tour/pengajar/SCENE_3B_PRESENSI_MANUAL_1.mp3',
    text: 'Cukup satu klik saja untuk mengubah status jadi Hadir, Izin, atau Sakit. Cepat dan tanpa ribet!',
  },
  SCENE_3C_SCAN_KARTU_0: {
    id: 'SCENE_3C_SCAN_KARTU_0',
    stepId: 'SCENE_3C_SCAN_KARTU',
    triggerSubStep: 0,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_3C_SCAN_KARTU_0.mp3',
    text: 'Bisa juga dengan memindai kartu fisik santri. Cukup arahkan kartu ke kamera HP kita, dan santri langsung terdata hadir!',
  },
  SCENE_4_JURNAL_PENILAIAN_1: {
    id: 'SCENE_4_JURNAL_PENILAIAN_1',
    stepId: 'SCENE_4_JURNAL_PENILAIAN',
    triggerSubStep: 1,
    multiSubStepEnd: 1,
    audioUrl: '/audio/tour/pengajar/SCENE_4_JURNAL_PENILAIAN_1.mp3',
    text: 'Setelah presensi, buka Tab Jurnal. Materi prioritas yang kita pilih semalam sudah langsung ada di urutan teratas.',
  },
  SCENE_4_JURNAL_PENILAIAN_2: {
    id: 'SCENE_4_JURNAL_PENILAIAN_2',
    stepId: 'SCENE_4_JURNAL_PENILAIAN',
    triggerSubStep: 2,
    multiSubStepEnd: 2,
    audioUrl: '/audio/tour/pengajar/SCENE_4_JURNAL_PENILAIAN_2.mp3',
    text: 'Satu kali klik tombol status, berubah jadi Proses, untuk santri yang masih butuh bimbingan estafet.',
  },
  SCENE_4_JURNAL_PENILAIAN_3: {
    id: 'SCENE_4_JURNAL_PENILAIAN_3',
    stepId: 'SCENE_4_JURNAL_PENILAIAN',
    triggerSubStep: 3,
    multiSubStepEnd: 4,
    audioUrl: '/audio/tour/pengajar/SCENE_4_JURNAL_PENILAIAN_3.mp3',
    text: 'Klik sekali lagi, berubah jadi Tuntas. Di sini kita bisa langsung pilih skor nilai dan catatan khususnya.',
  },
  SCENE_4_JURNAL_PENILAIAN_5: {
    id: 'SCENE_4_JURNAL_PENILAIAN_5',
    stepId: 'SCENE_4_JURNAL_PENILAIAN',
    triggerSubStep: 5,
    multiSubStepEnd: 5,
    audioUrl: '/audio/tour/pengajar/SCENE_4_JURNAL_PENILAIAN_5.mp3',
    text: 'Kita bisa mengombinasikan materi yang berstatus Tuntas dan yang masih Proses dalam satu sesi yang sama.',
  },
  SCENE_4_JURNAL_PENILAIAN_6: {
    id: 'SCENE_4_JURNAL_PENILAIAN_6',
    stepId: 'SCENE_4_JURNAL_PENILAIAN',
    triggerSubStep: 6,
    multiSubStepEnd: 6,
    audioUrl: '/audio/tour/pengajar/SCENE_4_JURNAL_PENILAIAN_6.mp3',
    text: 'Terakhir, klik Simpan Jurnal dan Selesai Mengajar. Seluruh data kelas resmi tersimpan rapi ke sistem!',
  },
  SCENE_5_COMPLETED_0: {
    id: 'SCENE_5_COMPLETED_0',
    stepId: 'SCENE_5_COMPLETED',
    triggerSubStep: 0,
    multiSubStepEnd: 0,
    audioUrl: '/audio/tour/pengajar/SCENE_5_COMPLETED_0.mp3',
    text: 'Alhamdulillah! Seluruh siklus mengajar berhasil Anda kuasai. Selamat mengajar dan semoga berkah untuk para santri!',
  },
};

const audioPreloadCache = new Map<string, HTMLAudioElement>();

function preloadAudio(url: string) {
  if (typeof window === 'undefined') return;
  if (!audioPreloadCache.has(url)) {
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audioPreloadCache.set(url, audio);
    } catch {}
  }
}

function preloadAudioForStep(stepId: StepId) {
  Object.values(VO_REGISTRY).forEach((item) => {
    if (
      item.stepId === stepId ||
      (stepId === 'SCENE_3A_QR_DINAMIS' && item.stepId === 'SCENE_3A_PRESENSI_QR') ||
      (stepId === 'SCENE_3A_PRESENSI_QR' && item.stepId === 'SCENE_3A_QR_DINAMIS')
    ) {
      preloadAudio(item.audioUrl);
    }
  });
}

function getVoiceOverItem(step: StepId, subStep: number): VoiceOverItem | undefined {
  const normalizedStep = step === 'SCENE_3A_QR_DINAMIS' ? 'SCENE_3A_PRESENSI_QR' : step;
  return Object.values(VO_REGISTRY).find(
    (item) => item.stepId === normalizedStep && item.triggerSubStep === subStep
  );
}

function getActiveMultiSubStepItem(step: StepId, subStep: number): VoiceOverItem | undefined {
  const normalizedStep = step === 'SCENE_3A_QR_DINAMIS' ? 'SCENE_3A_PRESENSI_QR' : step;
  return Object.values(VO_REGISTRY).find(
    (item) =>
      item.stepId === normalizedStep &&
      subStep >= item.triggerSubStep &&
      subStep <= (item.multiSubStepEnd ?? item.triggerSubStep)
  );
}

// ============================================================================
// 3. CANVAS CONFETTI ENGINE (Pure Lightweight 2D Particle Burst)
// ============================================================================
function triggerCelebrationConfetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    vRot: number;
    life: number;
  }> = [];

  const colors = ['#0D9488', '#10B981', '#34D399', '#6366F1', '#F59E0B', '#3B82F6', '#14B8A6'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: width / 2 + (Math.random() * 200 - 100),
      y: height / 3 + (Math.random() * 80 - 40),
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      life: 1,
    });
  }

  let animationId: number;
  const render = () => {
    ctx.clearRect(0, 0, width, height);
    let alive = 0;

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.vx *= 0.98;
      p.rotation += p.vRot;
      p.life -= 0.014;

      if (p.life > 0) {
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
      }
    });

    if (alive > 0) {
      animationId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
      cancelAnimationFrame(animationId);
    }
  };

  render();
}

// ============================================================================
// 4. SUBTITLE & STEP DICTIONARY (NARASI INDONESIA SESUAI SISTEM ASLI)
// ============================================================================

function getSubtitleText(step: StepId, subStep: number): string {
  switch (step) {
    case 'SCENE_1_WA_NOTIF_H1':
      if (subStep === 0)
        return 'Malam hari (H-1 pukul 19:30 WIB): Menunggu notifikasi WhatsApp pengingat jadwal mengajar esok hari...';
      if (subStep === 1)
        return '🔔 Pesan WhatsApp masuk! Kursor bergerak mengarahkan pengajar untuk membuka notifikasi...';
      if (subStep === 2)
        return 'Sentuh notifikasi WhatsApp untuk membuka detail pesan pengingat resmi Sistem Pengajian...';
      return 'Membuka pesan WhatsApp Sistem Pengajian...';

    case 'SCENE_1_WA_CHAT_H1':
      if (subStep === 0)
        return 'Pesan WhatsApp paired: Informasi detail sesi dan tautan khusus Portal Persiapan Ajar Sesi (/pengajar/sesi/token).';
      if (subStep === 1)
        return 'Kursor bergerak menuju tautan "Rencana Materi Sesi"...';
      return 'Membuka Portal Persiapan Ajar Sesi pengajar...';

    case 'SCENE_1_SELECT_CAPAIAN':
      if (subStep === 0)
        return 'Portal Persiapan Ajar Sesi terbuka: Kursor bergerak menuju accordion materi untuk melihat rincian indikator.';
      if (subStep === 1)
        return 'Klik accordion: Membuka materi "Bab 1: Ilmu Tajwid Praktis & Tahfidz" untuk memilih capaian santri...';
      if (subStep === 2 || subStep === 3)
        return 'Kursor mencentang capaian #1 "Tajwid: Hukum Nun Mati" untuk dijadikan ⭐ Prioritas Mengajar esok hari!';
      if (subStep === 4)
        return 'Materi #1 ditandai ⭐ Prioritas! Selanjutnya mencentang capaian #2 "Tahfidz: Hafalan Surat An-Naba 1-10"...';
      return 'Materi #2 ditandai ⭐ Prioritas! Mengklik "Simpan Rencana Ajar & Catatan Siaran" untuk menyimpan persiapan...';

    case 'SCENE_2_WA_NOTIF_H2JAM':
      if (subStep === 0)
        return 'Hari H (Pukul 14:00 WIB - H-2 Jam sebelum kelas): Layar ponsel standby menanti pengingat sesi...';
      if (subStep === 1)
        return '🔔 Notifikasi H-2 Jam tiba! Sistem otomatis mengirimkan pengingat absensi dan Magic Link 1-Klik.';
      if (subStep === 2)
        return 'Sentuh notifikasi WhatsApp untuk membuka pesan dan mengakses ruang absensi kelas...';
      return 'Membuka pesan WhatsApp H-2 Jam...';

    case 'SCENE_2_WA_CHAT_H2JAM':
      if (subStep === 0)
        return 'Pesan WhatsApp pengingat 2 jam: Tersedia tautan Magic Link 1-Klik (/auth/direct) untuk masuk Classroom Cockpit.';
      if (subStep === 1)
        return 'Kursor bergerak menuju tombol tautan Magic Link di pesan WhatsApp...';
      if (subStep === 2)
        return 'Klik tautan: Sistem mengotentikasi login secara instan tanpa perlu repot mengetik password!';
      return 'Autentikasi 1-Klik direct login berhasil! Membuka Classroom Cockpit...';

    case 'SCENE_3_BRANCH_MENU':
      if (subStep === 0)
        return '⏸️ Titik Percabangan: Silakan klik salah satu mode presensi pada modal interaktif layar (Dynamic QR, Absensi Manual, atau Scan Kartu)!';
      return 'Kursor mengarahkan pengajar menuju tombol tab presensi pada menu ClassroomCockpit...';

    case 'SCENE_3A_PRESENSI_QR':
    case 'SCENE_3A_QR_DINAMIS':
      if (subStep === 0)
        return 'Tab 1 [Dynamic QR]: Pengajar mengklik tombol "Tampilkan QR Kelas" di proyektor / ponsel.';
      if (subStep === 1)
        return 'QR Code dinamis aktif dengan batas waktu 00:15 detik untuk mencegah kecurangan titip absen.';
      if (subStep === 2)
        return 'Santri memindai QR code via smartphone mereka — status kehadiran terisi otomatis secara real-time!';
      return 'Mode Dynamic QR selesai dipelajari! Kembali ke ruang ClassroomCockpit.';

    case 'SCENE_3B_PRESENSI_MANUAL':
      if (subStep === 0)
        return 'Tab 2 [Absensi Manual]: Seluruh santri berstatus default Alfa (Merah). Kursor bergerak ke santri pertama...';
      if (subStep === 1)
        return 'Klik [Hadir]: Mengubah status santri pertama (Ahmad Fauzi) dari Alfa menjadi Hadir (Hijau).';
      if (subStep === 2)
        return 'Klik [Izin]: Mengubah status santri kedua (Budi Santoso) dari Alfa menjadi Izin (Kuning).';
      if (subStep === 3)
        return 'Klik [Sakit]: Mengubah status santri ketiga (Citra Lestari) dari Alfa menjadi Sakit (Oranye).';
      return 'Absensi manual selesai dicatat! Kembali ke ruang ClassroomCockpit.';

    case 'SCENE_3C_SCAN_KARTU':
      if (subStep === 0)
        return 'Tab 3 [Scan Kartu]: Pengajar mengaktifkan kamera scanner ponsel untuk memindai kartu fisik santri.';
      if (subStep === 1)
        return 'Santri menunjukkan Kartu Santri / Syahriah ber-QR ke arah kamera pengajar...';
      if (subStep === 2)
        return 'Beep! Kartu terdeteksi seketika dan santri Muhammad Rizky tercatat hadir otomatis.';
      return 'Mode Scan Kartu selesai dipelajari! Kembali ke ruang ClassroomCockpit.';

    case 'SCENE_4_JURNAL_PENILAIAN':
      if (subStep === 0)
        return 'Tab 4 [Jurnal Nilai]: Kursor bergerak menuju accordion materi evaluasi yang masih tertutup.';
      if (subStep === 1)
        return 'Klik accordion materi: Membuka kartu capaian target pembelajaran santri dengan animasi mulus...';
      if (subStep === 2)
        return 'Klik ke-1 tombol status: Capaian #1 berubah dari "Belum Dinilai" menjadi "⚡ Proses", memunculkan kolom catatan capaian!';
      if (subStep === 3)
        return 'Klik ke-2 tombol status: Capaian #1 berubah dari "Proses" menjadi "✓ Tuntas", memunculkan pilihan nilai & catatan materi!';
      if (subStep === 4)
        return 'Kursor memilih skor nilai capaian [90] untuk santri yang tuntas menguasai hukum tajwid.';
      if (subStep === 5)
        return 'Klik capaian #2: Status diset menjadi "⚡ Proses" sehingga 2 tipe status capaian aktif sekaligus!';
      if (subStep === 6)
        return 'Kursor mengklik "Simpan Jurnal & Selesai Mengajar" — Seluruh data pembelajaran tersimpan resmi ke sistem!';
      return 'Menyimpan jurnal penilaian santri...';

    case 'SCENE_5_COMPLETED':
      return '🎉 Alhamdulillah! Anda telah menguasai seluruh siklus mengajar: H-1 Persiapan → Magic Link H-2 Jam → Cockpit Presensi → Jurnal Nilai.';

    default:
      return '';
  }
}

// ============================================================================
// 5. MAIN COMPONENT: PengajarProductTour
// ============================================================================

export default function PengajarProductTour() {
  // Core Deterministic State Machine
  const [currentStep, setCurrentStep] = useState<StepId>('SCENE_1_WA_NOTIF_H1');
  const [subStep, setSubStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [visitedBranches, setVisitedBranches] = useState<BranchOption[]>([]);
  const [hasStartedTour, setHasStartedTour] = useState<boolean>(false);

  // Audio & narration controls
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceOverEnabled, setVoiceOverEnabled] = useState<boolean>(true);
  const [isVoSpeaking, setIsVoSpeaking] = useState<boolean>(false);
  const [isClicking, setIsClicking] = useState<boolean>(false);

  // Audio References for Multi-Substep Anti-Cut-Off
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeVoKeyRef = useRef<string | null>(null);
  const isVoSpeakingRef = useRef<boolean>(false);
  const pendingTransitionRef = useRef<(() => void) | null>(null);

  // Scene Specific Visual States (Sesuai Sistem Asli)
  const [selectedCapaian, setSelectedCapaian] = useState<number[]>([]);
  const [openPlanAccordion, setOpenPlanAccordion] = useState<string | null>(null); // Default: CLOSED
  const [isTimeLapseActive, setIsTimeLapseActive] = useState<boolean>(false);
  const [timeLapseHours, setTimeLapseHours] = useState<number>(24);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(true);
  const [targetBranchTab, setTargetBranchTab] = useState<BranchOption | 'EVALUATION' | null>(null);
  const [openJournalAccordion, setOpenJournalAccordion] = useState<boolean>(false); // Default: CLOSED
  const [journalCapaianStatus, setJournalCapaianStatus] = useState<
    Record<number, 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>
  >({
    1: 'NOT_STARTED',
    2: 'NOT_STARTED',
  });
  const [journalScores, setJournalScores] = useState<Record<number, number>>({
    1: 90,
    2: 85,
  });
  const [journalNotes, setJournalNotes] = useState<Record<number, string>>({
    1: 'Perlu bimbingan pada hukum Idgham Bighunnah',
    2: 'Hafalan lancar dan makhraj fasih',
  });
  const [teacherBroadcastNoteInput, setTeacherBroadcastNoteInput] = useState<string>(
    "Mohon santri membawa mushaf Juz 'Amma dan menyimak materi makhraj huruf."
  );
  const [cockpitActiveTab, setCockpitActiveTab] = useState<
    'DYNAMIC_QR' | 'MANUAL_SHEET' | 'BATCH_SCAN' | 'EVALUATION'
  >('DYNAMIC_QR');
  const [showToast, setShowToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });
  const [manualPresence, setManualPresence] = useState<Record<string, 'HADIR' | 'IZIN' | 'SAKIT' | 'ALFA'>>({
    s1: 'ALFA',
    s2: 'ALFA',
    s3: 'ALFA',
  }); // Default: ALFA
  const [selectedScores, setSelectedScores] = useState<Record<string, number>>({
    s1: 90,
    s2: 85,
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([
    '✓ Tajwid Fasih',
    '✓ Makhraj Sempurna',
  ]);
  const [teachingSummaryNotes, setTeachingSummaryNotes] = useState<string>(
    'Alhamdulillah materi Nun Mati & Surat An-Naba tuntas dengan lancar. Santri antusias.'
  );
  const journalScrollRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────────────────────
  // VOICE OVER AUDIO MANAGEMENT (MULTI-SUBSTEP ANTI-CUT-OFF & SPEECH FALLBACK)
  // ─────────────────────────────────────────────────────────────
  const stopVoiceOver = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsVoSpeaking(false);
    isVoSpeakingRef.current = false;
    activeVoKeyRef.current = null;
  }, []);

  const playVoiceOver = useCallback(
    (voKey: string) => {
      if (!voiceOverEnabled) return;

      const item = VO_REGISTRY[voKey];
      if (!item) return;

      // Anti-cut-off: if already playing this exact item, don't restart
      if (activeVoKeyRef.current === voKey && isVoSpeakingRef.current) {
        return;
      }

      stopVoiceOver();

      activeVoKeyRef.current = voKey;
      setIsVoSpeaking(true);
      isVoSpeakingRef.current = true;

      const audio = new Audio(item.audioUrl);
      audio.playbackRate = playbackSpeed;
      audio.currentTime = 0;
      currentAudioRef.current = audio;

      const handleEnded = () => {
        setIsVoSpeaking(false);
        isVoSpeakingRef.current = false;
        activeVoKeyRef.current = null;
        if (pendingTransitionRef.current) {
          const nextFn = pendingTransitionRef.current;
          pendingTransitionRef.current = null;
          setTimeout(() => {
            nextFn();
          }, 350);
        }
      };

      audio.onended = handleEnded;

      audio.onerror = () => {
        // Fallback to Web Speech API if MP3 file is not yet generated
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(item.text);
          utterance.lang = 'id-ID';
          utterance.rate = playbackSpeed;
          utterance.onend = handleEnded;
          utterance.onerror = handleEnded;
          window.speechSynthesis.speak(utterance);
        } else {
          handleEnded();
        }
      };

      audio.play().catch(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(item.text);
          utterance.lang = 'id-ID';
          utterance.rate = playbackSpeed;
          utterance.onend = handleEnded;
          utterance.onerror = handleEnded;
          window.speechSynthesis.speak(utterance);
        } else {
          handleEnded();
        }
      });
    },
    [voiceOverEnabled, playbackSpeed, stopVoiceOver]
  );

  const executeOrWait = useCallback(
    (transitionFn: () => void) => {
      if (voiceOverEnabled && isVoSpeakingRef.current) {
        pendingTransitionRef.current = transitionFn;
      } else {
        pendingTransitionRef.current = null;
        transitionFn();
      }
    },
    [voiceOverEnabled]
  );

  const handleStartInteractiveTour = useCallback(() => {
    soundFx.initCtx();
    soundFx.playClick();
    stopVoiceOver();
    pendingTransitionRef.current = null;
    setCurrentStep('SCENE_1_WA_NOTIF_H1');
    setSubStep(0);
    setSelectedCapaian([]);
    setOpenPlanAccordion(null);
    setIsBranchModalOpen(true);
    setManualPresence({ s1: 'ALFA', s2: 'ALFA', s3: 'ALFA' });
    setOpenJournalAccordion(false);
    setJournalCapaianStatus({ 1: 'NOT_STARTED', 2: 'NOT_STARTED' });
    setJournalScores({ 1: 90, 2: 85 });
    setCockpitActiveTab('DYNAMIC_QR');
    setVisitedBranches([]);
    setIsTimeLapseActive(false);
    setTimeLapseHours(24);
    setHasStartedTour(true);
    setIsPlaying(true);
    preloadAudioForStep('SCENE_1_WA_NOTIF_H1');
    preloadAudioForStep('SCENE_1_WA_CHAT_H1');
  }, [stopVoiceOver]);

  useEffect(() => {
    soundFx.enabled = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!voiceOverEnabled) {
      stopVoiceOver();
      if (pendingTransitionRef.current) {
        const nextFn = pendingTransitionRef.current;
        pendingTransitionRef.current = null;
        nextFn();
      }
    }
  }, [voiceOverEnabled, stopVoiceOver]);

  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (!isPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    } else {
      if (currentAudioRef.current && currentAudioRef.current.paused && isVoSpeakingRef.current) {
        currentAudioRef.current.play().catch(() => {});
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!hasStartedTour || !isPlaying) return;
    if (isTimeLapseActive) return;

    const voItem = getVoiceOverItem(currentStep, subStep);
    if (voItem) {
      playVoiceOver(voItem.id);
    }
  }, [currentStep, subStep, isPlaying, hasStartedTour, isTimeLapseActive, playVoiceOver]);

  useEffect(() => {
    if (currentStep === 'SCENE_1_WA_NOTIF_H1') {
      preloadAudioForStep('SCENE_1_WA_CHAT_H1');
      preloadAudioForStep('SCENE_1_SELECT_CAPAIAN');
    } else if (currentStep === 'SCENE_1_SELECT_CAPAIAN') {
      preloadAudio('/audio/tour/pengajar/SCENE_2_TIMELAPSE_COUNTDOWN_0.mp3');
      preloadAudioForStep('SCENE_2_WA_NOTIF_H2JAM');
      preloadAudioForStep('SCENE_2_WA_CHAT_H2JAM');
    } else if (currentStep === 'SCENE_2_WA_CHAT_H2JAM') {
      preloadAudioForStep('SCENE_3_BRANCH_MENU');
      preloadAudioForStep('SCENE_3A_PRESENSI_QR');
      preloadAudioForStep('SCENE_3B_PRESENSI_MANUAL');
      preloadAudioForStep('SCENE_3C_SCAN_KARTU');
    } else if (
      currentStep === 'SCENE_3_BRANCH_MENU' ||
      currentStep === 'SCENE_3A_PRESENSI_QR' ||
      currentStep === 'SCENE_3A_QR_DINAMIS' ||
      currentStep === 'SCENE_3B_PRESENSI_MANUAL' ||
      currentStep === 'SCENE_3C_SCAN_KARTU'
    ) {
      preloadAudioForStep('SCENE_4_JURNAL_PENILAIAN');
      preloadAudioForStep('SCENE_5_COMPLETED');
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 'SCENE_4_JURNAL_PENILAIAN') {
      if (subStep >= 5) {
        journalScrollRef.current?.scrollTo({ top: 90, behavior: 'smooth' });
      } else {
        journalScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, subStep]);

  const handleCycleCapaianStatus = useCallback((id: number) => {
    soundFx.playClick();
    setJournalCapaianStatus((prev) => {
      const cur = prev[id] || 'NOT_STARTED';
      let next: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
      if (cur === 'NOT_STARTED') next = 'IN_PROGRESS';
      else if (cur === 'IN_PROGRESS') next = 'COMPLETED';
      else next = 'NOT_STARTED';
      return { ...prev, [id]: next };
    });
  }, []);

  const handleSelectBranchFromModal = useCallback((branch: BranchOption) => {
    soundFx.playClick();
    stopVoiceOver();
    pendingTransitionRef.current = null;
    setIsBranchModalOpen(false);
    setTargetBranchTab(branch);
    setSubStep(1);
    setIsPlaying(true);
  }, [stopVoiceOver]);

  const handleContinueToJournalFromModal = useCallback(() => {
    soundFx.playClick();
    stopVoiceOver();
    pendingTransitionRef.current = null;
    setIsBranchModalOpen(false);
    setTargetBranchTab('EVALUATION');
    setSubStep(1);
    setIsPlaying(true);
  }, [stopVoiceOver]);

  // ─────────────────────────────────────────────────────────────
  // QA DEBUG TOOLBAR STATE & QUERY PARAMS SUPPORT
  // ─────────────────────────────────────────────────────────────
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);

  const ALL_STEPS: { id: StepId; label: string }[] = useMemo(
    () => [
      { id: 'SCENE_1_WA_NOTIF_H1', label: '1. WA Notif H-1' },
      { id: 'SCENE_1_WA_CHAT_H1', label: '2. WA Chat H-1' },
      { id: 'SCENE_1_SELECT_CAPAIAN', label: '3. Portal Rencana' },
      { id: 'SCENE_2_WA_NOTIF_H2JAM', label: '4. WA Notif H-2' },
      { id: 'SCENE_2_WA_CHAT_H2JAM', label: '5. WA Chat H-2' },
      { id: 'SCENE_3_BRANCH_MENU', label: '6. Cockpit Menu' },
      { id: 'SCENE_3A_PRESENSI_QR', label: '7. Dynamic QR' },
      { id: 'SCENE_3B_PRESENSI_MANUAL', label: '8. Absensi Manual' },
      { id: 'SCENE_3C_SCAN_KARTU', label: '9. Scan Kartu' },
      { id: 'SCENE_4_JURNAL_PENILAIAN', label: '10. Jurnal Nilai' },
      { id: 'SCENE_5_COMPLETED', label: '11. Completed' },
    ],
    []
  );

  const handleDebugJump = useCallback((stepId: StepId, targetSubStep: number = 0) => {
    stopVoiceOver();
    pendingTransitionRef.current = null;
    setIsPlaying(false);
    setIsTimeLapseActive(false);
    setCurrentStep(stepId);
    setSubStep(targetSubStep);
    if (stepId === 'SCENE_1_SELECT_CAPAIAN') {
      setOpenPlanAccordion(targetSubStep >= 2 ? 'bab-tajwid' : null);
      setSelectedCapaian(targetSubStep === 3 ? [1] : targetSubStep >= 4 ? [1, 2] : []);
    } else if (stepId === 'SCENE_3_BRANCH_MENU') {
      setIsBranchModalOpen(targetSubStep === 0);
      setVisitedBranches(['QR_DINAMIS']);
    } else if (stepId === 'SCENE_3A_PRESENSI_QR' || stepId === 'SCENE_3A_QR_DINAMIS') {
      setCockpitActiveTab('DYNAMIC_QR');
    } else if (stepId === 'SCENE_3B_PRESENSI_MANUAL') {
      setCockpitActiveTab('MANUAL_SHEET');
      setManualPresence({
        s1: targetSubStep >= 1 ? 'HADIR' : 'ALFA',
        s2: targetSubStep >= 2 ? 'IZIN' : 'ALFA',
        s3: targetSubStep >= 3 ? 'SAKIT' : 'ALFA',
      });
    } else if (stepId === 'SCENE_3C_SCAN_KARTU') {
      setCockpitActiveTab('BATCH_SCAN');
    } else if (stepId === 'SCENE_4_JURNAL_PENILAIAN') {
      setCockpitActiveTab('EVALUATION');
      setOpenJournalAccordion(targetSubStep >= 1);
      setSelectedCapaian([1, 2]);
      setJournalCapaianStatus({
        1: targetSubStep >= 3 ? 'COMPLETED' : targetSubStep >= 2 ? 'IN_PROGRESS' : 'NOT_STARTED',
        2: targetSubStep >= 5 ? 'IN_PROGRESS' : 'NOT_STARTED',
      });
      setJournalScores({
        1: targetSubStep >= 4 ? 90 : 85,
        2: 85,
      });
    }
  }, [stopVoiceOver]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true' || params.get('debug') === '1') {
      setIsDebugMode(true);
      setHasStartedTour(true);
    }
    if (params.get('start') === 'true') {
      setHasStartedTour(true);
    }
    if (params.get('timelapse') === 'true') {
      setIsTimeLapseActive(true);
      setTimeLapseHours(12);
      setHasStartedTour(true);
    }
    const stepParam = params.get('step') as StepId | null;
    const subStepParam = params.get('subStep') || params.get('sub');
    const targetSubStep = subStepParam !== null ? parseInt(subStepParam, 10) : 0;

    if (stepParam && ALL_STEPS.some((s) => s.id === stepParam)) {
      setHasStartedTour(true);
      handleDebugJump(stepParam, isNaN(targetSubStep) ? 0 : targetSubStep);
    } else if (subStepParam !== null) {
      const parsed = parseInt(subStepParam, 10);
      if (!isNaN(parsed)) setSubStep(parsed);
    }
  }, [ALL_STEPS, handleDebugJump]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const triggerToast = useCallback((msg: string) => {
    setShowToast({ show: true, message: msg });
    setTimeout(() => {
      setShowToast({ show: false, message: '' });
    }, 2000);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // VIRTUAL CURSOR COORDINATES CALCULATION (PERCENTAGE BASED)
  // ─────────────────────────────────────────────────────────────
  const cursorCoordinates = useMemo<{ x: number; y: number; visible: boolean }>(() => {
    if (currentStep === 'SCENE_5_COMPLETED') {
      return { x: 50, y: 50, visible: false };
    }

    switch (currentStep) {
      case 'SCENE_1_WA_NOTIF_H1':
        if (subStep === 0) return { x: 50, y: -10, visible: false }; // Layar awal kosong
        if (subStep === 1) return { x: 60, y: 20, visible: true }; // Bergerak ke banner notif yang baru muncul
        return { x: 50, y: 27, visible: true }; // Klik banner notifikasi

      case 'SCENE_1_WA_CHAT_H1':
        if (subStep === 0) return { x: 50, y: 32, visible: true };
        return { x: 50, y: 58, visible: true }; // Tepat di atas tombol link 📖 Portal Rencana Materi Sesi

      case 'SCENE_1_SELECT_CAPAIAN':
        if (subStep === 0) return { x: 50, y: 31, visible: true }; // Kursor tepat di atas Accordion Header Bab 1 saat tertutup
        if (subStep === 1) return { x: 90, y: 31, visible: true }; // Klik Accordion Header Bab 1 untuk membuka
        if (subStep === 2) return { x: 15, y: 43, visible: true }; // Bergerak ke checkbox 1
        if (subStep === 3) return { x: 15, y: 50, visible: true }; // Centang checkbox 1 (Tajwid: Nun Mati) -> Prioritas
        if (subStep === 4) return { x: 15, y: 55, visible: true }; // Centang checkbox 2 (Tahfidz: An-Naba) -> Prioritas
        return { x: 50, y: 95, visible: true }; // Substep 5: Klik tombol Simpan Rencana Ajar & Catatan Siaran

      case 'SCENE_2_WA_NOTIF_H2JAM':
        if (subStep === 0) return { x: 50, y: -10, visible: false }; // Layar jam 14:00 kosong awal
        if (subStep === 1) return { x: 60, y: 20, visible: true }; // Bergerak ke banner notif H-2 Jam yang baru muncul
        return { x: 60, y: 27, visible: true }; // Klik banner notifikasi H-2 Jam

      case 'SCENE_2_WA_CHAT_H2JAM':
        if (subStep === 0) return { x: 50, y: 27, visible: true };
        if (subStep === 1) return { x: 50, y: 46, visible: true }; // Bergerak menuju tombol magic link
        return { x: 50, y: 46, visible: true }; // Tepat di tengah tombol 🚀 Buka Cockpit Presensi Sesi (1-Klik)

      case 'SCENE_3_BRANCH_MENU':
        if (subStep === 0 || isBranchModalOpen) return { x: 50, y: 50, visible: false };
        if (targetBranchTab === 'QR_DINAMIS') return { x: 16, y: 23, visible: true }; // Tab 1 [QR]
        if (targetBranchTab === 'MANUAL') return { x: 39, y: 23, visible: true }; // Tab 2 [Manual]
        if (targetBranchTab === 'SCAN_KARTU') return { x: 62, y: 23, visible: true }; // Tab 3 [Kartu]
        if (targetBranchTab === 'EVALUATION') return { x: 84, y: 23, visible: true }; // Tab 4 [Jurnal]
        return { x: 50, y: 50, visible: false };

      case 'SCENE_3A_PRESENSI_QR':
      case 'SCENE_3A_QR_DINAMIS':
        if (subStep === 0) return { x: 50, y: 28, visible: true }; // Tombol Tampilkan QR Kelas
        if (subStep === 1) return { x: 50, y: 46, visible: true }; // Kotak Dynamic QR Code
        return { x: 50, y: 72, visible: true }; // Log kehadiran realtime

      case 'SCENE_3B_PRESENSI_MANUAL':
        if (subStep === 0) return { x: 57, y: 30.5, visible: true }; // Kursor tepat di atas tombol [Hadir] santri 1 (Ahmad Fauzi)
        if (subStep === 1) return { x: 57, y: 30.5, visible: true }; // Klik [Hadir] santri 1
        if (subStep === 2) return { x: 67.5, y: 40.5, visible: true }; // Bergerak & klik tombol [Izin] santri 2 (Budi Santoso)
        if (subStep === 3) return { x: 78, y: 48.5, visible: true }; // Bergerak & klik tombol [Sakit] santri 3 (Citra Lestari)
        return { x: 50, y: 87, visible: true };

      case 'SCENE_3C_SCAN_KARTU':
        if (subStep === 0) return { x: 50, y: 46, visible: true };
        if (subStep === 1) return { x: 50, y: 46, visible: true }; // Kamera scanner aktif
        return { x: 50, y: 46, visible: true };

      case 'SCENE_4_JURNAL_PENILAIAN':
        if (subStep === 0) return { x: 80, y: 32.5, visible: true }; // Kursor di atas Accordion Header Jurnal tertutup
        if (subStep === 1) return { x: 80, y: 32.5, visible: true }; // Klik Accordion Header untuk membuka
        if (subStep === 2) return { x: 75, y: 40.5, visible: true }; // Klik tombol status Capaian 1 (Belum Dinilai -> ⚡ Proses)
        if (subStep === 3) return { x: 75, y: 40.5, visible: true }; // Klik tombol status Capaian 1 (Proses -> ✓ Tuntas)
        if (subStep === 4) return { x: 52.5, y: 54.5, visible: true }; // Klik Skor Nilai [90] Capaian 1
        if (subStep === 5) return { x: 75, y: 63, visible: true }; // Klik tombol status Capaian 2 (Belum Dinilai -> ⚡ Proses)
        return { x: 50, y: 86, visible: true }; // Klik tombol Simpan Jurnal & Selesai Mengajar

      default:
        return { x: 50, y: 50, visible: true };
    }
  }, [currentStep, subStep, isBranchModalOpen, targetBranchTab]);

  // ─────────────────────────────────────────────────────────────
  // CENTRALIZED STATE MACHINE TIMELINE CONTROLLER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // CRITICAL: Jangan jalankan timer jika user belum mengklik tombol Mulai Panduan Interaktif atau sedang paused!
    if (!hasStartedTour || !isPlaying) return;
    if (isTimeLapseActive) return;

    // Pada SCENE_3_BRANCH_MENU saat modal sedang terbuka menanti pilihan user:
    // Hentikan timer (jangan auto-advance), tapi biarkan isPlaying=true agar voice over tetap mengalun bebas!
    if (currentStep === 'SCENE_3_BRANCH_MENU' && isBranchModalOpen && subStep === 0) {
      return;
    }

    // Pada SCENE_5_COMPLETED: hentikan timer (akhir panduan), biarkan isPlaying=true agar voice over selesai mengalun!
    if (currentStep === 'SCENE_5_COMPLETED') {
      return;
    }

    const baseInterval = 1400;
    const interval = Math.round(baseInterval / playbackSpeed);

    const timer = setTimeout(() => {
      // If waiting for voice over to finish, pause timer progression
      if (pendingTransitionRef.current !== null) {
        return;
      }

      // 1. SCENE_1_WA_NOTIF_H1
      if (currentStep === 'SCENE_1_WA_NOTIF_H1') {
        if (subStep === 0) {
          soundFx.playNotification();
          setSubStep(1);
        } else if (subStep === 1) {
          setSubStep(2);
        } else if (subStep === 2) {
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(3);
        } else {
          executeOrWait(() => {
            setCurrentStep('SCENE_1_WA_CHAT_H1');
            setSubStep(0);
          });
        }
      }

      // 2. SCENE_1_WA_CHAT_H1
      else if (currentStep === 'SCENE_1_WA_CHAT_H1') {
        if (subStep === 0) {
          setSubStep(1);
        } else if (subStep === 1) {
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(2);
        } else {
          executeOrWait(() => {
            setCurrentStep('SCENE_1_SELECT_CAPAIAN');
            setOpenPlanAccordion(null);
            setSubStep(0);
          });
        }
      }

      // 3. SCENE_1_SELECT_CAPAIAN (Portal Persiapan Ajar Sesi - Accordion)
      else if (currentStep === 'SCENE_1_SELECT_CAPAIAN') {
        if (subStep === 0) {
          setSubStep(1);
        } else if (subStep === 1) {
          // Klik Accordion Header -> buka accordion setelah VO 1 selesai
          executeOrWait(() => {
            setIsClicking(true);
            soundFx.playClick();
            setTimeout(() => setIsClicking(false), 250);
            setOpenPlanAccordion('bab-tajwid');
            setSubStep(2);
          });
        } else if (subStep === 2) {
          // Centang Capaian 1 (Tajwid) -> tandai Prioritas
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSelectedCapaian([1]);
          setSubStep(3);
        } else if (subStep === 3) {
          // Centang Capaian 2 (Tahfidz) -> tandai Prioritas
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSelectedCapaian([1, 2]);
          setSubStep(4);
        } else if (subStep === 4) {
          // Tunggu VO 2 selesai sebelum bergerak ke tombol Simpan
          executeOrWait(() => {
            setSubStep(5);
          });
        } else if (subStep === 5) {
          // Klik tombol Simpan Rencana Ajar & Catatan Siaran
          setIsClicking(true);
          soundFx.playActionComplete();
          setTimeout(() => setIsClicking(false), 250);
          triggerToast('Rencana Ajar Tersimpan!');
          executeOrWait(() => {
            setIsTimeLapseActive(true);
            setTimeLapseHours(24);
          });
        }
      }

      // 4. SCENE_2_WA_NOTIF_H2JAM (Notif WhatsApp H-2 Jam Muncul & Diklik)
      else if (currentStep === 'SCENE_2_WA_NOTIF_H2JAM') {
        if (subStep === 0) {
          soundFx.playNotification();
          setSubStep(1);
        } else if (subStep === 1) {
          setSubStep(2);
        } else if (subStep === 2) {
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(3);
        } else {
          executeOrWait(() => {
            setCurrentStep('SCENE_2_WA_CHAT_H2JAM');
            setSubStep(0);
          });
        }
      }

      // 5. SCENE_2_WA_CHAT_H2JAM (Magic Link 1-Klik /auth/direct)
      else if (currentStep === 'SCENE_2_WA_CHAT_H2JAM') {
        if (subStep === 0) {
          setSubStep(1);
        } else if (subStep === 1) {
          setSubStep(2);
        } else if (subStep === 2) {
          // Klik tombol Magic Link
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(3);
        } else {
          executeOrWait(() => {
            setCurrentStep('SCENE_3_BRANCH_MENU');
            setSubStep(0);
            setCockpitActiveTab('DYNAMIC_QR');
            setIsBranchModalOpen(true);
          });
        }
      }

      // 6. SCENE_3_BRANCH_MENU (Animasi tab setelah user memilih mode dari modal)
      else if (currentStep === 'SCENE_3_BRANCH_MENU') {
        if (subStep === 1) {
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(2);
        } else if (subStep === 2) {
          if (targetBranchTab === 'QR_DINAMIS') {
            setCockpitActiveTab('DYNAMIC_QR');
            setCurrentStep('SCENE_3A_PRESENSI_QR');
            setSubStep(0);
          } else if (targetBranchTab === 'MANUAL') {
            setCockpitActiveTab('MANUAL_SHEET');
            setCurrentStep('SCENE_3B_PRESENSI_MANUAL');
            setSubStep(0);
          } else if (targetBranchTab === 'SCAN_KARTU') {
            setCockpitActiveTab('BATCH_SCAN');
            setCurrentStep('SCENE_3C_SCAN_KARTU');
            setSubStep(0);
          } else if (targetBranchTab === 'EVALUATION') {
            setCockpitActiveTab('EVALUATION');
            setCurrentStep('SCENE_4_JURNAL_PENILAIAN');
            setSubStep(0);
          }
        }
      }

      // 7. SCENE_3A_PRESENSI_QR (Cockpit Tab DYNAMIC_QR)
      else if (currentStep === 'SCENE_3A_PRESENSI_QR' || currentStep === 'SCENE_3A_QR_DINAMIS') {
        if (subStep === 0) {
          executeOrWait(() => {
            setIsClicking(true);
            soundFx.playClick();
            setTimeout(() => setIsClicking(false), 250);
            setSubStep(1);
          });
        } else if (subStep === 1) {
          soundFx.playScanBeep();
          setSubStep(2);
        } else if (subStep === 2) {
          setSubStep(3);
        } else {
          executeOrWait(() => {
            setVisitedBranches((prev) => (prev.includes('QR_DINAMIS') ? prev : [...prev, 'QR_DINAMIS']));
            soundFx.playActionComplete();
            setCurrentStep('SCENE_3_BRANCH_MENU');
            setSubStep(0);
            setIsBranchModalOpen(true);
          });
        }
      }

      // 8. SCENE_3B_PRESENSI_MANUAL (Cockpit Tab MANUAL_SHEET)
      else if (currentStep === 'SCENE_3B_PRESENSI_MANUAL') {
        if (subStep === 0) {
          executeOrWait(() => {
            setSubStep(1);
          });
        } else if (subStep === 1) {
          // Klik Hadir santri 1
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setManualPresence((prev) => ({ ...prev, s1: 'HADIR' }));
          setSubStep(2);
        } else if (subStep === 2) {
          // Klik Izin santri 2
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setManualPresence((prev) => ({ ...prev, s2: 'IZIN' }));
          setSubStep(3);
        } else if (subStep === 3) {
          // Klik Sakit santri 3
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setManualPresence((prev) => ({ ...prev, s3: 'SAKIT' }));
          setSubStep(4);
        } else {
          executeOrWait(() => {
            setVisitedBranches((prev) => (prev.includes('MANUAL') ? prev : [...prev, 'MANUAL']));
            soundFx.playActionComplete();
            setCurrentStep('SCENE_3_BRANCH_MENU');
            setSubStep(0);
            setIsBranchModalOpen(true);
          });
        }
      }

      // 9. SCENE_3C_SCAN_KARTU (Cockpit Tab BATCH_SCAN)
      else if (currentStep === 'SCENE_3C_SCAN_KARTU') {
        if (subStep === 0) {
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setSubStep(1);
        } else if (subStep === 1) {
          soundFx.playScanBeep();
          triggerToast('Berhasil Scan: Muhammad Rizky (Hadir)');
          setSubStep(2);
        } else if (subStep === 2) {
          setSubStep(3);
        } else {
          executeOrWait(() => {
            setVisitedBranches((prev) => (prev.includes('SCAN_KARTU') ? prev : [...prev, 'SCAN_KARTU']));
            soundFx.playActionComplete();
            setCurrentStep('SCENE_3_BRANCH_MENU');
            setSubStep(0);
            setIsBranchModalOpen(true);
          });
        }
      }

      // 10. SCENE_4_JURNAL_PENILAIAN (Cockpit Tab EVALUATION)
      else if (currentStep === 'SCENE_4_JURNAL_PENILAIAN') {
        if (subStep === 0) {
          setSubStep(1);
        } else if (subStep === 1) {
          // Klik Accordion Header -> buka accordion
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setOpenJournalAccordion(true);
          executeOrWait(() => {
            setSubStep(2);
          });
        } else if (subStep === 2) {
          // Klik tombol status Capaian 1: Belum Dinilai -> ⚡ Proses (muncul catatan capaian)
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setJournalCapaianStatus((prev) => ({ ...prev, 1: 'IN_PROGRESS' }));
          executeOrWait(() => {
            setSubStep(3);
          });
        } else if (subStep === 3) {
          // Klik tombol status Capaian 1: Proses -> ✓ Tuntas (muncul nilai & catatan materi)
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setJournalCapaianStatus((prev) => ({ ...prev, 1: 'COMPLETED' }));
          setSubStep(4);
        } else if (subStep === 4) {
          // Klik skor nilai capaian 1 [90]
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setJournalScores((prev) => ({ ...prev, 1: 90 }));
          executeOrWait(() => {
            setSubStep(5);
          });
        } else if (subStep === 5) {
          // Klik tombol status Capaian 2: Belum Dinilai -> ⚡ Proses (2 jenis status aktif simultan)
          setIsClicking(true);
          soundFx.playClick();
          setTimeout(() => setIsClicking(false), 250);
          setJournalCapaianStatus((prev) => ({ ...prev, 2: 'IN_PROGRESS' }));
          executeOrWait(() => {
            setSubStep(6);
          });
        } else {
          setIsClicking(true);
          soundFx.playActionComplete();
          setTimeout(() => setIsClicking(false), 250);
          triggerToast('Jurnal Mengajar Disimpan! Status: COMPLETED');
          executeOrWait(() => {
            setCurrentStep('SCENE_5_COMPLETED');
            setSubStep(0);
            soundFx.playFanfare();
            triggerCelebrationConfetti(canvasRef.current);
          });
        }
      }
    }, interval);

    return () => clearTimeout(timer);
  }, [
    hasStartedTour,
    isPlaying,
    currentStep,
    subStep,
    playbackSpeed,
    triggerToast,
    isBranchModalOpen,
    targetBranchTab,
    isTimeLapseActive,
    executeOrWait,
  ]);

  // ─────────────────────────────────────────────────────────────
  // FULLSCREEN TIME-LAPSE COUNTDOWN (24 Jam -> 2 Jam)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimeLapseActive) return;
    playVoiceOver('SCENE_2_TIMELAPSE_COUNTDOWN_0');
    const hours = [24, 21, 18, 15, 12, 9, 6, 4, 2];
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < hours.length) {
        setTimeLapseHours(hours[idx]);
        soundFx.playClick();
      } else {
        clearInterval(interval);
        executeOrWait(() => {
          setIsTimeLapseActive(false);
          setCurrentStep('SCENE_2_WA_NOTIF_H2JAM');
          setSubStep(0);
          setIsPlaying(true);
          soundFx.playNotification();
        });
      }
    }, 140);

    return () => clearInterval(interval);
  }, [isTimeLapseActive, executeOrWait, playVoiceOver]);

  const handleRestartTour = () => {
    stopVoiceOver();
    pendingTransitionRef.current = null;
    soundFx.playClick();
    setCurrentStep('SCENE_1_WA_NOTIF_H1');
    setSubStep(0);
    setIsPlaying(true);
    setSelectedCapaian([]);
    setOpenPlanAccordion(null);
    setIsBranchModalOpen(true);
    setManualPresence({ s1: 'ALFA', s2: 'ALFA', s3: 'ALFA' });
    setOpenJournalAccordion(false);
    setJournalCapaianStatus({ 1: 'NOT_STARTED', 2: 'NOT_STARTED' });
    setJournalScores({ 1: 90, 2: 85 });
    setJournalNotes({
      1: 'Perlu bimbingan pada hukum Idgham Bighunnah',
      2: 'Hafalan lancar dan makhraj fasih',
    });
    setCockpitActiveTab('DYNAMIC_QR');
    setVisitedBranches([]);
    setIsTimeLapseActive(false);
    setTimeLapseHours(24);
  };

  const handleSelectBranch = (branch: BranchOption) => {
    stopVoiceOver();
    pendingTransitionRef.current = null;
    soundFx.playClick();
    if (branch === 'QR_DINAMIS') {
      setCockpitActiveTab('DYNAMIC_QR');
      setCurrentStep('SCENE_3A_PRESENSI_QR');
    } else if (branch === 'MANUAL') {
      setCockpitActiveTab('MANUAL_SHEET');
      setCurrentStep('SCENE_3B_PRESENSI_MANUAL');
    } else {
      setCockpitActiveTab('BATCH_SCAN');
      setCurrentStep('SCENE_3C_SCAN_KARTU');
    }
    setSubStep(0);
    setIsPlaying(true);
  };

  const handleContinueToJournal = () => {
    stopVoiceOver();
    pendingTransitionRef.current = null;
    soundFx.playClick();
    setCurrentStep('SCENE_4_JURNAL_PENILAIAN');
    setSubStep(0);
    setCockpitActiveTab('DYNAMIC_QR');
    setIsPlaying(true);
  };

  const currentMilestoneIndex = useMemo(() => {
    if (
      currentStep === 'SCENE_1_WA_NOTIF_H1' ||
      currentStep === 'SCENE_1_WA_CHAT_H1' ||
      currentStep === 'SCENE_1_SELECT_CAPAIAN'
    )
      return 0;
    if (
      currentStep === 'SCENE_2_WA_NOTIF_H2JAM' ||
      currentStep === 'SCENE_2_WA_CHAT_H2JAM'
    )
      return 1;
    if (
      currentStep === 'SCENE_3_BRANCH_MENU' ||
      currentStep === 'SCENE_3A_PRESENSI_QR' ||
      currentStep === 'SCENE_3A_QR_DINAMIS' ||
      currentStep === 'SCENE_3B_PRESENSI_MANUAL' ||
      currentStep === 'SCENE_3C_SCAN_KARTU'
    )
      return 2;
    return 3;
  }, [currentStep]);

  const handleJumpMilestone = (index: number) => {
    stopVoiceOver();
    pendingTransitionRef.current = null;
    soundFx.playClick();
    if (index === 0) {
      setCurrentStep('SCENE_1_WA_NOTIF_H1');
      setSubStep(0);
      setIsPlaying(true);
    } else if (index === 1) {
      setCurrentStep('SCENE_2_WA_NOTIF_H2JAM');
      setSubStep(0);
      setIsPlaying(true);
    } else if (index === 2) {
      setCurrentStep('SCENE_3_BRANCH_MENU');
      setSubStep(0);
      setCockpitActiveTab('DYNAMIC_QR');
      setIsBranchModalOpen(true);
      setIsPlaying(true);
    } else {
      setCurrentStep('SCENE_4_JURNAL_PENILAIAN');
      setSubStep(0);
      setCockpitActiveTab('DYNAMIC_QR');
      setIsPlaying(true);
    }
  };

  // ============================================================================
  // RENDER UI: SISTEM PENGAJIAN AUTHENTIC DESIGN
  // ============================================================================

  return (
    <div className="min-h-screen bg-role-pengajar text-slate-800 flex flex-col justify-between selection:bg-teal-100 selection:text-teal-900 relative overflow-x-hidden font-sans antialiased">
      {/* 2D Canvas Confetti Burst */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-50 w-full h-full"
      />

      {/* Floating System Toast */}
      {showToast.show && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-xl border border-teal-400 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{showToast.message}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          0. AUTOPLAY UNLOCKER & WELCOME OVERLAY MODAL
      ───────────────────────────────────────────────────────────── */}
      {!hasStartedTour && (
        <div className="fixed inset-0 z-[120] backdrop-blur-md bg-slate-950/80 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-center overflow-hidden">
            {/* Ambient decorative blurs */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>

            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Panduan Interaktif Pengajar
            </h2>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Pelajari alur persiapan mengajar malam H-1, akses Magic Link H-2 jam, presensi santri 3 mode (QR, Manual, Kartu), dan penilaian jurnal capaian secara interaktif.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-4 text-left">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 text-xs">
                  🎙️
                </div>
                <div>
                  <div className="font-bold text-[10.5px] text-slate-900">Voice Over Studio</div>
                  <div className="text-[9.5px] text-slate-500">ElevenLabs Narator</div>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs">
                  🔔
                </div>
                <div>
                  <div className="font-bold text-[10.5px] text-slate-900">Sound FX Interaktif</div>
                  <div className="text-[9.5px] text-slate-500">Audio Synthesizer</div>
                </div>
              </div>
            </div>

            {/* CTA Button (Autoplay Unlocker) */}
            <button
              onClick={handleStartInteractiveTour}
              className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition-all transform active:scale-98 cursor-pointer"
            >
              <span>Mulai Panduan Interaktif</span>
            </button>

            <p className="text-[10px] text-slate-400 mt-2">
              Membuka izin audio browser & simulasi otomatis
            </p>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FULLSCREEN BACKBLUR TIME-LAPSE COUNTDOWN (24 Jam -> 2 Jam)
      ───────────────────────────────────────────────────────────── */}
      {isTimeLapseActive && (
        <div className="fixed inset-0 z-[110] backdrop-blur-xl bg-slate-950/85 flex flex-col items-center justify-center p-4 text-white text-center animate-fade-in">
          <div className="relative flex flex-col items-center max-w-sm w-full">
            <div className="w-16 h-16 rounded-3xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(20,184,166,0.35)]">
              <Clock className="w-8 h-8 text-teal-300 animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-300 bg-teal-950/80 px-3 py-1 rounded-full border border-teal-500/40 mb-2">
              Fast-Forward Waktu Berjalan
            </span>

            {/* Glowing Big Countdown Number */}
            <div className="flex items-baseline justify-center gap-2 my-1">
              <span className="text-8xl font-black font-mono tracking-tighter bg-gradient-to-br from-teal-200 via-emerald-300 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(45,212,191,0.6)]">
                {timeLapseHours}
              </span>
              <span className="text-xl font-black text-teal-200 tracking-wide uppercase">
                Jam
              </span>
            </div>

            <p className="text-sm font-bold text-slate-200 mt-1">
              Menuju Waktu Sesi Mengajar
            </p>

            <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
              Target mengajar H-1 tersimpan rapi. Sistem kini melompat maju ke fase <strong>H-2 Jam</strong> sebelum kelas dimulai untuk membuka tautan absensi!
            </p>

            {/* Progress Bar Animation */}
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-4 border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-150"
                style={{ width: `${Math.round(((24 - timeLapseHours) / 22) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FULLSCREEN BACKBLUR COCKPIT BRANCH MODAL (PILIH MODE PRESENSI)
      ───────────────────────────────────────────────────────────── */}
      {currentStep === 'SCENE_3_BRANCH_MENU' && isBranchModalOpen && (
        <div className="fixed inset-0 z-[100] backdrop-blur-md bg-slate-950/75 flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-5 shadow-2xl border border-teal-200/80 animate-scale-up space-y-3.5">
            <div className="text-center">
              <h3 className="text-base font-extrabold text-slate-900 mt-2">
                Pilih Mode Presensi yang Ingin Dipelajari
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Sistem Pengajian menyediakan 3 metode presensi fleksibel. Klik salah satu opsi di bawah ini:
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {/* Opsi 1: Dynamic QR Code */}
              <button
                onClick={() => handleSelectBranchFromModal('QR_DINAMIS')}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all hover:scale-[1.01] ${
                  visitedBranches.includes('QR_DINAMIS')
                    ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                    : 'bg-white hover:bg-teal-50/70 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">1. Dynamic QR Code</p>
                    <p className="text-[10px] text-slate-500">QR berganti tiap 15 detik di layar, santri scan via HP mandiri</p>
                  </div>
                </div>
                {visitedBranches.includes('QR_DINAMIS') && (
                  <span className="text-[9px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full shrink-0">
                    ✓ Selesai
                  </span>
                )}
              </button>

              {/* Opsi 2: Absensi Manual 1-Tap */}
              <button
                onClick={() => handleSelectBranchFromModal('MANUAL')}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all hover:scale-[1.01] ${
                  visitedBranches.includes('MANUAL')
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-white hover:bg-blue-50/70 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">2. Absensi Manual 1-Tap</p>
                    <p className="text-[10px] text-slate-500">Tandai Hadir, Izin, Sakit di tabel jika santri tidak bawa HP</p>
                  </div>
                </div>
                {visitedBranches.includes('MANUAL') && (
                  <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                    ✓ Selesai
                  </span>
                )}
              </button>

              {/* Opsi 3: Scan Kartu QR Santri */}
              <button
                onClick={() => handleSelectBranchFromModal('SCAN_KARTU')}
                className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all hover:scale-[1.01] ${
                  visitedBranches.includes('SCAN_KARTU')
                    ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
                    : 'bg-white hover:bg-purple-50/70 border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">3. Scan Kartu QR Santri</p>
                    <p className="text-[10px] text-slate-500">Kamera HP pengajar memindai fisik Kartu Syahriah santri</p>
                  </div>
                </div>
                {visitedBranches.includes('SCAN_KARTU') && (
                  <span className="text-[9px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full shrink-0">
                    ✓ Selesai
                  </span>
                )}
              </button>
            </div>

            {/* Tombol Lanjut ke Jurnal */}
            {visitedBranches.length >= 1 && (
              <button
                onClick={handleContinueToJournalFromModal}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition mt-2 animate-bounce"
              >
                <span>Lanjutkan ke Tab Jurnal Nilai</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          QA DEBUG TOOLBAR (TAHAP 1)
      ───────────────────────────────────────────────────────────── */}
      {isDebugMode && (
        <aside aria-label="QA Debug Toolbar" className="bg-slate-900 text-white border-b-2 border-amber-400 p-2.5 text-xs sticky top-0 z-50 shadow-xl">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded text-[10px] tracking-wide">
                QA DEBUG PANEL
              </span>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  isPlaying ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {isPlaying ? '⏸ Pause Timer' : '▶ Play Timer'}
              </button>
              <div className="text-slate-300 font-mono text-[11px] hidden md:flex items-center gap-2 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                <span>Step: <strong className="text-teal-300">{currentStep}</strong></span>
                <span>Sub: <strong className="text-amber-300">[{subStep}]</strong></span>
                <span>Cursor: <strong className="text-emerald-300">({cursorCoordinates.x}%, {cursorCoordinates.y}%)</strong></span>
              </div>
            </div>

            {/* SubStep selector */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold mr-1">SubStep:</span>
              {[0, 1, 2, 3, 4, 5, 6].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setIsPlaying(false);
                    setSubStep(s);
                  }}
                  className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs transition ${
                    subStep === s
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Hide Debug Button */}
            <button
              onClick={() => setIsDebugMode(false)}
              className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-[11px]"
            >
              ✕ Tutup
            </button>
          </div>

          {/* Quick jump to all 10 steps */}
          <div className="max-w-6xl mx-auto flex items-center gap-1 overflow-x-auto pt-2 pb-0.5 scrollbar-thin">
            {ALL_STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => handleDebugJump(s.id, 0)}
                className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap font-medium transition ${
                  currentStep === s.id
                    ? 'bg-teal-500 text-white font-bold shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. TOP PROGRESS STEPPER (4 TAHAPAN PROSES ASLI)
      ───────────────────────────────────────────────────────────── */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Simulasi Alur Mengajar Pengajar
              </h1>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 0, label: '1. Persiapan H-1' },
              { id: 1, label: '2. Pengingat H-2 Jam' },
              { id: 2, label: '3. Eksekusi Presensi' },
              { id: 3, label: '4. Jurnal Penilaian' },
            ].map((st) => {
              const isCurrent = currentMilestoneIndex === st.id;
              const isPassed = currentMilestoneIndex > st.id;

              return (
                <button
                  key={st.id}
                  onClick={() => handleJumpMilestone(st.id)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-md shadow-teal-600/20'
                      : isPassed
                      ? 'bg-teal-50 text-teal-700 border border-teal-200/80 hover:bg-teal-100/80'
                      : 'bg-white/80 text-slate-500 border border-slate-200/70 hover:bg-slate-50'
                  }`}
                >
                  {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. CENTRAL SCREEN: SMARTPHONE SIMULATION CONTAINER
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 py-1.5 sm:py-3 w-full overflow-hidden">
        <div className="relative w-full max-w-[345px] sm:max-w-[370px] h-[585px] sm:h-[615px] bg-slate-900 rounded-[2.2rem] sm:rounded-[2.6rem] border-[5px] sm:border-[6px] border-slate-800 shadow-[0_20px_50px_rgba(13,148,136,0.18),0_10px_25px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col justify-between select-none">
          {/* Dynamic Island / Status Bar */}
          <div className="h-8 shrink-0 flex justify-between items-center px-5 pt-1.5 text-slate-400 text-[10px] font-semibold pointer-events-none z-30">
            <span>
              {currentStep === 'SCENE_1_WA_NOTIF_H1' || currentStep === 'SCENE_1_WA_CHAT_H1'
                ? '19:30'
                : '14:00'}
            </span>
            <div className="w-16 h-3.5 bg-slate-800 rounded-full border border-slate-700/80 shadow-xs flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400/90 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Wifi className="w-3 h-3" />
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              PERCENTAGE-BASED VIRTUAL CURSOR
          ───────────────────────────────────────────────────────── */}
          {cursorCoordinates.visible && (
            <div
              className="absolute pointer-events-none z-50 transition-all ease-in-out"
              style={{
                left: `${cursorCoordinates.x}%`,
                top: `${cursorCoordinates.y}%`,
                transform: 'translate(-4px, -4px)',
                transitionDuration: `${Math.round(500 / playbackSpeed)}ms`,
              }}
            >
              <svg
                className={`w-7 h-7 text-slate-900 drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] transition-transform ${
                  isClicking ? 'scale-75' : 'scale-100'
                }`}
                viewBox="0 0 24 24"
                fill="#FFFFFF"
                stroke="#0F172A"
                strokeWidth="1.8"
              >
                <path d="M4 2l16 11.5-6.5 1.5 4 7-3 1.5-4-7-6.5 4V2z" />
              </svg>

              {isClicking && (
                <span className="absolute -top-3 -left-3 w-12 h-12 rounded-full bg-teal-400/50 border-2 border-teal-500 animate-ping pointer-events-none" />
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 1A: LOCKSCREEN / WA NOTIF H-1 (19:30 WIB)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_1_WA_NOTIF_H1' && (
            <div className="relative w-full flex-1 min-h-0 bg-gradient-to-b from-teal-950 via-slate-950 to-slate-950 p-4 pt-3 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="text-center mt-3">
                  <h2 className="text-4xl font-extralight tracking-tight text-white/90">19:30</h2>
                  <p className="text-[11px] text-teal-200 font-medium mt-0.5">Ahad, 24 Oktober</p>
                </div>

                {/* Animated WhatsApp Banner - Hidden at subStep 0, Drops down at subStep >= 1 */}
                <div
                  onClick={() => {
                    soundFx.playClick();
                    setCurrentStep('SCENE_1_WA_CHAT_H1');
                    setSubStep(0);
                  }}
                  className={`mt-6 p-3 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xl transition-all duration-700 ease-out flex items-start gap-2.5 cursor-pointer ${
                    subStep >= 1
                      ? 'translate-y-0 opacity-100 scale-100'
                      : '-translate-y-12 opacity-0 scale-90 pointer-events-none'
                  } ${subStep >= 2 ? 'ring-2 ring-teal-400 bg-white scale-[1.02]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <MessageCircle className="w-4 h-4 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-[#128C7E] uppercase tracking-wider">
                        WhatsApp • Baru saja
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5 truncate">Sistem Pengajian TPQ</h4>
                    <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                      ⏰ <strong>Jadwal Mengajar Besok (16:00 WIB)</strong>. Silakan tentukan indikator rencana
                      ajar di Portal Persiapan Sesi!
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center pb-3">
                <span className="text-[9px] text-teal-300/80 uppercase tracking-widest font-semibold">
                  {subStep >= 1 ? 'Sentuh notifikasi untuk membuka pesan' : 'Menunggu notifikasi masuk...'}
                </span>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 1B: WA CHAT H-1 (PAIRED MESSAGES: JADWAL & LINK AKSI)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_1_WA_CHAT_H1' && (
            <div className="relative w-full flex-1 min-h-0 bg-[#EFEAE2] flex flex-col justify-between overflow-hidden">
              {/* WhatsApp Header */}
              <div className="bg-[#008069] px-3.5 py-2 flex items-center justify-between text-white shadow-xs shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs border border-white/30">
                    TPQ
                  </div>
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-1 text-white">
                      Sistem Pengajian Bot
                      <ShieldCheck className="w-3 h-3 text-teal-200 fill-teal-200" />
                    </h4>
                    <p className="text-[9px] text-teal-100">Akun Resmi Sistem</p>
                  </div>
                </div>
              </div>

              {/* Chat Body: Dua Pesan Paired Asli Sistem */}
              <div className="flex-1 p-2.5 flex flex-col justify-start space-y-2 overflow-y-auto">
                <div className="self-center my-0.5 bg-white/80 border border-slate-200 text-slate-600 text-[9px] font-semibold px-2 py-0.5 rounded-md shadow-2xs">
                  Kemarin - 19:30
                </div>

                {/* Pesan 1: SCHEDULE_REMINDER_H1_TEACHER */}
                <div className="max-w-[92%] bg-white rounded-2xl rounded-tl-xs p-2.5 text-slate-800 text-[10px] shadow-sm border border-slate-200/60 leading-snug">
                  <p className="font-bold text-[#008069] text-[11px]">
                    *Assalamu&apos;alaikum Ustadz Ahmad Fauzi.*
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    Mengingatkan jadwal mengajar Anda besok:
                  </p>
                  <div className="my-1 p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[9px] text-slate-700 space-y-0.5">
                    <p>📚 <strong>Sesi:</strong> Pengajian Kelas Abu Bakar</p>
                    <p>🕒 <strong>Waktu:</strong> Senin, 16:00 - 17:30 WIB</p>
                    <p>📍 <strong>Tempat:</strong> Masjid Al-Ikhlas</p>
                    <p>👤 <strong>Status:</strong> Pengajar Utama</p>
                  </div>
                  <div className="text-right text-[8px] text-slate-400">19:30 ✓✓</div>
                </div>

                {/* Pesan 2: TEACHER_ACTION_LINKS_H1 */}
                <div className="max-w-[92%] bg-white rounded-2xl p-2.5 text-slate-800 text-[10px] shadow-sm border border-slate-200/60 leading-snug animate-slide-up">
                  <p className="font-bold text-slate-900 text-[11px]">
                    *Tautan Aksi Pengajar (H-1):*
                  </p>
                  <p className="text-slate-700 text-[10px] mt-0.5">
                    Tentukan target materi prioritas sebelum kelas dimulai:
                  </p>

                  {/* Tautan 1: Portal Rencana Ajar */}
                  <div className="mt-1.5 p-2 bg-teal-50 border-2 border-teal-400 rounded-xl flex items-center justify-between hover:bg-teal-100 transition shadow-2xs">
                    <div>
                      <p className="text-[11px] font-extrabold text-teal-900">
                        📖 Portal Rencana Materi Sesi
                      </p>
                      <p className="text-[9px] text-teal-700 font-mono font-medium">
                        pengajian.app/pengajar/sesi/tkn-781
                      </p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  </div>

                  {/* Tautan 2: Ajukan Guru Badal */}
                  <div className="mt-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between opacity-80">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-700">
                        🔄 Ajukan Guru Badal (Jika Berhalangan)
                      </p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        pengajian.app/badal/ajukan/bdl-102
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </div>
                  <div className="text-right text-[9px] text-slate-400 mt-1">19:30 ✓✓</div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 1C: PORTAL PERSIAPAN AJAR SESI (/pengajar/sesi/[token])
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_1_SELECT_CAPAIAN' && (
            <div className="relative w-full flex-1 min-h-0 bg-slate-50 text-slate-800 pt-3 px-3 pb-2 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header Portal Persiapan Sesi */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs mb-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-200 truncate">
                      Portal Persiapan Ajar Sesi
                    </span>
                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                      <Target className="w-2.5 h-2.5 text-indigo-600" />
                      <span>{selectedCapaian.length} Direncanakan</span>
                    </span>
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 mt-1 truncate">
                    Kelas Abu Bakar • Masjid Al-Ikhlas
                  </h3>
                  <p className="text-[9px] text-slate-500">
                    Pengajar: <strong>Ahmad Fauzi</strong> (Pengajar Utama)
                  </p>
                </div>

                <p className="text-[10px] text-slate-600 mb-1.5 font-medium">
                  Klik accordion materi untuk membuka capaian dan tentukan prioritas esok hari:
                </p>

                {/* Indikator Materi Accordion List */}
                <div className="space-y-1.5 mb-2">
                  {/* ACCORDION 1: Bab 1 Tajwid & Hafalan */}
                  <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs transition">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setOpenPlanAccordion(openPlanAccordion === 'bab-tajwid' ? null : 'bab-tajwid');
                      }}
                      className={`w-full p-2.5 flex items-center justify-between text-left transition ${
                        openPlanAccordion === 'bab-tajwid'
                          ? 'bg-teal-50/70 border-b border-teal-100'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                          📖
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            Bab 1: Ilmu Tajwid Praktis & Tahfidz
                          </p>
                          <p className="text-[9px] text-slate-500">2 Indikator Capaian Materi</p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          openPlanAccordion === 'bab-tajwid' ? 'rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </button>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        openPlanAccordion === 'bab-tajwid'
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="p-2 space-y-1.5 bg-slate-50/70 border-t border-slate-100">
                          {[
                            { id: 1, title: 'Tajwid: Hukum Nun Mati (Idgham & Ikhfa)', points: 15 },
                            { id: 2, title: 'Tahfidz: Hafalan Surat An-Naba 1-10', points: 20 },
                          ].map((item) => {
                            const isSelected = selectedCapaian.includes(item.id);

                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  soundFx.playClick();
                                  setSelectedCapaian((prev) =>
                                    prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                                  );
                                }}
                                className={`p-2 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-300 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:border-teal-200 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div
                                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 transition ${
                                        isSelected
                                          ? 'bg-amber-500 text-white font-black'
                                          : 'border border-slate-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && '✓'}
                                    </div>
                                    <span className="text-[11px] font-semibold text-slate-900 truncate">
                                      {item.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[8px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200">
                                      +{item.points} Poin
                                    </span>
                                    {isSelected && (
                                      <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-2xs animate-pulse">
                                        Prioritas
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACCORDION 2: Bab 2 Fiqih Ibadah */}
                  <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs transition">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setOpenPlanAccordion(openPlanAccordion === 'bab-fiqih' ? null : 'bab-fiqih');
                      }}
                      className={`w-full p-2.5 flex items-center justify-between text-left transition ${
                        openPlanAccordion === 'bab-fiqih'
                          ? 'bg-teal-50/70 border-b border-teal-100'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                          🕌
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            Bab 2: Fiqih Ibadah & Praktik Thaharah
                          </p>
                          <p className="text-[9px] text-slate-500">1 Indikator Capaian Materi</p>
                        </div>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          openPlanAccordion === 'bab-fiqih' ? 'rotate-180 text-teal-600' : ''
                        }`}
                      />
                    </button>

                    {openPlanAccordion === 'bab-fiqih' && (
                      <div className="p-2 space-y-1.5 bg-slate-50/50 animate-fade-in">
                        {[
                          { id: 3, title: 'Fiqih: Praktek Tata Cara Wudhu Sempurna', points: 10 },
                        ].map((item) => {
                          const isSelected = selectedCapaian.includes(item.id);

                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                soundFx.playClick();
                                setSelectedCapaian((prev) =>
                                  prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                                );
                              }}
                              className={`p-2 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-300 shadow-2xs'
                                  : 'bg-white border-slate-200 hover:border-teal-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div
                                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 transition ${
                                      isSelected
                                        ? 'bg-amber-500 text-white font-black'
                                        : 'border border-slate-300 bg-white'
                                    }`}
                                  >
                                    {isSelected && '✓'}
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-900 truncate">
                                    {item.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[8px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-200">
                                    +{item.points} Poin
                                  </span>
                                  {isSelected && (
                                    <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white shadow-2xs animate-pulse">
                                      Prioritas
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Catatan Siaran Pengajar (teacherBroadcastNote) */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs mb-2">
                  <label className="text-[9px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <MessageCircle className="w-3 h-3 text-teal-600" />
                    <span>Catatan Siaran untuk Wali Santri (Opsional):</span>
                  </label>
                  <textarea
                    rows={2}
                    value={teacherBroadcastNoteInput}
                    onChange={(e) => setTeacherBroadcastNoteInput(e.target.value)}
                    className="w-full text-[9px] p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-teal-500 leading-snug resize-none"
                  />
                </div>
              </div>

              {/* Tombol Simpan Rencana Ajar */}
              <button
                onClick={() => {
                  soundFx.playActionComplete();
                  triggerToast('Rencana Ajar Tersimpan!');
                  setIsTimeLapseActive(true);
                  setTimeLapseHours(24);
                }}
                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition shrink-0 mt-1 ${
                  selectedCapaian.length >= 1
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-teal-700/20 active:scale-98'
                    : 'bg-slate-200 text-slate-400'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>Simpan Rencana Ajar</span>
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 2A: LOCKSCREEN / WA NOTIF H-2 JAM (14:00 WIB)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_2_WA_NOTIF_H2JAM' && (
            <div className="relative w-full flex-1 min-h-0 bg-gradient-to-b from-teal-950 via-slate-950 to-slate-950 p-4 pt-3 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="text-center mt-3">
                  <h2 className="text-4xl font-extralight tracking-tight text-white/90">14:00</h2>
                  <p className="text-[11px] text-teal-200 font-medium mt-0.5">Ahad, 24 Oktober (Hari H)</p>
                </div>

                {/* Animated WhatsApp Banner H-2 Jam */}
                <div
                  onClick={() => {
                    soundFx.playClick();
                    setCurrentStep('SCENE_2_WA_CHAT_H2JAM');
                    setSubStep(0);
                  }}
                  className={`mt-6 p-3 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xl transition-all duration-700 ease-out flex items-start gap-2.5 cursor-pointer ${
                    subStep >= 1
                      ? 'translate-y-0 opacity-100 scale-100'
                      : '-translate-y-12 opacity-0 scale-90 pointer-events-none'
                  } ${subStep >= 2 ? 'ring-2 ring-teal-400 bg-white scale-[1.02]' : ''}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <MessageCircle className="w-4 h-4 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-[#128C7E] uppercase tracking-wider">
                        WhatsApp • Baru saja
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5 truncate">Sistem Pengajian TPQ</h4>
                    <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                      ⏰ <strong>PENGINGAT 2 JAM SESI MENGAJAR!</strong> Sesi Kelas Abu Bakar di Masjid Al-Ikhlas dimulai pukul 16:00. Buka tautan presensi sekarang.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center pb-3">
                <span className="text-[9px] text-teal-300/80 uppercase tracking-widest font-semibold">
                  {subStep >= 1 ? 'Sentuh notifikasi untuk membuka pesan' : 'Menunggu pengingat sesi...'}
                </span>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 2B: WA CHAT H-2 JAM (MAGIC LINK 1-KLIK /auth/direct)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_2_WA_CHAT_H2JAM' && (
            <div className="relative w-full flex-1 min-h-0 bg-[#EFEAE2] flex flex-col justify-between overflow-hidden">
              {/* WhatsApp Header */}
              <div className="bg-[#008069] px-3.5 py-2 flex items-center justify-between text-white shadow-xs shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs border border-white/30">
                    TPQ
                  </div>
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-1 text-white">
                      Sistem Pengajian Bot
                      <ShieldCheck className="w-3 h-3 text-teal-200 fill-teal-200" />
                    </h4>
                    <p className="text-[9px] text-teal-100">Akun Resmi Sistem</p>
                  </div>
                </div>
              </div>

              {/* Chat Body */}
              <div className="flex-1 p-2.5 flex flex-col justify-start space-y-2 overflow-y-auto">
                <div className="self-center my-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1.5 animate-fade-in">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Hari Ini - 2 Jam Sebelum Mengajar (14:00)</span>
                </div>

                {/* Pesan TEACHER_PRESENSI_LINK_2H */}
                <div className="max-w-[92%] bg-white rounded-2xl rounded-tl-xs p-2.5 text-slate-800 text-[10px] shadow-sm border border-slate-200/60 animate-slide-up leading-snug">
                  <p className="font-bold text-amber-700 text-[11px] mb-1">
                    ⏰ PENGINGAT 2 JAM MENJELANG SESI!
                  </p>
                  <p className="text-slate-700">
                    Sesi mengajar Anda akan dimulai pukul <strong>16:00 WIB</strong> di Masjid Al-Ikhlas.
                  </p>
                  <p className="text-slate-700 mt-1">
                    Klik tautan Magic Link di bawah untuk membuka ruang absensi kelas santri tanpa repot login:
                  </p>

                  {/* Magic Login Link */}
                  <div
                    onClick={() => {
                      soundFx.playClick();
                      setCurrentStep('SCENE_3_BRANCH_MENU');
                      setSubStep(0);
                      setIsBranchModalOpen(true);
                      setIsPlaying(true);
                    }}
                    className={`mt-2 p-2 bg-teal-50 border-2 rounded-xl flex items-center justify-between hover:bg-teal-100 cursor-pointer transition shadow-2xs ${
                      subStep >= 2
                        ? 'border-teal-500 ring-2 ring-teal-400 bg-teal-100/90 scale-[1.02]'
                        : 'border-teal-400'
                    }`}
                  >
                    <div>
                      <p className="text-[11px] font-extrabold text-teal-900">
                        🚀 Buka Cockpit Presensi Sesi (1-Klik)
                      </p>
                      <p className="text-[9px] text-teal-700 font-mono font-medium">
                        pengajian.app/auth/direct?target=presensi&tkn=auth-991
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  </div>
                  <div className="text-right text-[8px] text-slate-400 mt-1">14:00 ✓✓</div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 3: CLASSROOM COCKPIT 4 TAB (INTERACTIVE PAUSE POINT)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_3_BRANCH_MENU' && (
            <div className="relative w-full flex-1 min-h-0 bg-slate-50 p-3 pt-3 flex flex-col justify-between overflow-y-auto">
              {/* Latar Belakang ClassroomCockpit Terpadu */}
              <div className="space-y-1.5">
                {/* Header Info Sesi Cockpit */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Sesi Aktif • Kelas Abu Bakar
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      16:00 - 17:30 WIB
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Masjid Al-Ikhlas (3 Santri)</span>
                  </p>
                </div>

                {/* Segmented Control 4 Tab ClassroomCockpit */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-[10px] font-bold">
                  <button
                    onClick={() => handleSelectBranch('QR_DINAMIS')}
                    className="py-1 rounded-lg bg-white text-teal-800 shadow-2xs flex items-center justify-center gap-1 border border-teal-100 font-extrabold"
                  >
                    <QrCode className="w-3 h-3 text-teal-600" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('MANUAL')}
                    className="py-1 rounded-lg bg-white/70 hover:bg-white text-slate-700 flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    <span>Manual</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('SCAN_KARTU')}
                    className="py-1 rounded-lg bg-white/70 hover:bg-white text-slate-700 flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3 text-purple-600" />
                    <span>Kartu</span>
                  </button>
                  <button
                    onClick={handleContinueToJournal}
                    className="py-1 rounded-lg bg-white/70 hover:bg-white text-slate-700 flex items-center justify-center gap-1"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>Jurnal</span>
                  </button>
                </div>

                {/* Card Pengantar Mode Presensi (Opsi Lengkap Ada di Fullscreen Modal) */}
                <div className="bg-white p-3.5 rounded-2xl border border-teal-200 shadow-sm text-center space-y-2 mt-2">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto border border-teal-200">
                    <Target className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Ruang Kontrol Classroom Cockpit
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Pilih salah satu dari 3 mode presensi melalui jendela popup modal atau klik langsung tab menu di atas:
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setIsBranchModalOpen(true);
                      }}
                      className="w-full py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-300 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>Buka Modal Pilihan Mode Presensi</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tombol Lanjut ke Jurnal Nilai */}
              {visitedBranches.length >= 1 ? (
                <button
                  onClick={handleContinueToJournal}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-500 hover:to-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-700/25 transition mt-2 shrink-0 animate-bounce"
                >
                  <span>Lanjutkan ke Tab Jurnal Nilai</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <p className="text-center text-[9px] text-slate-500 italic bg-white/70 py-1 rounded-xl border border-slate-200 mt-2 shrink-0">
                  Pilih minimal 1 mode presensi untuk melanjutkan simulasi
                </p>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 3A: TAB DYNAMIC QR SIMULATION
          ───────────────────────────────────────────────────────── */}
          {(currentStep === 'SCENE_3A_PRESENSI_QR' || currentStep === 'SCENE_3A_QR_DINAMIS') && (
            <div className="relative w-full flex-1 min-h-0 bg-slate-50 text-slate-800 pt-3 px-3 pb-2 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header Info Sesi Cockpit */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs mb-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Sesi Aktif • Kelas Abu Bakar
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      16:00 - 17:30 WIB
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Masjid Al-Ikhlas (3 Santri)</span>
                  </p>
                </div>

                {/* Segmented Control 4 Tab ClassroomCockpit */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-[10px] font-bold mb-2">
                  <button
                    onClick={() => handleSelectBranch('QR_DINAMIS')}
                    className="py-1 rounded-lg bg-white text-teal-800 shadow-2xs border border-teal-200 font-extrabold flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3 h-3 text-teal-600" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('MANUAL')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    <span>Manual</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('SCAN_KARTU')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3 text-purple-600" />
                    <span>Kartu</span>
                  </button>
                  <button
                    onClick={handleContinueToJournal}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>Jurnal</span>
                  </button>
                </div>

                {/* Konten Tab Dynamic QR */}
                <button
                  className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition mb-2 ${
                    subStep >= 1
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Tampilkan QR Kelas</span>
                </button>

                {subStep >= 1 && (
                  <div className="p-2.5 bg-white rounded-2xl border border-teal-300 text-center animate-fade-in shadow-xs">
                    <div className="relative w-28 h-28 mx-auto bg-slate-50 p-1.5 rounded-xl flex items-center justify-center border border-slate-200">
                      <QrCode className="w-full h-full text-slate-900" />
                      <div className="absolute inset-0 border-2 border-teal-500 rounded-xl pointer-events-none animate-pulse" />
                    </div>

                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-bold">
                      <Clock className="w-3 h-3 animate-spin text-teal-600" />
                      <span>QR Berubah Dalam: 00:15</span>
                    </div>
                  </div>
                )}

                {subStep >= 2 && (
                  <div className="mt-2 space-y-1 animate-slide-up">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Log Kehadiran Realtime:
                    </p>
                    <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-[11px] shadow-2xs">
                      <span className="font-semibold text-slate-800">1. Ahmad Fauzi</span>
                      <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Hadir (via QR)
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-[11px] shadow-2xs">
                      <span className="font-semibold text-slate-800">2. Siti Aminah</span>
                      <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Hadir (via QR)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center text-[9px] text-slate-400 font-medium py-1">
                Kembali ke ruang ClassroomCockpit...
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 3B: TAB ABSENSI MANUAL (MANUAL_SHEET)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_3B_PRESENSI_MANUAL' && (
            <div className="relative w-full flex-1 min-h-0 bg-slate-50 text-slate-800 pt-3 px-3 pb-2 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header Info Sesi Cockpit */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs mb-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Sesi Aktif • Kelas Abu Bakar
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      16:00 - 17:30 WIB
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Masjid Al-Ikhlas (3 Santri)</span>
                  </p>
                </div>

                {/* Segmented Control 4 Tab ClassroomCockpit */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-[10px] font-bold mb-2">
                  <button
                    onClick={() => handleSelectBranch('QR_DINAMIS')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3 h-3 text-teal-600" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('MANUAL')}
                    className="py-1 rounded-lg bg-white text-teal-800 shadow-2xs border border-teal-200 font-extrabold flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    <span>Manual</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('SCAN_KARTU')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3 text-purple-600" />
                    <span>Kartu</span>
                  </button>
                  <button
                    onClick={handleContinueToJournal}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>Jurnal</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {[
                    { id: 's1', name: 'Ahmad Fauzi', nis: '001' },
                    { id: 's2', name: 'Budi Santoso', nis: '002' },
                    { id: 's3', name: 'Citra Lestari', nis: '003' },
                  ].map((st) => {
                    const status = manualPresence[st.id] || 'ALFA';

                    return (
                      <div
                        key={st.id}
                        className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs gap-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{st.name}</p>
                          <p className="text-[9px] text-slate-400">NIS: {st.nis}</p>
                        </div>

                        {/* Segmented Control 4 Status: Hadir, Izin, Sakit, Alfa */}
                        <div className="grid grid-cols-4 gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0 w-[140px]">
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              setManualPresence((prev) => ({ ...prev, [st.id]: 'HADIR' }));
                            }}
                            className={`py-1 text-[9px] font-extrabold rounded text-center transition ${
                              status === 'HADIR'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              setManualPresence((prev) => ({ ...prev, [st.id]: 'IZIN' }));
                            }}
                            className={`py-1 text-[9px] font-extrabold rounded text-center transition ${
                              status === 'IZIN'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              setManualPresence((prev) => ({ ...prev, [st.id]: 'SAKIT' }));
                            }}
                            className={`py-1 text-[9px] font-extrabold rounded text-center transition ${
                              status === 'SAKIT'
                                ? 'bg-orange-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Sakit
                          </button>
                          <button
                            onClick={() => {
                              soundFx.playClick();
                              setManualPresence((prev) => ({ ...prev, [st.id]: 'ALFA' }));
                            }}
                            className={`py-1 text-[9px] font-extrabold rounded text-center transition ${
                              status === 'ALFA'
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Alfa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 font-medium py-1">
                Kembali ke ruang ClassroomCockpit...
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 3C: TAB SCAN KARTU (BATCH_SCAN)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_3C_SCAN_KARTU' && (
            <div className="relative w-full flex-1 min-h-0 bg-slate-50 text-slate-800 pt-3 px-3 pb-2 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header Info Sesi Cockpit */}
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs mb-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Sesi Aktif • Kelas Abu Bakar
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      16:00 - 17:30 WIB
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>Masjid Al-Ikhlas (3 Santri)</span>
                  </p>
                </div>

                {/* Segmented Control 4 Tab ClassroomCockpit */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 rounded-xl text-[10px] font-bold mb-2">
                  <button
                    onClick={() => handleSelectBranch('QR_DINAMIS')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-3 h-3 text-teal-600" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('MANUAL')}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3 h-3 text-blue-600" />
                    <span>Manual</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('SCAN_KARTU')}
                    className="py-1 rounded-lg bg-white text-teal-800 shadow-2xs border border-teal-200 font-extrabold flex items-center justify-center gap-1"
                  >
                    <Camera className="w-3 h-3 text-purple-600" />
                    <span>Kartu</span>
                  </button>
                  <button
                    onClick={handleContinueToJournal}
                    className="py-1 rounded-lg text-slate-600 hover:bg-white/60 flex items-center justify-center gap-1"
                  >
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>Jurnal</span>
                  </button>
                </div>

                {/* Viewfinder Kamera Scanner Card */}
                <div className="relative w-full h-48 bg-slate-950 rounded-2xl border-2 border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
                  <div className="absolute inset-x-0 h-0.5 bg-teal-400 shadow-[0_0_12px_#2dd4bf] animate-bounce" />

                  <span className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                  <span className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                  <span className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                  <span className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-teal-400" />

                  {subStep >= 1 && (
                    <div
                      className={`w-40 p-2.5 bg-white text-slate-800 rounded-xl border-2 text-center shadow-2xl transition-all duration-500 animate-slide-up ${
                        subStep >= 2
                          ? 'border-teal-500 ring-2 ring-teal-300'
                          : 'border-slate-300'
                      }`}
                    >
                      <div className="w-10 h-10 mx-auto bg-slate-100 p-1 rounded-lg mb-1 border border-slate-200">
                        <QrCode className="w-full h-full text-slate-900" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-900">KARTU SANTRI TPQ</p>
                      <p className="text-[9px] font-bold text-teal-700">Muhammad Rizky</p>
                      <p className="text-[8px] text-slate-400">NIS: 202601</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 font-medium py-1">
                Kembali ke ruang ClassroomCockpit...
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 4: TAB JURNAL NILAI (REALTIME EVALUATION SHEET)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_4_JURNAL_PENILAIAN' && (
            <div ref={journalScrollRef} className="relative w-full flex-1 min-h-0 bg-slate-50 text-slate-800 pt-2 px-2.5 pb-20 flex flex-col justify-between overflow-y-auto">
              <div>
                {/* Header Info Sesi Cockpit */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-extrabold uppercase text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                      Sesi Aktif • Kelas Abu Bakar
                    </span>
                    <span className="text-[8.5px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      16:00 - 17:30 WIB
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                    <span>Masjid Al-Ikhlas (3 Santri)</span>
                  </p>
                </div>

                {/* 4 Tabs Segmented Control dengan Tab Jurnal Aktif */}
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200/80 rounded-lg text-[9px] font-bold mb-1">
                  <button
                    onClick={() => handleSelectBranch('QR_DINAMIS')}
                    className="py-1 rounded text-slate-600 hover:bg-white/60 flex items-center justify-center gap-0.5"
                  >
                    <QrCode className="w-2.5 h-2.5 text-teal-600" />
                    <span>QR</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('MANUAL')}
                    className="py-1 rounded text-slate-600 hover:bg-white/60 flex items-center justify-center gap-0.5"
                  >
                    <UserCheck className="w-2.5 h-2.5 text-blue-600" />
                    <span>Manual</span>
                  </button>
                  <button
                    onClick={() => handleSelectBranch('SCAN_KARTU')}
                    className="py-1 rounded text-slate-600 hover:bg-white/60 flex items-center justify-center gap-0.5"
                  >
                    <Camera className="w-2.5 h-2.5 text-purple-600" />
                    <span>Kartu</span>
                  </button>
                  <button
                    onClick={handleContinueToJournal}
                    className="py-1 rounded bg-white text-teal-800 shadow-2xs border border-teal-200 font-extrabold flex items-center justify-center gap-0.5"
                  >
                    <Award className="w-2.5 h-2.5 text-amber-600" />
                    <span>Jurnal (2)</span>
                  </button>
                </div>

                {/* Info Filter Santri Hadir Saja */}
                <div className="bg-teal-50 border border-teal-200 p-1 rounded-lg mb-1 flex items-center justify-between text-[9px] text-teal-900 font-medium">
                  <span className="truncate">✓ 2 Santri Hadir Siap Dinilai</span>
                  <span className="text-[8px] text-teal-700 shrink-0">(Izin/Sakit Disaring)</span>
                </div>

                {/* ACCORDION MATERI EVALUASI CAPAIAN & STATUS SIKLUS MULTI-KLIK */}
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs mb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setOpenJournalAccordion(!openJournalAccordion);
                    }}
                    className={`w-full p-2 flex items-center justify-between text-left transition ${
                      openJournalAccordion
                        ? 'bg-amber-50/70 border-b border-amber-200'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                        📖
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[11px] font-bold text-slate-900 truncate">
                            Materi: Bab 1 Tajwid & Tahfidz
                          </p>
                          <span className="text-[7px] font-extrabold uppercase px-1 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 shrink-0 whitespace-nowrap">
                            Prioritas
                          </span>
                        </div>
                        <p className="text-[8.5px] text-slate-500">2 Capaian Target Sesi Mengajar</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        openJournalAccordion ? 'rotate-180 text-amber-600' : ''
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      openJournalAccordion
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="p-1.5 space-y-1.5 bg-slate-50/70 border-t border-slate-100">
                        {/* Capaian 1: Tajwid */}
                        <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5 transition-all">
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-slate-900 truncate">
                                Tajwid: Hukum Nun Mati (Idgham & Ikhfa)
                              </p>
                              <p className="text-[8px] text-slate-500">
                                Target prioritas persiapan ajar H-1
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCycleCapaianStatus(1)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                                journalCapaianStatus[1] === 'COMPLETED'
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                                  : journalCapaianStatus[1] === 'IN_PROGRESS'
                                  ? 'bg-amber-500 text-white hover:bg-amber-600 border border-amber-600'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {journalCapaianStatus[1] === 'COMPLETED' ? (
                                <>
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>Tuntas</span>
                                </>
                              ) : journalCapaianStatus[1] === 'IN_PROGRESS' ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Proses</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Belum Dinilai</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Status IN_PROGRESS: Banner Informatif & Field Catatan Capaian */}
                          {journalCapaianStatus[1] === 'IN_PROGRESS' && (
                            <div className="space-y-1 pt-1 border-t border-amber-100">
                              <div className="p-1 rounded bg-amber-50/80 border border-amber-200/80 text-[8px] text-amber-900 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                                <span>Berlaku untuk <strong>2 santri (Proses)</strong></span>
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[8px] font-bold text-amber-900 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Catatan Kemajuan / Estafet Sesi:</span>
                                </label>
                                <input
                                  type="text"
                                  value={journalNotes[1] || 'Perlu bimbingan pada hukum Idgham Bighunnah'}
                                  onChange={(e) => setJournalNotes({ ...journalNotes, 1: e.target.value })}
                                  className="w-full text-[8.5px] px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50/70 text-amber-950 font-medium focus:outline-none"
                                  placeholder="Tulis catatan bimbingan santri..."
                                />
                              </div>
                            </div>
                          )}

                          {/* Status COMPLETED: Banner Informatif, Skor Nilai & Catatan Materi */}
                          {journalCapaianStatus[1] === 'COMPLETED' && (
                            <div className="space-y-1.5 pt-1 border-t border-emerald-100">
                              <div className="p-1 rounded bg-teal-50/80 border border-teal-200/80 text-[8px] text-teal-900 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                                <span>Berlaku untuk <strong>2 santri (Tuntas)</strong></span>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px] font-bold text-slate-700">
                                    Penilaian Capaian:
                                  </span>
                                  <span className="text-[8px] font-extrabold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300">
                                    Skor: {journalScores[1] || 90}
                                  </span>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {[75, 80, 85, 90, 95, 100].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => setJournalScores((prev) => ({ ...prev, 1: score }))}
                                      className={`py-0.5 text-center rounded text-[8.5px] font-bold transition-all ${
                                        (journalScores[1] || 90) === score
                                          ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[8px] font-bold text-slate-700 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-teal-600" />
                                  <span>Catatan Khusus (Opsional):</span>
                                </label>
                                <input
                                  type="text"
                                  value={journalNotes[1] || 'Alhamdulillah bacaan sangat lancar & makhraj tepat'}
                                  onChange={(e) => setJournalNotes({ ...journalNotes, 1: e.target.value })}
                                  className="w-full text-[8.5px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  placeholder="Tulis umpan balik ketuntasan materi..."
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Capaian 2: Tahfidz */}
                        <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5 transition-all">
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-slate-900 truncate">
                                Tahfidz: Hafalan Surat An-Naba 1-10
                              </p>
                              <p className="text-[8px] text-slate-500">
                                Kelancaran hafalan & ketepatan makhraj
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCycleCapaianStatus(2)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                                journalCapaianStatus[2] === 'COMPLETED'
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700'
                                  : journalCapaianStatus[2] === 'IN_PROGRESS'
                                  ? 'bg-amber-500 text-white hover:bg-amber-600 border border-amber-600'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {journalCapaianStatus[2] === 'COMPLETED' ? (
                                <>
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>Tuntas</span>
                                </>
                              ) : journalCapaianStatus[2] === 'IN_PROGRESS' ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Proses</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Belum Dinilai</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Status IN_PROGRESS: Banner Informatif & Field Catatan Capaian */}
                          {journalCapaianStatus[2] === 'IN_PROGRESS' && (
                            <div className="space-y-1 pt-1 border-t border-amber-100">
                              <div className="p-1 rounded bg-amber-50/80 border border-amber-200/80 text-[8px] text-amber-900 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                                <span>Berlaku untuk <strong>2 santri (Proses)</strong></span>
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[8px] font-bold text-amber-900 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Catatan Kemajuan / Estafet Sesi:</span>
                                </label>
                                <input
                                  type="text"
                                  value={journalNotes[2] || 'Hafalan lancar, perlu pengulangan ayat 6-10'}
                                  onChange={(e) => setJournalNotes({ ...journalNotes, 2: e.target.value })}
                                  className="w-full text-[8.5px] px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50/70 text-amber-950 font-medium focus:outline-none"
                                  placeholder="Tulis catatan bimbingan santri..."
                                />
                              </div>
                            </div>
                          )}

                          {/* Status COMPLETED: Banner Informatif, Skor Nilai & Catatan Materi */}
                          {journalCapaianStatus[2] === 'COMPLETED' && (
                            <div className="space-y-1.5 pt-1 border-t border-emerald-100">
                              <div className="p-1 rounded bg-teal-50/80 border border-teal-200/80 text-[8px] text-teal-900 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                                <span>Berlaku untuk <strong>2 santri (Tuntas)</strong></span>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px] font-bold text-slate-700">
                                    Penilaian Capaian:
                                  </span>
                                  <span className="text-[8px] font-extrabold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300">
                                    Skor: {journalScores[2] || 85}
                                  </span>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {[75, 80, 85, 90, 95, 100].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => setJournalScores((prev) => ({ ...prev, 2: score }))}
                                      className={`py-0.5 text-center rounded text-[8.5px] font-bold transition-all ${
                                        (journalScores[2] || 85) === score
                                          ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700'
                                          : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-emerald-50'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[8px] font-bold text-slate-700 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-teal-600" />
                                  <span>Catatan Khusus (Opsional):</span>
                                </label>
                                <input
                                  type="text"
                                  value={journalNotes[2] || 'Hafalan mutqin dan makhraj sangat fasih'}
                                  onChange={(e) => setJournalNotes({ ...journalNotes, 2: e.target.value })}
                                  className="w-full text-[8.5px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  placeholder="Tulis umpan balik ketuntasan materi..."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ringkasan Catatan Mengajar (teachingSummaryNotes) */}
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs mb-1">
                  <label className="text-[8px] font-bold text-slate-600 block mb-0.5">
                    Ringkasan Catatan Mengajar Sesi (teachingSummaryNotes):
                  </label>
                  <textarea
                    rows={1}
                    value={teachingSummaryNotes}
                    onChange={(e) => setTeachingSummaryNotes(e.target.value)}
                    className="w-full text-[8.5px] p-1 rounded border border-slate-200 bg-slate-50 resize-none font-medium text-slate-700 leading-tight"
                  />
                </div>
              </div>

              {/* Tombol Simpan Jurnal & Selesai Mengajar */}
              <button
                onClick={() => {
                  soundFx.playActionComplete();
                  triggerToast('Jurnal Mengajar Disimpan! Status: COMPLETED');
                  setCurrentStep('SCENE_5_COMPLETED');
                  setSubStep(0);
                  soundFx.playFanfare();
                  triggerCelebrationConfetti(canvasRef.current);
                }}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-teal-700/20 shrink-0 mt-1 active:scale-98"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Jurnal & Selesai Mengajar</span>
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              SCENE 5: COMPLETED (SESI RESMI SELESAI / STATUS COMPLETED)
          ───────────────────────────────────────────────────────── */}
          {currentStep === 'SCENE_5_COMPLETED' && (
            <div className="relative w-full flex-1 min-h-0 bg-white text-slate-800 p-3 pt-3 flex flex-col justify-between text-center overflow-y-auto">
              <div>
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/20 animate-bounce mb-1.5">
                  <Award className="w-6 h-6" />
                </div>

                <div className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  <Check className="w-3 h-3 text-teal-600" />
                  <span>Sesi Mengajar COMPLETED</span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                  Alhamdulillah! Anda Siap Mengajar 🎉
                </h3>

                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug px-1">
                  Anda telah menguasai alur sistem mengajar resmi secara end-to-end:
                </p>

                {/* 4 Tahapan Inti Sistem */}
                <div className="mt-2 space-y-1 text-left text-xs">
                  <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-700 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[9px]">
                      <strong>1. H-1 Persiapan Ajar:</strong> Tentukan materi prioritas & catatan siaran.
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-700 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[9px]">
                      <strong>2. H-2 Jam Magic Link:</strong> Masuk ClassroomCockpit 1-klik tanpa password.
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-700 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[9px]">
                      <strong>3. Presensi Multi-Mode:</strong> Dynamic QR, Manual, atau Scan Kartu.
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-1.5 text-slate-700 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="text-[9px]">
                      <strong>4. Jurnal Nilai:</strong> Prioritas di atas, skor & teachingSummaryNotes.
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-1 pt-2">
                <button
                  onClick={handleRestartTour}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi Tutorial dari Awal</span>
                </button>
                <Link
                  href="/dashboard"
                  className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Tutup & Kembali ke Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}


        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM PLAYER BAR & CONTROLS (SYSTEM PASTEL THEME)
      ───────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-3 sticky bottom-0 z-40 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tombol Play/Pause & Restart */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setIsPlaying(!isPlaying);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold flex items-center gap-2 shadow-md shadow-teal-700/20 transition active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Jeda Simulasi' : 'Lanjutkan Putar'}</span>
            </button>

            <button
              onClick={handleRestartTour}
              title="Ulangi dari Awal"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Kecepatan Putar (1x vs 1.5x) */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <button
                onClick={() => setPlaybackSpeed(1)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition ${
                  playbackSpeed === 1 ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1x
              </button>
              <button
                onClick={() => setPlaybackSpeed(1.5)}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition ${
                  playbackSpeed === 1.5 ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1.5x
              </button>
            </div>
          </div>

          {/* Indikator Status Cabang & Audio Controls */}
          <div className="flex items-center gap-2 sm:gap-3 text-slate-600">
            <span className="hidden sm:inline">
              Mode Presensi:{' '}
              <strong className="text-teal-700">{visitedBranches.length}/3</strong>
            </span>

            {/* Toggle Voice Over */}
            <button
              onClick={() => {
                soundFx.playClick();
                setVoiceOverEnabled(!voiceOverEnabled);
              }}
              title={voiceOverEnabled ? 'Matikan Voice Over (ElevenLabs)' : 'Nyalakan Voice Over (ElevenLabs)'}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                voiceOverEnabled
                  ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                  : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {voiceOverEnabled ? <Mic className="w-3.5 h-3.5 text-teal-600" /> : <MicOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline font-bold">VO</span>
              <span className="text-[10px]">{voiceOverEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Toggle Sound FX */}
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) soundFx.playClick();
              }}
              title={soundEnabled ? 'Matikan Efek Suara (SFX)' : 'Nyalakan Efek Suara (SFX)'}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline font-bold">SFX</span>
              <span className="text-[10px]">{soundEnabled ? 'ON' : 'OFF'}</span>
            </button>


          </div>
        </div>
      </footer>
    </div>
  );
}
