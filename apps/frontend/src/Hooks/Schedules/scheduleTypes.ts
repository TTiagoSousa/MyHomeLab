import type { DocLinkType } from '../Docs/docTypes';

export type ScheduleRepeat = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ScheduleRunStatus = 'RUNNING' | 'DONE' | 'FAILED';

export const SCHEDULE_REPEATS: ScheduleRepeat[] = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'];

export interface ScheduleRun {
  id: string;
  status: ScheduleRunStatus;
  summary: string | null;
  notice: string | null;
  tokensIn: number;
  tokensOut: number;
  docsUsed?: { id: string; title: string }[] | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface Schedule {
  id: string;
  agentKey: string;
  title: string;
  instruction: string;
  repeat: ScheduleRepeat;
  runAt: string | null;
  time: string | null;
  weekday: number | null;
  monthDay: number | null;
  enabled: boolean;
  notify: boolean;
  toChat: boolean;
  tags: string[];
  nextRunAt: string | null;
  createdBy: string;
  linkType: DocLinkType | null;
  targetId: string | null;
  targetLabel: string | null;
  updateId: string | null;
  runs: ScheduleRun[];
}

export interface SchedulePayload {
  agentKey?: string;
  title?: string;
  instruction?: string;
  repeat?: ScheduleRepeat;
  runAt?: string | null;
  time?: string | null;
  weekday?: number | null;
  monthDay?: number | null;
  enabled?: boolean;
  notify?: boolean;
  toChat?: boolean;
  tags?: string[];
  linkType?: DocLinkType | null;
  targetId?: string | null;
  targetLabel?: string | null;
}

export interface ScheduleAgent {
  key: string;
  name: string;
  isActive: boolean;
}

export interface ScheduleLink {
  linkType: DocLinkType;
  targetId: string;
  targetLabel: string;
}
