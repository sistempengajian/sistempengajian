import React from 'react';
import AppHeader from '@/components/navigation/AppHeader';
import BottomNav from '@/components/navigation/BottomNav';
import MicroCsatPrompt from '@/components/feedback/MicroCsatPrompt';
import FloatingRoleSwitcher from '@/components/navigation/FloatingRoleSwitcher';
import { ActiveRoleProvider } from '@/components/navigation/ActiveRoleContext';
import { IslamicMandalaBackdrop } from '@/components/ui/IslamicDecorations';
import { getRoleTheme } from '@/lib/theme';
import { requireProtectedAuth } from '@/lib/auth';
import { getCachedHeaderNotifications } from '@/app/(protected)/dashboard/queries';
import {
  buildGlobalRoleItems,
  getScopedRoleCodesForTab,
} from '@/lib/role-context';
import {
  getCachedUserRoleSignals,
  resolveGlobalActiveRole,
} from '@/lib/role-context-server';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dbUser } = await requireProtectedAuth();

  const roleCodes: string[] = dbUser.roles.map((r) => r.role);
  const fullName: string = dbUser.fullName;

  const roleSignals = await getCachedUserRoleSignals(dbUser.id);
  const { items: availableRoles } = buildGlobalRoleItems({
    roleCodes,
    hasChildren: roleSignals.hasChildren,
    hasHomeroomClasses: roleSignals.hasHomeroomClasses,
    hasScheduleAssignments: roleSignals.hasScheduleAssignments,
    generationId: dbUser.generationId,
    generationName: dbUser.generation?.name,
    organizationId: dbUser.organizationId,
  });

  const availableRoleIds = availableRoles.map((r) => r.id);
  const { activeRole } = await resolveGlobalActiveRole({ availableRoleIds });
  const effectiveRoleCodes =
    availableRoleIds.length > 0
      ? getScopedRoleCodesForTab(activeRole, roleCodes)
      : roleCodes;

  const roleTheme = getRoleTheme(effectiveRoleCodes);
  const notifications = await getCachedHeaderNotifications({
    userId: dbUser.id,
    roleCodes: effectiveRoleCodes,
    organizationId: dbUser.organizationId,
    parentOrgId: dbUser.organization?.parentId,
    generationId: dbUser.generationId,
  });

  return (
    <ActiveRoleProvider
      initialActiveRole={activeRole}
      availableRoles={availableRoles}
    >
      <div
        className={`relative min-h-screen overflow-x-clip ${roleTheme.bgGradient} text-slate-800 flex flex-col font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300`}
      >
        {/* Translucent Top-Right Geometric Islamic Mandala Backdrop */}
        <IslamicMandalaBackdrop color={roleTheme.mandalaColor} />

        {/* Accessibility: Skip to main content link for keyboard & screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[10000] focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:text-xs focus:font-bold focus:shadow-lg"
        >
          Langsung ke Konten Utama
        </a>

        {/* Redesigned Minimalist Header (Branding, Notifications Popover, Sleek Profile) */}
        <AppHeader
          roleTheme={roleTheme}
          roleCodes={effectiveRoleCodes}
          userName={fullName}
          notifications={notifications}
        />

        {/* Global Floating Multi-Role Switcher (0px mengambil ruang halaman) */}
        <FloatingRoleSwitcher />

        {/* Main Content Body with Full Width + Dynamic Floating Nav & PWA Banner Clearance */}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-10 flex-1 w-full pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(6.75rem+env(safe-area-inset-bottom))] transition-[padding] duration-200 focus:outline-none"
        >
          {children}
        </main>

        {/* Dynamic Role-Aware Bottom Navigation Bar (mendukung 0ms update dari ActiveRoleContext) */}
        <BottomNav roleCodes={roleCodes} />

        {/* Micro-CSAT 1-ketukan pasca-aksi penting (cooldown 14 hari) */}
        <MicroCsatPrompt userId={dbUser.id} />
      </div>
    </ActiveRoleProvider>
  );
}
