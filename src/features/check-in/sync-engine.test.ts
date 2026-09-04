import { describe, expect, it, vi } from 'vitest';

import type { CheckInGateway } from './gateway';
import type { CheckInCommand, QueueSummary } from './model';
import type { CheckInQueueRepository } from './repository';
import { syncPendingCheckIns } from './sync-engine';

const fixedNow = new Date('2026-09-03T12:00:00.000Z');

function command(
  overrides: Partial<CheckInCommand> = {},
): CheckInCommand {
  return {
    idempotencyKey: 'operation-123',
    eventId: 'event-1',
    attendeeCode: 'ATTENDEE-42',
    method: 'qr',
    status: 'pending',
    attempts: 0,
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
    nextAttemptAt: null,
    lastError: null,
    receiptId: null,
    ...overrides,
  };
}

class MemoryRepository implements CheckInQueueRepository {
  constructor(public commands: CheckInCommand[]) {}

  async initialize() {}

  async findDuplicate(eventId: string, attendeeCode: string) {
    return this.commands.find(
      item =>
        item.eventId === eventId &&
        item.attendeeCode === attendeeCode &&
        item.status !== 'failed',
    ) || null;
  }

  async getById(idempotencyKey: string) {
    return this.commands.find(item => item.idempotencyKey === idempotencyKey) || null;
  }

  async insert(value: CheckInCommand) {
    this.commands.push(value);
  }

  async update(value: CheckInCommand) {
    this.commands = this.commands.map(item =>
      item.idempotencyKey === value.idempotencyKey ? value : item,
    );
  }

  async listReady(now: string) {
    return this.commands.filter(
      item =>
        (item.status === 'pending' || item.status === 'awaiting_confirmation') &&
        (!item.nextAttemptAt || item.nextAttemptAt <= now),
    );
  }

  async getSummary(): Promise<QueueSummary> {
    return {
      pending: this.commands.filter(item =>
        item.status === 'pending' || item.status === 'awaiting_confirmation',
      ).length,
      confirmed: this.commands.filter(item => item.status === 'confirmed').length,
      failed: this.commands.filter(item => item.status === 'failed').length,
    };
  }

  async purgeConfirmedBefore() {}
}

function gateway(
  overrides: Partial<CheckInGateway> = {},
): CheckInGateway {
  return {
    submit: vi.fn(async () => ({ kind: 'confirmed' as const, receiptId: 'receipt-1' })),
    reconcile: vi.fn(async () => ({ kind: 'not_found' as const })),
    ...overrides,
  };
}

describe('check-in synchronization', () => {
  it('does not consume the queue while offline', async () => {
    const repository = new MemoryRepository([command()]);
    const api = gateway();

    const report = await syncPendingCheckIns({
      repository,
      gateway: api,
      isOnline: async () => false,
      now: () => fixedNow,
    });

    expect(report.processed).toBe(0);
    expect(api.submit).not.toHaveBeenCalled();
    expect(repository.commands[0].status).toBe('pending');
  });

  it('keeps the same operation identity after an uncertain response', async () => {
    const repository = new MemoryRepository([command()]);
    const api = gateway({
      submit: vi.fn(async () => ({
        kind: 'retry' as const,
        reason: 'Resposta não recebida',
        uncertain: true,
      })),
    });

    await syncPendingCheckIns({
      repository,
      gateway: api,
      isOnline: async () => true,
      now: () => fixedNow,
      random: () => 0,
    });

    expect(repository.commands[0]).toMatchObject({
      idempotencyKey: 'operation-123',
      status: 'awaiting_confirmation',
      attempts: 1,
    });
  });

  it('reconciles an uncertain command without submitting it again', async () => {
    const repository = new MemoryRepository([
      command({ status: 'awaiting_confirmation', attempts: 1 }),
    ]);
    const api = gateway({
      reconcile: vi.fn(async () => ({
        kind: 'confirmed' as const,
        receiptId: 'receipt-existing',
      })),
    });

    const report = await syncPendingCheckIns({
      repository,
      gateway: api,
      isOnline: async () => true,
      now: () => fixedNow,
    });

    expect(api.submit).not.toHaveBeenCalled();
    expect(report.confirmed).toBe(1);
    expect(repository.commands[0]).toMatchObject({
      status: 'confirmed',
      receiptId: 'receipt-existing',
    });
  });

  it('reuses the idempotency key when reconciliation reports not found', async () => {
    const repository = new MemoryRepository([
      command({ status: 'awaiting_confirmation', attempts: 1 }),
    ]);
    const api = gateway();

    await syncPendingCheckIns({
      repository,
      gateway: api,
      isOnline: async () => true,
      now: () => fixedNow,
    });

    expect(api.submit).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'operation-123', attempts: 2 }),
    );
    expect(repository.commands[0].status).toBe('confirmed');
  });
});
