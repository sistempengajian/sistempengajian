import prisma from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { z } from 'zod';

export const UI_TELEMETRY_ENTITY = 'UI_TELEMETRY';

export const csatReasonSchema = z.enum([
  'SMALL_TEXT',
  'SMALL_BUTTON',
  'HARD_TO_FIND',
  'SLOW',
]);

export type CsatFeedbackReason = z.infer<typeof csatReasonSchema>;

export const uiTelemetryEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CSAT_FEEDBACK'),
    rating: z.enum(['UP', 'DOWN']),
    reason: csatReasonSchema.optional(),
    triggerAction: z.string().max(64).optional(),
    route: z.string().max(120),
    viewportWidth: z.number().int().min(100).max(5000).optional(),
  }),
  z.object({
    type: z.literal('ERROR_BOUNDARY'),
    sectionName: z.string().max(80).optional(),
    route: z.string().max(120),
    activeRole: z.string().max(40).optional(),
    viewportWidth: z.number().int().min(100).max(5000).optional(),
    errorSummary: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal('ROLE_SWITCH'),
    fromRole: z.string().max(40),
    toRole: z.string().max(40),
    route: z.string().max(120),
    viewportWidth: z.number().int().min(100).max(5000).optional(),
  }),
  z.object({
    type: z.literal('QR_SCAN_OUTCOME'),
    outcome: z.enum(['SUCCESS', 'FAILED']),
    context: z.enum(['STUDENT', 'PARENT', 'BATCH']).default('STUDENT'),
    reasonBucket: z.string().max(64).optional(),
    deviceFamily: z.enum(['iOS', 'Android', 'Desktop', 'Unknown']).default('Unknown'),
    route: z.string().max(120).optional(),
    viewportWidth: z.number().int().min(100).max(5000).optional(),
  }),
]);

export type UiTelemetryEventInput = z.infer<typeof uiTelemetryEventSchema>;

export function detectDeviceFamilyFromUserAgent(ua?: string | null): 'iOS' | 'Android' | 'Desktop' | 'Unknown' {
  if (!ua) return 'Unknown';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mozilla|Chrome|Safari|Firefox|Edg/i.test(ua)) return 'Desktop';
  return 'Unknown';
}

/**
 * Mencatat telemetri friksi ringan & Micro-CSAT secara privacy-first menggunakan
 * tabel AuditLog yang sudah ada + counter opsional Upstash Redis (zero third-party cost).
 * Selalu fail-safe agar tidak pernah mengganggu alur pengguna utama.
 */
export async function recordUiTelemetryServer(
  input: UiTelemetryEventInput,
  userId?: string | null
): Promise<void> {
  try {
    const cleanRoute =
      'route' in input && input.route ? input.route.split('?')[0].slice(0, 120) : '/presensi';

    const payload: Record<string, unknown> = {
      ...input,
      route: cleanRoute,
      recordedAt: new Date().toISOString(),
    };

    await Promise.allSettled([
      prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: `TELEMETRY_${input.type}`,
          entityName: UI_TELEMETRY_ENTITY,
          entityId: cleanRoute,
          newValues: payload as object,
        },
      }),
      redis
        ? (async () => {
            const monthKey = `telemetry:ui:${new Date().toISOString().slice(0, 7)}`;
            const field =
              input.type === 'CSAT_FEEDBACK'
                ? `csat:${input.rating}${input.reason ? `:${input.reason}` : ''}`
                : input.type === 'QR_SCAN_OUTCOME'
                  ? `qr:${input.context}:${input.outcome}`
                  : input.type === 'ERROR_BOUNDARY'
                    ? `err:${input.sectionName || 'unknown'}`
                    : `role:${input.fromRole}->${input.toRole}`;
            await redis.hincrby(monthKey, field, 1);
            await redis.expire(monthKey, 90 * 24 * 60 * 60);
          })()
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.warn('[UI Telemetry] Non-fatal logging failure:', err);
  }
}

export interface UiTelemetrySummary {
  daysWindow: number;
  csat: {
    total: number;
    upCount: number;
    downCount: number;
    satisfactionPct: number | null;
    reasons: Record<CsatFeedbackReason, number>;
    recentDownEntries: Array<{
      route: string;
      reason: string | null;
      viewportWidth: number | null;
      createdAt: string;
    }>;
  };
  qrScans: {
    total: number;
    successCount: number;
    failureCount: number;
    failureRatePct: number | null;
    byDevice: Array<{
      deviceFamily: string;
      success: number;
      failed: number;
    }>;
    topFailureReasons: Array<{ reason: string; count: number }>;
  };
  errorBoundaries: {
    total: number;
    items: Array<{
      sectionName: string;
      route: string;
      count: number;
      lastOccurredAt: string;
    }>;
  };
  roleSwitches: {
    total: number;
    topTransitions: Array<{
      fromRole: string;
      toRole: string;
      route: string;
      count: number;
    }>;
  };
}

