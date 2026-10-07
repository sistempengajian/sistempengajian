import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateQrPayload } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'Session ID diperlukan' },
        { status: 400 }
      );
    }

    const { authUser, dbUser: userProfile } = await getEffectiveAuthUser();

    if (!authUser || !userProfile) {
      return NextResponse.json(
        { success: false, message: 'Tidak terautentikasi' },
        { status: 401 }
      );
    }

    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        dynamicQrSecret: true,
        qrRefreshSeconds: true,
        isActive: true,
        schedule: {
          select: {
            teachers: { select: { teacherId: true } },
          },
        },
      },
    });

    if (!session || !session.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sesi presensi telah ditutup atau tidak ditemukan.',
        },
        { status: 200 }
      );
    }

    const roleCodes = userProfile.roles.map((r: any) => r.role);
    const isPjOrAdmin = roleCodes.some((rc: string) =>
      ['PJ_KELOMPOK', 'PJ_DESA', 'PJ_DAERAH', 'ADMIN_MASTER'].includes(rc)
    );

    if (!isPjOrAdmin) {
      const isAssigned = session.schedule.teachers.some(
        (t) => t.teacherId === userProfile.id
      );
      if (!isAssigned) {
        return NextResponse.json(
          { success: false, message: 'Anda tidak memiliki akses ke QR sesi ini.' },
          { status: 403 }
        );
      }
    }

    const payload = generateQrPayload(
      session.id,
      session.dynamicQrSecret,
      session.qrRefreshSeconds
    );

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        ...payload,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error in GET /api/presensi/qr-token:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses token QR' },
      { status: 500 }
    );
  }
}
