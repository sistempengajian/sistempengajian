'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  GenerationWithStats,
  CreateGenerationInput,
  UpdateGenerationInput,
} from '@/components/generasi/types';
import { getEffectiveAuthUser } from '@/lib/auth';
import { formatZodError } from '@/lib/security-utils';

const createGenerationSchema = z
  .object({
    name: z
      .string({ required_error: 'Nama jenjang generasi wajib diisi.' })
      .min(2, 'Nama jenjang generasi minimal harus 2 karakter.')
      .max(100, 'Nama jenjang generasi maksimal 100 karakter.')
      .trim(),
    code: z
      .string()
      .max(50, 'Kode generasi maksimal 50 karakter.')
      .optional()
      .nullable()
      .or(z.literal('')),
    minAge: z.coerce.number().min(0, 'Usia minimal tidak boleh negatif atau kosong.'),
    maxAge: z.coerce.number().min(0, 'Usia maksimal tidak boleh negatif atau kosong.'),
    description: z
      .string()
      .max(500, 'Deskripsi maksimal 500 karakter.')
      .optional()
      .nullable()
      .or(z.literal('')),
    color: z.string().max(50).optional().nullable().or(z.literal('')),
    whatsappGroupId: z.string().max(100).optional().nullable().or(z.literal('')),
    whatsappGroupName: z.string().max(100).optional().nullable().or(z.literal('')),
    waGroupH1Enabled: z.boolean().optional(),
    waGroupWeeklyEnabled: z.boolean().optional(),
  })
  .refine((data) => data.maxAge >= data.minAge, {
    message: 'Usia maksimal harus lebih besar atau sama dengan usia minimal.',
    path: ['maxAge'],
  });

const updateGenerationSchema = z
  .object({
    name: z
      .string({ required_error: 'Nama jenjang generasi wajib diisi.' })
      .min(2, 'Nama jenjang generasi minimal harus 2 karakter.')
      .max(100, 'Nama jenjang generasi maksimal 100 karakter.')
      .trim(),
    minAge: z.coerce.number().min(0, 'Usia minimal tidak boleh negatif atau kosong.'),
    maxAge: z.coerce.number().min(0, 'Usia maksimal tidak boleh negatif atau kosong.'),
    description: z
      .string()
      .max(500, 'Deskripsi maksimal 500 karakter.')
      .optional()
      .nullable()
      .or(z.literal('')),
    color: z.string().max(50).optional().nullable().or(z.literal('')),
    whatsappGroupId: z.string().max(100).optional().nullable().or(z.literal('')),
    whatsappGroupName: z.string().max(100).optional().nullable().or(z.literal('')),
    waGroupH1Enabled: z.boolean().optional(),
    waGroupWeeklyEnabled: z.boolean().optional(),
  })
  .refine((data) => data.maxAge >= data.minAge, {
    message: 'Usia maksimal harus lebih besar atau sama dengan usia minimal.',
    path: ['maxAge'],
  });

const generationIdSchema = z.string().uuid('ID generasi tidak valid.');

/**
 * Membuat jenjang generasi kustom baru
 * Khusus Pengelola (ADMIN_MASTER atau PJ_DAERAH)
 */
