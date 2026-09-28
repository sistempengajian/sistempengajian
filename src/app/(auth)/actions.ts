'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { normalizePhoneNumber, displayPhoneNumber, whatsAppClient } from '@/lib/whatsapp';
import crypto from 'crypto';

const LOGIN_COOLDOWN_SECONDS = 300; // 5 Menit Cooldown

/**
 * Memeriksa sisa waktu jeda (cooldown) pengiriman link masuk WhatsApp
 */
export async function getWhatsAppLoginCooldown(phoneInput: string): Promise<{
  cooldownRemaining: number;
}> {
  try {
    const normalized = normalizePhoneNumber(phoneInput);
    if (!normalized) return { cooldownRemaining: 0 };

    const localFormat = normalized.startsWith('62') ? '0' + normalized.slice(2) : normalized;
    const fiveMinutesAgo = new Date(Date.now() - LOGIN_COOLDOWN_SECONDS * 1000);

    const recentToken = await prisma.whatsAppLoginToken.findFirst({
      where: {
        OR: [
          { phoneNumber: normalized },
          { phoneNumber: localFormat },
        ],
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
}> {
  try {
    const normalized = normalizePhoneNumber(phoneInput);
    if (!normalized || normalized.length < 9) {
      return {
        success: false,
        error: 'Format nomor WhatsApp tidak valid. Masukkan nomor HP aktif (contoh: 081234567890).',
      };
    }

    const localFormat = normalized.startsWith('62') ? '0' + normalized.slice(2) : normalized;

    // 1. Cari pengguna berdasarkan nomor telepon (format lokal / internasional)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: normalized },
          { phoneNumber: localFormat },
          { phoneNumber: `+${normalized}` },
          { phoneNumber: { contains: localFormat.slice(1) } },
        ],
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
          { phoneNumber: normalized },
          { phoneNumber: localFormat },
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

Berikut adalah tautan masuk instan (Magic Link) ke akun *Sistem Pengajian & Generasi Qur'ani*:

👉 ${magicLoginUrl}

🔒 *Ketentuan Keamanan:*
• Tautan ini hanya berlaku untuk *1 (satu) kali masuk*.
• Berlaku selama *15 menit*.
• Jeda pengiriman ulang link masuk adalah *5 menit*.
• Jangan bagikan tautan ini kepada siapapun demi keamanan data akun Anda.

Alhamdulillah Jazakumullahu Khairan Katsiran.
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

      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
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
 * Fallback Login dengan Email & Password
 */
export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard';

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
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
