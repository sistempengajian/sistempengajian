/**
 * Helper utility untuk manipulasi nomor telepon dan URL WhatsApp
 */

export function normalizePhoneNumber(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;

  // Hapus semua karakter selain angka
  let cleaned = rawPhone.replace(/\D/g, '');

  if (!cleaned) return null;

  // Jika diawali dengan '0', ganti menjadi kode negara '62'
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }

  return cleaned;
}

export function displayPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 10 && cleaned.length <= 13) {
    if (cleaned.startsWith('0')) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    if (cleaned.startsWith('62')) {
      return `+62 ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
    }
  }
  return phone;
}

export function formatWhatsAppDirectUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encodedMessage}`;
}

export function formatWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  return formatWhatsAppDirectUrl(phone, message);
}

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function sanitizeUuid(id: string | null | undefined): string | null {
  return isValidUuid(id) ? (id as string) : null;
}

/**
 * Menghasilkan variasi format nomor telepon yang sah secara kanonikal
 * (lokal 08x, internasional 62x, +62x, format strip, dan format spasi)
 * untuk pencarian eksak tanpa risiko salah akun (false-positive).
 */
export function getCanonicalPhoneVariants(rawPhone: string | null | undefined): string[] {
  if (!rawPhone) return [];
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) return [];

  const localFormat = normalized.startsWith('62') ? '0' + normalized.slice(2) : normalized;
  const variants = new Set<string>();

  variants.add(normalized); // '6281234567890'
  variants.add(localFormat); // '081234567890'
  variants.add(`+${normalized}`); // '+6281234567890'

  if (localFormat.length >= 10 && localFormat.length <= 13) {
    // 0812-3456-7890
    variants.add(`${localFormat.slice(0, 4)}-${localFormat.slice(4, 8)}-${localFormat.slice(8)}`);
    // 0812 3456 7890
    variants.add(`${localFormat.slice(0, 4)} ${localFormat.slice(4, 8)} ${localFormat.slice(8)}`);
  }

  if (normalized.length >= 11 && normalized.length <= 14) {
    // +62 812-3456-7890
    variants.add(`+62 ${normalized.slice(2, 5)}-${normalized.slice(5, 9)}-${normalized.slice(9)}`);
    // +62 812 3456 7890
    variants.add(`+62 ${normalized.slice(2, 5)} ${normalized.slice(5, 9)} ${normalized.slice(9)}`);
  }

  const rawTrimmed = rawPhone.trim();
  if (rawTrimmed) {
    variants.add(rawTrimmed);
  }

  return Array.from(variants);
}

/**
 * Helper untuk memformat title sapaan orang tua secara dinamis (Bapak / Ibu / Bapak/Ibu)
 */
export function formatParentSalutation(
  parentName: string,
  gender?: string | null,
  relationshipType?: string | null
): string {
  const cleanName = parentName.trim();
  if (relationshipType === 'AYAH' || gender === 'MALE') {
    return `Bapak ${cleanName}`;
  }
  if (relationshipType === 'IBU' || gender === 'FEMALE') {
    return `Ibu ${cleanName}`;
  }
  return `Bapak/Ibu ${cleanName}`;
}

/**
 * Helper untuk memformat title sapaan pengajar (Ustadz / Ustadzah)
 */
export function formatTeacherSalutation(
  teacherName: string,
  gender?: string | null
): string {
  const cleanName = teacherName.trim();
  if (gender === 'FEMALE') {
    return `Ustadzah ${cleanName}`;
  }
  return `Ustadz ${cleanName}`;
}

/**
 * Helper untuk memformat title sapaan santri (Kak [Nama Santri] tanpa kata Yth.)
 */
export function formatStudentSalutation(studentName: string): string {
  return `Kak ${studentName.trim()}`;
}

/**
 * Helper untuk memformat blok catatan tambahan jadwal (jika ada)
 */
export function formatScheduleNotesBlock(notes?: string | null): string {
  if (!notes || !notes.trim()) return '';
  return `\n📝 *Catatan Khusus:*\n${notes.trim()}\n`;
}
