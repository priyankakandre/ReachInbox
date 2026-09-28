export type EmailStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Sender {
  id: string;
  name: string;
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  hourlyLimit: number;
  sentThisHour: number;
  remainingThisHour: number;
}

export interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  error?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    emailAddress: string;
  };
}

export interface SlackStatus {
  connected: boolean;
  connection?: {
    channelName: string;
    connectedAt: string;
    hasWebhook: boolean;
  } | null;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  sending: number;
  total: number;
  totalSenders: number;
}
