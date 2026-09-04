import type { CheckInCommand } from './model';

export type SubmitOutcome =
  | { kind: 'confirmed'; receiptId: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'retry'; reason: string; uncertain: boolean };

export type ReconcileOutcome =
  | { kind: 'confirmed'; receiptId: string }
  | { kind: 'not_found' }
  | { kind: 'processing' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'retry'; reason: string };

export type CheckInGateway = {
  submit: (command: CheckInCommand) => Promise<SubmitOutcome>;
  reconcile: (command: CheckInCommand) => Promise<ReconcileOutcome>;
};
