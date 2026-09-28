import { IWhatsAppGateway } from './IWhatsAppGateway';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from '../types';
import { normalizePhoneNumber } from '../utils';

/**
 * Adapter untuk integrasi dengan microservice Baileys / WPPConnect self-hosted
 */
export class BaileysProvider implements IWhatsAppGateway {
  readonly providerName = 'baileys';
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || process.env.BAILEYS_API_URL || 'http://localhost:8000';
    this.apiKey = apiKey || process.env.BAILEYS_API_KEY || '';
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

    try {
      const response = await fetch(`${this.apiUrl}/api/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          phone: `${normalizedTo}@s.whatsapp.net`,
          message: options.message,
          mediaUrl: options.mediaUrl,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return {
          success: true,
          gatewayMessageId: data.messageId || `baileys_${Date.now()}`,
          status: 'SENT',
        };
      }

      return {
        success: false,
        status: 'FAILED',
        error: data.error || 'Gagal mengirim pesan via Baileys microservice',
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        error: err.message || 'Gagal terhubung ke Baileys microservice',
      };
    }
  }

  async checkConnectionStatus(): Promise<DeviceStatusResult> {
    try {
      const response = await fetch(`${this.apiUrl}/api/status`, {
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      });
      const data = await response.json();
      return {
        isConnected: Boolean(data.connected),
        deviceNumber: data.phone || null,
        deviceStatus: data.status || (data.connected ? 'CONNECTED' : 'DISCONNECTED'),
      };
    } catch {
      return { isConnected: false, deviceStatus: 'OFFLINE' };
    }
  }
}
