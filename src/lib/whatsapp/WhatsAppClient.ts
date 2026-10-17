import prisma from '@/lib/prisma';
import { IWhatsAppGateway } from './providers/IWhatsAppGateway';
import { FonnteProvider } from './providers/FonnteProvider';
import { BaileysProvider } from './providers/BaileysProvider';
import { WahaProvider } from './providers/WahaProvider';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from './types';
import { renderTemplate, DEFAULT_TEMPLATES } from './templateEngine';
import { normalizePhoneNumber, sanitizeUuid, isWhatsAppGroupJid, isWhatsAppLidJid } from './utils';

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
   * Mengambil daftar grup WhatsApp aktif dari gateway provider jika didukung
   */
  async fetchGroups(): Promise<Array<{ id: string; name: string }>> {
    if (this.provider.fetchGroups) {
      return this.provider.fetchGroups();
    }
    return [];
  }

  /**
   * Mengirim satu pesan WhatsApp dengan pencatatan otomatis ke database (WhatsAppMessageLog)
   */
  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const isGroup = isWhatsAppGroupJid(options.to);
    const isLid = isWhatsAppLidJid(options.to);
    const isExplicitChat = typeof options.to === 'string' && options.to.includes('@');

    const targetDestination = (isGroup || isLid || isExplicitChat)
      ? options.to.trim()
      : normalizePhoneNumber(options.to);

    if (!targetDestination) {
      return {
        success: false,
        status: 'FAILED',
        error: `Tujuan '${options.to}' tidak valid untuk WhatsApp`,
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

    // 2. Cek Mode Simulasi (Mock Mode) & Pengalihan Nomor Testing (Test Phone Override)
    const isMockMode = process.env.WA_MOCK_MODE === 'true';
    const overridePhoneRaw = process.env.WA_TEST_OVERRIDE_PHONE;
    const overridePhone = overridePhoneRaw ? normalizePhoneNumber(overridePhoneRaw) : null;

    let targetPhoneToSend = targetDestination;
    let actualMessageToSend = finalMessageBody;

    // Jangan alihkan jika tujuan adalah grup WhatsApp, LID, atau JID eksplisit
    if (overridePhone && !isGroup && !isLid && !targetDestination.includes('@')) {
      targetPhoneToSend = overridePhone;
      actualMessageToSend = `*[MODE TESTING: Pengalihan Pesan]*\n*Penerima Asli:* ${options.recipientName || 'Santri/Wali'} (${targetDestination})\n----------------------------------------\n\n${finalMessageBody}`;
      console.log(`[WhatsAppClient] Pesan dialihkan dari ${targetDestination} ke Nomor Testing: ${overridePhone}`);
    }

    // 3. Buat log awal di database dengan status QUEUED / SENDING
    let logId: string | null = null;
    try {
      const createdLog = await prisma.whatsAppMessageLog.create({
        data: {
          recipientPhone: targetPhoneToSend,
          recipientName: options.recipientName ? `${options.recipientName}${overridePhone ? ' (Test Mode)' : ''}` : null,
          recipientUserId: sanitizeUuid(options.recipientUserId),
          messageType: options.messageType || 'CUSTOM_DIRECT',
          templateId: sanitizeUuid(templateId),
          templateCode: options.templateCode || null,
          messageBody: actualMessageToSend,
          mediaUrl: options.mediaUrl || null,
          status: isMockMode ? 'SENT' : 'SENDING',
          magicToken: options.magicToken || null,
          referenceId: options.referenceId || null,
          sentAt: isMockMode ? new Date() : null,
        },
      });
      logId = createdLog.id;
    } catch (dbErr) {
      console.error('[WhatsAppClient] Gagal membuat initial log di database:', dbErr);
    }

    // 4. Jika Mock Mode aktif: Simulasikan tanpa memanggil gateway WA eksternal
    if (isMockMode) {
      console.log('\n================== 📱 [WA_MOCK_MODE: SIMULASI PESAN] ==================');
      console.log(`Penerima  : ${options.recipientName || '-'} (${targetPhoneToSend})`);
      console.log(`Tipe      : ${options.messageType || 'CUSTOM'}`);
      console.log(`Template  : ${options.templateCode || 'DIRECT'}`);
      console.log(`Isi Pesan :\n${actualMessageToSend}`);
      console.log('========================================================================\n');

      return {
        success: true,
        status: 'SENT',
        gatewayMessageId: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    // 5. Eksekusi pengiriman via gateway provider nyata
    const sendResult = await this.provider.sendMessage({
      ...options,
      to: targetPhoneToSend,
      message: actualMessageToSend,
    });

    // 6. Update status log di database
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

  /**
   * Menarik / menghapus pesan WhatsApp yang telah terkirim via provider aktif
   */
  async deleteMessage(
    to: string,
    gatewayMessageId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (process.env.WA_MOCK_MODE === 'true') {
      console.log(`[WhatsAppClient] 📱 [WA_MOCK_MODE] Simulasi deleteMessage untuk ${to} (ID: ${gatewayMessageId})`);
      return { success: true };
    }

    if (!this.provider.deleteMessage) {
      console.warn(`[WhatsAppClient] Provider ${this.provider.providerName} belum mendukung penarikan pesan.`);
      return { success: false, error: 'Provider does not support deleteMessage' };
    }

    const overridePhoneRaw = process.env.WA_TEST_OVERRIDE_PHONE;
    const overridePhone = overridePhoneRaw ? normalizePhoneNumber(overridePhoneRaw) : null;
    const targetPhone = overridePhone || normalizePhoneNumber(to) || to;

    if (overridePhone) {
      console.log(`[WhatsAppClient] 🔀 Penarikan pesan dialihkan dari ${to} ke Nomor Testing: ${overridePhone}`);
    }

    const result = await this.provider.deleteMessage(targetPhone, gatewayMessageId);

    // Jika berhasil ditarik/dihapus, update status log terkait di database
    if (result.success) {
      try {
        await prisma.whatsAppMessageLog.updateMany({
          where: { gatewayMessageId },
          data: {
            errorMessage: '[REVOKED/DELETED_BY_SCHEDULE_UPDATE]',
          },
        });
      } catch (err) {
        console.error('[WhatsAppClient] Gagal update status pesan yang ditarik di log:', err);
      }
    }

    return result;
  }

  /**
   * Menampilkan status sedang mengetik (typing indicator) pada obrolan tujuan
   */
  async startTyping(chatId: string): Promise<boolean> {
    if (this.provider.startTyping) {
      return this.provider.startTyping(chatId);
    }
    return true;
  }

  /**
   * Menghentikan status sedang mengetik pada obrolan tujuan
   */
  async stopTyping(chatId: string): Promise<boolean> {
    if (this.provider.stopTyping) {
      return this.provider.stopTyping(chatId);
    }
    return true;
  }
}

export const whatsAppClient = WhatsAppClient.getInstance();
