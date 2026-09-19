import { uploadImageToCloudinary, deleteImageFromCloudinary } from './cloudinary';
import { uploadAudioToR2, deleteAudioFromR2 } from './r2';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { parseMediaUrls } from '@/lib/habitParser';
import crypto from 'crypto';

function getSupabaseStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseKey || supabaseKey.includes('your-')) return null;

  try {
    return createSupabaseClient(supabaseUrl, supabaseKey);
  } catch {
    return null;
  }
}

/**
 * Upload gambar dengan routing otomatis ke Cloudinary (Fallback ke Supabase Storage)
 */
export async function uploadTaskImage(imageSource: string): Promise<string> {
  // Jika sudah berupa URL publik HTTP/HTTPS, tidak perlu diupload ulang
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return imageSource;
  }

  // 1. Prioritas Utama: Cloudinary (Gratis dengan q_auto, f_auto)
  const cloudinaryRes = await uploadImageToCloudinary(imageSource);
  if (cloudinaryRes?.url) {
    return cloudinaryRes.url;
  }

  // 2. Fallback: Supabase Storage Bucket 'tugas-foto'
  try {
    const supabase = getSupabaseStorageClient();
    if (supabase) {
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `foto_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;

      const { data, error } = await supabase.storage
        .from('tugas-foto')
        .upload(fileName, buffer, {
          contentType: 'image/webp',
          upsert: false,
        });

      if (!error && data) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('tugas-foto').getPublicUrl(fileName);
        return publicUrl;
      }
    }
  } catch (err) {
    console.warn('[MediaGateway] Supabase Storage fallback foto error:', err);
  }

  // 3. Fallback Darurat Lokal: Jika semua kredensial cloud belum diisi (Mode Dev)
  return imageSource;
}

/**
 * Upload audio hafalan dengan routing otomatis ke Cloudflare R2 (Fallback ke Supabase Storage)
 */
export async function uploadTaskAudio(audioSource: string): Promise<string> {
  // Jika sudah berupa URL publik HTTP/HTTPS, tidak perlu diupload ulang
  if (audioSource.startsWith('http://') || audioSource.startsWith('https://')) {
    return audioSource;
  }

  // 1. Prioritas Utama: Cloudflare R2 (Gratis 10GB & Zero Egress Fee)
  const r2Res = await uploadAudioToR2(audioSource);
  if (r2Res?.url) {
    return r2Res.url;
  }

  // 2. Fallback: Supabase Storage Bucket 'tugas-audio'
  try {
    const supabase = getSupabaseStorageClient();
    if (supabase) {
      const base64Data = audioSource.replace(/^data:audio\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `audio_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webm`;

      const { data, error } = await supabase.storage
        .from('tugas-audio')
        .upload(fileName, buffer, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (!error && data) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('tugas-audio').getPublicUrl(fileName);
        return publicUrl;
      }
    }
  } catch (err) {
    console.warn('[MediaGateway] Supabase Storage fallback audio error:', err);
  }

  // 3. Fallback Darurat Lokal: Jika semua kredensial cloud belum diisi (Mode Dev)
  return audioSource;
}

/**
 * Memproses dan mengunggah seluruh media lampiran tugas (mendukung multi-foto & multi-audio)
 * Mengubah Base64 besar menjadi URL Cloud pendek sebelum disimpan ke PostgreSQL
 */
export async function processMediaPayload(
  mediaPayload: string | null,
  isAudio: boolean
): Promise<string | null> {
  if (!mediaPayload) return null;

  try {
    // Periksa apakah payload berupa array JSON (contoh: '["data:...","data:..."]')
    if (mediaPayload.startsWith('[') && mediaPayload.endsWith(']')) {
      const urls = JSON.parse(mediaPayload) as string[];
      const uploadedUrls: string[] = [];

      for (const item of urls) {
        if (isAudio) {
          const cloudUrl = await uploadTaskAudio(item);
          uploadedUrls.push(cloudUrl);
        } else {
          const cloudUrl = await uploadTaskImage(item);
          uploadedUrls.push(cloudUrl);
        }
      }

      return uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);
    }

    // Single item
    if (isAudio) {
      return await uploadTaskAudio(mediaPayload);
    } else {
      return await uploadTaskImage(mediaPayload);
    }
  } catch (error) {
    console.error('[MediaGateway] Gagal memproses media payload:', error);
    return mediaPayload;
  }
}

/**
 * Menghapus file tunggal dari penyedia cloud yang sesuai (Cloudinary, R2, atau Supabase)
 */
export async function deleteTaskMedia(mediaUrl: string): Promise<boolean> {
  if (!mediaUrl || mediaUrl.startsWith('data:')) return false;

  try {
    // 1. Cek apakah file berada di Cloudinary
    if (mediaUrl.includes('cloudinary.com')) {
      return await deleteImageFromCloudinary(mediaUrl);
    }

    // 2. Cek apakah file berada di Cloudflare R2
    const r2Domain = process.env.R2_PUBLIC_DOMAIN;
    if (
      mediaUrl.includes('.r2.dev') ||
      mediaUrl.includes('.r2.cloudflarestorage.com') ||
      (r2Domain && mediaUrl.startsWith(r2Domain)) ||
      mediaUrl.includes('/audio/hafalan_')
    ) {
      return await deleteAudioFromR2(mediaUrl);
    }

    // 3. Cek apakah file berada di Supabase Storage
    if (mediaUrl.includes('/storage/v1/object/public/')) {
      const supabase = getSupabaseStorageClient();
      if (supabase) {
        if (mediaUrl.includes('/tugas-foto/')) {
          const fileName = mediaUrl.split('/tugas-foto/')[1];
          if (fileName) await supabase.storage.from('tugas-foto').remove([fileName]);
          return true;
        }
        if (mediaUrl.includes('/tugas-audio/')) {
          const fileName = mediaUrl.split('/tugas-audio/')[1];
          if (fileName) await supabase.storage.from('tugas-audio').remove([fileName]);
          return true;
        }
      }
    }
  } catch (e) {
    console.warn('[MediaGateway] Gagal hapus media dari storage:', e);
  }

  return false;
}

/**
 * Otomatis menghapus media usang dari cloud ketika santri mengedit / menghapus file
 * Hanya menghapus file yang ada di oldMediaPayload tapi TIDAK ada di newMediaPayload
 */
export async function deleteUnusedMedia(
  oldMediaPayload: string | null | undefined,
  newMediaPayload: string | null | undefined
): Promise<void> {
  if (!oldMediaPayload) return;

  const oldUrls = parseMediaUrls(oldMediaPayload);
  const newUrls = parseMediaUrls(newMediaPayload);

  // Cari berkas lama yang sudah tidak lagi dipakai di data baru
  const filesToDelete = oldUrls.filter(
    (oldUrl) => oldUrl && !oldUrl.startsWith('data:') && !newUrls.includes(oldUrl)
  );

  if (filesToDelete.length === 0) return;

  console.log(`[MediaGateway] Membersihkan ${filesToDelete.length} berkas media usang dari cloud storage...`);

  await Promise.allSettled(filesToDelete.map((url) => deleteTaskMedia(url)));
}
