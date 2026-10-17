/**
 * Memeriksa apakah tujuan merupakan ID / JID Grup WhatsApp (akhiran @g.us)
 */
export function isWhatsAppGroupJid(target: string | null | undefined): boolean {
  if (!target) return false;
  const trimmed = target.trim();
  return trimmed.endsWith('@g.us') || trimmed.endsWith('@temp');
}

/**
 * Memeriksa apakah tujuan merupakan ID / JID WhatsApp bertipe LID (akhiran @lid)
 */
export function isWhatsAppLidJid(target: string | null | undefined): boolean {
  if (!target) return false;
  const trimmed = target.trim();
  return trimmed.endsWith('@lid');
}

/**
 * Menormalisasi target tujuan pesan WhatsApp, mendukung nomor HP personal (628xxx), JID Grup (@g.us), maupun LID (@lid)
 */
export function normalizeRecipientDestination(rawTarget: string | null | undefined): string | null {
  if (!rawTarget) return null;
  const trimmed = rawTarget.trim();
  if (isWhatsAppGroupJid(trimmed) || isWhatsAppLidJid(trimmed) || trimmed.endsWith('@c.us')) {
    return trimmed;
  }
  return normalizePhoneNumber(trimmed);
}

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
 * Helper untuk memformat blok catatan tambahan jadwal (jika ada) dan pesan khusus pengajar
 */
export function formatScheduleNotesBlock(
  notes?: string | null,
  teacherBroadcastNote?: string | null
): string {
  const parts: string[] = [];
  if (notes && notes.trim()) {
    parts.push(`*• Catatan* _${notes.trim()}_`);
  }
  if (teacherBroadcastNote && teacherBroadcastNote.trim()) {
    parts.push(`*• Pesan Pengajar* _${teacherBroadcastNote.trim()}_`);
  }
  if (parts.length === 0) return '';
  return `\n${parts.join('\n')}\n`;
}

/**
 * Helper untuk memformat blok kelas / jenjang jadwal:
 * - Jika 1 kelas: ` _Remaja (Kelas A)_`
 * - Jika >1 kelas:
 *   \n`- Remaja 1`
 *   \n`- Remaja 2`
 *   \n`- Remaja 3`
 */
export function formatScheduleClassBlock(classes: string | string[] | null | undefined): string {
  if (!classes) return ' _Semua Kelas_';

  let list: string[] = [];
  if (Array.isArray(classes)) {
    list = classes.map((c) => c.trim()).filter(Boolean);
  } else if (typeof classes === 'string') {
    if (classes.includes('\n')) {
      list = classes
        .split('\n')
        .map((c) => c.replace(/^[-*•`\s]+/, '').replace(/`+$/, '').trim())
        .filter(Boolean);
    } else if (classes.includes(',')) {
      list = classes.split(',').map((c) => c.trim()).filter(Boolean);
    } else {
      list = [classes.trim()];
    }
  }

  if (list.length === 0) {
    return ' _Semua Kelas_';
  }

  if (list.length === 1) {
    return ` _${list[0]}_`;
  }

  const formattedItems = list.map((item) => `\`- ${item}\``).join('\n');
  return `\n${formattedItems}`;
}

/**
 * Helper untuk memformat blok materi ajar jadwal:
 * - Jika 1 materi: ` _Tafsir Surat Al-Hujurat_`
 * - Jika >1 materi:
 *   \n`- Alim-Faqih Okt`
 *   \n`- Akhlakul Karimah Okt`
 *   \n`- Kemandirian Okt`
 */
export function formatScheduleMaterialsBlock(materials: string | string[] | null | undefined): string {
  if (!materials) return ' _Materi Pengajian Rutin_';

  let list: string[] = [];
  if (Array.isArray(materials)) {
    list = materials.map((m) => m.trim()).filter(Boolean);
  } else if (typeof materials === 'string') {
    if (materials.includes('\n')) {
      list = materials
        .split('\n')
        .map((m) => m.replace(/^[-*•`\s]+/, '').replace(/`+$/, '').trim())
        .filter(Boolean);
    } else if (materials.includes(',')) {
      list = materials.split(',').map((m) => m.trim()).filter(Boolean);
    } else {
      list = [materials.trim()];
    }
  }

  if (list.length === 0) {
    return ' _Materi Pengajian Rutin_';
  }

  if (list.length === 1) {
    return ` _${list[0]}_`;
  }

  const formattedItems = list.map((item) => `\`- ${item}\``).join('\n');
  return `\n${formattedItems}`;
}

/**
 * Helper untuk memformat materi pada ringkasan santri keluarga (Family Digest):
 * - Jika 1 materi: ` _Judul Materi_` (inline)
 * - Jika >1 materi:
 *   \n   `- Materi 1`
 *   \n   `- Materi 2`
 */
export function formatFamilyStudentMaterialsBlock(
  materials: string | string[] | null | undefined,
  indent = '   '
): string {
  if (!materials) return ' _Materi Pengajian Rutin_';

  let list: string[] = [];
  if (Array.isArray(materials)) {
    list = materials.map((m) => m.trim()).filter(Boolean);
  } else if (typeof materials === 'string') {
    if (materials.includes('\n')) {
      list = materials
        .split('\n')
        .map((m) => m.replace(/^[-*•`\s]+/, '').replace(/`+$/, '').trim())
        .filter(Boolean);
    } else if (materials.includes(',')) {
      list = materials.split(',').map((m) => m.trim()).filter(Boolean);
    } else {
      list = [materials.trim()];
    }
  }

  if (list.length === 0) {
    return ' _Materi Pengajian Rutin_';
  }

  if (list.length === 1) {
    return ` _${list[0]}_`;
  }

  const formattedItems = list.map((item) => `${indent}\`- ${item}\``).join('\n');
  return `\n${formattedItems}`;
}

export function getBaseAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
