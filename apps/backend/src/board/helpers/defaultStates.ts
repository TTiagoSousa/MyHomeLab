import { BoardStateGroup } from 'src/generated/prisma/client/client';

export interface StateSeed {
  name: string;
  group: BoardStateGroup;
  color: string;
  key: string | null;
  phase?: string;
}

/** As colunas de um projeto novo. */
export const GENERAL_STATES: StateSeed[] = [
  { name: 'Backlog', group: 'BACKLOG', color: '#8a94a6', key: null },
  { name: 'Todo', group: 'UNSTARTED', color: '#5b8def', key: null },
  { name: 'Em curso', group: 'STARTED', color: '#f2b84b', key: null },
  { name: 'À espera', group: 'WAITING', color: '#c084fc', key: null },
  { name: 'Feito', group: 'COMPLETED', color: '#3fb27f', key: null },
  { name: 'Cancelado', group: 'CANCELLED', color: '#e05d5d', key: null },
];

/**
 * As colunas do projeto das atualizações. `key` é o que o MyHomeLab usa para mover
 * as tarefas (o nome pode mudar à vontade).
 */
export const UPDATE_STATES: StateSeed[] = [
  {
    name: 'Todo',
    group: 'BACKLOG',
    color: '#8a94a6',
    key: 'new',
    phase: 'Entrada',
  },
  {
    name: 'Espera por estudo',
    group: 'UNSTARTED',
    color: '#5b8def',
    key: 'study',
    phase: 'Entrada',
  },
  {
    name: 'Study',
    group: 'STARTED',
    color: '#38bdf8',
    key: 'studying',
    phase: 'Estudo',
  },
  {
    name: 'Estudo feito',
    group: 'STARTED',
    color: '#22d3ee',
    key: 'studied',
    phase: 'Estudo',
  },
  {
    name: 'Ready to update',
    group: 'UNSTARTED',
    color: '#3fb27f',
    key: 'ready',
    phase: 'Decisão',
  },
  {
    name: 'Waiting for reply',
    group: 'WAITING',
    color: '#c084fc',
    key: 'waiting',
    phase: 'Decisão',
  },
  {
    name: 'Recheck later',
    group: 'WAITING',
    color: '#a78bfa',
    key: 'later',
    phase: 'Decisão',
  },
  {
    name: 'In progress',
    group: 'STARTED',
    color: '#f2b84b',
    key: 'in_progress',
    phase: 'Atualização',
  },
  {
    name: 'Verifying',
    group: 'STARTED',
    color: '#fb923c',
    key: 'verifying',
    phase: 'Atualização',
  },
  {
    name: 'Done',
    group: 'COMPLETED',
    color: '#16a34a',
    key: 'done',
    phase: 'Fim',
  },
  {
    name: 'Failed',
    group: 'CANCELLED',
    color: '#e05d5d',
    key: 'failed',
    phase: 'Fim',
  },
  {
    name: 'Cancelled',
    group: 'CANCELLED',
    color: '#9ca3af',
    key: 'cancelled',
    phase: 'Fim',
  },
];

/** As colunas que contam como fechadas (feitas ou canceladas). */
export const CLOSED_GROUPS: BoardStateGroup[] = ['COMPLETED', 'CANCELLED'];
