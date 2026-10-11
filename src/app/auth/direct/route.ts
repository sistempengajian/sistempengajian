import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyDirectPresensiToken } from '@/lib/badalToken';
import { verifyStudentDirectPresensiToken } from '@/lib/studentAbsenceToken';

export const dynamic = 'force-dynamic';

/**
 * Route Handler: Akses Langsung Absensi Pengajar / Santri Tanpa Login Manual
 * Menerima token HMAC, menginisialisasi sesi otentikasi browser, dan redirect ke cockpit absensi jadwal
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  const token = searchParams.get('token');
  const fallbackScheduleId = searchParams.get('scheduleId');

  const baseUrl = request.nextUrl.origin;

  if (!token) {
    const targetUrl = fallbackScheduleId ? `/presensi?scheduleId=${fallbackScheduleId}` : '/presensi';
    return NextResponse.redirect(`${baseUrl}/login?redirect=${encodeURIComponent(targetUrl)}`);
  }

  let scheduleId: string | undefined;
  let targetUserId: string | undefined;

  if (target === 'presensi_santri') {
    const result = verifyStudentDirectPresensiToken(token);
    if (!result.valid || !result.scheduleId || !result.studentId) {
      console.warn('[DirectAuth Presensi Santri] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId ? `/presensi?scheduleId=${fallbackScheduleId}` : '/presensi';
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent(result.error || 'Tautan absensi santri kedaluwarsa')}&redirect=${encodeURIComponent(targetUrl)}`
      );
    }
    scheduleId = result.scheduleId;
    targetUserId = result.studentId;
  } else {
    // Default: Presensi Pengajar
    const result = verifyDirectPresensiToken(token);
    if (!result.valid || !result.scheduleId || !result.teacherUserId) {
      console.warn('[DirectAuth Presensi] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId ? `/presensi?scheduleId=${fallbackScheduleId}` : '/presensi';
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent(result.error || 'Tautan absensi kedaluwarsa')}&redirect=${encodeURIComponent(targetUrl)}`
      );
    }
    scheduleId = result.scheduleId;
    targetUserId = result.teacherUserId;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        username: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent('Pengguna tidak aktif.')}`
      );
    }

    // Inisialisasi sesi login Supabase secara otomatis via Admin Client
    const supabaseAdmin = createAdminClient();
    const userEmail = user.email || `${user.username || user.id}@pengajian.app`;

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
    });

    if (linkData?.properties?.hashed_token && !linkErr) {
      const supabase = await createClient();
      await supabase.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });
    }

    // Redirect langsung ke Cockpit Presensi Sesi Terkait
    return NextResponse.redirect(`${baseUrl}/presensi?scheduleId=${scheduleId}`);
  } catch (err: any) {
    console.error('[DirectAuth Presensi Exception]:', err);
    return NextResponse.redirect(`${baseUrl}/presensi?scheduleId=${scheduleId}`);
  }
}
