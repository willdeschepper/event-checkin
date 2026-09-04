import type { CheckInCommand, QueueSummary } from './model';

export type CheckInQueueRepository = {
  initialize: () => Promise<void>;
  findDuplicate: (
    eventId: string,
    attendeeCode: string,
  ) => Promise<CheckInCommand | null>;
  getById: (idempotencyKey: string) => Promise<CheckInCommand | null>;
  insert: (command: CheckInCommand) => Promise<void>;
  update: (command: CheckInCommand) => Promise<void>;
  listReady: (now: string) => Promise<CheckInCommand[]>;
  getSummary: () => Promise<QueueSummary>;
  purgeConfirmedBefore: (timestamp: string) => Promise<void>;
};
