import React from 'react';

interface RubElHizbAnimationProps {
  className?: string;
  size?: number;
}

/**
 * Animasi Vektor SVG Murni: Geometri Bintang Segi-8 Generasi Penerus (Rub el Hizb)
 * - TEMA CERAH & BERSIH (White Ivory, Mint Emerald & Royal Gold)
 * - Berputar halus dengan multi-layer akselerasi GPU
 * - Pendar cahaya neon zamrud & emas di atas latar putih bersih
 * - 0 kB Library JS tambahan (Murni SVG + CSS Keyframes)
 * - 0 ms delay inisialisasi
 */
export default function RubElHizbAnimation({
  className = '',
  size = 76,
}: RubElHizbAnimationProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible drop-shadow-sm"
      >
        <defs>
          {/* Gradien Emas Royal Keemasan */}
          <linearGradient id="rubGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Gradien Zamrud Mint Segar & Cerah */}
          <linearGradient id="rubEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="50%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Gradien Putih Bersih Pusat Bintang */}
          <linearGradient id="rubCenterWhiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>

          {/* Pendar Sinar Radial Lembut Cerah */}
          <radialGradient id="rubGlowAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#A7F3D0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>{`
          @keyframes spinClockwise {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes spinCounterClockwise {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(-360deg);
            }
          }

          @keyframes breathePulse {
            0%, 100% {
              transform: scale(0.94);
              opacity: 0.92;
            }
            50% {
              transform: scale(1.04);
              opacity: 1;
            }
          }

          @keyframes auraGlowPulse {
            0%, 100% {
              transform: scale(0.9);
              opacity: 0.35;
            }
            50% {
              transform: scale(1.18);
              opacity: 0.75;
            }
          }

          .anim-rub-aura {
            transform-origin: 50% 50%;
            animation: auraGlowPulse 2.8s ease-in-out infinite;
          }

          .anim-orbit-ring {
            transform-origin: 50% 50%;
            animation: spinClockwise 16s linear infinite;
          }

          .anim-outer-star {
            transform-origin: 50% 50%;
            animation: spinCounterClockwise 22s linear infinite;
          }

          .anim-inner-star {
            transform-origin: 50% 50%;
            animation: breathePulse 2.4s ease-in-out infinite;
          }

          .anim-center-gem {
            transform-origin: 50% 50%;
            animation: spinClockwise 8s linear infinite;
          }
        `}</style>

        {/* 1. Aura Cahaya Pendar Lembut di Belakang Bintang */}
        <circle cx="50" cy="50" r="45" fill="url(#rubGlowAura)" className="anim-rub-aura" />

        {/* 2. Cincin Orbit Putus-Putus Geometris (Outer Dashed Ring) */}
        <g className="anim-orbit-ring">
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            opacity="0.85"
          />
          <circle
            cx="50"
            cy="50"
            r="41"
            stroke="#10B981"
            strokeWidth="0.8"
            strokeDasharray="2 8"
            opacity="0.6"
          />
          {/* Titik-titik satelit orbit emas */}
          <circle cx="50" cy="6" r="2.2" fill="url(#rubGoldGrad)" />
          <circle cx="50" cy="94" r="2.2" fill="url(#rubGoldGrad)" />
          <circle cx="6" cy="50" r="2.2" fill="url(#rubGoldGrad)" />
          <circle cx="94" cy="50" r="2.2" fill="url(#rubGoldGrad)" />
        </g>

        {/* 3. Bintang Segi-8 Luar (Dua Kotak Bersilangan Garis Emas) */}
        <g className="anim-outer-star">
          {/* Bujur sangkar 1 */}
          <rect
            x="22"
            y="22"
            width="56"
            height="56"
            rx="4"
            fill="none"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.8"
            opacity="0.9"
          />
          {/* Bujur sangkar 2 (Rotasi 45 Derajat) */}
          <rect
            x="22"
            y="22"
            width="56"
            height="56"
            rx="4"
            transform="rotate(45 50 50)"
            fill="none"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.8"
            opacity="0.9"
          />
        </g>

        {/* 4. Bintang Segi-8 Dalam (Isian Mint-Zamrud Segar yang Berdenyut) */}
        <g className="anim-inner-star">
          {/* Bujur sangkar 1 Isian */}
          <rect
            x="27"
            y="27"
            width="46"
            height="46"
            rx="3"
            fill="url(#rubEmeraldGrad)"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.2"
            opacity="0.95"
          />
          {/* Bujur sangkar 2 Isian (Rotasi 45 Derajat) */}
          <rect
            x="27"
            y="27"
            width="46"
            height="46"
            rx="3"
            transform="rotate(45 50 50)"
            fill="url(#rubEmeraldGrad)"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.2"
            opacity="0.95"
          />

          {/* Lingkaran Batas Dalam Bintang (PUTIH BERSIH ELEGAN) */}
          <circle
            cx="50"
            cy="50"
            r="19"
            fill="url(#rubCenterWhiteGrad)"
            stroke="url(#rubGoldGrad)"
            strokeWidth="1.6"
          />
        </g>

        {/* 5. Intan Geometris di Pusat Lingkaran (Center Diamond Emas Berkilau) */}
        <g className="anim-center-gem">
          <rect
            x="44"
            y="44"
            width="12"
            height="12"
            transform="rotate(45 50 50)"
            fill="url(#rubGoldGrad)"
          />
        </g>

        {/* Titik Zamrud Pusat di Dalam Intan */}
        <circle cx="50" cy="50" r="3.2" fill="#059669" />
        <circle cx="50" cy="50" r="1.4" fill="#FFFFFF" opacity="0.9" />
      </svg>
    </div>
  );
}
