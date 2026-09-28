'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { normalizePhoneNumber, displayPhoneNumber, whatsAppClient } from '@/lib/whatsapp';
import crypto from 'crypto';

const LOGIN_COOLDOWN_SECONDS = 300; // 5 Menit Cooldown

interface TokenRecordData {
  id: string;
  token: string;
  phoneNumber: string;
  userId: string;
  isUsed: boolean;
  usedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Helper resilien untuk mencari token terakhir (mendukung Prisma ORM & Raw SQL fallback)
 */
async function getRecentTokenRecord(
  normalized: string,
  localFormat: string,
  userId?: string,
  sinceDate?: Date
): Promise<TokenRecordData | null> {
  try {
    if ((prisma as any).whatsAppLoginToken?.findFirst) {
      const rec = await prisma.whatsAppLoginToken.findFirst({
        where: {
          OR: [
            { phoneNumber: normalized },
            { phoneNumber: localFormat },
            ...(userId ? [{ userId }] : []),
          ],
          ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (rec) return rec as TokenRecordData;
    }
  } catch {
    // Fallback ke Raw SQL jika HMR runtime belum me-reload model ORM
  }

  try {
    const rawResults: any[] = await prisma.$queryRaw`
      SELECT id, token, phone_number as "phoneNumber", user_id as "userId", 
             is_used as "isUsed", used_at as "usedAt", expires_at as "expiresAt", created_at as "createdAt"
      FROM whatsapp_login_tokens
      WHERE (phone_number = ${normalized} OR phone_number = ${localFormat})
        ${sinceDate ? prisma.$queryRaw`AND created_at >= ${sinceDate}` : prisma.$queryRaw``}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rawResults[0] || null;
  } catch (rawErr) {
    console.warn('[MagicLogin DB Notice]:', rawErr);
    return null;
  }
}

/**
 * Helper resilien untuk menyimpan token baru
 */
async function insertLoginTokenRecord(data: {
  token: string;
  phoneNumber: string;
  userId: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    if ((prisma as any).whatsAppLoginToken?.create) {
      await prisma.whatsAppLoginToken.create({
        data: {
          token: data.token,
          phoneNumber: data.phoneNumber,
          userId: data.userId,
          expiresAt: data.expiresAt,
          isUsed: false,
        },
      });
      return;
    }
  } catch {}

  // Raw SQL fallback
  await prisma.$executeRaw`
    INSERT INTO whatsapp_login_tokens (id, token, phone_number, user_id, is_used, expires_at, created_at)
    VALUES (gen_random_uuid(), ${data.token}, ${data.phoneNumber}, ${data.userId}::uuid, false, ${data.expiresAt}, NOW())
  `;
}

/**
 * Helper resilien untuk mengambil token beserta data User untuk verifikasi
 */
async function findLoginTokenWithUser(token: string) {
  const cleanToken = token.trim();

  try {
    if ((prisma as any).whatsAppLoginToken?.findUnique) {
      const rec = await prisma.whatsAppLoginToken.findUnique({
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
      if (rec) return rec;
    }
  } catch {}

  // Raw SQL Fallback
  const rawTokens: any[] = await prisma.$queryRaw`
    SELECT id, token, phone_number as "phoneNumber", user_id as "userId", 
           is_used as "isUsed", used_at as "usedAt", expires_at as "expiresAt", created_at as "createdAt"
    FROM whatsapp_login_tokens
    WHERE token = ${cleanToken}
    LIMIT 1
  `;
  if (!rawTokens || rawTokens.length === 0) return null;
  const t = rawTokens[0];

  const user = await prisma.user.findUnique({
    where: { id: t.userId },
    include: {
      roles: true,
      organization: true,
      generation: true,
    },
  });
  if (!user) return null;

  return {
    ...t,
    user,
  };
}

/**
 * Helper resilien untuk menandai token sudah dipakai (single-use)
 */
async function markTokenAsUsed(tokenId: string): Promise<void> {
  try {
    if ((prisma as any).whatsAppLoginToken?.update) {
      await prisma.whatsAppLoginToken.update({
        where: { id: tokenId },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });
      return;
    }
  } catch {}

  await prisma.$executeRaw`
    UPDATE whatsapp_login_tokens
    SET is_used = true, used_at = NOW()
    WHERE id = ${tokenId}::uuid
  `;
}

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

    const recentToken = await getRecentTokenRecord(normalized, localFormat, undefined, fiveMinutesAgo);
    if (!recentToken) return { cooldownRemaining: 0 };

    const tokenCreatedAt = new Date(recentToken.createdAt).getTime();
    const elapsedMs = Date.now() - tokenCreatedAt;
    const remaining = Math.max(0, Math.ceil((LOGIN_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
    return { cooldownRemaining: remaining };
  } catch {
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

    // 1. Cari pengguna aktif berdasarkan nomor telepon
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: normalized },
          { phoneNumber: localFormat },
          { phoneNumber: `+${normalized}` },
        ],
        status: 'ACTIVE',
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

    // 2. Cek Cooldown 5 Menit
    const fiveMinutesAgo = new Date(Date.now() - LOGIN_COOLDOWN_SECONDS * 1000);
    const recentToken = await getRecentTokenRecord(normalized, localFormat, user.id, fiveMinutesAgo);

    if (recentToken) {
      const tokenCreatedAt = new Date(recentToken.createdAt).getTime();
      const elapsedMs = Date.now() - tokenCreatedAt;
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

    await insertLoginTokenRecord({
      token: magicToken,
      phoneNumber: normalized,
      userId: user.id,
      expiresAt,
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

    // 1. Cari token di database
    const tokenRecord = await findLoginTokenWithUser(token);

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
    const tokenExpiresAt = new Date(tokenRecord.expiresAt);
    if (tokenExpiresAt < new Date()) {
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
    await markTokenAsUsed(tokenRecord.id);

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

    revalidatePath('/', 'layout');
    return {
      success: true,
      userName: tokenRecord.user.fullName,
      roles: tokenRecord.user.roles.map((r: any) => r.role),
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
