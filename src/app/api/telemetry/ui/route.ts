import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserLean } from '@/lib/auth';
import {
  uiTelemetryEventSchema,
  recordUiTelemetryServer,
  getUiTelemetrySummary,
  detectDeviceFamilyFromUserAgent,
} from '@/lib/telemetry';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }

    const parsed = uiTelemetryEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Skema telemetri tidak valid.' },
        { status: 400 }
      );
    }

    const auth = await getAuthUserLean();
    const userAgent = request.headers.get('user-agent');
    const eventData = parsed.data;

    if (
      eventData.type === 'QR_SCAN_OUTCOME' &&
      eventData.deviceFamily === 'Unknown'
    ) {
      eventData.deviceFamily = detectDeviceFamilyFromUserAgent(userAgent);
    }

    await recordUiTelemetryServer(eventData, auth.effectiveUserId || null);

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUserLean();
    if (!auth.dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdminMaster = auth.dbUser.roles.some((r) => r.role === 'ADMIN_MASTER');
    if (!isAdminMaster) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const daysParam = Number(request.nextUrl.searchParams.get('days') || '30');
    const daysWindow =
      Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 180
        ? Math.round(daysParam)
        : 30;

    const summary = await getUiTelemetrySummary(daysWindow);
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error('[GET /api/telemetry/ui] Error:', err);
    return NextResponse.json(
      { error: 'Gagal memuat ringkasan telemetri UI.' },
      { status: 500 }
    );
  }
}
