export type CheckInMethod = 'qr' | 'manual';

export type CheckInStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'failed';

export type CheckInCommand = {
  idempotencyKey: string;
  eventId: string;
  attendeeCode: string;
  method: CheckInMethod;
  status: CheckInStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  lastError: string | null;
  receiptId: string | null;
};

export type QueueSummary = {
  pending: number;
  confirmed: number;
  failed: number;
};

export type QueueCheckInInput = {
  eventId: string;
  attendeeCode: string;
  method: CheckInMethod;
};
