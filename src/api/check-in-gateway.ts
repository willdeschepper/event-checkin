import { isAxiosError } from 'axios';

import { env } from '@/config/env';
import type {
  CheckInGateway,
  ReconcileOutcome,
  SubmitOutcome,
} from '@/features/check-in/gateway';
import type { CheckInCommand } from '@/features/check-in/model';

import { apiClient } from './client';

type ConfirmationPayload = {
  receiptId?: string;
  status?: 'confirmed' | 'processing' | 'rejected';
  message?: string;
};

const demoReceipts = new Map<string, string>();

function errorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Erro inesperado';
  const data = error.response?.data as { message?: string } | undefined;
  return data?.message || error.message || 'Falha de comunicação';
}

function mapSubmitError(error: unknown): SubmitOutcome {
  if (!isAxiosError(error)) {
    return { kind: 'retry', reason: errorMessage(error), uncertain: true };
  }
  if (!error.response) {
    return { kind: 'retry', reason: errorMessage(error), uncertain: true };
  }

  const status = error.response.status;
  if (status === 408 || status === 429 || status >= 500) {
    return { kind: 'retry', reason: errorMessage(error), uncertain: false };
  }
  return { kind: 'rejected', reason: errorMessage(error) };
}

async function demoSubmit(command: CheckInCommand): Promise<SubmitOutcome> {
  await new Promise(resolve => setTimeout(resolve, 350));
  const existing = demoReceipts.get(command.idempotencyKey);
  if (existing) return { kind: 'confirmed', receiptId: existing };

  const receiptId = `demo-${command.idempotencyKey.slice(0, 8)}`;
  demoReceipts.set(command.idempotencyKey, receiptId);
  return { kind: 'confirmed', receiptId };
}

export const checkInGateway: CheckInGateway = {
  async submit(command) {
    if (env.demoMode) return demoSubmit(command);

    try {
      const response = await apiClient.post<ConfirmationPayload>(
        `/events/${encodeURIComponent(command.eventId)}/check-ins`,
        {
          attendeeCode: command.attendeeCode,
          method: command.method,
          occurredAt: command.createdAt,
        },
        { headers: { 'Idempotency-Key': command.idempotencyKey } },
      );
      return {
        kind: 'confirmed',
        receiptId: response.data.receiptId || command.idempotencyKey,
      };
    } catch (error) {
      return mapSubmitError(error);
    }
  },

  async reconcile(command): Promise<ReconcileOutcome> {
    if (env.demoMode) {
      const receiptId = demoReceipts.get(command.idempotencyKey);
      return receiptId
        ? { kind: 'confirmed', receiptId }
        : { kind: 'not_found' };
    }

    try {
      const response = await apiClient.get<ConfirmationPayload>(
        `/check-ins/operations/${encodeURIComponent(command.idempotencyKey)}`,
      );
      if (response.data.status === 'processing') return { kind: 'processing' };
      if (response.data.status === 'rejected') {
        return {
          kind: 'rejected',
          reason: response.data.message || 'Check-in rejeitado',
        };
      }
      return {
        kind: 'confirmed',
        receiptId: response.data.receiptId || command.idempotencyKey,
      };
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return { kind: 'not_found' };
      }
      return { kind: 'retry', reason: errorMessage(error) };
    }
  },
};
