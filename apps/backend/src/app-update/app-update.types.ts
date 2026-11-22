import {
  AppUpdate,
  ConnectedAccount,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { BoardLink } from './task-board/taskBoard';

/** Uma atualização com o alvo: a app ligada, ou o servidor quando é o próprio host (Proxmox VE). */
export type UpdateWithAccount = AppUpdate & {
  account: ConnectedAccount | null;
  hostServer: ServerConnection | null;
};

export interface StepTask {
  id: string;
  key: string | null;
  step: string;
}

export interface SpecDoc {
  id: string;
  title: string;
  updatedAt: string;
}

export interface HistoryEntry {
  at: string;
  text: string;
}

export interface StudyInput {
  summary: string;
  reasonsFor?: string[];
  reasonsAgainst?: string[];
  study: string;
  risk: 'low' | 'medium' | 'high';
  recommendation: string;
  next: 'install' | 'recommend' | 'todo' | 'waiting' | 'later';
  question?: string;
  recheckInDays?: number;
  updateAfter?: string;
  manualSteps?: string[];
  sources?: BoardLink[];
}

export interface SaveUpdateSetting {
  boardModules?: string[];
}

export interface PrepareInput {
  server?: string;
  guest?: string;
  commands?: string[];
  checklist?: { point: string; ok: boolean; evidence: string }[];
}

/** Um passo à mão e se a sub-tarefa já está fechada no quadro. */
export interface StepState {
  step: string;
  key: string | null;
  done: boolean;
}
