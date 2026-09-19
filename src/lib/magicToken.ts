import crypto from 'crypto';

const MAGIC_SECRET = process.env.MAGIC_LINK_SECRET || 'sistem-pengajian-magic-secret-key-2026';

export interface MagicTokenPayload {
  submissionId: string;
  parentUserId?: string;
  exp: number;
}

/**
 * Membuat HMAC Signed Token untuk verifikasi paraf orang tua via WhatsApp
 * Berlaku default 48 jam.
 */
export function generateMagicToken(
  submissionId: string,
  parentUserId?: string,
  expiresInHours = 48
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `${submissionId}:${parentUserId || ''}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Memvalidasi HMAC Signed Token dan memeriksa masa kadaluarsa
 */
export function verifyMagicToken(token: string): {
  valid: boolean;
  submissionId?: string;
  parentUserId?: string;
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan tidak valid' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [submissionId, parentUserId, expStr] = data.split(':');
    const exp = parseInt(expStr, 10);

    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return { valid: false, error: 'Tanda tangan tautan tidak sah' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan verifikasi telah kadaluarsa' };
    }

    return {
      valid: true,
      submissionId,
      parentUserId: parentUserId || undefined,
    };
  } catch {
    return { valid: false, error: 'Tautan gagal diverifikasi' };
  }
}
