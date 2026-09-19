import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis/cloudflare';

// Helper to validate whether real Upstash Redis credentials are provided
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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isConfigured = isValidUpstashConfig(redisUrl, redisToken);

const redis = isConfigured && redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 attempts per min for auth
      prefix: 'ratelimit:auth',
    })
  : null;

const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'), // 60 req per min for APIs
      prefix: 'ratelimit:api',
    })
  : null;

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1';
  const pathname = request.nextUrl.pathname;

  // 1. Rate Limiting for Auth and API Routes (with safe try/catch fallback)
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    if (authRateLimiter) {
      try {
        const { success, limit, remaining, reset } = await authRateLimiter.limit(ip);
        if (!success) {
          return new NextResponse(
            JSON.stringify({
              error: 'Terlalu banyak percobaan masuk. Mohon tunggu beberapa saat.',
              limit,
              remaining,
              reset,
            }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': reset.toString() },
            }
          );
        }
      } catch (err) {
        console.warn('[RateLimiter] Skipping rate limiter due to error:', err);
      }
    }
  } else if (pathname.startsWith('/api/')) {
    if (apiRateLimiter) {
      try {
        const { success } = await apiRateLimiter.limit(ip);
        if (!success) {
          return new NextResponse(
            JSON.stringify({ error: 'Batas permintaan terlampaui. Coba lagi sebentar lagi.' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        console.warn('[RateLimiter] Skipping API rate limiter due to error:', err);
      }
    }
  }

  // 2. Supabase Session Refresh & Route Guard
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .woff, .woff2, .ico, .webmanifest)
     * - Service worker scripts (sw.js, swe-worker)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw\\.js|swe-worker|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf|ico|webmanifest)$).*)',
  ],
};
