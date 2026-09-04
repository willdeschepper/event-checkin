import type { CheckInGateway, SubmitOutcome } from './gateway';
import type { CheckInCommand } from './model';
import type { CheckInQueueRepository } from './repository';

export type SyncDependencies = {
  repository: CheckInQueueRepository;
  gateway: CheckInGateway;
  isOnline: () => Promise<boolean>;
  now?: () => Date;
  random?: () => number;
};

export type SyncReport = {
  processed: number;
  confirmed: number;
  failed: number;
  deferred: number;
};

const MAX_BACKOFF_MS = 15 * 60 * 1000;
const BASE_BACKOFF_MS = 5 * 1000;

function nextAttemptAt(
  attempts: number,
  now: Date,
  random: () => number,
): string {
  const exponential = Math.min(
    BASE_BACKOFF_MS * 2 ** Math.max(attempts - 1, 0),
    MAX_BACKOFF_MS,
  );
  const jitter = Math.floor(exponential * 0.2 * random());
  return new Date(now.getTime() + exponential + jitter).toISOString();
}

function asConfirmed(
  command: CheckInCommand,
  receiptId: string,
  now: Date,
): CheckInCommand {
  return {
    ...command,
    status: 'confirmed',
    receiptId,
    lastError: null,
    nextAttemptAt: null,
    updatedAt: now.toISOString(),
  };
}

function asFailed(
  command: CheckInCommand,
  reason: string,
  now: Date,
): CheckInCommand {
  return {
    ...command,
    status: 'failed',
    lastError: reason,
    nextAttemptAt: null,
    updatedAt: now.toISOString(),
  };
}

function asDeferred(
  command: CheckInCommand,
  reason: string,
  now: Date,
  random: () => number,
  uncertain = false,
): CheckInCommand {
  return {
    ...command,
    status: uncertain ? 'awaiting_confirmation' : 'pending',
    lastError: reason,
    nextAttemptAt: nextAttemptAt(command.attempts, now, random),
    updatedAt: now.toISOString(),
  };
}

async function applySubmitOutcome(
  repository: CheckInQueueRepository,
  command: CheckInCommand,
  outcome: SubmitOutcome,
  now: Date,
  random: () => number,
): Promise<'confirmed' | 'failed' | 'deferred'> {
  if (outcome.kind === 'confirmed') {
    await repository.update(asConfirmed(command, outcome.receiptId, now));
    return 'confirmed';
  }

  if (outcome.kind === 'rejected') {
    await repository.update(asFailed(command, outcome.reason, now));
    return 'failed';
  }

  await repository.update(
    asDeferred(command, outcome.reason, now, random, outcome.uncertain),
  );
  return 'deferred';
}

async function processCommand(
  dependencies: SyncDependencies,
  command: CheckInCommand,
): Promise<'confirmed' | 'failed' | 'deferred'> {
  const now = dependencies.now?.() ?? new Date();
  const random = dependencies.random ?? Math.random;

  if (command.status === 'awaiting_confirmation') {
    const reconciliation = await dependencies.gateway.reconcile(command);
    if (reconciliation.kind === 'confirmed') {
      await dependencies.repository.update(
        asConfirmed(command, reconciliation.receiptId, now),
      );
      return 'confirmed';
    }
    if (reconciliation.kind === 'processing') {
      await dependencies.repository.update(
        asDeferred(command, 'Servidor ainda processando', now, random, true),
      );
      return 'deferred';
    }
    if (reconciliation.kind === 'retry') {
      await dependencies.repository.update(
        asDeferred(command, reconciliation.reason, now, random, true),
      );
      return 'deferred';
    }
    if (reconciliation.kind === 'rejected') {
      await dependencies.repository.update(
        asFailed(command, reconciliation.reason, now),
      );
      return 'failed';
    }
  }

  const attempting: CheckInCommand = {
    ...command,
    attempts: command.attempts + 1,
    status: 'awaiting_confirmation',
    updatedAt: now.toISOString(),
  };
  await dependencies.repository.update(attempting);

  const outcome = await dependencies.gateway.submit(attempting);
  return applySubmitOutcome(
    dependencies.repository,
    attempting,
    outcome,
    now,
    random,
  );
}

export async function syncPendingCheckIns(
  dependencies: SyncDependencies,
): Promise<SyncReport> {
  const report: SyncReport = {
    processed: 0,
    confirmed: 0,
    failed: 0,
    deferred: 0,
  };

  if (!(await dependencies.isOnline())) {
    return report;
  }

  const now = dependencies.now?.() ?? new Date();
  const commands = await dependencies.repository.listReady(now.toISOString());

  for (const command of commands) {
    if (!(await dependencies.isOnline())) {
      break;
    }

    report.processed += 1;
    const result = await processCommand(dependencies, command);
    report[result] += 1;
  }

  return report;
}
