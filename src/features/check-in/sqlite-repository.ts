import { openDatabaseSync } from 'expo-sqlite';

import type { CheckInCommand, CheckInMethod, CheckInStatus } from './model';
import type { CheckInQueueRepository } from './repository';

type CheckInRow = {
  idempotency_key: string;
  event_id: string;
  attendee_code: string;
  method: CheckInMethod;
  status: CheckInStatus;
  attempts: number;
  created_at: string;
  updated_at: string;
  next_attempt_at: string | null;
  last_error: string | null;
  receipt_id: string | null;
};

const database = openDatabaseSync('event-checkin.db');

function toCommand(row: CheckInRow): CheckInCommand {
  return {
    idempotencyKey: row.idempotency_key,
    eventId: row.event_id,
    attendeeCode: row.attendee_code,
    method: row.method,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    receiptId: row.receipt_id,
  };
}

export class SQLiteCheckInRepository implements CheckInQueueRepository {
  async initialize(): Promise<void> {
    database.execSync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS check_in_queue (
        idempotency_key TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL,
        attendee_code TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_attempt_at TEXT,
        last_error TEXT,
        receipt_id TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS check_in_event_attendee_active
        ON check_in_queue(event_id, attendee_code)
        WHERE status IN ('pending', 'awaiting_confirmation', 'confirmed');
      CREATE INDEX IF NOT EXISTS check_in_queue_ready
        ON check_in_queue(status, next_attempt_at);
    `);
  }

  async findDuplicate(
    eventId: string,
    attendeeCode: string,
  ): Promise<CheckInCommand | null> {
    const row = database.getFirstSync<CheckInRow>(
      `SELECT * FROM check_in_queue
       WHERE event_id = ? AND attendee_code = ? AND status != 'failed'
       ORDER BY created_at DESC LIMIT 1`,
      eventId,
      attendeeCode,
    );
    return row ? toCommand(row) : null;
  }

  async getById(idempotencyKey: string): Promise<CheckInCommand | null> {
    const row = database.getFirstSync<CheckInRow>(
      'SELECT * FROM check_in_queue WHERE idempotency_key = ? LIMIT 1',
      idempotencyKey,
    );
    return row ? toCommand(row) : null;
  }

  async insert(command: CheckInCommand): Promise<void> {
    database.runSync(
      `INSERT INTO check_in_queue (
        idempotency_key, event_id, attendee_code, method, status, attempts,
        created_at, updated_at, next_attempt_at, last_error, receipt_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      command.idempotencyKey,
      command.eventId,
      command.attendeeCode,
      command.method,
      command.status,
      command.attempts,
      command.createdAt,
      command.updatedAt,
      command.nextAttemptAt,
      command.lastError,
      command.receiptId,
    );
  }

  async update(command: CheckInCommand): Promise<void> {
    database.runSync(
      `UPDATE check_in_queue SET
        status = ?, attempts = ?, updated_at = ?, next_attempt_at = ?,
        last_error = ?, receipt_id = ?
       WHERE idempotency_key = ?`,
      command.status,
      command.attempts,
      command.updatedAt,
      command.nextAttemptAt,
      command.lastError,
      command.receiptId,
      command.idempotencyKey,
    );
  }

  async listReady(now: string): Promise<CheckInCommand[]> {
    return database
      .getAllSync<CheckInRow>(
        `SELECT * FROM check_in_queue
         WHERE status IN ('pending', 'awaiting_confirmation')
           AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
         ORDER BY created_at ASC`,
        now,
      )
      .map(toCommand);
  }

  async getSummary() {
    const rows = database.getAllSync<{ status: CheckInStatus; total: number }>(
      'SELECT status, COUNT(*) AS total FROM check_in_queue GROUP BY status',
    );
    const summary = { pending: 0, confirmed: 0, failed: 0 };

    for (const row of rows) {
      if (row.status === 'confirmed') summary.confirmed += row.total;
      else if (row.status === 'failed') summary.failed += row.total;
      else summary.pending += row.total;
    }

    return summary;
  }

  async purgeConfirmedBefore(timestamp: string): Promise<void> {
    database.runSync(
      "DELETE FROM check_in_queue WHERE status = 'confirmed' AND updated_at < ?",
      timestamp,
    );
  }
}
