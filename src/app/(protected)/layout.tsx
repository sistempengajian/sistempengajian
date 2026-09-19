import React from 'react';
import AppHeader from '@/components/navigation/AppHeader';
import BottomNav from '@/components/navigation/BottomNav';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

import { getRoleTheme } from '@/lib/theme';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let roleCodes: string[] = [];
  let fullName: string | undefined;

  if (authUser) {
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        fullName: true,
        roles: {
          select: { role: true },
        },
      },
    });
    roleCodes = dbUser?.roles.map((r) => r.role) || [];
    fullName = dbUser?.fullName;
  }

  const roleTheme = getRoleTheme(roleCodes);

  return (
    <div
      className={`min-h-screen ${roleTheme.bgGradient} text-slate-800 flex flex-col font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-300`}
    >
      {/* Redesigned Minimalist Header (Branding, Notifications Popover, Sleek Logout) */}
      <AppHeader
        roleTheme={roleTheme}
        roleCodes={roleCodes}
        userName={fullName}
      />

      {/* Main Content Body with Full Width for Seamless Section Backgrounds */}
      <main className="flex-1 w-full pb-28 sm:pb-24">
        {children}
      </main>

      {/* Dynamic Role-Aware Bottom Navigation Bar */}
      <BottomNav roleCodes={roleCodes} />
    </div>
  );
}
