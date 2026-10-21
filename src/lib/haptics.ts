/**
 * Utility Haptic Feedback aman untuk SSR & Cross-Browser (iOS Safari / Chromium / Firefox).
 * Menggunakan Web Vibration API dengan fallback graceful tanpa menimbulkan exception.
 */

function isVibrationSupported(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Getaran pendek 1x (40ms) untuk indikasi aksi sukses (misal: sukses presensi, simpan form, verifikasi).
 */
export function triggerHapticSuccess(): void {
  try {
    if (isVibrationSupported()) {
      navigator.vibrate(40);
    }
  } catch {
    // Graceful fallback jika browser memblokir vibration
  }
}

/**
 * Getaran berpola ganda ([30ms, jeda 50ms, 30ms]) untuk indikasi peringatan atau aksi gagal/error.
 */
export function triggerHapticWarning(): void {
  try {
    if (isVibrationSupported()) {
      navigator.vibrate([30, 50, 30]);
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Getaran sangat ringan (15ms) untuk interaksi taktil seperti tap, switch, toggle, atau tab change.
 */
export function triggerHapticLight(): void {
  try {
    if (isVibrationSupported()) {
      navigator.vibrate(15);
    }
  } catch {
    // Graceful fallback
  }
}
