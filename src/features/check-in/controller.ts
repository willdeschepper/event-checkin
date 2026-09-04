import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';

import { checkInGateway } from '@/api/check-in-gateway';

import type { CheckInCommand, QueueCheckInInput } from './model';
import { useQueueStore } from './queue-store';
import { SQLiteCheckInRepository } from './sqlite-repository';
import { syncPendingCheckIns } from './sync-engine';

const repository = new SQLiteCheckInRepository();
let initialization: Promise<void> | null = null;
let synchronization: Promise<void> | null = null;

async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function refreshQueueSummary(): Promise<void> {
  useQueueStore.getState().setSummary(await repository.getSummary());
}

export async function initializeCheckInQueue(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await repository.initialize();
      const retentionLimit = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      await repository.purgeConfirmedBefore(retentionLimit);
      await refreshQueueSummary();
    })();
  }
  return initialization;
}

export async function synchronizeCheckIns(): Promise<void> {
  await initializeCheckInQueue();
  if (synchronization) return synchronization;

  synchronization = (async () => {
    useQueueStore.getState().setSyncing(true);
    try {
      await syncPendingCheckIns({ repository, gateway: checkInGateway, isOnline });
      await refreshQueueSummary();
    } finally {
      useQueueStore.getState().setSyncing(false);
      synchronization = null;
    }
  })();

  return synchronization;
}

export type QueueCheckInResult = {
  command: CheckInCommand;
  duplicate: boolean;
};

export async function queueCheckIn(
  input: QueueCheckInInput,
): Promise<QueueCheckInResult> {
  await initializeCheckInQueue();
  const attendeeCode = input.attendeeCode.trim();
  if (!attendeeCode) throw new Error('Informe o código do participante.');

  const duplicate = await repository.findDuplicate(input.eventId, attendeeCode);
  if (duplicate) {
    await synchronizeCheckIns();
    return {
      command: (await repository.getById(duplicate.idempotencyKey)) || duplicate,
      duplicate: true,
    };
  }

  const timestamp = new Date().toISOString();
  const command: CheckInCommand = {
    idempotencyKey: randomUUID(),
    eventId: input.eventId,
    attendeeCode,
    method: input.method,
    status: 'pending',
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    nextAttemptAt: null,
    lastError: null,
    receiptId: null,
  };

  try {
    await repository.insert(command);
  } catch (error) {
    const concurrentDuplicate = await repository.findDuplicate(
      input.eventId,
      attendeeCode,
    );
    if (concurrentDuplicate) {
      await synchronizeCheckIns();
      return {
        command:
          (await repository.getById(concurrentDuplicate.idempotencyKey)) ||
          concurrentDuplicate,
        duplicate: true,
      };
    }
    throw error;
  }

  await refreshQueueSummary();
  await synchronizeCheckIns();

  return {
    command: (await repository.getById(command.idempotencyKey)) || command,
    duplicate: false,
  };
}
