'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  GenerationWithStats,
  CreateGenerationInput,
  UpdateGenerationInput,
} from '@/components/generasi/types';

/**
 * Membuat jenjang generasi kustom baru
 * Khusus Pengelola (ADMIN_MASTER atau PJ_DAERAH)
 */
export async function createGeneration(
  input: CreateGenerationInput
): Promise<{ success: boolean; message: string; generation?: GenerationWithStats }> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        roles: {
          select: { role: true },
        },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak menambah jenjang generasi.',
      };
    }

    // Validasi Nama
    const trimmedName = (input.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama jenjang generasi minimal harus 2 karakter.' };
    }

    // Validasi & Format Kode Unik
    let formattedCode = (input.code || '')
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

    // Validasi Usia
    const minAge = Math.floor(Number(input.minAge));
    const maxAge = Math.floor(Number(input.maxAge));

    if (isNaN(minAge) || minAge < 0) {
      return { success: false, message: 'Usia minimal tidak boleh negatif atau kosong.' };
    }

    if (isNaN(maxAge) || maxAge < minAge) {
      return { success: false, message: 'Usia maksimal harus lebih besar atau sama dengan usia minimal.' };
    }

    const validColors = ['emerald', 'sky', 'purple', 'amber', 'rose', 'teal', 'orange', 'cyan', 'indigo'];
    const chosenColor = validColors.includes(input.color || '') ? input.color : 'emerald';

    const created = await prisma.generation.create({
      data: {
        name: trimmedName,
        code: formattedCode,
        minAge,
        maxAge,
        description: input.description?.trim() || null,
        color: chosenColor,
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
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        roles: {
          select: { role: true },
        },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const canEdit = roleCodes.includes('ADMIN_MASTER') || roleCodes.includes('PJ_DAERAH');

    if (!canEdit) {
      return {
        success: false,
        message: 'Akses ditolak: Hanya Pengelola (Admin Master / PJ Daerah) yang berhak memperbarui data jenjang generasi.',
      };
    }

    // Validasi input
    const trimmedName = (input.name || '').trim();
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, message: 'Nama jenjang generasi minimal harus 2 karakter.' };
    }

    const minAge = Math.floor(Number(input.minAge));
    const maxAge = Math.floor(Number(input.maxAge));

    if (isNaN(minAge) || minAge < 0) {
      return { success: false, message: 'Usia minimal tidak boleh negatif atau kosong.' };
    }

    if (isNaN(maxAge) || maxAge < minAge) {
      return { success: false, message: 'Usia maksimal harus lebih besar atau sama dengan usia minimal.' };
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
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        roles: {
          select: { role: true },
        },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
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
