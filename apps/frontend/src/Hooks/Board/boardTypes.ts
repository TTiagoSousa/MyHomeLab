import type { Schedule } from '../Schedules/scheduleTypes';

export type StateGroup = 'BACKLOG' | 'UNSTARTED' | 'STARTED' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TasksView = 'columns' | 'list' | 'table' | 'triggers';

export const STATE_GROUPS: StateGroup[] = ['BACKLOG', 'UNSTARTED', 'STARTED', 'WAITING', 'COMPLETED', 'CANCELLED'];
export const TASK_PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];
export const CLOSED_GROUPS: StateGroup[] = ['COMPLETED', 'CANCELLED'];

export interface BoardState {
  id: string;
  projectId: string;
  name: string;
  group: StateGroup;
  color: string;
  position: number;
  key: string | null;
  phase: string | null;
}

export interface BoardModule {
  id: string;
  projectId: string;
  name: string;
  description: string;
  position: number;
}

export interface BoardCycle {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
}

export type RelationKind = 'BLOCKS' | 'RELATES' | 'DUPLICATES';
export const RELATION_KINDS: RelationKind[] = ['BLOCKS', 'RELATES', 'DUPLICATES'];

export interface TaskRelation {
  id: string;
  kind: RelationKind;
  direction: 'from' | 'to';
  task: { id: string; key: string; title: string; state: { name: string; color: string; group: StateGroup } };
}

export interface TaskAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdBy: string;
  createdAt: string;
}

export interface BoardProject {
  id: string;
  name: string;
  identifier: string;
  description: string;
  agentKeys: string[];
  kind: 'GENERAL' | 'UPDATES';
  serverConnectionId: string | null;
  color: number;
  states: BoardState[];
  modules: BoardModule[];
  cycles: BoardCycle[];
  docCount: number;
  taskCount: number;
  openCount: number;
}

export interface BoardTask {
  id: string;
  key: string;
  number: number;
  projectId: string;
  project: { id: string; name: string; identifier: string; kind: string };
  title: string;
  description: string;
  stateId: string;
  state: BoardState;
  priority: TaskPriority;
  assignee: string | null;
  labels: string[];
  startDate: string | null;
  dueDate: string | null;
  parentId: string | null;
  position: number;
  createdBy: string;
  updateId: string | null;
  cycleId: string | null;
  completedAt: string | null;
  modules: { id: string; name: string }[];
  commentCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface TaskActivity {
  id: string;
  actor: string;
  text: string;
  createdAt: string;
}

export interface TaskDetail extends BoardTask {
  comments: TaskComment[];
  links: TaskLink[];
  activity: TaskActivity[];
  children: { id: string; key: string; title: string; state: BoardState }[];
  parent: { id: string; key: string; title: string } | null;
  docs: { id: string; title: string; kind: string; required: boolean; summary: string | null }[];
  schedules: Schedule[];
  cycle: BoardCycle | null;
  conversation: { id: string; lastMessageAt: string } | null;
  attachments: TaskAttachment[];
  relations: TaskRelation[];
  update: {
    id: string;
    status: string;
    logDocId: string | null;
    accountId: string;
    question: string | null;
    fromVersion: string;
    toVersion: string;
  } | null;
}

export interface TaskPayload {
  projectId?: string;
  title?: string;
  description?: string;
  stateId?: string;
  priority?: TaskPriority;
  assignee?: string | null;
  labels?: string[];
  startDate?: string | null;
  dueDate?: string | null;
  parentId?: string | null;
  moduleIds?: string[];
  position?: number;
  cycleId?: string | null;
}

export interface ProjectPayload {
  name?: string;
  identifier?: string;
  description?: string;
  agentKeys?: string[];
  color?: number;
  serverConnectionId?: string | null;
}

export interface TaskFilters {
  search: string;
  stateId: string;
  priority: string;
  assignee: string;
  label: string;
  moduleId: string;
  cycleId: string;
}
