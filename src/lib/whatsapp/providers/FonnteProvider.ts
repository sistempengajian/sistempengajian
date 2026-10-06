import { IWhatsAppGateway } from './IWhatsAppGateway';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from '../types';
import { normalizePhoneNumber } from '../utils';

export class FonnteProvider implements IWhatsAppGateway {
  readonly providerName = 'fonnte';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://api.fonnte.com') {
    this.apiKey = apiKey || process.env.FONNTE_API_KEY || '';
    this.baseUrl = baseUrl;
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

    if (!this.apiKey) {
      // Jika API Key belum diset, log simulasi dev mode
      console.warn('[FonnteProvider] FONNTE_API_KEY belum dikonfigurasi. Simulasi kirim pesan ke:', normalizedTo);
      return {
        success: true,
        gatewayMessageId: `sim_${Date.now()}`,
        status: 'SENT',
      };
    }

    try {
      const payload: Record<string, any> = {
        target: normalizedTo,
        message: options.message,
        countryCode: '62',
      };

      if (options.mediaUrl) {
        payload.url = options.mediaUrl;
      }

      if (options.buttons && options.buttons.length > 0) {
        payload.buttons = JSON.stringify(
          options.buttons.map((b) => ({ id: b.id, message: b.label }))
        );
      }

      const response = await fetch(`${this.baseUrl}/send`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json();

      if (data.status === true || data.status === 'true') {
        const msgId = Array.isArray(data.id) ? data.id[0] : data.id || `fonnte_${Date.now()}`;
        return {
          success: true,
          gatewayMessageId: String(msgId),
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.reason || data.message || 'Gagal mengirim pesan via Fonnte Gateway',
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        error: err.name === 'TimeoutError' || err.name === 'AbortError'
          ? 'Fonnte Gateway Timeout (5s)'
          : err.message || 'Kesalahan jaringan saat menghubungi Fonnte API',
      };
    }
  }

  async checkConnectionStatus(): Promise<DeviceStatusResult> {
    if (!this.apiKey) {
      return {
        isConnected: false,
        deviceStatus: 'NO_API_KEY',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/device`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey,
        },
        signal: AbortSignal.timeout(4000),
      });

      const data = await response.json();

      const isConnected = data.device_status === 'connect';
      return {
        isConnected,
        deviceNumber: data.device || null,
        deviceStatus: data.device_status || (isConnected ? 'CONNECTED' : 'DISCONNECTED'),
        quotaUsed: data.quota_used ?? undefined,
        quotaLimit: data.quota ?? undefined,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        deviceStatus: 'ERROR',
      };
    }
  }

  async fetchQrCode(): Promise<{ qrCode: string; expiresAt?: Date }> {
    if (!this.apiKey) {
      throw new Error('FONNTE_API_KEY belum dikonfigurasi');
    }

    const response = await fetch(`${this.baseUrl}/qr`, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
      },
    });

    const data = await response.json();
    if (data.status && data.url) {
      return {
        qrCode: data.url, // URL atau Base64 QR code image
        expiresAt: new Date(Date.now() + 60 * 1000), // QR biasanya kedaluwarsa dlm 1 menit
      };
    }

    throw new Error(data.reason || 'Gagal memuat QR code dari Fonnte');
  }
}
