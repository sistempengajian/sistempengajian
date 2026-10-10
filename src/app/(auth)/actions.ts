'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  normalizePhoneNumber,
  displayPhoneNumber,
  whatsAppClient,
  getCanonicalPhoneVariants,
} from '@/lib/whatsapp';
import crypto from 'crypto';

const LOGIN_COOLDOWN_SECONDS = 300; // 5 Menit Cooldown


/**
 * Memeriksa sisa waktu jeda (cooldown) pengiriman link masuk WhatsApp
 */
export async function getWhatsAppLoginCooldown(phoneInput: string): Promise<{
  cooldownRemaining: number;
}> {
  try {
    const phoneVariants = getCanonicalPhoneVariants(phoneInput);
    if (phoneVariants.length === 0) return { cooldownRemaining: 0 };

    const fiveMinutesAgo = new Date(Date.now() - LOGIN_COOLDOWN_SECONDS * 1000);

    const recentToken = await prisma.whatsAppLoginToken.findFirst({
      where: {
        phoneNumber: { in: phoneVariants },
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentToken) return { cooldownRemaining: 0 };

    const elapsedMs = Date.now() - recentToken.createdAt.getTime();
    const remaining = Math.max(0, Math.ceil((LOGIN_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
    return { cooldownRemaining: remaining };
  } catch (err) {
    console.error('[getWhatsAppLoginCooldown Error]:', err);
    return { cooldownRemaining: 0 };
  }
}

/**
 * Server Action: Permintaan Link Masuk Instan (Magic Link) via WhatsApp
 * 1. Validasi nomor telepon terdaftar & akun aktif
 * 2. Cek jeda pengiriman (cooldown 5 menit)
 * 3. Hasilkan token kriptografi unik (1x pakai, kedaluwarsa 15 menit)
 * 4. Kirimkan pesan berisi Magic Link ke WhatsApp pengguna
 */
export async function requestWhatsAppMagicLogin(phoneInput: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  cooldownRemaining?: number;
  targetPhone?: string;
  userName?: string;
  loginToken?: string;
}> {
  try {
    const normalized = normalizePhoneNumber(phoneInput);
    if (!normalized || normalized.length < 9) {
      return {
        success: false,
        error: 'Format nomor WhatsApp tidak valid. Masukkan nomor HP aktif (contoh: 081234567890).',
      };
    }

    const phoneVariants = getCanonicalPhoneVariants(phoneInput);

    // 1. Cari pengguna berdasarkan variasi nomor telepon kanonikal yang eksak (bebas false-positive)
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: { in: phoneVariants },
      },
      include: {
        roles: true,
      },
    });

    if (!user) {
      return {
        success: false,
        error: 'Nomor WhatsApp belum terdaftar di Sistem Pengajian. Silakan hubungi pengurus kelompok atau admin.',
      };
    }

    if (user.status !== 'ACTIVE') {
      return {
        success: false,
        error: `Akun Anda (${user.fullName}) sedang ${user.status === 'SUSPENDED' ? 'ditangguhkan' : 'tidak aktif'}. Silakan hubungi pengurus wilayah / admin.`,
      };
    }

    // 2. Cek Cooldown 5 Menit
    const fiveMinutesAgo = new Date(Date.now() - LOGIN_COOLDOWN_SECONDS * 1000);
    const recentToken = await prisma.whatsAppLoginToken.findFirst({
      where: {
        OR: [
          { phoneNumber: { in: phoneVariants } },
          { userId: user.id },
        ],
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentToken) {
      const elapsedMs = Date.now() - recentToken.createdAt.getTime();
      const remainingSeconds = Math.max(1, Math.ceil((LOGIN_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      const timeStr = mins > 0 ? `${mins} menit ${secs} detik` : `${secs} detik`;

      return {
        success: false,
        error: `Nomor ini sedang dalam masa jeda pengiriman (cooldown). Silakan tunggu ${timeStr} lagi untuk meminta link masuk baru.`,
        cooldownRemaining: remainingSeconds,
        targetPhone: displayPhoneNumber(normalized),
      };
    }

    // 3. Generate Token Unik 1x Penggunaan (Expires 15 Menit)
    const magicToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    await prisma.whatsAppLoginToken.create({
      data: {
        token: magicToken,
        phoneNumber: normalized,
        userId: user.id,
        expiresAt,
        isUsed: false,
      },
    });

    // 4. Susun Pesan WhatsApp Magic Link
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const magicLoginUrl = `${appUrl}/login/magic/${magicToken}`;

    const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. *${user.fullName}*.

Berikut adalah tautan masuk instan (Magic Link) ke akun *Sistem Pengajian & Generasi Penerus*:

👉 ${magicLoginUrl}

🔒 *Ketentuan Keamanan:*
• Tautan ini hanya berlaku untuk *1 (satu) kali masuk*.
• Berlaku selama *15 menit*.
• Jeda pengiriman ulang link masuk adalah *5 menit*.
• Jangan bagikan tautan ini kepada siapapun demi keamanan data akun Anda.

Alhamdulillah Jazakumullahu Khairan.
— *Sistem Manajemen Pengajian Terpadu*`;

    // 5. Kirim via WhatsApp Gateway
    const sendResult = await whatsAppClient.sendMessage({
      to: normalized,
      message,
      recipientName: user.fullName,
      recipientUserId: user.id,
      messageType: 'CUSTOM_DIRECT',
      magicToken,
    });

    if (!sendResult.success && sendResult.error && !sendResult.gatewayMessageId?.startsWith('sim_')) {
      console.warn('[MagicLogin] Peringatan gateway WhatsApp:', sendResult.error);
    }

    return {
      success: true,
      message: `Link masuk telah dikirim ke WhatsApp ${displayPhoneNumber(normalized)}. Buka chat WhatsApp Anda dan klik tautan untuk masuk.`,
      cooldownRemaining: LOGIN_COOLDOWN_SECONDS,
      targetPhone: displayPhoneNumber(normalized),
      userName: user.fullName,
      loginToken: magicToken,
    };
  } catch (err: any) {
    console.error('[MagicLogin Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan sistem saat memproses login WhatsApp.',
    };
  }
}

/**
 * Server Action: Memeriksa apakah token magic login telah berhasil diverifikasi (di browser / tab lain)
 * Jika sudah diverifikasi, otomatis lakukan inisialisasi sesi otentikasi pada client PWA ini.
 */
export async function checkLoginTokenStatus(loginToken: string): Promise<{
  isVerified: boolean;
  userName?: string;
  error?: string;
}> {
  try {
    if (!loginToken || loginToken.trim().length < 10) {
      return { isVerified: false };
    }

    const supabase = await createClient();

    // 1. Cek apakah sesi sudah aktif di client ini (misal cookie terbagi secara native)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (currentUser) {
      const dbUser = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { fullName: true },
      });
      return {
        isVerified: true,
        userName: dbUser?.fullName || 'Pengguna',
      };
    }

    // 2. Cek status token di database
    const cleanToken = loginToken.trim();
    const tokenRecord = await prisma.whatsAppLoginToken.findUnique({
      where: { token: cleanToken },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      return { isVerified: false, error: 'Token tidak ditemukan' };
    }

    // Jika token sudah dipakai dan masih dalam jendela waktu aktif (10 menit)
    if (tokenRecord.isUsed) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (tokenRecord.usedAt && tokenRecord.usedAt < tenMinutesAgo) {
        return { isVerified: false, error: 'Sesi token telah kedaluwarsa.' };
      }

      // Pastikan sesi disinkronisasikan ke cookie client PWA ini
      try {
        const supabaseAdmin = createAdminClient();
        const userEmail =
          tokenRecord.user.email ||
          `${tokenRecord.user.username || tokenRecord.user.id}@pengajian.app`;

        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
        });

        if (linkData?.properties?.hashed_token) {
          await supabase.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'magiclink',
          });
        }
      } catch (authErr) {
        console.error('[checkLoginTokenStatus Auth Sync Error]:', authErr);
      }

      try {
        revalidatePath('/', 'layout');
      } catch {}

      return {
        isVerified: true,
        userName: tokenRecord.user.fullName,
      };
    }

    return { isVerified: false };
  } catch (err: any) {
    console.error('[checkLoginTokenStatus Exception]:', err);
    return { isVerified: false };
  }
}

/**
 * Server Action: Verifikasi Magic Login Token 1x Pakai dan Inisialisasi Sesi Supabase
 */
export async function verifyWhatsAppMagicToken(token: string): Promise<{
  success: boolean;
  error?: string;
  userName?: string;
  roles?: string[];
  isUsed?: boolean;
  isExpired?: boolean;
}> {
  try {
    if (!token || token.trim().length < 10) {
      return { success: false, error: 'Token masuk tidak valid atau format salah.' };
    }

    const cleanToken = token.trim();

    // 1. Cari token di database
    const tokenRecord = await prisma.whatsAppLoginToken.findUnique({
      where: { token: cleanToken },
      include: {
        user: {
          include: {
            roles: true,
            organization: true,
            generation: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      return { success: false, error: 'Tautan masuk tidak ditemukan atau telah dihapus.' };
    }

    // 2. Cek apakah sudah pernah digunakan (Batasan 1x Pakai)
    if (tokenRecord.isUsed) {
      return {
        success: false,
        error: 'Tautan masuk ini sudah pernah digunakan (dibatasi 1x pemakaian). Silakan buka halaman login untuk meminta tautan baru.',
        isUsed: true,
      };
    }

    // 3. Cek apakah sudah kedaluwarsa (15 menit)
    if (tokenRecord.expiresAt < new Date()) {
      return {
        success: false,
        error: 'Tautan masuk telah kedaluwarsa (melebihi batas 15 menit). Silakan minta tautan baru dari halaman login.',
        isExpired: true,
      };
    }

    // 4. Cek status akun pengguna
    if (tokenRecord.user.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Akun Anda saat ini sedang dinonaktifkan. Silakan hubungi admin pengajian.',
      };
    }

    // 5. Kunci token SEGERA (Tandai isUsed = true untuk mencegah pemakaian ulang)
    await prisma.whatsAppLoginToken.update({
      where: { id: tokenRecord.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // 6. Buat sesi otentikasi Supabase untuk pengguna
    try {
      const supabaseAdmin = createAdminClient();
      const userEmail = tokenRecord.user.email || `${tokenRecord.user.username || tokenRecord.user.id}@pengajian.app`;

      // Pastikan user ada di Supabase Auth dengan ID yang sama
      let authUserId = tokenRecord.user.id;
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userEmail,
      });

      if (linkData?.properties?.hashed_token) {
        const supabase = await createClient();
        await supabase.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'magiclink',
        });
      } else {
        try {
          await supabaseAdmin.auth.admin.createUser({
            id: tokenRecord.user.id,
            email: userEmail,
            password: 'DemoPassword2026!',
            email_confirm: true,
            user_metadata: {
              full_name: tokenRecord.user.fullName,
              username: tokenRecord.user.username,
            },
          });

          const { data: retryLink } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: userEmail,
          });

          if (retryLink?.properties?.hashed_token) {
            const supabase = await createClient();
            await supabase.auth.verifyOtp({
              token_hash: retryLink.properties.hashed_token,
              type: 'magiclink',
            });
          }
        } catch (provErr) {
          console.warn('[MagicLogin Provisioning Notice]:', provErr);
        }
      }
    } catch (authErr) {
      console.error('[MagicLogin Supabase Auth Setup Error]:', authErr);
    }

    try {
      revalidatePath('/', 'layout');
    } catch {}

    return {
      success: true,
      userName: tokenRecord.user.fullName,
      roles: tokenRecord.user.roles.map((r) => r.role),
    };
  } catch (err: any) {
    console.error('[VerifyMagicToken Error]:', err);
    return {
      success: false,
      error: err.message || 'Gagal memverifikasi tautan masuk.',
    };
  }
}

/**
 * Server Action: Masuk Instan Akun Demo (1-Klik untuk Pengujian Sistem)
 */
export async function loginAsDemoUser(identifier: string): Promise<{ success: boolean; error?: string }> {
  // Keamanan: Akses demo dinonaktifkan secara ketat pada versi rilis / production
  if (process.env.NODE_ENV === 'production') {
    return { success: false, error: 'Fitur akun demo dinonaktifkan pada versi rilis (production).' };
  }

  try {
    const phoneVariants = getCanonicalPhoneVariants(identifier);

    // Cari pengguna demo di Prisma berdasarkan nomor HP, email, atau username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(phoneVariants.length > 0 ? [{ phoneNumber: { in: phoneVariants } }] : []),
          { email: identifier },
          { username: identifier },
        ],
      },
      include: {
        roles: true,
      },
    });

    if (!user) {
      return { success: false, error: 'Akun demo tidak ditemukan di database.' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'Akun demo sedang tidak aktif.' };
    }

    const userEmail = user.email || (user.username ? `${user.username}@pengajian.app` : `${user.id}@pengajian.app`);
    const supabaseAdmin = createAdminClient();
    const supabase = await createClient();

    // 1. Coba login langsung via signInWithPassword (DemoPassword2026!)
    const { error: pwdErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: 'DemoPassword2026!',
    });

    if (!pwdErr) {
      revalidatePath('/', 'layout');
      return { success: true };
    }

    // 2. Jika password gagal, gunakan OTP magiclink generator (admin)
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkData?.properties?.hashed_token) {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

      if (!otpErr) {
        revalidatePath('/', 'layout');
        return { success: true };
      }
    }

    // 3. Jika belum terdaftar di Supabase Auth, buat akun baru dengan ID Prisma
    await supabaseAdmin.auth.admin.createUser({
      id: user.id,
      email: userEmail,
      password: 'DemoPassword2026!',
      email_confirm: true,
      user_metadata: {
        full_name: user.fullName,
        username: user.username,
      },
    });

    const { error: finalSignInErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: 'DemoPassword2026!',
    });

    if (finalSignInErr) {
      return { success: false, error: finalSignInErr.message };
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    console.error('[loginAsDemoUser Error]:', err);
    return { success: false, error: err.message || 'Gagal masuk akun demo.' };
  }
}

/**
 * Login dengan Alamat Email / Username / No. HP & Kata Sandi
 */
export async function login(formData: FormData) {
  const rawIdentifier = (formData.get('email') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard';

  if (!rawIdentifier || !password) {
    return { error: 'Alamat email / username dan kata sandi wajib diisi.' };
  }

  const lowerInput = rawIdentifier.toLowerCase();
  const phoneVariants = getCanonicalPhoneVariants(rawIdentifier);

  // 1. Cari user di database Prisma berdasarkan email, username, atau no HP (kanonikal eksak bebas false-positive)
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: lowerInput, mode: 'insensitive' } },
        { username: { equals: lowerInput, mode: 'insensitive' } },
        ...(phoneVariants.length > 0
          ? [{ phoneNumber: { in: phoneVariants } }]
          : []),
      ],
    },
    include: {
      roles: true,
    },
  });

  if (dbUser && dbUser.status !== 'ACTIVE') {
    return {
      error: `Akun Anda (${dbUser.fullName}) sedang ${
        dbUser.status === 'SUSPENDED' ? 'ditangguhkan' : 'tidak aktif'
      }. Silakan hubungi pengurus wilayah / admin.`,
    };
  }

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  // Tentukan target email otentikasi di Supabase Auth
  const targetEmail =
    dbUser?.email ||
    (dbUser?.username ? `${dbUser.username}@pengajian.app` : (dbUser ? `${dbUser.id}@pengajian.app` : lowerInput));

  // 2. Coba sign in dengan target email
  let { error: signInErr } = await supabase.auth.signInWithPassword({
    email: targetEmail,
    password,
  });

  // Jika gagal dan input rawIdentifier berbeda dan berformat email, coba juga langsung rawIdentifier
  if (signInErr && lowerInput !== targetEmail && lowerInput.includes('@')) {
    const retryRes = await supabase.auth.signInWithPassword({
      email: lowerInput,
      password,
    });
    if (!retryRes.error) {
      signInErr = null;
    }
  }

  // 3. Jika user ada di Prisma tapi sign in gagal karena belum ada di Supabase Auth atau mismatch
  if (signInErr && dbUser) {
    try {
      // Cek keberadaan user secara langsung (O(1)), bukan list semua (O(N))
      const { data: authByIdData } = await supabaseAdmin.auth.admin.getUserById(dbUser.id);

      if (!authByIdData?.user) {
        // Buat akun baru jika sama sekali belum ada
        await supabaseAdmin.auth.admin.createUser({
          id: dbUser.id,
          email: targetEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: dbUser.fullName,
            username: dbUser.username,
          },
        });

        // Coba login ulang setelah provisioning
        const retryAfterCreate = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (!retryAfterCreate.error) {
          signInErr = null;
        }
      }
    } catch (syncCatch) {
      console.warn('[Login sync notice]:', syncCatch);
    }
  }

  if (signInErr) {
    const errMsg = signInErr.message.toLowerCase();
    if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
      return { error: 'Alamat email/username atau kata sandi salah. Silakan periksa kembali kredensial Anda.' };
    }
    if (errMsg.includes('email not confirmed')) {
      return { error: 'Email belum dikonfirmasi. Silakan hubungi admin.' };
    }
    return { error: signInErr.message };
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
