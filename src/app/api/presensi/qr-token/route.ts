import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
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
