import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Root Route (/) Handler:
 * Mengarahkan pengguna langsung ke /dashboard jika sudah masuk (terotentikasi),
 * atau ke /login jika belum masuk, sehingga halaman beranda publik dilewati.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  redirect('/login');
}
