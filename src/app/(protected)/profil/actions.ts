'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { normalizePhoneNumber, displayPhoneNumber, whatsAppClient } from '@/lib/whatsapp';
import crypto from 'crypto';
import { getEffectiveAuthUser } from '@/lib/auth';

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
    const { authUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !effectiveUserId) {
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
          id: { not: effectiveUserId },
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
      where: { id: effectiveUserId },
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
    const { authUser, dbUser: currentUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !currentUser || !effectiveUserId) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const normalizedNewPhone = normalizePhoneNumber(newPhoneInput);
    if (!normalizedNewPhone || normalizedNewPhone.length < 9) {
      return {
        success: false,
        error: 'Format nomor WhatsApp tidak valid. Masukkan minimal 9-15 digit (contoh: 08123456789 atau 628123456789).',
      };
    }

    // Cek apakah nomor baru sama dengan nomor lama pengguna
    if (currentUser.phoneNumber === normalizedNewPhone) {
      return {
        success: false,
        error: 'Nomor WhatsApp baru sama dengan nomor yang saat ini terdaftar pada akun Anda.',
      };
    }

    // Cek apakah nomor baru sudah terdaftar pada pengguna lain
    const existingPhoneUser = await prisma.user.findFirst({
      where: {
        phoneNumber: normalizedNewPhone,
        id: { not: effectiveUserId },
      },
    });

    if (existingPhoneUser) {
      return {
        success: false,
        error: `Nomor WhatsApp ${displayPhoneNumber(normalizedNewPhone)} sudah digunakan oleh akun lain.`,
      };
    }

    // Cek cooldown pengiriman OTP (terakhir dikirim dalam 60 detik)
    const recentToken = await prisma.whatsAppLoginToken.findFirst({
      where: {
        userId: effectiveUserId,
        phoneNumber: normalizedNewPhone,
        createdAt: {
          gte: new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentToken) {
      const secondsPassed = Math.floor((Date.now() - new Date(recentToken.createdAt).getTime()) / 1000);
      const remainingCooldown = Math.max(1, OTP_COOLDOWN_SECONDS - secondsPassed);
      return {
        success: false,
        error: `Silakan tunggu ${remainingCooldown} detik sebelum meminta kode OTP baru.`,
        cooldownRemaining: remainingCooldown,
      };
    }

    // Generate kode OTP 6 Digit yang aman secara kriptografi
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const tokenSecret = `OTP_PHONE_CHANGE_${otpCode}_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Simpan ke tabel WhatsAppLoginToken
    await prisma.whatsAppLoginToken.create({
      data: {
        token: tokenSecret,
        phoneNumber: normalizedNewPhone,
        userId: effectiveUserId,
        expiresAt,
      },
    });

    // Kirim pesan OTP via WhatsApp Gateway
    const otpMessage = `*KODE VERIFIKASI PENGGANTIAN NOMOR*\n\nKode OTP Anda adalah: *${otpCode}*\n\nKode ini berlaku selama ${OTP_EXPIRY_MINUTES} menit untuk mengubah nomor WhatsApp pada akun *Sistem Pengajian* Anda (${currentUser.fullName}).\n\n_Jangan bagikan kode ini kepada siapapun._`;

    const sendResult = await whatsAppClient.sendMessage({
      to: normalizedNewPhone,
      message: otpMessage,
    });

    if (!sendResult.success) {
      console.warn('[requestPhoneChangeOtp Warning]: WhatsApp gateway gagal mengirim pesan:', sendResult.error);
      return {
        success: false,
        error: 'Gagal mengirim kode OTP ke WhatsApp Anda. Pastikan gateway WhatsApp aktif.',
        targetPhone: normalizedNewPhone,
      };
    }

    return {
      success: true,
      message: `Kode verifikasi OTP 6-digit telah dikirimkan ke nomor WhatsApp ${displayPhoneNumber(normalizedNewPhone)}.`,
      cooldownRemaining: OTP_COOLDOWN_SECONDS,
      targetPhone: normalizedNewPhone,
    };
  } catch (err: any) {
    console.error('[requestPhoneChangeOtp Error]:', err);
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan sistem saat meminta kode OTP.',
    };
  }
}

/**
 * 3. Server Action: Verifikasi Kode OTP dan Terapkan Nomor WhatsApp Baru
 * - Validasi kode OTP yang cocok dan belum kedaluwarsa
 * - Tandai token telah digunakan
 * - Perbarui kolom phoneNumber di database Prisma
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
    const { authUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !effectiveUserId) {
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
        userId: effectiveUserId,
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
      where: { id: effectiveUserId },
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
    const { authUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !effectiveUserId) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    const cleanEmail = emailInput?.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Format alamat email tidak valid (contoh: nama@gmail.com).' };
    }

    // Cek apakah email sudah digunakan user lain
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: 'insensitive' },
        id: { not: effectiveUserId },
      },
    });

    if (existing) {
      return { success: false, error: `Email ${cleanEmail} sudah digunakan oleh akun lain.` };
    }

    await prisma.user.update({
      where: { id: effectiveUserId },
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
    const { authUser, effectiveUserId } = await getEffectiveAuthUser();

    if (!authUser || !effectiveUserId) {
      return { success: false, error: 'Sesi Anda telah berakhir. Silakan login kembali.' };
    }

    await prisma.user.update({
      where: { id: effectiveUserId },
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
