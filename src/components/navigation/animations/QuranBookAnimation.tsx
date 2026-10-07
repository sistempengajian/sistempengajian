import React from 'react';

interface QuranBookAnimationProps {
  className?: string;
  size?: number;
}

/**
 * Animasi Vektor SVG Murni: Mushaf Al-Qur'an dengan Halaman Membalik Halus & Cahaya Pendar
 * - 0 kB Library JS tambahan (Murni SVG + CSS Keyframes)
 * - 60 FPS akselerasi hardware GPU
 * - 0 ms delay inisialisasi
 */
export default function QuranBookAnimation({
  className = '',
  size = 72,
}: QuranBookAnimationProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible drop-shadow-md"
      >
        <defs>
          {/* Gradien Emas Ornamen */}
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Gradien Hijau Zamrud Mushaf */}
          <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          {/* Gradien Kertas Mushaf */}
          <linearGradient id="pageGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEFCE8" />
            <stop offset="100%" stopColor="#F1F5F9" />
          </linearGradient>

          {/* Pendar Sinar Nur Ilahi */}
          <radialGradient id="holyAura" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#10B981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>
        </defs>

        <style>{`
          @keyframes pageFlip1 {
            0% {
              transform: rotateY(0deg) skewY(0deg);
              opacity: 0.95;
            }
            45% {
              transform: rotateY(-90deg) skewY(-8deg);
              opacity: 0.7;
            }
            50% {
              transform: rotateY(-90deg) skewY(-8deg);
              opacity: 0;
            }
            100% {
              transform: rotateY(-180deg) skewY(0deg);
              opacity: 0;
            }
          }

          @keyframes pageFlip2 {
            0%, 25% {
              transform: rotateY(0deg) skewY(0deg);
              opacity: 0;
            }
            30% {
              opacity: 0.95;
            }
            75% {
              transform: rotateY(-90deg) skewY(-8deg);
              opacity: 0.7;
            }
            80% {
              opacity: 0;
            }
            100% {
              transform: rotateY(-180deg) skewY(0deg);
              opacity: 0;
            }
          }

          @keyframes glowAura {
            0%, 100% {
              transform: scale(0.9);
              opacity: 0.45;
            }
            50% {
              transform: scale(1.15);
              opacity: 0.85;
            }
          }

          @keyframes sparkleTwinkle {
            0%, 100% {
              transform: scale(0.3) rotate(0deg);
              opacity: 0.2;
            }
            50% {
              transform: scale(1.2) rotate(45deg);
              opacity: 1;
            }
          }

          .anim-glow {
            transform-origin: 50% 45%;
            animation: glowAura 2.8s ease-in-out infinite;
          }

          .anim-page-1 {
            transform-origin: 50% 50%;
            animation: pageFlip1 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }

          .anim-page-2 {
            transform-origin: 50% 50%;
            animation: pageFlip2 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }

          .anim-sparkle-1 {
            transform-origin: 22% 25%;
            animation: sparkleTwinkle 2.2s ease-in-out infinite;
          }

          .anim-sparkle-2 {
            transform-origin: 78% 22%;
            animation: sparkleTwinkle 2.2s ease-in-out infinite 0.7s;
          }

          .anim-sparkle-3 {
            transform-origin: 50% 12%;
            animation: sparkleTwinkle 2.2s ease-in-out infinite 1.4s;
          }
        `}</style>

        {/* 1. Aura Cahaya Pendar di Belakang Mushaf */}
        <circle cx="50" cy="45" r="38" fill="url(#holyAura)" className="anim-glow" />

        {/* 2. Rehal / Alas Meja Lipat Mushaf */}
        {/* Kaki Kiri Rehal */}
        <path
          d="M24 74 L46 54 L50 58 L30 78 Z"
          fill="#064E3B"
          stroke="#047857"
          strokeWidth="1.2"
        />
        {/* Kaki Kanan Rehal */}
        <path
          d="M76 74 L54 54 L50 58 L70 78 Z"
          fill="#047857"
          stroke="#064E3B"
          strokeWidth="1.2"
        />
        {/* Ornamen Emas Kaki Rehal */}
        <circle cx="50" cy="56" r="3" fill="url(#goldGrad)" />

        {/* 3. Cover Belakang Mushaf (Hardcover Hijau Zamrud) */}
        <path
          d="M50 54 C38 52 24 55 18 53 L18 31 C24 33 38 30 50 32 Z"
          fill="url(#emeraldGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="1.2"
        />
        <path
          d="M50 54 C62 52 76 55 82 53 L82 31 C76 33 62 30 50 32 Z"
          fill="url(#emeraldGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="1.2"
        />

        {/* 4. Halaman Statis Kiri (Tebal) */}
        <path
          d="M50 52 C39 50 26 53 20 51 L20 29 C26 31 39 28 50 30 Z"
          fill="url(#pageGrad)"
          stroke="#CBD5E1"
          strokeWidth="0.8"
        />
        {/* Baris Garis Ayat Quran Kiri */}
        <line x1="26" y1="35" x2="44" y2="34" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="26" y1="40" x2="44" y2="39" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="26" y1="45" x2="40" y2="44" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* 5. Halaman Statis Kanan (Tebal) */}
        <path
          d="M50 52 C61 50 74 53 80 51 L80 29 C74 31 61 28 50 30 Z"
          fill="url(#pageGrad)"
          stroke="#CBD5E1"
          strokeWidth="0.8"
        />
        {/* Baris Garis Ayat Quran Kanan */}
        <line x1="56" y1="34" x2="74" y2="35" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="56" y1="39" x2="74" y2="40" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="60" y1="44" x2="74" y2="45" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* 6. Halaman Animasi Membalik 1 (Flipping Page 1) */}
        <g className="anim-page-1">
          <path
            d="M50 52 C62 50 73 52 79 50 L79 28 C73 30 62 28 50 30 Z"
            fill="#FEFCE8"
            stroke="url(#goldGrad)"
            strokeWidth="0.8"
          />
          <line x1="55" y1="34" x2="73" y2="35" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <line x1="55" y1="39" x2="73" y2="40" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </g>

        {/* 7. Halaman Animasi Membalik 2 (Flipping Page 2) */}
        <g className="anim-page-2">
          <path
            d="M50 52 C62 50 73 52 79 50 L79 28 C73 30 62 28 50 30 Z"
            fill="#FEFCE8"
            stroke="url(#goldGrad)"
            strokeWidth="0.8"
          />
          <line x1="55" y1="34" x2="73" y2="35" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <line x1="55" y1="39" x2="73" y2="40" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </g>

        {/* 8. Pita Pembatas Mushaf (Bookmark Ribbon Emas) */}
        <path
          d="M50 30 C50 42 48 58 45 68 L49 66 L53 68 C51 58 50 42 50 30 Z"
          fill="url(#goldGrad)"
        />

        {/* 9. Partikel Bintang / Kilau Cahaya (Twinkles) */}
        {/* Bintang Kiri Atas */}
        <g className="anim-sparkle-1">
          <path
            d="M22 25 L23.5 21 L25 25 L29 26.5 L25 28 L23.5 32 L22 28 L18 26.5 Z"
            fill="url(#goldGrad)"
          />
        </g>
        {/* Bintang Kanan Atas */}
        <g className="anim-sparkle-2">
          <path
            d="M78 22 L79.5 18 L81 22 L85 23.5 L81 25 L79.5 29 L78 25 L74 23.5 Z"
            fill="url(#goldGrad)"
          />
        </g>
        {/* Bintang Tengah Atas */}
        <g className="anim-sparkle-3">
          <path
            d="M50 12 L51.2 9 L52.4 12 L55.4 13.2 L52.4 14.4 L51.2 17.4 L50 14.4 L47 13.2 Z"
            fill="#34D399"
          />
        </g>
      </svg>
    </div>
  );
}
