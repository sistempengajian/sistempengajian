import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { withCache, cacheKey, CACHE_TTL } from '@/lib/cache';
import {
  ACTIVE_ROLE_COOKIE,
  normalizeRoleTabParam,
  type RoleTabId,
} from '@/lib/role-context';

export interface UserRoleSignals {
  hasChildren: boolean;
  hasHomeroomClasses: boolean;
  hasScheduleAssignments: boolean;
}

/**
 * Mengambil sinyal relasi peran implisit secara ringan & ter-cache (2 menit)
 * untuk akun pada layout 'lean' tanpa query lengkap seluruh profil anak/kelas.
 */
export async function getCachedUserRoleSignals(
  userId: string
): Promise<UserRoleSignals> {
  return withCache(
    cacheKey.roleSignals(userId),
    CACHE_TTL.USER_LEAN,
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          children: { select: { id: true }, take: 1 },
          homeroomClasses: { select: { id: true }, take: 1 },
          scheduleAssignments: { select: { id: true }, take: 1 },
        },
      });
      return {
        hasChildren: Boolean(user && user.children.length > 0),
        hasHomeroomClasses: Boolean(user && user.homeroomClasses.length > 0),
        hasScheduleAssignments: Boolean(
          user && user.scheduleAssignments.length > 0
        ),
      };
    }
  );
}

/**
 * Menentukan peran aktif global dengan prioritas:
 * 1. Query param `?role=` eksplisit yang sah (Keputusan 1: Opsi A)
 * 2. Cookie `sipanji_active_role` yang sah dimiliki user
 * 3. Peran default pertama yang tersedia untuk user
 */
export async function resolveGlobalActiveRole(params: {
  searchParamRole?: string | null;
  availableRoleIds: RoleTabId[];
}): Promise<{ activeRole: RoleTabId; source: 'query' | 'cookie' | 'default' }> {
  const { searchParamRole, availableRoleIds } = params;

  const normalizedQuery = normalizeRoleTabParam(searchParamRole);
  if (normalizedQuery && availableRoleIds.includes(normalizedQuery)) {
    return { activeRole: normalizedQuery, source: 'query' };
  }

  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(ACTIVE_ROLE_COOKIE)?.value;
    const normalizedCookie = normalizeRoleTabParam(rawCookie);
    if (normalizedCookie && availableRoleIds.includes(normalizedCookie)) {
      return { activeRole: normalizedCookie, source: 'cookie' };
    }
  } catch {
    // Abaikan jika dipanggil di luar request cookies context
  }

  return {
    activeRole: availableRoleIds[0] || 'student',
    source: 'default',
  };
}
