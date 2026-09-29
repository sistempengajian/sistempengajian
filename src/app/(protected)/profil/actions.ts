'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { normalizePhoneNumber, displayPhoneNumber, whatsAppClient } from '@/lib/whatsapp';
import crypto from 'crypto';

const OTP_COOLDOWN_SECONDS = 60; // 60 detik jeda kirim ulang OTP
const OTP_EXPIRY_MINUTES = 5; // 5 menit kedaluwarsa

export interface UpdateProfileInput {
  fullName: string;
  username?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
}

/**
 * 1. Server Action: Update Data Profil Dasar Pengguna
 * - Nama Lengkap
 * - Username (Unik)
 * - Tempat Lahir
 * - Tanggal Lahir
 */
export async function updateUserProfile(data: UpdateProfileInput): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const trimmedFullName = data.fullName?.trim();
    if (!trimmedFullName || trimmedFullName.length < 2) {
      return { success: false, error: 'Nama lengkap wajib diisi minimal 2 karakter.' };
    }

    // Validasi Username jika diisi
    let cleanUsername: string | null = null;
    if (data.username && data.username.trim()) {
      cleanUsername = data.username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
      if (cleanUsername.length < 3) {
        return { success: false, error: 'Username minimal 3 karakter alfanumerik (huruf, angka, titik, garis bawah).' };
      }

      // Cek apakah username telah dipakai oleh user lain
      const existingUser = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          id: { not: authUser.id },
        },
      });

      if (existingUser) {
        return { success: false, error: `Username @${cleanUsername} sudah digunakan oleh akun lain. Silakan pilih username lain.` };
      }
    }

    // Format Tanggal Lahir
    let parsedBirthDate: Date | null = null;
    if (data.birthDate && data.birthDate.trim()) {
      const dateVal = new Date(data.birthDate.trim());
      if (!isNaN(dateVal.getTime())) {
        parsedBirthDate = dateVal;
      }
    }

    const cleanBirthPlace = data.birthPlace?.trim() ? data.birthPlace.trim() : null;

    // Update ke Database Prisma
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        fullName: trimmedFullName,
        username: cleanUsername,
        birthPlace: cleanBirthPlace,
        birthDate: parsedBirthDate,
      },
    });

    revalidatePath('/profil');
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: 'Data profil berhasil diperbarui dengan sukses!',
    };
  } catch (err: any) {
    console.error('[updateUserProfile Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan sistem saat memperbarui profil.',
    };
  }
}

/**
 * 2. Server Action: Permintaan Kode OTP untuk Pengubahan Nomor WhatsApp
 * - Cek format nomor WhatsApp baru
 * - Cek apakah nomor baru sama dengan nomor lama
 * - Cek apakah nomor baru sudah digunakan akun lain
 * - Cek jeda cooldown pengiriman OTP (60 detik)
 * - Kirimkan kode OTP 6-digit via WhatsApp Gateway
 */
