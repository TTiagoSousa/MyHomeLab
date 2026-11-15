export type UpdateAttemptKind = 'STUDY' | 'UPDATE';

export type UpdateAttemptStatus = 'CHECKING' | 'RUNNING' | 'VERIFYING' | 'DONE' | 'FAILED' | 'STOPPED';
export type UpdateCheckPhase = 'BEFORE' | 'AFTER';
export type UpdateCheckState = 'PENDING' | 'VALIDATED' | 'NOT_VALIDATED' | 'NOT_APPLICABLE' | 'SKIPPED';

export interface UpdateAttemptCounts {
  total: number;
  validated: number;
  notValidated: number;
  notApplicable: number;
  skipped: number;
  pending: number;
}

export interface UpdateAttemptSummary {
  id: string;
  updateId: string;
  accountId: string | null;
  number: number;
  kind: UpdateAttemptKind;
  installNumber: number | null;
  title: string;
  fromVersion: string;
  toVersion: string;
  status: UpdateAttemptStatus;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  account: { provider: string; displayName: string | null } | null;
  hostServer: { id: string; name: string } | null;
  counts: UpdateAttemptCounts;
}

export interface UpdateAttemptCheck {
  id: string;
  position: number;
  phase: UpdateCheckPhase;
  point: string;
  proof: string | null;
  source: string | null;
  who: 'agent' | 'user' | 'code';
  state: UpdateCheckState;
  evidence: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
}

export interface UpdateAttempt {
  id: string;
  updateId: string;
  accountId: string | null;
  number: number;
  kind: UpdateAttemptKind;
  installNumber: number | null;
  title: string;
  fromVersion: string;
  toVersion: string;
  status: UpdateAttemptStatus;
  docs: { id: string; title: string; updatedAt: string }[] | null;
  result: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  account: { id: string; provider: string; displayName: string | null } | null;
  hostServer: { id: string; name: string } | null;
  update: { status: string; logDocId: string | null; boardTaskKey: string | null };
  checks: UpdateAttemptCheck[];
}

export const ATTEMPT_OPEN: UpdateAttemptStatus[] = ['CHECKING', 'RUNNING', 'VERIFYING'];
