/**
 * Utilitas Pengaturan Jeda Waktu Pengiriman WhatsApp (Anti-Spam Pacing & Jitter Engine)
 * Mencegah nomor terdeteksi sebagai bot/spammer oleh WAHA dan WhatsApp/Meta.
 */

/**
 * Menghasilkan jeda waktu acak (jitter) dalam milidetik di antara rentang minMs dan maxMs.
 * Pola interval acak alami meniru perilaku pengetikan manusia dan memecah pola burst robotik.
 */
export async function sleepWithJitter(minMs = 1500, maxMs = 3000): Promise<number> {
  const safeMin = Math.max(0, minMs);
  const safeMax = Math.max(safeMin, maxMs);
  const delay = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}

/**
 * Jeda mikro khusus antara Pesan 1 (Rangkuman Sesi) dan Pesan 2 (Link Aksi/Presensi)
 * untuk nomor tujuan yang sama (1.200 ms - 2.000 ms).
 * Mencegah urutan pesan terbalik di HP penerima dan menghindari pemicuan sensor multi-pesan instan.
 */
export async function microDelayBetweenPairedMessages(minMs = 1200, maxMs = 2000): Promise<number> {
  return sleepWithJitter(minMs, maxMs);
}

/**
 * Memeriksa apakah waktu eksekusi telah mendekati batas aman waktu serverless runtime (Vercel).
 */
export function isApproachingTimeout(
  startTimeMs: number,
  maxAllowedMs = 12000,
  safetyBufferMs = 2500
): boolean {
  const elapsed = Date.now() - startTimeMs;
  return elapsed + safetyBufferMs >= maxAllowedMs;
}
