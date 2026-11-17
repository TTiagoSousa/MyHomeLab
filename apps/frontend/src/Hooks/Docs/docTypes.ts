export type DocKind = 'RULES' | 'MAP' | 'LOG';
export type DocOwner = 'USER' | 'AGENT';
export type DocLinkType = 'SERVER' | 'GUEST' | 'APP' | 'MONITOR' | 'AGENT' | 'PROJECT' | 'TASK' | 'DOC';
export type DocProposalAction = 'EDIT' | 'APPEND' | 'CREATE' | 'ORGANIZE';

export const DOC_KINDS: DocKind[] = ['RULES', 'MAP', 'LOG'];
export const LIBRARY_KINDS: DocKind[] = ['RULES', 'MAP'];
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

export interface DocSummary {
  id: string;
  title: string;
  kind: DocKind;
  owner: DocOwner;
  tags: string[];
  summary: string | null;
  links: DocLink[];
  sectionId: string | null;
  parentId: string | null;
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
  owner: DocOwner;
  content: string;
  summary: string | null;
  tags: string[];
  updatedBy: string;
  links: DocLink[];
  sectionId: string | null;
  parentId: string | null;
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
  content?: string;
  summary?: string;
  tags?: string[];
  links?: DocLinkInput[];
  sectionId?: string | null;
  parentId?: string | null;
}

export interface DocSection {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
}

export const MAP_TAG = 'mapa-auto';

export interface DocTemplateSet {
  id: string;
  author: string;
  language: string;
  name: Partial<Record<'pt-PT' | 'en' | 'es', string>>;
  description: Partial<Record<'pt-PT' | 'en' | 'es', string>>;
  files: string[];
}

export interface DocTarget {
  type: DocLinkType;
  targetId: string;
  label: string;
  group: string;
  provider?: string;
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
  tags: string[];
  replaces: string[];
  proposedBy: string;
  taskId: string | null;
  status: string;
  createdAt: string;
  doc: { id: string; title: string; content: string } | null;
  changes?: DocProposalChanges;
}

export interface DocProposalChanges {
  title?: { from: string; to: string };
  tagsAdded: string[];
  tagsRemoved: string[];
  linksAdded: { type: DocLinkType; label: string }[];
  linksRemoved: { type: DocLinkType; label: string }[];
  section?: { from: string | null; to: string | null; isNew: boolean };
}

export interface DocFilters {
  search: string;
  kind: DocKind | '';
  linkType: DocLinkType | '';
  targetId?: string;
  owner?: DocOwner | '';
  sort?: 'recent' | 'title';
}
