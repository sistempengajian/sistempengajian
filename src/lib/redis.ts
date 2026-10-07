import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function isValidUpstashConfig(url?: string, token?: string): boolean {
  if (!url || !token) return false;
  if (!url.startsWith('https://')) return false;
  if (url.includes('your-upstash') || url.includes('example.com')) return false;
  if (token.includes('your-upstash') || token.includes('example')) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.upstash.io');
  } catch {
    return false;
  }
}

/**
 * Singleton Redis client for server-side usage (Node.js runtime).
 *
 * Uses @upstash/redis (not /cloudflare) so it works in Next.js API routes
 * and Server Components running on Node.js.
 *
 * The middleware uses @upstash/redis/cloudflare because it runs on the Edge runtime.
 * Both are included in the same @upstash/redis package.
 *
 * Returns null when Upstash is not configured, allowing graceful fallback.
 */
export const redis = isValidUpstashConfig(redisUrl, redisToken)
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null;
