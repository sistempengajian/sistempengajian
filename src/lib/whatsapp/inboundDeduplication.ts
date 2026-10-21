import { redis } from '@/lib/redis';

// =========================================================================
// DEDUPLIKASI INBOUND MESSAGE ID (TTL 10 Menit / 600 Detik)
// Mencegah double-reply akibat re-delivery webhook otomatis oleh WAHA / Gateway
// =========================================================================

const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 menit
const inMemoryDedupMap = new Map<string, number>();

/**
 * Memeriksa apakah pesan masuk dengan ID tertentu adalah duplikat.
 * Menggunakan arsitektur 2 lapis:
 * - Lapis 1: In-Memory Map (TTL 10 menit) dengan auto-pruning saat > 500 entri
 * - Lapis 2: Upstash Redis atomic SET ... NX EX 600 (jika Redis terkonfigurasi)
 *
 * @param messageId ID pesan unik dari gateway (stanzaId / payload.id)
 * @returns true jika pesan duplikat (sudah pernah diterima), false jika pesan baru
 */
export async function isDuplicateInboundMessage(messageId?: string | null): Promise<boolean> {
  if (!messageId || typeof messageId !== 'string') {
    return false;
  }

  const cleanId = messageId.trim();
  if (!cleanId) return false;

  const now = Date.now();

  // Pruning memory map jika sudah melebihi 500 entri untuk mencegah memory leak
  if (inMemoryDedupMap.size > 500) {
    for (const [key, timestamp] of inMemoryDedupMap.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        inMemoryDedupMap.delete(key);
      }
    }
  }

  // Lapis 1: Cek cache in-memory lokal
  const cachedTime = inMemoryDedupMap.get(cleanId);
  if (cachedTime && now - cachedTime < DEDUP_TTL_MS) {
    return true;
  }

  // Lapis 2: Cek & Set atomik di Upstash Redis (Distributed Lock / NX)
  if (redis) {
    try {
      // SET wa:dedup:msg:<messageId> 1 EX 600 NX
      // Mengembalikan 'OK' jika key baru berhasil dibuat, atau null jika key sudah ada
      const setResult = await redis.set(`wa:dedup:msg:${cleanId}`, '1', {
        ex: 600, // 10 menit TTL
        nx: true,
      });

      if (setResult === null) {
        // Berarti key sudah dibuat oleh instance serverless lain -> DUPLIKAT
        inMemoryDedupMap.set(cleanId, now);
        return true;
      }
    } catch (redisErr) {
      console.warn('[WhatsApp Inbound Dedup] Peringatan saat akses Upstash Redis:', redisErr);
      // Fallback tenang ke Lapis 1 tanpa memutus alur webhook
    }
  }

  // Pesan baru belum pernah diproses, catat di in-memory map
  inMemoryDedupMap.set(cleanId, now);
  return false;
}

/**
 * Helper untuk pengujian / simulasi pembersihan cache deduplikasi
 */
export function resetInboundDeduplicationCache(): void {
  inMemoryDedupMap.clear();
}
