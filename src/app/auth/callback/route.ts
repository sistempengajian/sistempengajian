import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const googleEmail = data.user.email?.toLowerCase().trim();

      if (googleEmail) {
        try {
          // Cari apakah akun user sudah ada di database Prisma
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: data.user.id },
                { email: googleEmail },
              ],
            },
          });

          if (existingUser) {
            // Jika akun ditemukan, pastikan email tersinkron
            if (existingUser.email !== googleEmail) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { email: googleEmail },
              });
            }

            // Jika status akun tidak aktif
            if (existingUser.status !== 'ACTIVE') {
              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${requestUrl.origin}/login?auth_error=${encodeURIComponent(
                  `Akun Anda (${existingUser.fullName}) sedang tidak aktif/ditangguhkan. Silakan hubungi pengurus.`
                )}`
              );
            }

            return NextResponse.redirect(`${requestUrl.origin}${next}`);
          } else {
            // Jika datang dari alur halaman profil (sedang menautkan email)
            if (next.includes('/profil')) {
              return NextResponse.redirect(`${requestUrl.origin}${next}?auth_status=success`);
            }

            // Jika mencoba login via Google dari halaman /login tetapi belum ditautkan
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${requestUrl.origin}/login?auth_error=${encodeURIComponent(
                `Akun Google (${googleEmail}) belum ditautkan ke akun Sistem Pengajian. Silakan login via WhatsApp lalu tautkan Google di halaman Profil.`
              )}`
            );
          }
        } catch (dbErr) {
          console.error('[Auth Callback Sync Error]:', dbErr);
        }
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    } else if (error) {
      console.error('[Auth Callback Exchange Error]:', error.message);
      return NextResponse.redirect(
        `${requestUrl.origin}/login?auth_error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
