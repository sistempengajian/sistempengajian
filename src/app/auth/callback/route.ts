import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/profil';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const googleEmail = data.user.email;
      const userMeta = data.user.user_metadata;
      const fullName = userMeta?.full_name || userMeta?.name;

      if (googleEmail) {
        try {
          // Cari apakah akun user sudah ada di database Prisma
          const existingUser = await prisma.user.findUnique({
            where: { id: data.user.id },
          });

          if (existingUser) {
            // Update email dari Google
            await prisma.user.update({
              where: { id: data.user.id },
              data: {
                email: googleEmail,
                ...(existingUser.fullName ? {} : { fullName: fullName || 'Pengguna' }),
              },
            });
          } else {
            // Jika akun dicari berdasarkan email
            const userByEmail = await prisma.user.findUnique({
              where: { email: googleEmail },
            });

            if (userByEmail) {
              // Jika email cocok dengan akun yang sudah ada, sinkronkan auth id jika memungkinkan
              console.log('[Auth Callback] Email cocok dengan pengguna terdaftar:', userByEmail.id);
            }
          }
        } catch (dbErr) {
          console.error('[Auth Callback Sync Error]:', dbErr);
        }
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}?auth_status=success`);
    } else if (error) {
      console.error('[Auth Callback Exchange Error]:', error.message);
      return NextResponse.redirect(`${requestUrl.origin}${next}?auth_error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
