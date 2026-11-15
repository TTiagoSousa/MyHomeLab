import { DOC_LINK_TYPES, type Doc, type DocKind, type DocLinkInput, type DocPayload } from '../../../Hooks/Docs/docTypes';

export interface DocDraft {
  title: string;
  kind: DocKind;
  typeId: string | null;
  content: string;
  summary: string;
  tags: string[];
  required: boolean;
  links: DocLinkInput[];
}

export const emptyDraft = (links: DocLinkInput[] = []): DocDraft => ({
  title: '',
  kind: 'NOTES',
  typeId: null,
  content: '',
  summary: '',
  tags: [],
  required: false,
  links,
});

export const draftFromDoc = (doc: Doc): DocDraft => ({
  title: doc.title,
  kind: doc.kind,
  typeId: doc.typeId,
  content: doc.content,
  summary: doc.summary ?? '',
  tags: doc.tags,
  required: doc.required,
  links: doc.links.map(({ type, targetId, label }) => ({ type, targetId, label })),
});

export const draftToPayload = (draft: DocDraft): DocPayload => ({
  title: draft.title.trim(),
  kind: draft.typeId ? 'OTHER' : draft.kind,
  typeId: draft.typeId,
  content: draft.content,
  summary: draft.summary.trim(),
  tags: draft.tags,
  required: draft.required,
  links: draft.links,
});

export const linkFromQuery = (params: URLSearchParams): DocLinkInput[] => {
  const type = params.get('linkType');
  const targetId = params.get('targetId');
  const match = DOC_LINK_TYPES.find((linkType) => linkType === type);
  if (!match || !targetId) return [];
  return [{ type: match, targetId, label: params.get('label') || targetId }];
};

export const sameLink = (a: DocLinkInput, b: DocLinkInput) => a.type === b.type && a.targetId === b.targetId;
