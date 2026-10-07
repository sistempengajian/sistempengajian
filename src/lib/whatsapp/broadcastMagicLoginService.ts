import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { whatsAppClient } from '@/lib/whatsapp/WhatsAppClient';
import {
  normalizePhoneNumber,
  formatParentSalutation,
  formatTeacherSalutation,
  formatStudentSalutation,
} from '@/lib/whatsapp/utils';

function getBaseAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Service Handler: Broadcast Tautan Masuk Sekali Pakai (Magic Login Link)
 * Mengirimkan magic login link otomatis ke seluruh pengguna aktif yang terdaftar di sistem.
 */
export async function handleBroadcastMagicLogin(request: NextRequest) {
  try {
    // 1. Validasi Keamanan Token
    const authHeader = request.headers.get('authorization');
    const secretParam = request.nextUrl.searchParams.get('key');
    const isDryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
    const filterRole = request.nextUrl.searchParams.get('role')?.toUpperCase() as any;
    const validityDays = parseInt(request.nextUrl.searchParams.get('days') || '7', 10);
    const forceResend = request.nextUrl.searchParams.get('force') === 'true';
    const expectedSecret = process.env.CRON_SECRET || 'pengajian-cron-secret-2026';

    const isAuthorized =
      authHeader === `Bearer ${expectedSecret}` ||
      secretParam === expectedSecret ||
      process.env.NODE_ENV === 'development';

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak: Token otorisasi tidak valid.' },
        { status: 401 }
      );
    }

    const now = new Date();
    const appBaseUrl = getBaseAppUrl();

    // 2. Query Seluruh Pengguna Aktif yang Memiliki Nomor WhatsApp
    const userWhere: any = {
      status: 'ACTIVE',
      phoneNumber: {
        not: null,
      },
    };

    if (filterRole) {
      userWhere.roles = {
        some: {
          role: filterRole,
        },
      };
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        roles: true,
        organization: true,
        generation: true,
        children: {
          include: {
            student: {
              include: {
                generation: true,
              },
            },
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    // 3. Preload riwayat broadcast sebelumnya untuk proteksi anti-spam
    const existingLogs = await prisma.whatsAppMessageLog.findMany({
      where: {
        magicToken: {
          startsWith: 'BROADCAST_MAGIC_LOGIN_',
        },
      },
      select: {
        magicToken: true,
      },
    });
    const sentTokensSet = new Set(existingLogs.map((l) => l.magicToken));

    let sentCount = 0;
    let skippedCount = 0;
    const processLogs: string[] = [];
    const dryRunList: any[] = [];

    type DispatchTask = {
      userId: string;
      fullName: string;
      phoneNumber: string;
      primaryRole: string;
      execute: () => Promise<{ success: boolean; log: string; error?: string }>;
    };

    const dispatchQueue: DispatchTask[] = [];

    for (const user of users) {
      const normalizedPhone = normalizePhoneNumber(user.phoneNumber);
      if (!normalizedPhone) {
        skippedCount++;
        continue;
      }

      const dedupKey = `BROADCAST_MAGIC_LOGIN_${user.id}`;
      if (!forceResend && sentTokensSet.has(dedupKey)) {
        skippedCount++;
        continue;
      }

      const userRoles = user.roles.map((r) => r.role);
      const isSantri = userRoles.includes('SANTRI');
      const isParent = userRoles.includes('ORANG_TUA');
      const isTeacher = userRoles.includes('PENGAJAR') || userRoles.includes('WALI_KELAS');
      const isPj = userRoles.includes('PJ_KELOMPOK') || userRoles.includes('PJ_DESA') || userRoles.includes('PJ_DAERAH');
      const isAdmin = userRoles.includes('ADMIN_MASTER');

      // Tentukan Sapaan Personal Dinamis
      let sapaanPenerima = '';
      let roleLabel = 'Pengguna';

      if (isSantri) {
        roleLabel = 'Santri';
        const genName = user.generation?.name ? ` (Santri ${user.generation.name})` : '';
        sapaanPenerima = `${formatStudentSalutation(user.fullName)}${genName}`;
      } else if (isParent) {
        roleLabel = 'Wali Santri';
        const childrenNames = user.children.map((c) => c.student.fullName).join(', ');
        const childInfo = childrenNames ? ` (Wali dari Ananda ${childrenNames})` : '';
        sapaanPenerima = `Yth. *${formatParentSalutation(user.fullName, user.gender)}*${childInfo}`;
      } else if (isTeacher) {
        roleLabel = 'Dewan Pengajar';
        sapaanPenerima = `Yth. *${formatTeacherSalutation(user.fullName, user.gender)}*`;
      } else if (isPj || isAdmin) {
        roleLabel = 'Pengurus';
        const titlePj = user.gender === 'FEMALE' ? 'Ustadzah/Ibu' : 'Bapak/Ustadz';
        sapaanPenerima = `Yth. *${titlePj} ${user.fullName}*`;
      } else {
        sapaanPenerima = `Yth. *${user.fullName}*`;
      }

      const orgName = user.organization?.name || 'Sistem Pengajian';

      if (isDryRun) {
        dryRunList.push({
          userId: user.id,
          fullName: user.fullName,
          gender: user.gender,
          phoneNumber: normalizedPhone,
          role: roleLabel,
          organization: orgName,
          sapaanPreview: sapaanPenerima,
          sampleLoginUrl: `${appBaseUrl}/login/magic/SAMPLE_MAGIC_TOKEN_${user.id.slice(0, 8)}`,
        });
        continue;
      }

      // Buat token unik sekali pakai untuk login (Masa aktif: validityDays hari)
      const magicToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
      const magicLoginUrl = `${appBaseUrl}/login/magic/${magicToken}`;

      dispatchQueue.push({
        userId: user.id,
        fullName: user.fullName,
        phoneNumber: normalizedPhone,
        primaryRole: roleLabel,
        execute: async () => {
          // 1. Simpan Token Login ke Database
          await prisma.whatsAppLoginToken.create({
            data: {
              token: magicToken,
              phoneNumber: normalizedPhone,
              userId: user.id,
              expiresAt,
              isUsed: false,
            },
          });

          // 2. Kirim pesan WhatsApp
          const sendRes = await whatsAppClient.sendMessage({
            to: normalizedPhone,
            recipientName: user.fullName,
            recipientUserId: user.id,
            messageType: 'CUSTOM_DIRECT',
            templateCode: 'BROADCAST_MAGIC_LOGIN',
            message: '',
            templateVariables: {
              sapaan_penerima: sapaanPenerima,
              magic_login_url: magicLoginUrl,
              nama_kelompok: orgName,
            },
            magicToken: dedupKey,
          });

          return {
            success: Boolean(sendRes.success),
            log: `[Magic Link Login] ${sapaanPenerima} (${normalizedPhone})`,
            error: sendRes.error,
          };
        },
      });
    }

    if (isDryRun) {
      return NextResponse.json({
        success: true,
        mode: 'SIMULATION_PREVIEW (DRY RUN)',
        message: 'Simulasi broadcast link login berhasil dipindai tanpa mengirim pesan.',
        validityDays,
        filterRole: filterRole || 'ALL_ROLES',
        totalEligibleUsers: dryRunList.length,
        alreadySentBefore: skippedCount,
        recipientsPreview: dryRunList,
        instructions: {
          howToExecuteLive: `Akses URL ini tanpa parameter dry_run untuk mengirim pesan riil: ${appBaseUrl}/api/cron/schedule-reminders?action=broadcast_login&key=${expectedSecret}${filterRole ? `&role=${filterRole}` : ''}`,
        },
      });
    }

    // 4. Eksekusi antrean secara berurutan (pacing) dengan batas waktu aman 50 detik
    const startTimeMs = Date.now();
    const MAX_EXECUTION_TIME_MS = 50000;
    let consecutiveErrors = 0;

    for (let i = 0; i < dispatchQueue.length; i++) {
      if (Date.now() - startTimeMs > MAX_EXECUTION_TIME_MS) {
        processLogs.push(
          `[Peringatan] Batas waktu pemrosesan tercapai. Sisa ${
            dispatchQueue.length - i
          } pengguna akan dilanjutkan pada pemicuan cron berikutnya.`
        );
        break;
      }

      if (consecutiveErrors >= 5) {
        processLogs.push(
          `[Circuit Breaker] Gateway WhatsApp tidak merespons (Offline/Timeout berulang). Menghentikan sisa antrean.`
        );
        break;
      }

      const item = dispatchQueue[i];
      try {
        const res = await item.execute();
        if (res.success) {
          sentCount++;
          consecutiveErrors = 0;
          processLogs.push(res.log);
        } else {
          consecutiveErrors++;
          processLogs.push(`[Gagal] ${res.log}: ${res.error || 'Unknown'}`);
        }
      } catch (err: any) {
        consecutiveErrors++;
        processLogs.push(`[Error] Eksekusi pesan gagal: ${err?.message || 'Error'}`);
      }

      // Jeda 350ms antar pesan agar antrean socket WAHA tetap stabil
      if (i < dispatchQueue.length - 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    console.log(
      `[Broadcast Magic Login] Selesai: ${sentCount} terkirim, ${skippedCount} dilewati dari total ${dispatchQueue.length} antrean.`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      filterRole: filterRole || 'ALL_ROLES',
      totalUsersMatched: users.length,
      sentCount,
      skippedCount,
      totalQueued: dispatchQueue.length,
      logs: processLogs.slice(0, 50),
    });
  } catch (error: any) {
    console.error('[Broadcast Magic Login Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Terjadi kesalahan sistem saat menjalankan broadcast magic login.',
      },
      { status: 500 }
    );
  }
}