export async function createGeneration(
  input: CreateGenerationInput
): Promise<{ success: boolean; message: string; generation?: GenerationWithStats }> {
  try {
    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const roleCodes = userProfile.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak menambah jenjang generasi.',
      };
    }

    const validation = createGenerationSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, message: formatZodError(validation.error) };
    }

    const {
      name: trimmedName,
      code: rawCode,
      minAge,
      maxAge,
      description,
      color,
      whatsappGroupId,
      whatsappGroupName,
      waGroupH1Enabled,
      waGroupWeeklyEnabled,
    } = validation.data;

    // Validasi & Format Kode Unik
    let formattedCode = (rawCode || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

    if (!formattedCode || formattedCode.length < 2) {
      // Fallback generate kode dari nama
      formattedCode = trimmedName
        .toUpperCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^A-Z0-9_]/g, '')
        .slice(0, 30);
    }

    if (formattedCode.length < 2) {
      return { success: false, message: 'Kode generasi harus minimal 2 karakter (huruf, angka, garis bawah).' };
    }

    // Cek keunikan kode
    const existingCode = await prisma.generation.findUnique({
      where: { code: formattedCode },
    });

    if (existingCode) {
      return {
        success: false,
        message: `Kode generasi "${formattedCode}" sudah digunakan oleh jenjang "${existingCode.name}". Silakan gunakan kode lain.`,
      };
    }

    const validColors = ['emerald', 'sky', 'purple', 'amber', 'rose', 'teal', 'orange', 'cyan', 'indigo'];
    const chosenColor = validColors.includes(color || '') ? color : 'emerald';

    const created = await prisma.generation.create({
      data: {
        name: trimmedName,
        code: formattedCode,
        minAge,
        maxAge,
        description: input.description?.trim() || null,
        color: chosenColor,
        whatsappGroupId: input.whatsappGroupId?.trim() || null,
        whatsappGroupName: input.whatsappGroupName?.trim() || null,
        waGroupH1Enabled: input.waGroupH1Enabled !== undefined ? Boolean(input.waGroupH1Enabled) : true,
        waGroupWeeklyEnabled: input.waGroupWeeklyEnabled !== undefined ? Boolean(input.waGroupWeeklyEnabled) : true,
      },
    });

    // Revalidasi cache
    revalidatePath('/generasi');
    revalidatePath('/kurikulum');
    revalidatePath('/tugas');
    revalidatePath('/tugas/buat');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Jenjang generasi "${created.name}" (${created.code}) berhasil dibuat.`,
      generation: {
        ...created,
        studentCount: 0,
        classCount: 0,
        materialCount: 0,
      },
    };
  } catch (err: any) {
    console.error('Gagal membuat generasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat membuat jenjang generasi.',
    };
  }
}

/**
 * Memperbarui data jenjang generasi (nama, rentang usia, deskripsi fokus kurikulum, warna tema)
 * Khusus Pengelola (ADMIN_MASTER atau PJ_DAERAH).
 */
export async function updateGeneration(
  id: string,
  input: UpdateGenerationInput
): Promise<{ success: boolean; message: string; generation?: GenerationWithStats }> {
  try {
    const idValidation = generationIdSchema.safeParse(id);
    if (!idValidation.success) {
      return { success: false, message: formatZodError(idValidation.error) };
    }

    const validation = updateGenerationSchema.safeParse(input);
    if (!validation.success) {
      return { success: false, message: formatZodError(validation.error) };
    }

    const {
      name: trimmedName,
      minAge,
      maxAge,
      description,
      color,
      whatsappGroupId,
      whatsappGroupName,
      waGroupH1Enabled,
      waGroupWeeklyEnabled,
    } = validation.data;

    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const roleCodes = userProfile.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak memperbarui data jenjang generasi.',
      };
    }

    // Pastikan generasi dengan ID tersebut ada
    const existing = await prisma.generation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: { where: { roles: { some: { role: 'SANTRI' } } } },
            classes: true,
            materials: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, message: 'Jenjang generasi tidak ditemukan di sistem.' };
    }

    const validColors = ['emerald', 'sky', 'purple', 'amber', 'rose', 'teal', 'orange', 'cyan', 'indigo'];
    const chosenColor = validColors.includes(input.color || '') ? input.color : (existing.color || 'emerald');

    const updated = await prisma.generation.update({
      where: { id },
      data: {
        name: trimmedName,
        minAge,
        maxAge,
        description: input.description?.trim() || null,
        color: chosenColor,
        whatsappGroupId: input.whatsappGroupId !== undefined ? (input.whatsappGroupId?.trim() || null) : existing.whatsappGroupId,
        whatsappGroupName: input.whatsappGroupName !== undefined ? (input.whatsappGroupName?.trim() || null) : existing.whatsappGroupName,
        waGroupH1Enabled: input.waGroupH1Enabled !== undefined ? Boolean(input.waGroupH1Enabled) : existing.waGroupH1Enabled,
        waGroupWeeklyEnabled: input.waGroupWeeklyEnabled !== undefined ? Boolean(input.waGroupWeeklyEnabled) : existing.waGroupWeeklyEnabled,
      },
    });

    // Revalidasi seluruh halaman yang menampilkan data generasi
    revalidatePath('/generasi');
    revalidatePath('/kurikulum');
    revalidatePath('/tugas');
    revalidatePath('/tugas/buat');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Jenjang generasi "${updated.name}" berhasil diperbarui.`,
      generation: {
        ...updated,
        studentCount: existing._count.users,
        classCount: existing._count.classes,
        materialCount: existing._count.materials,
      },
    };
  } catch (err: any) {
    console.error('Gagal memperbarui generasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menyimpan data generasi.',
    };
  }
}

/**
 * Menghapus jenjang generasi dengan validasi integritas ketat (Safety Guard)
 * Khusus Pengelola (ADMIN_MASTER atau PJ_DAERAH).
 * Menolak penghapusan jika masih ada santri, kelas, atau materi yang tertaut.
 */
