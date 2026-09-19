import crypto from 'crypto';

/**
 * Konfigurasi Cloudinary dari Environment Variables
 */
function getCloudinaryConfig() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const isConfigured = Boolean(
    cloudName &&
      apiKey &&
      apiSecret &&
      !cloudName.includes('your-') &&
      !apiKey.includes('your-')
  );

  return {
    cloudName,
    apiKey,
    apiSecret,
    isConfigured,
  };
}

/**
 * Menghasilkan signature SHA-1 untuk upload terautentikasi ke Cloudinary
 */
function generateCloudinarySignature(params: Record<string, any>, apiSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(serialized + apiSecret)
    .digest('hex');
}

/**
 * Upload gambar / foto lembar kerja ke Cloudinary (dengan auto-format & auto-quality)
 * @param imageSource File string (Base64 data URL) atau Buffer
 * @param publicId Optional public_id / nama file acak
 */
export async function uploadImageToCloudinary(
  imageSource: string,
  folder = 'sistem-pengajian/tugas'
): Promise<{ url: string; publicId: string } | null> {
  const config = getCloudinaryConfig();

  if (!config.isConfigured || !config.cloudName || !config.apiKey || !config.apiSecret) {
    console.warn('[Cloudinary] Kredensial belum dikonfigurasi, beralih ke fallback storage.');
    return null;
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
    };

    const signature = generateCloudinarySignature(paramsToSign, config.apiSecret);

    const formData = new FormData();
    formData.append('file', imageSource);
    formData.append('api_key', config.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Cloudinary] Upload gagal:', errText);
      return null;
    }

    const data = await res.json();

    // Memanfaatkan transformasi dinamis q_auto, f_auto Cloudinary
    // Contoh URL: https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v1234/folder/file.webp
    let secureUrl = data.secure_url as string;
    if (secureUrl.includes('/upload/')) {
      secureUrl = secureUrl.replace('/upload/', '/upload/f_auto,q_auto/');
    }

    return {
      url: secureUrl,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('[Cloudinary] Error saat upload foto:', error);
    return null;
  }
}

/**
 * Mengekstrak public_id Cloudinary dari URL lengkap
 */
export function extractCloudinaryPublicId(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;

  try {
    const parts = url.split('/image/upload/');
    if (parts.length < 2) return null;

    const path = parts[1];
    const segments = path.split('/');
    const cleanSegments: string[] = [];
    let hasPassedTransformations = false;

    for (const seg of segments) {
      // Abaikan parameter transformasi (seperti f_auto, q_auto, w_300, dll.)
      if (!hasPassedTransformations && (seg.includes(',') || seg.startsWith('w_') || seg.startsWith('h_') || seg.startsWith('c_') || seg === 'f_auto' || seg === 'q_auto')) {
        continue;
      }
      // Abaikan segmen versi (seperti v1726053821)
      if (!hasPassedTransformations && /^v\d+$/.test(seg)) {
        hasPassedTransformations = true;
        continue;
      }
      hasPassedTransformations = true;
      cleanSegments.push(seg);
    }

    const fullPath = cleanSegments.join('/');
    // Hapus ekstensi (.webp, .jpg, dll.)
    return fullPath.replace(/\.[^/.]+$/, '') || null;
  } catch (e) {
    console.warn('[Cloudinary] Gagal ekstrak public_id:', e);
    return null;
  }
}

/**
 * Menghapus file gambar dari Cloudinary agar storage tidak membengkak
 * @param urlOrPublicId URL Cloudinary atau public_id file
 */
export async function deleteImageFromCloudinary(urlOrPublicId: string): Promise<boolean> {
  const config = getCloudinaryConfig();
  if (!config.isConfigured || !config.cloudName || !config.apiKey || !config.apiSecret) {
    return false;
  }

  const publicId = urlOrPublicId.includes('cloudinary.com')
    ? extractCloudinaryPublicId(urlOrPublicId)
    : urlOrPublicId;

  if (!publicId) return false;

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      public_id: publicId,
      timestamp,
    };

    const signature = generateCloudinarySignature(paramsToSign, config.apiSecret);

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', config.apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const result = await res.json();
      const isSuccess = result.result === 'ok' || result.result === 'not found';
      if (isSuccess) {
        console.log(`[Cloudinary] Berhasil menghapus file usang: ${publicId}`);
      }
      return isSuccess;
    }
    return false;
  } catch (err) {
    console.error('[Cloudinary] Gagal menghapus file dari Cloudinary:', err);
    return false;
  }
}
