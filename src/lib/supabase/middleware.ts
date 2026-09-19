import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const allCookies = request.cookies.getAll();
  const hasSupabaseCookie = allCookies.some((c) => c.name.startsWith('sb-'));

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register') ||
    request.nextUrl.pathname.startsWith('/forgot-password');

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/santri') ||
    request.nextUrl.pathname.startsWith('/kelas') ||
    request.nextUrl.pathname.startsWith('/jadwal') ||
    request.nextUrl.pathname.startsWith('/kurikulum') ||
    request.nextUrl.pathname.startsWith('/private-remedial') ||
    request.nextUrl.pathname.startsWith('/presensi') ||
    (request.nextUrl.pathname.startsWith('/tugas') && !request.nextUrl.pathname.startsWith('/tugas/paraf')) ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/pengurus') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/profil');

  // Fast path 1: Unauthenticated request with no cookies targeting protected route -> redirect immediately without cloud roundtrip
  if (!hasSupabaseCookie && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Fast path 2: Request with no cookies on public routes (e.g. homepage '/') -> proceed immediately
  if (!hasSupabaseCookie && !isAuthRoute) {
    return supabaseResponse;
  }

  // IMPORTANT: Do NOT run code between createServerClient and
  // supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If unauthenticated user tries to access protected route -> redirect to /login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If already logged in and visiting /login -> redirect to /dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
