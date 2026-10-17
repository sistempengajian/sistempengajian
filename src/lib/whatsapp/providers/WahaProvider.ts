import { IWhatsAppGateway } from './IWhatsAppGateway';
import { SendMessageOptions, SendMessageResult, DeviceStatusResult } from '../types';
import { normalizePhoneNumber, isWhatsAppGroupJid, isWhatsAppLidJid } from '../utils';

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
    const isGroup = isWhatsAppGroupJid(options.to);
    const isLid = isWhatsAppLidJid(options.to);
    const isExplicitChat = typeof options.to === 'string' && options.to.includes('@');

    let targetChatId: string | null = null;
    if (isGroup || isLid || isExplicitChat) {
      targetChatId = options.to.trim();
    } else {
      const normalizedPhone = normalizePhoneNumber(options.to);
      targetChatId = normalizedPhone ? `${normalizedPhone}@c.us` : null;
    }

    if (!targetChatId) {
      return {
        success: false,
        status: 'FAILED',
        error: `Tujuan tidak valid: ${options.to}`,
      };
    }

    if (!this.apiUrl || !this.apiKey) {
      console.warn('[WahaProvider] WAHA Credentials belum lengkap. Simulasi pengiriman ke:', targetChatId);
      return {
        success: true,
        gatewayMessageId: `sim_waha_${Date.now()}`,
        status: 'SENT',
      };
    }

    try {
      const hasMedia = Boolean(options.mediaUrl);
      const endpoint = hasMedia
        ? `${this.apiUrl}/api/sendImage`
        : `${this.apiUrl}/api/sendText`;

      const payload = hasMedia
        ? {
            chatId: targetChatId,
            file: {
              url: options.mediaUrl,
            },
            caption: options.message,
            session: this.session,
          }
        : {
            chatId: targetChatId,
            text: options.message,
            session: this.session,
          };

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      let data = await response.json().catch(() => null);

      // Jika sendImage gagal (misal kendala upload), coba fallback ke sendText
      if (!response.ok && hasMedia) {
        console.warn(`[WahaProvider] sendImage gagal (${response.status}), mencoba fallback ke sendText...`);
        response = await fetch(`${this.apiUrl}/api/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
          body: JSON.stringify({
            chatId: targetChatId,
            text: options.message,
            session: this.session,
          }),
          signal: AbortSignal.timeout(15000),
        });
        data = await response.json().catch(() => null);
      }

      if (response.ok && data) {
        const rawId = data.key?.id || data.id || data.messageId;
        const formattedChatId = targetChatId;
        const msgId = rawId
          ? (String(rawId).includes('_') ? String(rawId) : `true_${formattedChatId}_${rawId}`)
          : `waha_${Date.now()}`;

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
          ? 'WAHA Gateway Timeout (15s)'
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

  /**
   * Menarik / menghapus pesan yang telah terkirim sebelumnya di WhatsApp via WAHA
   * Endpoint WAHA: DELETE /api/{session}/chats/{chatId}/messages/{messageId}
   */
  async deleteMessage(chatId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.apiUrl || !this.apiKey) {
      console.warn('[WahaProvider] Simulasi deleteMessage (kredensial belum lengkap) untuk msgId:', messageId);
      return { success: true };
    }

    // Pastikan format chatId sesuai dengan standar WAHA (nomor@c.us)
    let formattedChatId = chatId;
    if (!formattedChatId.includes('@')) {
      const normalized = normalizePhoneNumber(chatId) || chatId;
      formattedChatId = `${normalized}@c.us`;
    }

    // Pastikan messageId dalam format serialized WAHA: true_{chatId}_{id}
    let formattedMsgId = messageId;
    if (formattedMsgId.startsWith('true_') || formattedMsgId.startsWith('false_')) {
      const parts = formattedMsgId.split('_');
      if (parts.length >= 3) {
        const fromMe = parts[0];
        const rawMsgId = parts.slice(2).join('_');
        formattedMsgId = `${fromMe}_${formattedChatId}_${rawMsgId}`;
      }
    } else {
      formattedMsgId = `true_${formattedChatId}_${messageId}`;
    }

    try {
      // Primary WAHA endpoint: DELETE /api/{session}/chats/{chatId}/messages/{messageId}
      const encodedChatId = encodeURIComponent(formattedChatId);
      const encodedMsgId = encodeURIComponent(formattedMsgId);
      const endpoint = `${this.apiUrl}/api/${this.session}/chats/${encodedChatId}/messages/${encodedMsgId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'X-Api-Key': this.apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`[WahaProvider] ✅ Berhasil menghapus/menarik pesan lama ${messageId} di chat ${formattedChatId}`);
        return { success: true };
      }

      // Fallback alternative endpoint untuk versi WAHA tertentu:
      const fallbackEndpoint = `${this.apiUrl}/api/chats/${encodedChatId}/messages/${encodedMsgId}?session=${this.session}`;
      const fallbackRes = await fetch(fallbackEndpoint, {
        method: 'DELETE',
        headers: {
          'X-Api-Key': this.apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (fallbackRes.ok) {
        console.log(`[WahaProvider] ✅ Berhasil menghapus/menarik pesan lama via fallback ${messageId}`);
        return { success: true };
      }

      const errData = await response.json().catch(() => null);
      const errorMsg = errData?.message || errData?.error || `HTTP ${response.status} saat menghapus pesan WAHA`;
      console.warn(`[WahaProvider] ⚠️ Gagal menghapus pesan ${messageId}:`, errorMsg);
      return { success: false, error: errorMsg };
    } catch (err: any) {
      console.error(`[WahaProvider] ❌ Error saat memanggil deleteMessage WAHA:`, err);
      return { success: false, error: err.message || 'Gagal terhubung ke gateway WAHA' };
    }
  }

  /**
   * Mengambil daftar grup WhatsApp aktif dari WAHA
   * Endpoint: GET /api/{session}/groups atau fallback GET /api/{session}/chats?limit=100
   */
  async fetchGroups(): Promise<Array<{ id: string; name: string }>> {
    if (!this.apiUrl || !this.apiKey) {
      return [];
    }

    try {
      // 1. Coba endpoint grup WAHA
      const res = await fetch(`${this.apiUrl}/api/${this.session}/groups`, {
        headers: { 'X-Api-Key': this.apiKey },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data) && data.length > 0) {
          return data
            .map((g: any) => ({
              id: (g.id?._serialized || g.id || g.chatId || '').trim(),
              name: (g.name || g.subject || g.id || 'Grup WA').trim(),
            }))
            .filter((g) => g.id.endsWith('@g.us'));
        }
      }

      // 2. Fallback ke endpoint chats
      const fallbackRes = await fetch(`${this.apiUrl}/api/${this.session}/chats?limit=100`, {
        headers: { 'X-Api-Key': this.apiKey },
        signal: AbortSignal.timeout(8000),
      });

      if (fallbackRes.ok) {
        const data = await fallbackRes.json().catch(() => []);
        if (Array.isArray(data)) {
          return data
            .filter((c: any) => {
              const id = (c.id?._serialized || c.id || '').trim();
              return id.endsWith('@g.us');
            })
            .map((c: any) => ({
              id: (c.id?._serialized || c.id || '').trim(),
              name: (c.name || c.subject || 'Grup WA').trim(),
            }));
        }
      }

      return [];
    } catch (err) {
      console.warn('[WahaProvider] Gagal memuat daftar grup dari WAHA:', err);
      return [];
    }
  }

  /**
   * Menampilkan status sedang mengetik (typing indicator) pada chat penerima via WAHA
   * Endpoint: POST /api/startTyping
   */
  async startTyping(chatId: string): Promise<boolean> {
    if (!this.apiUrl || !this.apiKey) return true;

    const isGroup = isWhatsAppGroupJid(chatId);
    const isLid = isWhatsAppLidJid(chatId);
    const isExplicit = chatId.includes('@');
    const targetChatId = (isGroup || isLid || isExplicit)
      ? chatId.trim()
      : `${normalizePhoneNumber(chatId)}@c.us`;

    try {
      const res = await fetch(`${this.apiUrl}/api/startTyping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          session: this.session,
          chatId: targetChatId,
        }),
        signal: AbortSignal.timeout(4000),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Menghentikan status sedang mengetik pada chat penerima via WAHA
   * Endpoint: POST /api/stopTyping
   */
  async stopTyping(chatId: string): Promise<boolean> {
    if (!this.apiUrl || !this.apiKey) return true;

    const isGroup = isWhatsAppGroupJid(chatId);
    const isLid = isWhatsAppLidJid(chatId);
    const isExplicit = chatId.includes('@');
    const targetChatId = (isGroup || isLid || isExplicit)
      ? chatId.trim()
      : `${normalizePhoneNumber(chatId)}@c.us`;

    try {
      const res = await fetch(`${this.apiUrl}/api/stopTyping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          session: this.session,
          chatId: targetChatId,
        }),
        signal: AbortSignal.timeout(4000),
      });

      return res.ok;
    } catch {
      return false;
    }
  }
}

