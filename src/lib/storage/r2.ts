import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

/**
 * Konfigurasi Cloudflare R2 dari Environment Variables
 */
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || 'sistem-pengajian-audio';
  let publicDomain = process.env.R2_PUBLIC_DOMAIN;

  const isConfigured = Boolean(
    accountId &&
      accessKeyId &&
      secretAccessKey &&
      !accountId.includes('your-') &&
      !accessKeyId.includes('your-')
  );

  if (publicDomain && publicDomain.endsWith('/')) {
    publicDomain = publicDomain.slice(0, -1);
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain,
    isConfigured,
  };
}

let s3ClientInstance: S3Client | null = null;

function getR2Client(): S3Client | null {
  const config = getR2Config();
  if (!config.isConfigured || !config.accountId || !config.accessKeyId || !config.secretAccessKey) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Upload file audio hafalan ke Cloudflare R2 (Bebas Biaya Egress Bandwidth)
 * @param audioSource Base64 Data URL atau Buffer audio
 * @param customFileName Nama file opsional
 */
export async function uploadAudioToR2(
  audioSource: string | Buffer,
  customFileName?: string
): Promise<{ url: string; key: string } | null> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config.isConfigured || !client) {
    console.warn('[Cloudflare R2] Kredensial belum dikonfigurasi, beralih ke fallback storage.');
    return null;
  }

  try {
    let buffer: Buffer;
    let contentType = 'audio/webm';

    if (typeof audioSource === 'string') {
      // Parse Base64 Data URL
      const matches = audioSource.match(/^data:(audio\/[\w-]+);base64,(.+)$/);
      if (matches) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(audioSource, 'base64');
      }
    } else {
      buffer = audioSource;
    }

    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const extension = contentType.includes('webm')
      ? 'webm'
      : contentType.includes('mp4') || contentType.includes('m4a')
      ? 'm4a'
      : 'ogg';

    const key = customFileName
      ? `audio/${customFileName}`
      : `audio/hafalan_${Date.now()}_${randomSuffix}.${extension}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(uploadCommand);

    // Bangun URL publik R2
    const publicBase =
      config.publicDomain ||
      `https://${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;
    const publicUrl = `${publicBase}/${key}`;

    return {
      url: publicUrl,
      key,
    };
  } catch (error) {
    console.error('[Cloudflare R2] Gagal upload audio ke R2:', error);
    return null;
  }
}

/**
 * Mengekstrak S3 Key file dari URL Cloudflare R2
 */
export function extractR2Key(urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  // Jika sudah berupa key (misal 'audio/hafalan_123.webm')
  if (urlOrKey.startsWith('audio/')) return urlOrKey;

  try {
    const parsed = new URL(urlOrKey);
    const pathname = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    // Cari bagian yang diawali dengan 'audio/'
    const audioIdx = pathname.indexOf('audio/');
    if (audioIdx !== -1) {
      return pathname.slice(audioIdx);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

/**
 * Menghapus file audio dari Cloudflare R2 bucket
 * @param urlOrKey URL lengkap atau Object Key di R2
 */
export async function deleteAudioFromR2(urlOrKey: string): Promise<boolean> {
  const config = getR2Config();
  const client = getR2Client();

  if (!config.isConfigured || !client) {
    return false;
  }

  const key = extractR2Key(urlOrKey);
  if (!key) return false;

  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    });

    await client.send(deleteCommand);
    console.log(`[Cloudflare R2] Berhasil menghapus file audio usang: ${key}`);
    return true;
  } catch (error) {
    console.error('[Cloudflare R2] Gagal menghapus file dari R2:', error);
    return false;
  }
}
