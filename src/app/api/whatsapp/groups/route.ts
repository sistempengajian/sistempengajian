import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { whatsAppClient } from '@/lib/whatsapp/WhatsAppClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/whatsapp/groups
 * Mengambil daftar grup WhatsApp yang terdeteksi dari gateway WAHA
 * Khusus untuk Pengelola (ADMIN_MASTER, PJ_DAERAH, KETUA_KELOMPOK, OPERATOR)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json(
        { success: false, message: 'Tidak terautentikasi. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const userProfile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        roles: {
          select: { role: true },
        },
      },
    });

    const roleCodes = userProfile?.roles.map((r) => r.role) || [];
    const canManage =
      roleCodes.includes('ADMIN_MASTER') ||
      roleCodes.includes('PJ_DAERAH') ||
      roleCodes.includes('PJ_DESA') ||
      roleCodes.includes('PJ_KELOMPOK');

    if (!canManage) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Anda tidak memiliki izin mengelola grup WhatsApp.' },
        { status: 403 }
      );
    }

    const groups = await whatsAppClient.fetchGroups();

    return NextResponse.json({
      success: true,
      groups,
      count: groups.length,
    });
  } catch (error: any) {
    console.error('[API /api/whatsapp/groups] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil daftar grup WhatsApp' },
      { status: 500 }
    );
  }
}
