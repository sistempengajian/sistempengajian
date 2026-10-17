import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WhatsAppMessageStatus } from '@prisma/client';
import { processInboundWhatsAppMessage } from '@/lib/whatsapp/inboundWebhookService';

/**
 * Webhook Handler untuk WhatsApp Gateway (WAHA, Fonnte, Meta, & Generic Providers)
 * Menangani:
 * 1. Delivery Receipts / ACK Status (Sent, Delivered, Read, Failed)
 * 2. Smart Inbound Reply / Auto-Responder untuk Balasan Chat Izin Orang Tua & Santri
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
    }

    // =========================================================================
    // 1. Tangani Webhook Status ACK / Delivery Receipt
    // =========================================================================

    // Format A: WAHA event 'message.ack'
    if (body.event === 'message.ack' && body.payload) {
      const ackPayload = body.payload;
      const gatewayMsgId = ackPayload.id;
      const ackNumber = Number(ackPayload.ack);

      let mappedStatus: WhatsAppMessageStatus | null = null;
      const now = new Date();

      if (ackNumber === 1) mappedStatus = 'SENT';
      else if (ackNumber === 2) mappedStatus = 'DELIVERED';
      else if (ackNumber === 3) mappedStatus = 'READ';
      else if (ackNumber === -1) mappedStatus = 'FAILED';

      if (gatewayMsgId && mappedStatus) {
        await prisma.whatsAppMessageLog.updateMany({
          where: { gatewayMessageId: String(gatewayMsgId) },
          data: {
            status: mappedStatus,
            ...(mappedStatus === 'DELIVERED' ? { deliveredAt: now } : {}),
            ...(mappedStatus === 'READ' ? { readAt: now } : {}),
            ...(mappedStatus === 'FAILED' ? { errorMessage: 'Gagal terkirim ke perangkat penerima' } : {}),
          },
        });

        return NextResponse.json({
          status: 'success',
          event: 'WAHA_ACK_UPDATED',
          gatewayMessageId: gatewayMsgId,
          updatedStatus: mappedStatus,
        });
      }
    }

    // Format B: Generic / Fonnte status
    const genericMsgId = body.id || body.message_id || body.gatewayMessageId;
    const statusRaw = (body.status || '').toLowerCase();

    if (genericMsgId && statusRaw) {
      let mappedStatus: WhatsAppMessageStatus | null = null;
      const now = new Date();

      if (statusRaw === 'sent') mappedStatus = 'SENT';
      else if (statusRaw === 'delivered' || statusRaw === 'receive') mappedStatus = 'DELIVERED';
      else if (statusRaw === 'read' || statusRaw === 'viewed') mappedStatus = 'READ';
      else if (statusRaw === 'failed' || statusRaw === 'rejected') mappedStatus = 'FAILED';

      if (mappedStatus) {
        await prisma.whatsAppMessageLog.updateMany({
          where: { gatewayMessageId: String(genericMsgId) },
          data: {
            status: mappedStatus,
            ...(mappedStatus === 'DELIVERED' ? { deliveredAt: now } : {}),
            ...(mappedStatus === 'READ' ? { readAt: now } : {}),
            ...(mappedStatus === 'FAILED' ? { errorMessage: body.reason || 'Gagal terkirim' } : {}),
          },
        });

        return NextResponse.json({
          status: 'success',
          event: 'DELIVERY_ACK_UPDATED',
          updatedStatus: mappedStatus,
        });
      }
    }

    // =========================================================================
    // 2. Tangani Inbound Reply dari Pengguna (Smart Webhook Auto-Responder)
    // =========================================================================
    const sender =
      body.payload?.from ||
      body.payload?.participant ||
      body.sender ||
      body.from ||
      body.phone;

    // Deteksi nomor telepon pengirim jika payload menyediakan metadata author/participant
    let authorPhone: string | undefined;
    const authorRaw =
      body.payload?.author ||
      body.payload?._data?.author ||
      body.payload?._data?.participant ||
      body.payload?.participant;

    if (typeof authorRaw === 'string' && authorRaw.includes('@c.us')) {
      authorPhone = authorRaw.replace(/@c\.us$/, '');
    } else if (typeof authorRaw === 'string' && !authorRaw.includes('@lid') && !authorRaw.includes('@g.us')) {
      authorPhone = authorRaw;
    }

    const incomingText =
      body.payload?.body ||
      body.message ||
      body.text ||
      body.body;

    const fromMe =
      body.payload?.fromMe ??
      body.fromMe ??
      false;

    const msgId = body.payload?.id || body.id;

    if (sender && incomingText !== undefined && incomingText !== null) {
      console.log(`[WhatsApp Webhook] Pesan masuk dari ${sender} (authorPhone: ${authorPhone || '-'}, fromMe: ${fromMe}): "${incomingText}"`);

      // Delegasikan ke Smart Webhook Auto-Responder Service
      const result = await processInboundWhatsAppMessage({
        from: String(sender),
        body: String(incomingText),
        fromMe: Boolean(fromMe),
        messageId: msgId ? String(msgId) : undefined,
        authorPhone,
      });

      return NextResponse.json({
        status: 'success',
        event: 'INBOUND_MESSAGE_PROCESSED',
        ...result,
      });
    }

    return NextResponse.json({ status: 'ignored', message: 'Event tidak dikenali' });
  } catch (error: any) {
    console.error('[WhatsApp Webhook Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    service: 'Sistem Pengajian WhatsApp Webhook Gateway',
    autoResponder: 'ACTIVE',
    timestamp: new Date().toISOString(),
  });
}
