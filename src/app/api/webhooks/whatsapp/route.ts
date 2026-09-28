import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WhatsAppMessageStatus } from '@prisma/client';

/**
 * Webhook Handler untuk WhatsApp Gateway (Fonnte / Baileys / Meta)
 * Menangani:
 * 1. Delivery Receipts (Sent / Delivered / Read)
 * 2. Inbound Messages / Balasan Chat Orang Tua
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
    }

    // 1. Tangani Webhook Status ACK (Fonnte / Generic)
    // Contoh Fonnte delivery status: { id: "msg_123", status: "delivered" }
    const gatewayMsgId = body.id || body.message_id || body.gatewayMessageId;
    const statusRaw = (body.status || '').toLowerCase();

    if (gatewayMsgId && statusRaw) {
      let mappedStatus: WhatsAppMessageStatus | null = null;
      const now = new Date();

      if (statusRaw === 'sent') mappedStatus = 'SENT';
      else if (statusRaw === 'delivered' || statusRaw === 'receive') mappedStatus = 'DELIVERED';
      else if (statusRaw === 'read' || statusRaw === 'viewed') mappedStatus = 'READ';
      else if (statusRaw === 'failed' || statusRaw === 'rejected') mappedStatus = 'FAILED';

      if (mappedStatus) {
        await prisma.whatsAppMessageLog.updateMany({
          where: { gatewayMessageId: String(gatewayMsgId) },
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

    // 2. Tangani Inbound Reply dari Pengguna (Two-Way Communication)
    const sender = body.sender || body.from || body.phone;
    const incomingText = body.message || body.text || body.body;

    if (sender && incomingText) {
      // Log atau proses balasan masuk jika dibutuhkan di masa mendatang
      console.log(`[WhatsApp Webhook] Pesan masuk dari ${sender}: "${incomingText}"`);

      return NextResponse.json({
        status: 'success',
        event: 'INBOUND_MESSAGE_RECEIVED',
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
    timestamp: new Date().toISOString(),
  });
}
