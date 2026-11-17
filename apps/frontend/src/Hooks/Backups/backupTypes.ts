import type { RunFrequency } from '@myhomelab/shared';

export type BackupDestinationKind = 'NEXTCLOUD' | 'LOCAL';

export type BackupRetention = 'REPLACE' | 'KEEP_LAST' | 'KEEP_ALL';

export interface BackupDestination {
  id: string;
  kind: BackupDestinationKind;
  name: string;
  accountId: string | null;
  account: { name: string | null; disconnected: boolean } | null;
  url: string | null;
  username: string | null;
  folder: string;
  lastCheckedAt: string | null;
  lastError: string | null;
  jobCount: number;
  updatedAt: string;
}

export interface BackupDestinationPayload {
  kind?: BackupDestinationKind;
  name: string;
  accountId: string | null;
  url?: string;
  username?: string;
  password?: string;
  folder: string;
}

export interface BackupDestinationCheck {
  ok: boolean;
  user?: string;
  freeBytes?: number | null;
  error?: string;
}

export interface BackupRun {
  id: string;
  status: 'SUCCESS' | 'ERROR';
  manual: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  deleted: number;
  missing: string[];
  error: string | null;
  startedAt: string;
}

export interface BackupJob {
  id: string;
  accountId: string | null;
  destinationId: string;
  folder: string;
  runFrequency: RunFrequency;
  retention: BackupRetention;
  keepCount: number;
  isActive: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  account: { id: string; provider: string; displayName: string | null; username: string | null; baseUrl: string | null } | null;
  destination: { id: string; name: string; kind: BackupDestinationKind; folder: string };
  runs: BackupRun[];
}

export interface BackupJobPayload {
  destinationId: string;
  folder: string;
  runFrequency: RunFrequency;
  retention: BackupRetention;
  keepCount: number;
  isActive: boolean;
}

export interface BackupRunResult {
  ok: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  deleted: number;
  missing: string[];
  error: string | null;
}
