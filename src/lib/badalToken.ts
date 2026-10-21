import crypto from 'crypto';
import { timingSafeCompare } from '@/lib/security-utils';

const MAGIC_SECRET = process.env.MAGIC_LINK_SECRET || 'sistem-pengajian-magic-secret-key-2026';

/**
 * 1. Token Pengajuan Badal (Akses khusus Ustadz Pemohon dari WA)
 */
export function generateSubstituteRequestToken(
  scheduleId: string,
  teacherUserId: string,
  expiresInHours = 72
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `REQ:${scheduleId}:${teacherUserId}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifySubstituteRequestToken(token: string): {
  valid: boolean;
  scheduleId?: string;
  teacherUserId?: string;
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan pengajuan badal tidak valid' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, scheduleId, teacherUserId, expStr] = data.split(':');

    if (prefix !== 'REQ' || !scheduleId || !teacherUserId || !expStr) {
      return { valid: false, error: 'Data tautan pengajuan tidak sesuai' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (!timingSafeCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Tanda tangan digital tautan tidak sah' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan pengajuan badal telah kedaluwarsa' };
    }

    return {
      valid: true,
      scheduleId,
      teacherUserId,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan' };
  }
}

/**
 * 2. Token Konfirmasi Badal (Akses khusus Calon Badal & PJ Wilayah dari WA)
 */
export function generateSubstituteConfirmToken(
  requestId: string,
  targetUserId: string,
  targetRole: 'SUBSTITUTE' | 'PJ',
  expiresInHours = 72
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `CONF:${requestId}:${targetUserId}:${targetRole}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifySubstituteConfirmToken(token: string): {
  valid: boolean;
  requestId?: string;
  targetUserId?: string;
  targetRole?: 'SUBSTITUTE' | 'PJ';
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan konfirmasi tidak valid' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, requestId, targetUserId, targetRole, expStr] = data.split(':');

    if (prefix !== 'CONF' || !requestId || !targetUserId || !targetRole || !expStr) {
      return { valid: false, error: 'Data tautan konfirmasi tidak sesuai' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (!timingSafeCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Tanda tangan digital konfirmasi tidak sah' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan konfirmasi badal telah kedaluwarsa' };
    }

    return {
      valid: true,
      requestId,
      targetUserId,
      targetRole: targetRole as 'SUBSTITUTE' | 'PJ',
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan konfirmasi' };
  }
}

/**
 * 3. Token Akses Langsung Absensi Pengajar Tanpa Login Ulang
 */
export function generateDirectPresensiToken(
  scheduleId: string,
  teacherUserId: string,
  expiresInHours = 48
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `ATT:${scheduleId}:${teacherUserId}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifyDirectPresensiToken(token: string): {
  valid: boolean;
  scheduleId?: string;
  teacherUserId?: string;
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan absensi tidak valid' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, scheduleId, teacherUserId, expStr] = data.split(':');

    if (prefix !== 'ATT' || !scheduleId || !teacherUserId || !expStr) {
      return { valid: false, error: 'Data tautan absensi tidak sesuai' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (!timingSafeCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Tanda tangan tautan absensi tidak sah' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan langsung absensi telah kedaluwarsa' };
    }

    return {
      valid: true,
      scheduleId,
      teacherUserId,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan absensi' };
  }
}
