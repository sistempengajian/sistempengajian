'use client';

import React, {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ACTIVE_ROLE_COOKIE,
  ACTIVE_ROLE_COOKIE_MAX_AGE,
  isRoleAwarePathname,
  normalizeRoleTabParam,
  type GlobalRoleItem,
  type RoleTabId,
} from '@/lib/role-context';
import { trackRoleSwitch } from '@/lib/telemetry-client';

interface ActiveRoleContextValue {
  activeRole: RoleTabId;
  availableRoles: GlobalRoleItem[];
  isRoleSwitching: boolean;
  peekTrigger: number;
  switchGlobalRole: (newRole: RoleTabId) => void;
}

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

function writeActiveRoleCookie(role: RoleTabId): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${ACTIVE_ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; max-age=${ACTIVE_ROLE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Listener sinkronisasi query param `?role=` / `?view=` ke cookie global (Keputusan 1: Opsi A).
 * Dipisahkan dengan Suspense agar tidak memblokir SSR halaman.
 */
function RoleQuerySync({
  availableRoleIds,
  activeRole,
  ignoringUrlRoleRef,
  onSyncFromUrl,
}: {
  availableRoleIds: RoleTabId[];
  activeRole: RoleTabId;
  ignoringUrlRoleRef: React.MutableRefObject<boolean>;
  onSyncFromUrl: (roleFromUrl: RoleTabId) => void;
}) {
  const searchParams = useSearchParams();
  const roleParam = searchParams?.get('role') || searchParams?.get('view');

  useEffect(() => {
    if (!roleParam) {
      ignoringUrlRoleRef.current = false;
      return;
    }

    if (ignoringUrlRoleRef.current) {
      return;
    }

    const normalized = normalizeRoleTabParam(roleParam);
    if (normalized && availableRoleIds.includes(normalized) && normalized !== activeRole) {
      onSyncFromUrl(normalized);
    }
  }, [roleParam, availableRoleIds, activeRole, ignoringUrlRoleRef, onSyncFromUrl]);

  return null;
}

export function ActiveRoleProvider({
  initialActiveRole,
  availableRoles,
  children,
}: {
  initialActiveRole: RoleTabId;
  availableRoles: GlobalRoleItem[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [activeRole, setActiveRole] = useState<RoleTabId>(initialActiveRole);
  const [peekTrigger, setPeekTrigger] = useState<number>(0);
  const ignoringUrlRoleRef = useRef(false);

  const availableRoleIds = useMemo(
    () => availableRoles.map((r) => r.id),
    [availableRoles]
  );

  // Sinkronkan state lokal saat server render membawa cookie terbaru setelah router.refresh()
  useEffect(() => {
    if (availableRoleIds.includes(initialActiveRole)) {
      setActiveRole(initialActiveRole);
    }
  }, [initialActiveRole, availableRoleIds]);

  const handleSyncFromUrl = useCallback(
    (roleFromUrl: RoleTabId) => {
      writeActiveRoleCookie(roleFromUrl);
      setActiveRole(roleFromUrl);
      setPeekTrigger((c) => c + 1);
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  const switchGlobalRole = useCallback(
    (newRole: RoleTabId) => {
      if (!availableRoleIds.includes(newRole)) return;

      if (newRole !== activeRole) {
        trackRoleSwitch(activeRole, newRole);
      }

      writeActiveRoleCookie(newRole);
      setActiveRole(newRole);
      setPeekTrigger((c) => c + 1);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const hadRoleQuery = url.searchParams.has('role') || url.searchParams.has('view');

        if (hadRoleQuery) {
          ignoringUrlRoleRef.current = true;
          url.searchParams.delete('role');
          url.searchParams.delete('view');
          const cleanPath = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState({}, '', cleanPath);
          startTransition(() => {
            router.replace(cleanPath, { scroll: false });
            router.refresh();
          });
          return;
        }
      }

      startTransition(() => {
        router.refresh();
      });
    },
    [activeRole, availableRoleIds, router]
  );

  // Pastikan cookie awal tertulis ketika user belum punya cookie sama sekali (atau nilainya belum tersimpan)
  useEffect(() => {
    if (typeof document === 'undefined' || !isRoleAwarePathname(pathname)) return;
    if (!document.cookie.includes(`${ACTIVE_ROLE_COOKIE}=`)) {
      writeActiveRoleCookie(activeRole);
    }
  }, [activeRole, pathname]);

  const contextValue = useMemo<ActiveRoleContextValue>(
    () => ({
      activeRole,
      availableRoles,
      isRoleSwitching: isPending,
      peekTrigger,
      switchGlobalRole,
    }),
    [activeRole, availableRoles, isPending, peekTrigger, switchGlobalRole]
  );

  return (
    <ActiveRoleContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <RoleQuerySync
          availableRoleIds={availableRoleIds}
          activeRole={activeRole}
          ignoringUrlRoleRef={ignoringUrlRoleRef}
          onSyncFromUrl={handleSyncFromUrl}
        />
      </Suspense>
      {children}
    </ActiveRoleContext.Provider>
  );
}

/**
 * Hook opsional agar halaman klien tetap aman bahkan jika dirender di luar ActiveRoleProvider.
 */
export function useActiveRole(): ActiveRoleContextValue | null {
  return useContext(ActiveRoleContext);
}

/**
 * Shared hook untuk menyinkronkan tab peran di Client Wrapper (`roleDataMap`)
 * dengan perubahan role global dari FloatingRoleSwitcher (0ms) maupun URL SSR.
 */
export function useSyncedPageRole(
  initialActiveRole: RoleTabId,
  roleDataMap: Record<string, unknown>
): RoleTabId {
  const roleCtx = useActiveRole();
  const [activeRole, setActiveRole] = useState<RoleTabId>(initialActiveRole);
  const prevGlobalRoleRef = useRef<RoleTabId | undefined>(roleCtx?.activeRole);

  useEffect(() => {
    setActiveRole(initialActiveRole);
  }, [initialActiveRole]);

  useEffect(() => {
    if (!roleCtx) return;
    if (roleCtx.activeRole !== prevGlobalRoleRef.current) {
      prevGlobalRoleRef.current = roleCtx.activeRole;
      if (roleDataMap[roleCtx.activeRole]) {
        setActiveRole(roleCtx.activeRole);
      }
    }
  }, [roleCtx?.activeRole, roleDataMap, roleCtx]);

  return activeRole;
}
