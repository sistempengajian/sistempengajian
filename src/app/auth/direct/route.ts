import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyDirectPresensiToken } from '@/lib/badalToken';
import {
  verifyStudentDirectPresensiToken,
  verifyFamilyActionHubToken,
  verifyTeacherLessonPlanToken,
} from '@/lib/studentAbsenceToken';

export const dynamic = 'force-dynamic';

/**
 * Route Handler: Akses Langsung Absensi Pengajar / Santri / Orang Tua Tanpa Login Manual
 * Menerima token HMAC, menginisialisasi sesi otentikasi browser, dan redirect ke cockpit absensi jadwal
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');
  const token = searchParams.get('token');
  const fallbackScheduleId = searchParams.get('scheduleId');
  const studentIdParam = searchParams.get('studentId');

  const baseUrl = request.nextUrl.origin;

  const tab = searchParams.get('tab');
  const tabSuffix = tab ? `&tab=${encodeURIComponent(tab)}` : '';
  const studentSuffix = studentIdParam ? `&studentId=${encodeURIComponent(studentIdParam)}` : '';

  if (!token) {
    const targetUrl = fallbackScheduleId
      ? `/presensi?scheduleId=${fallbackScheduleId}${studentSuffix}${tabSuffix}`
      : '/presensi';
    return NextResponse.redirect(`${baseUrl}/login?redirect=${encodeURIComponent(targetUrl)}`);
  }

  let scheduleId: string | undefined;
  let targetUserId: string | undefined;

  if (target === 'presensi_santri') {
    const result = verifyStudentDirectPresensiToken(token);
    if (!result.valid || !result.scheduleId || !result.studentId) {
      console.warn('[DirectAuth Presensi Santri] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId
        ? `/presensi?scheduleId=${fallbackScheduleId}${studentSuffix}${tabSuffix}`
        : '/presensi';
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent(result.error || 'Tautan absensi santri kedaluwarsa')}&redirect=${encodeURIComponent(targetUrl)}`
      );
    }
    scheduleId = result.scheduleId;
    targetUserId = result.studentId;
  } else if (target === 'presensi_ortu' || target === 'presensi_keluarga') {
    const result = verifyFamilyActionHubToken(token);
    if (!result.valid || !result.scheduleId || !result.parentUserId) {
      console.warn('[DirectAuth Presensi Ortu] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId
        ? `/presensi?scheduleId=${fallbackScheduleId}${studentSuffix}${tabSuffix}`
        : '/presensi';
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent(result.error || 'Tautan presensi orang tua tidak sah atau kedaluwarsa')}&redirect=${encodeURIComponent(targetUrl)}`
      );
    }
    scheduleId = result.scheduleId;
    targetUserId = result.parentUserId;
  } else if (target === 'persiapan_mengajar' || target === 'rencana_materi') {
    const result = verifyTeacherLessonPlanToken(token);
    if (!result.valid || !result.scheduleId || !result.teacherUserId) {
      console.warn('[DirectAuth Persiapan Mengajar] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId
        ? `/pengajar/sesi/${token}`
        : '/presensi';
      return NextResponse.redirect(
        `${baseUrl}/login?auth_error=${encodeURIComponent(result.error || 'Tautan rencana ajar pengajar tidak sah atau kedaluwarsa')}&redirect=${encodeURIComponent(targetUrl)}`
      );
    }
    scheduleId = result.scheduleId;
    targetUserId = result.teacherUserId;
  } else {
    // Default: Presensi Pengajar
    const result = verifyDirectPresensiToken(token);
    if (!result.valid || !result.scheduleId || !result.teacherUserId) {
      console.warn('[DirectAuth Presensi] Token tidak valid:', result.error);
      const targetUrl = fallbackScheduleId
        ? `/presensi?scheduleId=${fallbackScheduleId}${studentSuffix}${tabSuffix}`
        : '/presensi';
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

    if (target === 'persiapan_mengajar' || target === 'rencana_materi') {
      return NextResponse.redirect(`${baseUrl}/pengajar/sesi/${token}`);
    }

    const effectiveScheduleId = scheduleId || fallbackScheduleId;
    const redirectUrl = effectiveScheduleId
      ? `${baseUrl}/presensi?scheduleId=${encodeURIComponent(effectiveScheduleId)}${studentSuffix}${tabSuffix}`
      : `${baseUrl}/presensi`;

    // Redirect langsung ke Cockpit Presensi Sesi Terkait (dengan tab & studentId yang diminta jika ada)
    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[DirectAuth Presensi Exception]:', err);
    if (target === 'persiapan_mengajar' || target === 'rencana_materi') {
      return NextResponse.redirect(`${baseUrl}/pengajar/sesi/${token}`);
    }
    const effectiveScheduleId = scheduleId || fallbackScheduleId;
    const redirectUrl = effectiveScheduleId
      ? `${baseUrl}/presensi?scheduleId=${encodeURIComponent(effectiveScheduleId)}${studentSuffix}${tabSuffix}`
      : `${baseUrl}/presensi`;
    return NextResponse.redirect(redirectUrl);
  }
}
