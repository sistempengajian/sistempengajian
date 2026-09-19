import crypto from 'crypto';

/**
 * TOTP Engine for Dynamic QR Presensi
 * Menghasilkan token satu-waktu berbasis waktu (default 15 detik)
 * Menggunakan HMAC-SHA256 untuk mencegah pemalsuan, screenshot, atau titip absen
 */

export const TOTP_STEP_SECONDS = 15;

/**
 * Membuat secret unik untuk sesi presensi baru
 */
export function generateSessionSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Menghitung time step counter saat ini
 */
export function getCurrentCounter(stepSeconds: number = TOTP_STEP_SECONDS): number {
  return Math.floor(Date.now() / (stepSeconds * 1000));
}

/**
 * Menghitung sisa detik sebelum token saat ini berganti
 */
export function getRemainingSeconds(stepSeconds: number = TOTP_STEP_SECONDS): number {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return stepSeconds - (currentTimestamp % stepSeconds);
}

/**
 * Menghasilkan token HMAC-SHA256 untuk sesi dan counter tertentu
 */
export function computeTotpHash(sessionId: string, secret: string, counter: number): string {
  const payload = `${sessionId}:${counter}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8).toUpperCase();
}

/**
 * Menghasilkan payload lengkap yang akan dimasukkan ke dalam QR Code
 */
export function generateQrPayload(sessionId: string, secret: string, stepSeconds: number = TOTP_STEP_SECONDS): {
  qrContent: string;
  token: string;
  counter: number;
  remainingSeconds: number;
} {
  const counter = getCurrentCounter(stepSeconds);
  const token = computeTotpHash(sessionId, secret, counter);
  const remainingSeconds = getRemainingSeconds(stepSeconds);

  // Format QR yang ringkas dan aman: PENG_QR:<sessionId>:<counter>:<token>
  const qrContent = `PENG_QR:${sessionId}:${counter}:${token}`;

  return {
    qrContent,
    token,
    counter,
    remainingSeconds,
  };
}

/**
 * Memvalidasi token QR yang dikirimkan oleh santri
 * Mendukung toleransi 1 window sebelumnya (window - 1) untuk mengantisipasi jeda jaringan seluler
 */
export function verifyQrPayload(
  rawContent: string,
  expectedSessionId: string,
  secret: string,
  stepSeconds: number = TOTP_STEP_SECONDS
): { isValid: boolean; message: string } {
  if (!rawContent || !rawContent.startsWith('PENG_QR:')) {
    return { isValid: false, message: 'Format kode QR tidak valid untuk presensi.' };
  }

  const parts = rawContent.split(':');
  if (parts.length !== 4) {
    return { isValid: false, message: 'Format data kode QR tidak dikenali.' };
  }

  const [, sessionId, counterStr, candidateToken] = parts;
  const clientCounter = parseInt(counterStr, 10);

  if (sessionId !== expectedSessionId) {
    return { isValid: false, message: 'Kode QR bukan untuk sesi pengajian aktif ini.' };
  }

  if (isNaN(clientCounter)) {
    return { isValid: false, message: 'Penanda waktu kode QR rusak.' };
  }

  const currentCounter = getCurrentCounter(stepSeconds);

  // Periksa window saat ini (T0) atau window sebelumnya (T-1)
  const isCurrentWindowValid = computeTotpHash(sessionId, secret, currentCounter) === candidateToken;
  const isPrevWindowValid = computeTotpHash(sessionId, secret, currentCounter - 1) === candidateToken;

  if (isCurrentWindowValid || isPrevWindowValid) {
    return { isValid: true, message: 'Kode QR valid.' };
  }

  // Jika counter client sudah terlalu lampau (> 15-30 detik)
  if (clientCounter < currentCounter - 1) {
    return { isValid: false, message: 'Kode QR sudah kadaluarsa (melewati batas 15 detik). Silakan scan ulang layar kelas.' };
  }

  // Jika counter client berada di masa depan (indikasi manipulasi jam perangkat)
  if (clientCounter > currentCounter + 1) {
    return { isValid: false, message: 'Waktu perangkat Anda tidak sinkron dengan server.' };
  }

  return { isValid: false, message: 'Kode QR tidak cocok atau telah diperbarui.' };
}
