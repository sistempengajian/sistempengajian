import crypto from 'crypto';
import { timingSafeCompare } from '@/lib/security-utils';

function getMagicSecret(): string {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SECURITY CONFIGURATION ERROR: MAGIC_LINK_SECRET environment variable must be set in production.'
      );
    }
    return 'dev-local-secret-do-not-use-in-prod-2026';
  }
  return secret;
}

export interface EvaluationTokenPayload {
  studentIds: string[];
  month: number;
  year: number;
  expiresInDays?: number;
}

export interface VerifiedEvaluationToken {
  valid: boolean;
  studentIds?: string[];
  month?: number;
  year?: number;
  error?: string;
}

interface RawTokenData {
  p: 'EVAL_SHEET';
  s: string[];
  m: number;
  y: number;
  exp: number;
}

/**
 * Membuat Token Tautan Lembar Evaluasi Bulanan (HMAC-SHA256 Signed Token)
 * Masa berlaku default: 45 hari (memungkinkan orang tua membuka arsip bulan lalu).
 */
export function createEvaluationToken(payload: EvaluationTokenPayload): string {
  const { studentIds, month, year, expiresInDays = 45 } = payload;

  if (!studentIds || studentIds.length === 0) {
    throw new Error('studentIds minimal harus memiliki 1 ID santri.');
  }

  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 3600;
  const rawData: RawTokenData = {
    p: 'EVAL_SHEET',
    s: studentIds,
    m: month,
    y: year,
    exp,
  };

  const payloadStr = Buffer.from(JSON.stringify(rawData)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getMagicSecret())
    .update(payloadStr)
    .digest('hex');

  return `${payloadStr}.${signature}`;
}

/**
 * Memverifikasi keabsahan dan integritas Token Lembar Evaluasi Bulanan
 */
export function verifyEvaluationToken(token: string): VerifiedEvaluationToken {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token lembar evaluasi tidak ditemukan.' };
    }

    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan lembar evaluasi tidak valid.' };
    }

    const expectedSignature = crypto
      .createHmac('sha256', getMagicSecret())
      .update(payloadStr)
      .digest('hex');

    if (!timingSafeCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Tanda tangan digital tautan tidak sah atau telah dimodifikasi.' };
    }

    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const data: RawTokenData = JSON.parse(jsonStr);

    if (
      data.p !== 'EVAL_SHEET' ||
      !Array.isArray(data.s) ||
      data.s.length === 0 ||
      typeof data.m !== 'number' ||
      typeof data.y !== 'number' ||
      typeof data.exp !== 'number'
    ) {
      return { valid: false, error: 'Struktur data tautan evaluasi tidak sesuai.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > data.exp) {
      return {
        valid: false,
        error: 'Tautan lembar evaluasi telah kedaluwarsa. Silakan hubungi pengurus untuk tautan terbaru.',
      };
    }

    return {
      valid: true,
      studentIds: data.s,
      month: data.m,
      year: data.y,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Gagal memverifikasi tautan lembar evaluasi.',
    };
  }
}
