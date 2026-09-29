import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const action = requestUrl.searchParams.get('action');
  const next = requestUrl.searchParams.get('next') || '/dashboard';
  const queryLinkUid = requestUrl.searchParams.get('link_uid');

  // Ambil user id yang sedang menautkan akun jika ada dari cookie atau query
  const cookieStore = await cookies();
  const cookieLinkUid = cookieStore.get('pengajian_link_uid')?.value;
  const linkUid = queryLinkUid || cookieLinkUid;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user) {
      const googleEmail = data.user.email?.toLowerCase().trim();

      if (googleEmail) {
        try {
          const supabaseAdmin = createAdminClient();

          // -------------------------------------------------------------
          // SKENARIO 1: Alur Penautan Akun (User menekan "Tautkan" di Profil)
          // -------------------------------------------------------------
          if (action === 'link' || linkUid) {
            let targetUser = null;

            if (linkUid) {
              targetUser = await prisma.user.findUnique({
                where: { id: linkUid },
              });
            }

            // Jika tidak ada linkUid, cari user berdasarkan session saat ini atau email
            if (!targetUser) {
              targetUser = await prisma.user.findFirst({
                where: {
                  OR: [
                    { id: data.user.id },
                    { email: googleEmail },
                    { email: { equals: googleEmail, mode: 'insensitive' } },
                  ],
                },
              });
            }

            if (targetUser) {
              // Simpan email Google ke database pengguna di Prisma
              await prisma.user.update({
                where: { id: targetUser.id },
                data: { email: googleEmail },
              });

              const response = NextResponse.redirect(`${requestUrl.origin}/profil?auth_status=success`);
              response.cookies.delete('pengajian_link_uid');
              return response;
            } else {
              const response = NextResponse.redirect(`${requestUrl.origin}/profil?auth_status=success`);
              response.cookies.delete('pengajian_link_uid');
              return response;
            }
          }

          // -------------------------------------------------------------
          // SKENARIO 2: Alur Login Akun (User menekan "Lanjutkan dengan Google" di Login)
          // -------------------------------------------------------------
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { email: googleEmail },
                { email: { equals: googleEmail, mode: 'insensitive' } },
                { id: data.user.id },
              ],
            },
          });

          if (existingUser) {
            // Cek status keaktifan akun
            if (existingUser.status !== 'ACTIVE') {
              await supabase.auth.signOut();
              return NextResponse.redirect(
                `${requestUrl.origin}/login?auth_error=${encodeURIComponent(
                  `Akun Anda (${existingUser.fullName}) sedang dinonaktifkan/ditangguhkan. Silakan hubungi pengurus.`
                )}`
              );
            }

            // Pastikan email tersinkron di database Prisma jika sebelumnya belum terisi
            if (!existingUser.email || existingUser.email.toLowerCase() !== googleEmail) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { email: googleEmail },
              });
            }

            return NextResponse.redirect(`${requestUrl.origin}${next}`);
          } else {
            // Akun Google belum terdaftar/tertaut di database Sistem Pengajian
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${requestUrl.origin}/login?auth_error=${encodeURIComponent(
                `Akun Google (${googleEmail}) belum ditautkan ke akun Sistem Pengajian. Silakan login via nomor WhatsApp terlebih dahulu, lalu klik 'Tautkan' di halaman Profil.`
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
