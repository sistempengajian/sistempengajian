import crypto from 'crypto';
import { z } from 'zod';

/**
 * Membandingkan dua string secara aman dari serangan timing attack (constant-time comparison).
 * Mengatasi kelemahan timingSafeEqual bawaan Node.js yang melempar TypeError jika panjang buffer berbeda.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Mendeteksi apakah input honeypot (field tersembunyi untuk bot) diisi.
 * Jika diisi oleh bot / crawler, fungsi ini mengembalikan true.
 */
export function isHoneypotTriggered(
  formDataOrObj: FormData | Record<string, unknown>,
  fieldName = 'website_url'
): boolean {
  let value: unknown;
  if (typeof FormData !== 'undefined' && formDataOrObj instanceof FormData) {
    value = formDataOrObj.get(fieldName);
  } else if (typeof formDataOrObj === 'object' && formDataOrObj !== null) {
    value = (formDataOrObj as Record<string, unknown>)[fieldName];
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return true;
  }
  return false;
}

/**
 * Memformat pesan error pertama dari ZodError ke bentuk string yang ramah pengguna.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Data input tidak valid';
}
