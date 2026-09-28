import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from '../types';

export interface IWhatsAppGateway {
  readonly providerName: string;

  /**
   * Mengirim pesan teks atau media ke penerima via WhatsApp
   */
  sendMessage(options: SendMessageOptions): Promise<SendMessageResult>;

  /**
   * Memeriksa status koneksi perangkat / sesi gateway
   */
  checkConnectionStatus(): Promise<DeviceStatusResult>;

  /**
   * Mendapatkan QR Code sesi jika provider mendukung pairing multi-device
   */
  fetchQrCode?(): Promise<{ qrCode: string; expiresAt?: Date }>;
}
