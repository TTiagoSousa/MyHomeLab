import { DOC_KINDS, DOC_LINK_TYPES, type Doc, type DocKind, type DocLinkInput, type DocPayload } from '../../../Hooks/Docs/docTypes';

export interface DocDraft {
  title: string;
  kind: DocKind;
  content: string;
  summary: string;
  tags: string[];
  links: DocLinkInput[];
}

export const emptyDraft = (links: DocLinkInput[] = [], kind: DocKind = 'RULES'): DocDraft => ({
  title: '',
  kind,
  content: '',
  summary: '',
  tags: [],
  links,
});

export const draftFromDoc = (doc: Doc): DocDraft => ({
  title: doc.title,
  kind: doc.kind,
  content: doc.content,
  summary: doc.summary ?? '',
  tags: doc.tags,
  links: doc.links.map(({ type, targetId, label }) => ({ type, targetId, label })),
});

export const draftToPayload = (draft: DocDraft): DocPayload => ({
  title: draft.title.trim(),
  kind: draft.kind,
  content: draft.content,
  summary: draft.summary.trim(),
  tags: draft.tags,
  links: draft.links,
});

export const linkFromQuery = (params: URLSearchParams): DocLinkInput[] => {
  const type = params.get('linkType');
  const targetId = params.get('targetId');
  const match = DOC_LINK_TYPES.find((linkType) => linkType === type);
  if (!match || !targetId) return [];
  return [{ type: match, targetId, label: params.get('label') || targetId }];
};

export const kindFromQuery = (params: URLSearchParams): DocKind =>
  DOC_KINDS.find((kind) => kind === params.get('newKind')) ?? 'RULES';

export const sameLink = (a: DocLinkInput, b: DocLinkInput) => a.type === b.type && a.targetId === b.targetId;