export async function deleteGeneration(
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    const idValidation = generationIdSchema.safeParse(id);
    if (!idValidation.success) {
      return { success: false, message: formatZodError(idValidation.error) };
    }

    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const roleCodes = userProfile.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak menghapus jenjang generasi.',
      };
    }

    const existing = await prisma.generation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            classes: true,
            materials: true,
          },
        },
      },
    });

    if (!existing) {
      return { success: false, message: 'Jenjang generasi tidak ditemukan atau sudah dihapus.' };
    }

    // Safety Guard: Periksa apakah masih ada data yang terhubung
    const studentCount = existing._count.users;
    const classCount = existing._count.classes;
    const materialCount = existing._count.materials;

    if (studentCount > 0 || classCount > 0 || materialCount > 0) {
      const reasons: string[] = [];
      if (studentCount > 0) reasons.push(`${studentCount} santri/pengguna`);
      if (classCount > 0) reasons.push(`${classCount} kelas`);
      if (materialCount > 0) reasons.push(`${materialCount} modul materi kurikulum`);

      return {
        success: false,
        message: `Tidak dapat menghapus jenjang "${existing.name}". Masih terdapat data terkait: ${reasons.join(
          ', '
        )}. Silakan pindahkan atau hapus data terkait terlebih dahulu demi menjaga keutuhan data sistem.`,
      };
    }

    // Aman untuk dihapus
    await prisma.generation.delete({
      where: { id },
    });

    revalidatePath('/generasi');
    revalidatePath('/kurikulum');
    revalidatePath('/tugas');
    revalidatePath('/tugas/buat');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Jenjang generasi "${existing.name}" berhasil dihapus dari sistem.`,
    };
  } catch (err: any) {
    console.error('Gagal menghapus generasi:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat menghapus jenjang generasi.',
    };
  }
}

/**
 * Memicu pengiriman manual rangkuman jadwal 1 pekan ke depan ke grup WhatsApp jenjang
 */
export async function triggerGenerationWeeklyDigest(
  generationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const idValidation = generationIdSchema.safeParse(generationId);
    if (!idValidation.success) {
      return { success: false, message: formatZodError(idValidation.error) };
    }

    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const roleCodes = userProfile.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak memicu notifikasi grup.',
      };
    }

    const { dispatchWeeklyScheduleDigestForGeneration } = await import(
      '@/lib/whatsapp/groupScheduleNotificationService'
    );

    const result = await dispatchWeeklyScheduleDigestForGeneration(generationId, { force: true });

    if (result.success) {
      return {
        success: true,
        message: `Rangkuman jadwal mingguan (${result.schedulesCount} sesi) berhasil dikirimkan ke grup WA!`,
      };
    }

    return {
      success: false,
      message: result.error || 'Gagal mengirimkan rangkuman jadwal mingguan ke grup WA.',
    };
  } catch (err: any) {
    console.error('Gagal mengirimkan rangkuman mingguan:', err);
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan sistem saat memicu pesan grup.',
    };
  }
}

/**
 * Mengirim pesan tes uji coba konektivitas ke Grup WhatsApp Jenjang
 */
export async function testSendGroupPing(
  generationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const idValidation = generationIdSchema.safeParse(generationId);
    if (!idValidation.success) {
      return { success: false, message: formatZodError(idValidation.error) };
    }

    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const roleCodes = userProfile.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola yang berhak menguji pesan grup.',
      };
    }

    const gen = await prisma.generation.findUnique({
      where: { id: generationId },
    });

    if (!gen || !gen.whatsappGroupId) {
      return { success: false, message: 'Jenjang belum memiliki ID Grup WhatsApp yang valid.' };
    }

    const { whatsAppClient } = await import('@/lib/whatsapp/WhatsAppClient');

    const res = await whatsAppClient.sendMessage({
      to: gen.whatsappGroupId,
      recipientName: gen.whatsappGroupName || `Grup WA ${gen.name}`,
      message: `🔔 *Uji Coba Integrasi Notifikasi Pengajian*\n\nAlhamdulillah, koneksi sistem dengan Grup WhatsApp *${gen.name}* (${gen.whatsappGroupName || gen.whatsappGroupId}) berhasil terhubung dengan lancar! 🚀\n\n_Pesan otomatis dikirim oleh Sistem Informasi Manajemen Pengajian._`,
      messageType: 'CUSTOM_DIRECT',
    });

    if (res.success) {
      return {
        success: true,
        message: `Pesan uji coba berhasil terkirim ke "${gen.whatsappGroupName || gen.whatsappGroupId}"!`,
      };
    }

    return {
      success: false,
      message: res.error || 'Gagal mengirim pesan uji coba ke grup WA.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Terjadi kesalahan saat menguji pesan grup.',
    };
  }
}
