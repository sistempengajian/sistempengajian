import { WhatsAppMessageStatus, WhatsAppMessageType } from '@prisma/client';

export type { WhatsAppMessageStatus, WhatsAppMessageType };

export interface SendMessageOptions {
  to: string; // Phone number formatted (e.g., 6281234567890)
  message: string;
  mediaUrl?: string | null;
  buttons?: Array<{ id: string; label: string }>;
  recipientName?: string | null;
  recipientUserId?: string | null;
  messageType?: WhatsAppMessageType;
  templateCode?: string | null;
  templateVariables?: Record<string, string | number | undefined | null>;
  magicToken?: string | null;
  referenceId?: string | null; // e.g. AttendanceRecord ID or Submission ID
}

export interface SendMessageResult {
  success: boolean;
  gatewayMessageId?: string;
  status: WhatsAppMessageStatus;
  error?: string;
}

export interface DeviceStatusResult {
  isConnected: boolean;
  deviceNumber?: string | null;
  deviceStatus?: string | null;
  battery?: number | null;
  quotaUsed?: number;
  quotaLimit?: number;
}

export interface WebhookIncomingPayload {
  sender: string;
  message: string;
  mediaUrl?: string;
  timestamp?: number;
  messageId?: string;
  buttonId?: string;
}

export interface WebhookDeliveryAckPayload {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: number;
  error?: string;
}