/**
 * Mengambil agregat telemetri UI 30 hari terakhir tanpa mengekspos PII user.
 */
export async function getUiTelemetrySummary(daysWindow = 30): Promise<UiTelemetrySummary> {
  const since = new Date();
  since.setDate(since.getDate() - daysWindow);

  const logs = await prisma.auditLog.findMany({
    where: {
      entityName: UI_TELEMETRY_ENTITY,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 1500,
    select: {
      action: true,
      entityId: true,
      newValues: true,
      createdAt: true,
    },
  });

  let upCount = 0;
  let downCount = 0;
  const csatReasons: Record<CsatFeedbackReason, number> = {
    SMALL_TEXT: 0,
    SMALL_BUTTON: 0,
    HARD_TO_FIND: 0,
    SLOW: 0,
  };
  const recentDownEntries: UiTelemetrySummary['csat']['recentDownEntries'] = [];

  let qrSuccess = 0;
  let qrFailure = 0;
  const qrDeviceMap = new Map<string, { success: number; failed: number }>();
  const qrReasonMap = new Map<string, number>();

  let errTotal = 0;
  const errMap = new Map<string, { sectionName: string; route: string; count: number; lastOccurredAt: string }>();

  let switchTotal = 0;
  const switchMap = new Map<string, { fromRole: string; toRole: string; route: string; count: number }>();

  for (const row of logs) {
    const val = (row.newValues || {}) as Record<string, unknown>;
    const route = String(val.route || row.entityId || '/');

    if (row.action === 'TELEMETRY_CSAT_FEEDBACK') {
      if (val.rating === 'UP') {
        upCount++;
      } else if (val.rating === 'DOWN') {
        downCount++;
        const reason = typeof val.reason === 'string' ? (val.reason as CsatFeedbackReason) : null;
        if (reason && reason in csatReasons) {
          csatReasons[reason]++;
        }
        if (recentDownEntries.length < 10) {
          recentDownEntries.push({
            route,
            reason,
            viewportWidth: typeof val.viewportWidth === 'number' ? val.viewportWidth : null,
            createdAt: row.createdAt.toISOString(),
          });
        }
      }
    } else if (row.action === 'TELEMETRY_QR_SCAN_OUTCOME') {
      const deviceFamily = String(val.deviceFamily || 'Unknown');
      const dev = qrDeviceMap.get(deviceFamily) || { success: 0, failed: 0 };
      if (val.outcome === 'SUCCESS') {
        qrSuccess++;
        dev.success++;
      } else {
        qrFailure++;
        dev.failed++;
        const reason = String(val.reasonBucket || 'UNKNOWN');
        qrReasonMap.set(reason, (qrReasonMap.get(reason) || 0) + 1);
      }
      qrDeviceMap.set(deviceFamily, dev);
    } else if (row.action === 'TELEMETRY_ERROR_BOUNDARY') {
      errTotal++;
      const sectionName = String(val.sectionName || 'Unknown');
      const key = `${sectionName}::${route}`;
      const existing = errMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        errMap.set(key, {
          sectionName,
          route,
          count: 1,
          lastOccurredAt: row.createdAt.toISOString(),
        });
      }
    } else if (row.action === 'TELEMETRY_ROLE_SWITCH') {
      switchTotal++;
      const fromRole = String(val.fromRole || '?');
      const toRole = String(val.toRole || '?');
      const key = `${fromRole}->${toRole}::${route}`;
      const existing = switchMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        switchMap.set(key, { fromRole, toRole, route, count: 1 });
      }
    }
  }

  const csatTotal = upCount + downCount;
  const qrTotal = qrSuccess + qrFailure;

  return {
    daysWindow,
    csat: {
      total: csatTotal,
      upCount,
      downCount,
      satisfactionPct: csatTotal > 0 ? Math.round((upCount / csatTotal) * 100) : null,
      reasons: csatReasons,
      recentDownEntries,
    },
    qrScans: {
      total: qrTotal,
      successCount: qrSuccess,
      failureCount: qrFailure,
      failureRatePct: qrTotal > 0 ? Math.round((qrFailure / qrTotal) * 100) : null,
      byDevice: Array.from(qrDeviceMap.entries()).map(([deviceFamily, v]) => ({
        deviceFamily,
        ...v,
      })),
      topFailureReasons: Array.from(qrReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    },
    errorBoundaries: {
      total: errTotal,
      items: Array.from(errMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    },
    roleSwitches: {
      total: switchTotal,
      topTransitions: Array.from(switchMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    },
  };
}
