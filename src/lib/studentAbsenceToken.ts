import crypto from 'crypto';

const MAGIC_SECRET = process.env.MAGIC_LINK_SECRET || 'sistem-pengajian-magic-secret-key-2026';

/**
 * 1. Token Pengajuan Izin/Sakit Santri Mandiri (Akses santri / ortu dari WA)
 */
export function generateStudentAbsenceRequestToken(
  scheduleId: string,
  studentId: string,
  submitterUserId: string,
  submitterRole: 'STUDENT' | 'PARENT',
  expiresInHours = 72
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `STU_ABS_REQ:${scheduleId}:${studentId}:${submitterUserId}:${submitterRole}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifyStudentAbsenceRequestToken(token: string): {
  valid: boolean;
  scheduleId?: string;
  studentId?: string;
  submitterUserId?: string;
  submitterRole?: 'STUDENT' | 'PARENT';
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan pengajuan izin tidak valid.' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, scheduleId, studentId, submitterUserId, submitterRole, expStr] = data.split(':');

    if (
      prefix !== 'STU_ABS_REQ' ||
      !scheduleId ||
      !studentId ||
      !submitterUserId ||
      !submitterRole ||
      !expStr
    ) {
      return { valid: false, error: 'Data tautan pengajuan izin tidak sesuai.' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return { valid: false, error: 'Tanda tangan digital tautan tidak sah.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan pengajuan izin telah kedaluwarsa (berlaku 72 jam).' };
    }

    return {
      valid: true,
      scheduleId,
      studentId,
      submitterUserId,
      submitterRole: submitterRole as 'STUDENT' | 'PARENT',
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan pengajuan izin.' };
  }
}

/**
 * 2. Token Konfirmasi Approval Izin/Sakit (Ortu, Wali Kelas, PJ Wilayah)
 */
export function generateStudentAbsenceApprovalToken(
  requestId: string,
  targetUserId: string,
  approverRole: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ',
  expiresInHours = 72
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `STU_ABS_CONF:${requestId}:${targetUserId}:${approverRole}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifyStudentAbsenceApprovalToken(token: string): {
  valid: boolean;
  requestId?: string;
  targetUserId?: string;
  approverRole?: 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ';
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan konfirmasi izin tidak valid.' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, requestId, targetUserId, approverRole, expStr] = data.split(':');

    if (prefix !== 'STU_ABS_CONF' || !requestId || !targetUserId || !approverRole || !expStr) {
      return { valid: false, error: 'Data tautan konfirmasi izin tidak sesuai.' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return { valid: false, error: 'Tanda tangan digital konfirmasi izin tidak sah.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan konfirmasi izin telah kedaluwarsa (berlaku 72 jam).' };
    }

    return {
      valid: true,
      requestId,
      targetUserId,
      approverRole: approverRole as 'PARENT' | 'HOMEROOM_TEACHER' | 'PJ',
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan konfirmasi izin.' };
  }
}

/**
 * 3. Token Akses Langsung Presensi Santri Tanpa Login Ulang
 */
export function generateStudentDirectPresensiToken(
  scheduleId: string,
  studentId: string,
  expiresInHours = 48
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const data = `STU_ATT:${scheduleId}:${studentId}:${exp}`;
  const signature = crypto
    .createHmac('sha256', MAGIC_SECRET)
    .update(data)
    .digest('hex');
  const payloadStr = Buffer.from(data).toString('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifyStudentDirectPresensiToken(token: string): {
  valid: boolean;
  scheduleId?: string;
  studentId?: string;
  error?: string;
} {
  try {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) {
      return { valid: false, error: 'Format tautan presensi santri tidak valid.' };
    }

    const data = Buffer.from(payloadStr, 'base64url').toString('utf-8');
    const [prefix, scheduleId, studentId, expStr] = data.split(':');

    if (prefix !== 'STU_ATT' || !scheduleId || !studentId || !expStr) {
      return { valid: false, error: 'Data tautan presensi santri tidak sesuai.' };
    }

    const exp = parseInt(expStr, 10);
    const expectedSignature = crypto
      .createHmac('sha256', MAGIC_SECRET)
      .update(data)
      .digest('hex');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return { valid: false, error: 'Tanda tangan tautan presensi santri tidak sah.' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: 'Tautan langsung presensi telah kedaluwarsa.' };
    }

    return {
      valid: true,
      scheduleId,
      studentId,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Gagal memverifikasi tautan presensi.' };
  }
}
