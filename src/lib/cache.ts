import { redis } from '@/lib/redis';

/**
 * TTL constants (in seconds) for each cache category.
 * Keep values conservative to avoid serving stale data.
 */
export const CACHE_TTL = {
  USER_LEAN: 120,    // 2 minutes — roles, org (rarely changes mid-session)
  USER_FULL: 60,     // 1 minute — full profile with gamification, children, etc.
  SCHEDULE: 300,     // 5 minutes — upcoming schedule per user
  CURRICULUM: 600,   // 10 minutes — materials/checklist items (very stable)
  GENERATIONS: 900,  // 15 minutes — generation list (almost never changes)
} as const;

/**
 * Get-or-set cache helper.
 *
 * - Cache HIT  → returns data from Redis in < 5 ms (no DB round-trip)
 * - Cache MISS → runs `fetcher()`, stores result in Redis with TTL, returns result
 * - Redis down → transparently falls back to running `fetcher()` directly
 *
 * @param key     Unique cache key, e.g. `user:full:${userId}`
 * @param ttl     Time-to-live in seconds
 * @param fetcher Async function that fetches fresh data from the DB
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) {
    return fetcher();
  }

  // Attempt cache read
  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
  } catch (err) {
    // Redis read failed — bypass cache, do not block the request
    console.warn('[Cache] Redis get error, bypassing cache:', err);
    return fetcher();
  }

  // Cache miss — fetch fresh data
  const fresh = await fetcher();

  // Attempt cache write (fire-and-forget errors)
  try {
    // Redis.setex stores value with expiry.
    // We JSON.stringify so complex objects survive the round-trip.
    await redis.setex(key, ttl, JSON.stringify(fresh));
  } catch (err) {
    console.warn('[Cache] Redis set error:', err);
  }

  return fresh;
}

/**
 * Invalidate one or more cache keys.
 * Call this whenever the underlying data is mutated (e.g. profile update, user edit).
 *
 * @example
 * await invalidateCache(`user:lean:${userId}`, `user:full:${userId}`);
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn('[Cache] Redis del error:', err);
  }
}

/**
 * Build the canonical cache key for a user profile.
 * Centralising key construction prevents key mismatches between set and delete.
 */
export const cacheKey = {
  userLean: (userId: string) => `user:lean:${userId}`,
  userFull: (userId: string) => `user:full:${userId}`,
  schedule: (userId: string) => `schedule:upcoming:${userId}`,
};
