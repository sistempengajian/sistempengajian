import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { withCache, cacheKey, CACHE_TTL } from '@/lib/cache';

/**
 * [LEAN] Versi ringan: hanya mengambil data esensial (roles, organisasi, generasi).
 * Gunakan di layout.tsx dan halaman yang hanya butuh auth guard + role check.
 *
 * Double-cached:
 * 1. React.cache() — deduplicates within a single SSR render pass (no extra calls)
 * 2. Redis (withCache) — skips the Prisma query entirely on warm requests (TTL: 2 menit)
 */
export const getAuthUserLean = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { authUser: null, dbUser: null, effectiveUserId: null };
  }

  // Build lookup args outside the cache fetcher so they're computed once
  const metaEmail = typeof authUser.user_metadata?.email === 'string'
    ? authUser.user_metadata.email.toLowerCase().trim()
    : null;
  const email = (authUser.email?.toLowerCase().trim() || metaEmail) || null;
  const usernamePrefix = email ? email.split('@')[0] : null;
  const phone = authUser.phone ? authUser.phone.replace(/[^0-9]/g, '') : null;

  const dbUser = await withCache(
    cacheKey.userLean(authUser.id),
    CACHE_TTL.USER_LEAN,
    () => prisma.user.findFirst({
      where: {
        OR: [
          { id: authUser.id },
          ...(email
            ? [
                { email: email },
                { email: { equals: email, mode: 'insensitive' as const } },
                ...(usernamePrefix ? [{ username: usernamePrefix }] : []),
              ]
            : []),
          ...(phone ? [{ phoneNumber: phone }] : []),
        ],
      },
      include: {
        roles: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            parentId: true,
          },
        },
        generation: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })
  );

  return {
    authUser,
    dbUser,
    effectiveUserId: dbUser?.id || authUser.id,
  };
});

/**
 * [FULL] Mengambil data pengguna aktif dari sesi Supabase dan mencocokkannya ke database Prisma
 * secara fleksibel (berdasarkan UUID Supabase, alamat email Google / manual, phone, atau username).
 *
 * Mengembalikan `effectiveUserId` yang merupakan ID database Prisma yang valid
 * agar seluruh relasi (jadwal, presensi, rapor, gamifikasi, kelas) dapat diakses dengan akurat.
 *
 * Gunakan HANYA di halaman yang membutuhkan data lengkap (dashboard, profil, presensi cockpit).
 *
 * Double-cached:
 * 1. React.cache() — deduplicates within a single SSR render pass
 * 2. Redis (withCache) — skips the heavy Prisma query on warm requests (TTL: 1 menit)
 */
export const getEffectiveAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { authUser: null, dbUser: null, effectiveUserId: null };
  }

  // Build lookup args outside the cache fetcher so they're computed once
  const metaEmail = typeof authUser.user_metadata?.email === 'string'
    ? authUser.user_metadata.email.toLowerCase().trim()
    : null;
  const email = (authUser.email?.toLowerCase().trim() || metaEmail) || null;
  const usernamePrefix = email ? email.split('@')[0] : null;
  const phone = authUser.phone ? authUser.phone.replace(/[^0-9]/g, '') : null;

  const dbUser = await withCache(
    cacheKey.userFull(authUser.id),
    CACHE_TTL.USER_FULL,
    () => prisma.user.findFirst({
      where: {
        OR: [
          { id: authUser.id },
          ...(email
            ? [
                { email: email },
                { email: { equals: email, mode: 'insensitive' as const } },
                ...(usernamePrefix ? [{ username: usernamePrefix }] : []),
              ]
            : []),
          ...(phone ? [{ phoneNumber: phone }] : []),
        ],
      },
      include: {
        organization: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        generation: true,
        roles: true,
        gamification: true,
        children: {
          include: {
            student: {
              include: {
                organization: {
                  include: {
                    parent: true,
                  },
                },
                generation: true,
                gamification: true,
              },
            },
          },
        },
        homeroomClasses: {
          include: {
            generation: true,
            organization: true,
          },
        },
        scheduleAssignments: {
          select: { id: true },
          take: 1,
        },
      },
    })
  );

  return {
    authUser,
    dbUser,
    effectiveUserId: dbUser?.id || authUser.id,
  };
});
