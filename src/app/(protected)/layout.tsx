import React from 'react';
import AppHeader from '@/components/navigation/AppHeader';
import BottomNav from '@/components/navigation/BottomNav';
import { createClient } from '@/lib/supabase/server';

import { getRoleTheme } from '@/lib/theme';

import { redirect } from 'next/navigation';

import { getAuthUserLean } from '@/lib/auth';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authUser, dbUser } = await getAuthUserLean();

  if (!authUser) {
    redirect('/login');
  }

  if (!dbUser) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login?auth_error=' + encodeURIComponent('Sesi Anda tidak memiliki data profil terdaftar. Silakan login kembali.'));
  }

  if (dbUser.status !== 'ACTIVE') {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login?auth_error=' + encodeURIComponent(`Akun Anda (${dbUser.fullName}) saat ini sedang ${dbUser.status === 'SUSPENDED' ? 'ditangguhkan' : 'tidak aktif'}. Silakan hubungi pengurus.`));
  }

  const roleCodes: string[] = dbUser.roles.map((r) => r.role);
  const fullName: string = dbUser.fullName;

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
