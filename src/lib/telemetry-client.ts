'use client';

export type CsatReason = 'SMALL_TEXT' | 'SMALL_BUTTON' | 'HARD_TO_FIND' | 'SLOW';

export const CSAT_ELIGIBLE_EVENT = 'sipanji:csat-eligible';

export function getClientDeviceFamily(): 'iOS' | 'Android' | 'Desktop' | 'Unknown' {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'Desktop';
}

export function getClientRoute(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function getViewportWidth(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.innerWidth;
}

/**
 * Mengirim event telemetri ringan via `sendBeacon` / `fetch keepalive` tanpa memblokir interaksi UI.
 */
export function sendUiTelemetry(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({
      ...payload,
      route: (payload.route as string | undefined) ?? getClientRoute(),
      viewportWidth: (payload.viewportWidth as number | undefined) ?? getViewportWidth(),
    });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/telemetry/ui', blob);
      if (sent) return;
    }

    void fetch('/api/telemetry/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Abaikan kegagalan jaringan telemetri agar tidak mengganggu UX
  }
}

export function trackRoleSwitch(fromRole: string, toRole: string): void {
  if (!fromRole || !toRole || fromRole === toRole) return;
  sendUiTelemetry({
    type: 'ROLE_SWITCH',
    fromRole,
    toRole,
  });
}

export function trackErrorBoundaryHit(sectionName?: string, errorMessage?: string): void {
  sendUiTelemetry({
    type: 'ERROR_BOUNDARY',
    sectionName: sectionName || 'UnknownSection',
    errorSummary: errorMessage ? errorMessage.slice(0, 180) : undefined,
  });
}

export function trackQrScanClientOutcome(
  outcome: 'SUCCESS' | 'FAILED',
  context: 'STUDENT' | 'PARENT' | 'BATCH',
  reasonBucket?: string
): void {
  sendUiTelemetry({
    type: 'QR_SCAN_OUTCOME',
    outcome,
    context,
    reasonBucket,
    deviceFamily: getClientDeviceFamily(),
  });
}

/**
 * Memicu munculnya prompt Micro-CSAT 1-ketukan (tunduk pada cooldown 14 hari per pengguna).
 */
export function triggerMicroCsatPrompt(triggerAction: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CSAT_ELIGIBLE_EVENT, {
      detail: { triggerAction },
    })
  );
}
