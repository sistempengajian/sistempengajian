import prisma from '@/lib/prisma';
import { IWhatsAppGateway } from './providers/IWhatsAppGateway';
import { FonnteProvider } from './providers/FonnteProvider';
import { BaileysProvider } from './providers/BaileysProvider';
import { WahaProvider } from './providers/WahaProvider';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from './types';
import { renderTemplate, DEFAULT_TEMPLATES } from './templateEngine';
import { normalizePhoneNumber } from './utils';

export class WhatsAppClient {
  private static instance: WhatsAppClient;
  private provider: IWhatsAppGateway;

  private constructor() {
    const providerEnv = (process.env.WA_PROVIDER || '').toLowerCase();

    if (providerEnv === 'baileys') {
      this.provider = new BaileysProvider();
    } else if (providerEnv === 'waha' || (!providerEnv && process.env.PETAPOD_WAHA_URL)) {
      // Prioritaskan WahaProvider jika kredensial Petapod WAHA tersedia
      this.provider = new WahaProvider();
    } else {
      this.provider = new FonnteProvider();
    }
  }

  public static getInstance(): WhatsAppClient {
    if (!WhatsAppClient.instance) {
      WhatsAppClient.instance = new WhatsAppClient();
    }
    return WhatsAppClient.instance;
  }

  /**
   * Mengirim satu pesan WhatsApp dengan pencatatan otomatis ke database (WhatsAppMessageLog)
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const normalizedPhone = normalizePhoneNumber(options.to);
    if (!normalizedPhone) {
      return {
        success: false,
        status: 'FAILED',
        error: `Nomor telepon '${options.to}' tidak valid untuk WhatsApp`,
      };
    }

    // 1. Resolve konten teks pesan (dari template atau teks langsung)
    let finalMessageBody = options.message;
    let templateId: string | undefined;

    if (options.templateCode) {
      try {
        const dbTemplate = await prisma.whatsAppTemplate.findUnique({
          where: { code: options.templateCode },
        });

        if (dbTemplate && dbTemplate.isActive) {
          templateId = dbTemplate.id;
          finalMessageBody = renderTemplate(dbTemplate.templateBody, options.templateVariables);
        } else if (DEFAULT_TEMPLATES[options.templateCode]) {
          const defaultTpl = DEFAULT_TEMPLATES[options.templateCode];
          finalMessageBody = renderTemplate(defaultTpl.templateBody, options.templateVariables);
        }
      } catch (err) {
        // Fallback ke default template jika DB belum sinkron
        if (DEFAULT_TEMPLATES[options.templateCode]) {
          const defaultTpl = DEFAULT_TEMPLATES[options.templateCode];
          finalMessageBody = renderTemplate(defaultTpl.templateBody, options.templateVariables);
        }
      }
    }

    // 2. Buat log awal di database dengan status QUEUED / SENDING
    let logId: string | null = null;
    try {
      const createdLog = await prisma.whatsAppMessageLog.create({
        data: {
          recipientPhone: normalizedPhone,
          recipientName: options.recipientName || null,
          recipientUserId: options.recipientUserId || null,
          messageType: options.messageType || 'CUSTOM_DIRECT',
          templateId: templateId || null,
          messageBody: finalMessageBody,
          mediaUrl: options.mediaUrl || null,
          status: 'SENDING',
          magicToken: options.magicToken || null,
          referenceId: options.referenceId || null,
        },
      });
      logId = createdLog.id;
    } catch (dbErr) {
      console.error('[WhatsAppClient] Gagal membuat initial log di database:', dbErr);
    }

    // 3. Eksekusi pengiriman via gateway provider
    const sendResult = await this.provider.sendMessage({
      ...options,
      to: normalizedPhone,
      message: finalMessageBody,
    });

    // 4. Update status log di database
    if (logId) {
      try {
        await prisma.whatsAppMessageLog.update({
          where: { id: logId },
          data: {
            status: sendResult.status,
            gatewayMessageId: sendResult.gatewayMessageId || null,
            errorMessage: sendResult.error || null,
            sentAt: sendResult.success ? new Date() : null,
          },
        });
      } catch (updateErr) {
        console.error('[WhatsAppClient] Gagal memperbarui status log pengiriman:', updateErr);
      }
    }

    return sendResult;
  }

  /**
   * Mengirim sekumpulan pesan dengan jeda waktu acak (Anti-Ban Jitter Rate Limiting)
   */
  async sendBatchMessages(
    items: SendMessageOptions[],
    minDelayMs = 2500,
    maxDelayMs = 5000
  ): Promise<SendMessageResult[]> {
    const results: SendMessageResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const res = await this.sendMessage(item);
      results.push(res);

      // Jeda waktu antara pesan kecuali pesan terakhir
      if (i < items.length - 1) {
        const jitter = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }
    }

    return results;
  }

  /**
   * Memeriksa status koneksi perangkat dan memperbarui setting di DB
   */
  async checkDeviceStatus(): Promise<DeviceStatusResult> {
    const status = await this.provider.checkConnectionStatus();

    try {
      const existing = await prisma.whatsAppSetting.findFirst();
      if (existing) {
        await prisma.whatsAppSetting.update({
          where: { id: existing.id },
          data: {
            isConnected: status.isConnected,
            deviceStatus: status.deviceStatus || (status.isConnected ? 'CONNECTED' : 'DISCONNECTED'),
            senderNumber: status.deviceNumber || existing.senderNumber,
            dailyQuotaLimit: status.quotaLimit ?? existing.dailyQuotaLimit,
            dailyQuotaUsed: status.quotaUsed ?? existing.dailyQuotaUsed,
            lastSyncAt: new Date(),
          },
        });
      } else {
        await prisma.whatsAppSetting.create({
          data: {
            provider: this.provider.providerName,
            isConnected: status.isConnected,
            deviceStatus: status.deviceStatus || (status.isConnected ? 'CONNECTED' : 'DISCONNECTED'),
            senderNumber: status.deviceNumber || null,
            dailyQuotaLimit: status.quotaLimit ?? 1000,
            dailyQuotaUsed: status.quotaUsed ?? 0,
            lastSyncAt: new Date(),
          },
        });
      }
    } catch (err) {
      console.error('[WhatsAppClient] Gagal memperbarui WhatsAppSetting di database:', err);
    }

    return status;
  }
}

export const whatsAppClient = WhatsAppClient.getInstance();
