import { IWhatsAppGateway } from './IWhatsAppGateway';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from '../types';
import { normalizePhoneNumber } from '../utils';

export class WahaProvider implements IWhatsAppGateway {
  readonly providerName = 'waha';
  private apiUrl: string;
  private apiKey: string;
  private session: string;

  constructor(apiUrl?: string, apiKey?: string, session?: string) {
    this.apiUrl = (apiUrl || process.env.PETAPOD_WAHA_URL || '').replace(/\/$/, '');
    this.apiKey = apiKey || process.env.PETAPOD_WAHA_API_KEY || '';
    this.session = session || process.env.PETAPOD_WAHA_SESSION || 'default';
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const normalizedTo = normalizePhoneNumber(options.to);
    if (!normalizedTo) {
      return {
        success: false,
        status: 'FAILED',
        error: `Nomor tujuan tidak valid: ${options.to}`,
      };
    }

    if (!this.apiUrl || !this.apiKey) {
      console.warn('[WahaProvider] WAHA Credentials belum lengkap. Simulasi pengiriman ke:', normalizedTo);
      return {
        success: true,
        gatewayMessageId: `sim_waha_${Date.now()}`,
        status: 'SENT',
      };
    }

    try {
      const endpoint = `${this.apiUrl}/api/sendText`;
      const payload = {
        chatId: `${normalizedTo}@c.us`,
        text: options.message,
        session: this.session,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data) {
        const msgId = data.id || data.messageId || `waha_${Date.now()}`;
        return {
          success: true,
          gatewayMessageId: String(msgId),
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data?.message || data?.error || `Gagal mengirim via WAHA (HTTP ${response.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        error: err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'WAHA Gateway Timeout (5s)'
          : err.message || 'Kesalahan jaringan saat menghubungi WAHA Gateway',
      };
    }
  }

  async checkConnectionStatus(): Promise<DeviceStatusResult> {
    if (!this.apiUrl || !this.apiKey) {
      return { isConnected: false, deviceStatus: 'NO_CREDENTIALS' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/sessions/${this.session}`, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
        signal: AbortSignal.timeout(4000),
      });

      const data = await response.json().catch(() => null);
      const isWorking = data?.status === 'WORKING' || data?.status === 'AUTHENTICATED';

      return {
        isConnected: isWorking,
        deviceNumber: data?.me?.id ? data.me.id.split('@')[0] : null,
        deviceStatus: data?.status || (isWorking ? 'CONNECTED' : 'DISCONNECTED'),
      };
    } catch {
      return { isConnected: false, deviceStatus: 'ERROR' };
    }
  }
}
