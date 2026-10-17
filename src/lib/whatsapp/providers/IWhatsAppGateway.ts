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

  /**
   * Menghapus / menarik (revoke) pesan yang telah terkirim sebelumnya di WhatsApp
   */
  deleteMessage?(chatId: string, messageId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Mengambil daftar grup WhatsApp yang tersedia dari gateway
   */
  fetchGroups?(): Promise<Array<{ id: string; name: string }>>;

  /**
   * Menampilkan status sedang mengetik (typing indicator) pada chat penerima
   */
  startTyping?(chatId: string): Promise<boolean>;

  /**
   * Menghentikan status sedang mengetik pada chat penerima
   */
  stopTyping?(chatId: string): Promise<boolean>;
}
