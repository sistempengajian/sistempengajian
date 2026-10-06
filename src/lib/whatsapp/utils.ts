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
