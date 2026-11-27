import React, { useId } from 'react';

interface DecorationProps {
  color?: string;
  className?: string;
}

const MANDALA_ANGLES_8 = [0, 45, 90, 135, 180, 225, 270, 315];
const MANDALA_ANGLES_12 = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const MANDALA_ANGLES_16 = [
  0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5,
  180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5,
];

/**
 * Large translucent geometric Islamic mandala backdrop placed on the top-right canvas edge.
 */
export function IslamicMandalaBackdrop({
  color = '#059669',
  className = '',
}: DecorationProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `mandala-mask-grad-${uid}`;
  const maskId = `mandala-mask-${uid}`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none fixed top-[72px] -right-24 sm:top-14 sm:-right-20 w-[300px] h-[300px] sm:w-[375px] sm:h-[375px] z-0 ${className}`}
    >
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="62%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="88%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="400">
            <rect width="400" height="400" fill={`url(#${gradId})`} />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          <g transform="translate(200 200)" fill="none" stroke={color}>
            {/* Outer delicate concentric rings */}
            <circle r="174" strokeWidth="1" strokeOpacity="0.18" strokeDasharray="3 5" />
            <circle r="158" strokeWidth="1.3" strokeOpacity="0.24" />
            <circle r="122" strokeWidth="1.15" strokeOpacity="0.24" />
            <circle r="84" strokeWidth="1.3" strokeOpacity="0.26" />
            <circle r="46" strokeWidth="1.1" strokeOpacity="0.24" />

            {/* 16-fold outer pointed Islamic arch petals */}
            {MANDALA_ANGLES_16.map((angle) => (
              <g key={`p16-${angle}`} transform={`rotate(${angle})`}>
                <path
                  d="M 0,-122 C 15,-138 15,-148 0,-160 C -15,-148 -15,-138 0,-122 Z"
                  strokeWidth="1.25"
                  strokeOpacity="0.25"
                  fill={color}
                  fillOpacity="0.03"
                />
                <path
                  d="M 0,-84 C 12,-98 12,-110 0,-122 C -12,-110 -12,-98 0,-84 Z"
                  strokeWidth="1.2"
                  strokeOpacity="0.26"
                />
                <circle cx="0" cy="-140" r="1.9" fill={color} fillOpacity="0.22" stroke="none" />
              </g>
            ))}

            {/* 8-fold inner arabesque petals & interlaced curves */}
            {MANDALA_ANGLES_8.map((angle) => (
              <g key={`p8-${angle}`} transform={`rotate(${angle})`}>
                <path
                  d="M 0,-46 C 18,-60 18,-74 0,-90 C -18,-74 -18,-60 0,-46 Z"
                  strokeWidth="1.35"
                  strokeOpacity="0.28"
                  fill={color}
                  fillOpacity="0.045"
                />
                <path
                  d="M 0,-16 Q 10,-30 0,-46 Q -10,-30 0,-16 Z"
                  strokeWidth="1.1"
                  strokeOpacity="0.24"
                />
              </g>
            ))}

            <circle r="14" strokeWidth="1.25" strokeOpacity="0.28" fill={color} fillOpacity="0.04" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Ornamen Shamsa / Arabesque Islami yang memudar mulus dari kuadran kiri-atas kartu jadwal,
 * menjaga area detail jadwal bawah & siluet masjid kanan bawah tetap bersih dan terbaca.
 */
export function IslamicCardPattern({
  color = '#0d9488',
  className = '',
}: DecorationProps) {
  const uid = useId().replace(/:/g, '');
  const maskGradId = `card-ornament-grad-${uid}`;
  const maskId = `card-ornament-mask-${uid}`;
  const latticeId = `card-lattice-${uid}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 200"
      preserveAspectRatio="xMinYMin slice"
      className={`pointer-events-none select-none absolute inset-0 w-full h-full z-0 ${className}`}
    >
      <defs>
        {/* Mask radial di koordinat SVG global agar 360° ornamen kiri-atas muncul utuh dan memudar halus */}
        <radialGradient id={maskGradId} cx="26%" cy="22%" r="58%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0.68" />
          <stop offset="82%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="200">
          <rect width="360" height="200" fill={`url(#${maskGradId})`} />
        </mask>

        {/* Kisi bintang 8-sudut tipis di dalam mask kiri-atas saja */}
        <pattern id={latticeId} width="32" height="32" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="0.65" strokeOpacity="0.09">
            <path d="M16 2 L20 12 L30 16 L20 20 L16 30 L12 20 L2 16 L12 12 Z" />
            <circle cx="16" cy="16" r="3" />
          </g>
        </pattern>
      </defs>

      <g mask={`url(#${maskId})`}>
        {/* Lapisan 1: Tekstur bintang geometris halus memudar di area kiri-atas */}
        <rect width="360" height="200" fill={`url(#${latticeId})`} />

        {/* Lapisan 2: Ornamen Shamsa Islami 12-kelopak di kuadran kiri-atas */}
        <g transform="translate(96 42)" fill="none" stroke={color}>
          <circle r="118" strokeWidth="1.15" strokeOpacity="0.18" />
          <circle r="92" strokeWidth="1" strokeOpacity="0.18" />
          <circle r="62" strokeWidth="1.15" strokeOpacity="0.22" />
          <circle r="34" strokeWidth="1" strokeOpacity="0.20" />

          {/* 12-fold outer scalloped floral arches */}
          {MANDALA_ANGLES_12.map((angle) => (
            <g key={`o12-${angle}`} transform={`rotate(${angle})`}>
              <path
                d="M 0,-92 C 14,-104 14,-114 0,-124 C -14,-114 -14,-104 0,-92 Z"
                strokeWidth="1.15"
                strokeOpacity="0.22"
                fill={color}
                fillOpacity="0.025"
              />
              <path
                d="M 0,-62 C 11,-74 11,-84 0,-92 C -11,-84 -11,-74 0,-62 Z"
                strokeWidth="1.15"
                strokeOpacity="0.22"
              />
              <circle cx="0" cy="-106" r="1.5" fill={color} fillOpacity="0.20" stroke="none" />
            </g>
          ))}

          {/* 12-fold inner star petals */}
          {MANDALA_ANGLES_12.map((angle) => (
            <g key={`i12-${angle}`} transform={`rotate(${angle + 15})`}>
              <path
                d="M 0,-34 C 12,-46 12,-55 0,-62 C -12,-55 -12,-46 0,-34 Z"
                strokeWidth="1.1"
                strokeOpacity="0.22"
                fill={color}
                fillOpacity="0.035"
              />
              <path
                d="M 0,-11 Q 6,-22 0,-34 Q -6,-22 0,-11 Z"
                strokeWidth="0.95"
                strokeOpacity="0.20"
              />
            </g>
          ))}

          <circle r="10" strokeWidth="1.1" strokeOpacity="0.24" fill={color} fillOpacity="0.04" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Siluet masjid artistik semi-transparan di kanan bawah kartu jadwal:
 * - Menara tinggi di kiri dengan 2 balkon
 * - Kubah kecil kiri-tengah & kubah utama besar dengan deretan jendela kecil
 * - Cahaya (halo) lembut di belakang kubah utama
 * - Deretan lengkungan pintu (arcade) di bagian bawah
 */
export function MosqueWatermark({
  color = '#3b7a6c',
  className = '',
}: DecorationProps) {
  const uid = useId().replace(/:/g, '');
  const mainGradId = `mosque-main-${uid}`;
  const domeGradId = `mosque-dome-${uid}`;
  const haloGradId = `mosque-halo-${uid}`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 165"
      preserveAspectRatio="xMaxYMax meet"
      className={`pointer-events-none select-none absolute bottom-0 right-0 w-[171px] h-[118px] sm:w-[198px] sm:h-[136px] z-0 ${className}`}
    >
      <defs>
        {/* Halo lembut melingkar di belakang kubah utama */}
        <radialGradient id={haloGradId} cx="68%" cy="48%" r="42%">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="65%" stopColor={color} stopOpacity="0.05" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* Gradasi badan masjid & menara */}
        <linearGradient id={mainGradId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="55%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0.32" />
        </linearGradient>

        {/* Gradasi kubah utama (lebih terang di atas, lebih tegas di bawah) */}
        <linearGradient id={domeGradId} x1="35%" y1="0%" x2="65%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="60%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0.36" />
        </linearGradient>
      </defs>

      {/* Cahaya melingkar lembut di latar kubah */}
      <circle cx="164" cy="82" r="76" fill={`url(#${haloGradId})`} />

      {/* ===== MENARA TINGGI KIRI ===== */}
      <g fill={`url(#${mainGradId})`}>
        {/* Batang menara */}
        <rect x="34" y="54" width="12" height="111" />
        {/* Balkon atas */}
        <rect x="30" y="52" width="20" height="4.5" rx="1.5" />
        {/* Balkon tengah */}
        <rect x="31" y="84" width="18" height="4.5" rx="1.5" />
        {/* Kepala / kubah menara */}
        <path d="M34,52 C34,38 40,32 40,32 C40,32 46,38 46,52 Z" />
        {/* Tiang & bulan sabit kecil menara */}
        <rect x="39.4" y="25" width="1.2" height="8" />
        <circle cx="40" cy="24" r="1.4" />
      </g>

      {/* ===== KUBAH KECIL KIRI-TENGAH ===== */}
      <g fill={`url(#${mainGradId})`}>
        <path d="M62,102 C62,84 72,74 82,70 C92,74 102,84 102,102 Z" />
        <rect x="81.4" y="61" width="1.2" height="10" />
        <circle cx="82" cy="60" r="1.3" />
        {/* Leher kubah kiri */}
        <rect x="64" y="102" width="36" height="16" />
      </g>

      {/* ===== KUBAH UTAMA BESAR (KANAN-TENGAH) ===== */}
      <g fill={`url(#${domeGradId})`}>
        {/* Bentuk kubah bawang/runcing */}
        <path d="M116,96 C114,66 134,48 158,38 C182,48 202,66 200,96 Z" />
        {/* Tiang & bulan sabit utama */}
        <rect x="157.2" y="21" width="1.6" height="18" />
        <path d="M158,14 A4.5,4.5 0 1,0 162.5,20.5 A3.5,3.5 0 1,1 158,14 Z" />
        {/* Leher / drum kubah utama */}
        <rect x="118" y="96" width="80" height="20" />
      </g>

      {/* ===== KUBAH SAMPING KANAN (TERPOTONG DI TEPI) ===== */}
      <g fill={`url(#${mainGradId})`}>
        <path d="M208,108 C208,90 220,80 232,76 C237,78 240,82 240,88 L240,108 Z" />
        <rect x="208" y="108" width="32" height="57" />
      </g>

      {/* ===== BADAN / DINDING BAWAH MASJID ===== */}
      <g fill={`url(#${mainGradId})`}>
        {/* Dinding utama menyatu dari kiri ke kanan */}
        <rect x="24" y="116" width="216" height="49" />
        {/* Lis atap horizontal */}
        <rect x="22" y="113" width="218" height="4" rx="1" />
      </g>

      {/* ===== POTONGAN PUTIH (JENDELA KUBAH & ARCADE PINTU) ===== */}
      <g fill="#ffffff" fillOpacity="0.72">
        {/* Jendela kecil pada menara */}
        <rect x="38.2" y="64" width="3.6" height="10" rx="1.8" />
        <rect x="38.2" y="95" width="3.6" height="11" rx="1.8" />

        {/* Deretan jendela kecil di leher kubah kiri */}
        {[69, 76, 83, 90].map((x) => (
          <rect key={`wl-${x}`} x={x} y="105" width="3.8" height="7" rx="1.9" />
        ))}

        {/* Deretan 8 jendela kecil melengkung di leher kubah utama */}
        {[123, 132, 141, 150, 159, 168, 177, 186].map((x) => (
          <rect key={`wm-${x}`} x={x} y="100" width="4.5" height="9" rx="2.2" />
        ))}

        {/* Deretan jendela kecil di kubah kanan */}
        {[214, 222, 230].map((x) => (
          <rect key={`wr-${x}`} x={x} y="112" width="4" height="7" rx="2" />
        ))}

        {/* 3 lengkungan arcade di sisi kiri bawah */}
        {[34, 54, 74].map((x) => (
          <path
            key={`al-${x}`}
            d={`M${x},165 L${x},142 C${x},134 ${x + 12},134 ${x + 12},142 L${x + 12},165 Z`}
          />
        ))}

        {/* Pintu lengkung utama (besar) di bawah kubah utama */}
        <path d="M138,165 L138,136 C138,122 158,118 158,118 C158,118 178,122 178,136 L178,165 Z" />

        {/* Lengkungan arcade di sisi kanan bawah */}
        <path d="M214,165 L214,142 C214,134 228,134 228,142 L228,165 Z" />
      </g>
    </svg>
  );
}