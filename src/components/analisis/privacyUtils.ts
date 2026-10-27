/**
 * Utility for Privacy Mode (Sensor Nama) across Analysis & Export modules.
 * Masks each word cleanly, for example:
 * "Abdulah Mohammad Musa" -> "A*** M*** M***"
 * "Alya" -> "A***"
 */
export function maskStudentName(fullName: string | null | undefined, isPrivacyMode: boolean): string {
  if (!isPrivacyMode || !fullName) return fullName || '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => {
      if (!part) return '';
      return `${part[0]}***`;
    })
    .filter(Boolean)
    .join(' ');
}
