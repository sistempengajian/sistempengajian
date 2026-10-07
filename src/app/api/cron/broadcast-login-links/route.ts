import { NextRequest } from 'next/server';
import { handleBroadcastMagicLogin } from '@/lib/whatsapp/broadcastMagicLoginService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s execution

/**
 * Endpoint Khusus: Broadcast Tautan Masuk Sekali Pakai (Magic Login Link)
 * Mengirimkan magic login link otomatis ke seluruh pengguna aktif yang terdaftar di sistem.
 * 
 * Penggunaan:
 * - GET /api/cron/broadcast-login-links?key=pengajian-cron-secret-2026
 * - GET /api/cron/broadcast-login-links?key=pengajian-cron-secret-2026&dry_run=true (Simulasi aman tanpa kirim)
 * - GET /api/cron/broadcast-login-links?key=pengajian-cron-secret-2026&role=ORANG_TUA (Khusus role tertentu)
 * - GET /api/cron/broadcast-login-links?key=pengajian-cron-secret-2026&days=14 (Masa aktif token 14 hari)
 */
export async function GET(request: NextRequest) {
  return handleBroadcastMagicLogin(request);
}

export async function POST(request: NextRequest) {
  return handleBroadcastMagicLogin(request);
}