export async function requestPhoneChangeOtp(newPhoneInput: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  cooldownRemaining?: number;
  targetPhone?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
    });

    if (!currentUser) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    const normalizedNewPhone = normalizePhoneNumber(newPhoneInput);
    if (!normalizedNewPhone || normalizedNewPhone.length < 9) {
      return {
        success: false,
        error: 'Format nomor WhatsApp baru tidak valid. Masukkan nomor HP aktif (contoh: 081234567890).',
      };
    }

    const localFormat = normalizedNewPhone.startsWith('62') ? '0' + normalizedNewPhone.slice(2) : normalizedNewPhone;

    // Cek apakah nomor baru sama persis dengan nomor saat ini
    const currentNormalized = normalizePhoneNumber(currentUser.phoneNumber);
    if (currentNormalized === normalizedNewPhone) {
      return {
        success: false,
        error: 'Nomor WhatsApp baru tidak boleh sama dengan nomor WhatsApp yang saat ini terdaftar.',
      };
    }

    // Cek apakah nomor baru sudah dipakai oleh akun lain yang aktif
    const existingOtherUser = await prisma.user.findFirst({
      where: {
        id: { not: authUser.id },
        OR: [
          { phoneNumber: normalizedNewPhone },
          { phoneNumber: localFormat },
          { phoneNumber: `+${normalizedNewPhone}` },
        ],
      },
    });

    if (existingOtherUser) {
      return {
        success: false,
        error: `Nomor WhatsApp ${displayPhoneNumber(normalizedNewPhone)} sudah terdaftar pada akun lain (${existingOtherUser.fullName}).`,
      };
    }

    // Cek jeda cooldown (60 detik)
    const cooldownAgo = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
    const recentOtp = await prisma.whatsAppLoginToken.findFirst({
      where: {
        userId: authUser.id,
        createdAt: { gte: cooldownAgo },
        token: { startsWith: 'OTP_PHONE_CHANGE_' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      const elapsedMs = Date.now() - recentOtp.createdAt.getTime();
      const remainingSeconds = Math.max(1, Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000));
      return {
        success: false,
        error: `Silakan tunggu ${remainingSeconds} detik lagi sebelum meminta kode verifikasi baru.`,
        cooldownRemaining: remainingSeconds,
        targetPhone: displayPhoneNumber(normalizedNewPhone),
      };
    }

    // Nonaktifkan OTP perubahan nomor sebelumnya yang belum dipakai
    await prisma.whatsAppLoginToken.updateMany({
      where: {
        userId: authUser.id,
        isUsed: false,
        token: { startsWith: 'OTP_PHONE_CHANGE_' },
      },
      data: { isUsed: true },
    });

    // Buat kode OTP 6 Digit
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const tokenIdentifier = `OTP_PHONE_CHANGE_${authUser.id}_${otpCode}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.whatsAppLoginToken.create({
      data: {
        token: tokenIdentifier,
        phoneNumber: normalizedNewPhone,
        userId: authUser.id,
        expiresAt,
        isUsed: false,
      },
    });

    // Susun pesan WhatsApp Verifikasi
    const message = `Assalamu'alaikum Warahmatullahi Wabarakatuh,
Yth. *${currentUser.fullName}*.

Berikut adalah kode verifikasi OTP untuk pembaruan nomor WhatsApp akun Anda di *Sistem Pengajian*:

🔐 Kode Verifikasi: *${otpCode}*

• Kode ini berlaku selama *5 menit*.
• Masukkan kode ini pada halaman verifikasi profil untuk mengonfirmasi bahwa nomor WhatsApp ini aktif.
• Jangan bagikan kode ini kepada siapapun demi keamanan data akun Anda.

Alhamdulillah Jazakumullahu Khairan Katsiran.
— *Sistem Manajemen Pengajian Terpadu*`;

    // Kirim via WhatsApp Gateway ke Nomor Baru
    const sendResult = await whatsAppClient.sendMessage({
      to: normalizedNewPhone,
      message,
      recipientName: currentUser.fullName,
      recipientUserId: currentUser.id,
      messageType: 'CUSTOM_DIRECT',
    });

    if (!sendResult.success && sendResult.error && !sendResult.gatewayMessageId?.startsWith('sim_')) {
      console.warn('[PhoneChange OTP] Peringatan gateway WhatsApp:', sendResult.error);
    }

    return {
      success: true,
      message: `Kode verifikasi 6-digit telah dikirim ke WhatsApp ${displayPhoneNumber(normalizedNewPhone)}. Silakan masukkan kode untuk verifikasi.`,
      cooldownRemaining: OTP_COOLDOWN_SECONDS,
      targetPhone: normalizedNewPhone,
    };
  } catch (err: any) {
    console.error('[requestPhoneChangeOtp Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan sistem saat mengirim kode OTP.',
    };
  }
}

/**
 * 3. Server Action: Verifikasi Kode OTP dan Perbarui Nomor WhatsApp
 */
export async function verifyPhoneChangeOtp(
  newPhoneInput: string,
  otpInput: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  newPhone?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const cleanOtp = otpInput?.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      return { success: false, error: 'Format kode verifikasi salah. Masukkan 6 digit angka.' };
    }

    const normalizedNewPhone = normalizePhoneNumber(newPhoneInput);
    if (!normalizedNewPhone) {
      return { success: false, error: 'Nomor WhatsApp tujuan tidak valid.' };
    }

    // Cari token OTP aktif untuk user dan nomor ini
    const activeTokens = await prisma.whatsAppLoginToken.findMany({
      where: {
        userId: authUser.id,
        phoneNumber: normalizedNewPhone,
        isUsed: false,
        expiresAt: { gt: new Date() },
        token: { startsWith: 'OTP_PHONE_CHANGE_' },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const matchedToken = activeTokens.find((t) => t.token.includes(`_${cleanOtp}_`));

    if (!matchedToken) {
      return {
        success: false,
        error: 'Kode verifikasi tidak valid atau telah kedaluwarsa. Silakan periksa kembali atau minta kode baru.',
      };
    }

    // Tandai token telah digunakan
    await prisma.whatsAppLoginToken.update({
      where: { id: matchedToken.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Update nomor WhatsApp di tabel User
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        phoneNumber: normalizedNewPhone,
      },
    });

    revalidatePath('/profil');
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: `Nomor WhatsApp berhasil diverifikasi dan diperbarui menjadi ${displayPhoneNumber(normalizedNewPhone)}!`,
      newPhone: normalizedNewPhone,
    };
  } catch (err: any) {
    console.error('[verifyPhoneChangeOtp Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan sistem saat memverifikasi kode OTP.',
    };
  }
}

/**
 * 4. Server Action: Perbarui Alamat Email Pengguna (Google / Manual)
 */
export async function updateUserEmail(emailInput: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const cleanEmail = emailInput?.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Format alamat email tidak valid (contoh: nama@gmail.com).' };
    }

    // Cek apakah email sudah digunakan user lain
    const existing = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        id: { not: authUser.id },
      },
    });

    if (existing) {
      return { success: false, error: `Email ${cleanEmail} sudah digunakan oleh akun lain.` };
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { email: cleanEmail },
    });

    revalidatePath('/profil');
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: `Alamat email berhasil diperbarui ke ${cleanEmail}!`,
    };
  } catch (err: any) {
    console.error('[updateUserEmail Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan saat memperbarui email.',
    };
  }
}

/**
 * 5. Server Action: Putuskan / Hapus Tautan Email Pengguna
 */
export async function unlinkUserEmail(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { email: null },
    });

    revalidatePath('/profil');
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: 'Tautan email akun berhasil diputuskan.',
    };
  } catch (err: any) {
    console.error('[unlinkUserEmail Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan saat memutuskan tautan email.',
    };
  }
}


