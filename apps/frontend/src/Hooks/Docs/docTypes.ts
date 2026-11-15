export type DocKind = 'RULES' | 'CHECKLIST' | 'NOTES' | 'LEARNINGS' | 'GUIDE' | 'LOG' | 'OTHER';
export type DocOwner = 'USER' | 'AGENT';
export type DocLinkType = 'SERVER' | 'GUEST' | 'APP' | 'MONITOR' | 'AGENT' | 'PROJECT' | 'TASK' | 'DOC';
export type DocProposalAction = 'EDIT' | 'APPEND' | 'CREATE';

export const DOC_KINDS: DocKind[] = ['RULES', 'CHECKLIST', 'NOTES', 'LEARNINGS', 'GUIDE', 'LOG', 'OTHER'];
export const ATTEMPT_KIND = 'ATTEMPT';
export type DocListKind = DocKind | typeof ATTEMPT_KIND;

export const DOC_LINK_TYPES: DocLinkType[] = ['SERVER', 'GUEST', 'APP', 'MONITOR', 'AGENT', 'PROJECT', 'TASK', 'DOC'];

export interface DocLinkInput {
  type: DocLinkType;
  targetId: string;
  label: string;
}

export interface DocLink extends DocLinkInput {
  id: string;
  docId: string;
}

export interface DocUserType {
  id: string;
  name: string;
  _count?: { docs: number };
}

export const TYPE_PREFIX = 'type:';

export interface DocSummary {
  id: string;
  title: string;
  kind: DocKind;
  typeId: string | null;
  owner: DocOwner;
  required: boolean;
  tags: string[];
  summary: string | null;
  links: DocLink[];
  snippet: string;
  updatedBy: string;
  updatedAt: string;
}

export interface DocVersionSummary {
  id: string;
  title: string;
  editedBy: string;
  createdAt: string;
}

export interface Doc {
  id: string;
  title: string;
  kind: DocKind;
  typeId: string | null;
  owner: DocOwner;
  content: string;
  summary: string | null;
  tags: string[];
  required: boolean;
  updatedBy: string;
  links: DocLink[];
  createdAt: string;
  updatedAt: string;
  versions?: DocVersionSummary[];
  conflicts?: { docId: string; title: string; text: string }[] | null;
  conflictsCheckedAt?: string | null;
}

export interface DocVersion {
  id: string;
  docId: string;
  title: string;
  content: string;
  editedBy: string;
  createdAt: string;
}

export interface DocPayload {
  title?: string;
  kind?: DocKind;
  typeId?: string | null;
  content?: string;
  summary?: string;
  tags?: string[];
  required?: boolean;
  links?: DocLinkInput[];
}

export interface DocTarget {
  type: DocLinkType;
  targetId: string;
  label: string;
  group: string;
}

export interface DocProposal {
  id: string;
  docId: string | null;
  action: DocProposalAction;
  title: string | null;
  kind: DocKind | null;
  content: string;
  reason: string | null;
  links: DocLinkInput[] | null;
  proposedBy: string;
  taskId: string | null;
  status: string;
  createdAt: string;
  doc: { id: string; title: string; content: string } | null;
}

export interface DocFilters {
  search: string;
  kind: DocKind | '';
  typeId?: string;
  linkType: DocLinkType | '';
  targetId?: string;
  required?: boolean;
  owner?: DocOwner | '';
  sort?: 'recent' | 'title';
}
