import { DocLinkType } from 'src/generated/prisma/client/client';

/**
 * A arrumação que uma proposta pede (DocProposal.organize): o que não vem fica como está.
 * section: { id } uma secção que existe, { id: null } fora das secções, { name } uma
 * secção nova (criada ao aprovar, no topo).
 */
export interface ProposalOrganize {
  title?: string;
  tags?: string[];
  links?: { type: DocLinkType; targetId: string; label: string }[];
  section?: { id: string | null } | { name: string };
}

export interface ProposalChanges {
  title?: { from: string; to: string };
  tagsAdded: string[];
  tagsRemoved: string[];
  linksAdded: { type: DocLinkType; label: string }[];
  linksRemoved: { type: DocLinkType; label: string }[];
  section?: { from: string | null; to: string | null; isNew: boolean };
}

interface CurrentDoc {
  title: string;
  tags: string[];
  links: { type: DocLinkType; targetId: string; label: string }[];
  sectionId: string | null;
}

const linkKey = (link: { type: DocLinkType; targetId: string }) =>
  `${link.type}:${link.targetId}`;

export const readOrganize = (value: unknown): ProposalOrganize | null =>
  value && typeof value === 'object' ? value : null;

/** O que muda, para o utilizador ver antes de aprovar (sem a parte do texto). */
export function proposalChanges(
  organize: ProposalOrganize | null,
  doc: CurrentDoc | null,
  sectionName: (id: string | null) => string | null,
): ProposalChanges {
  const changes: ProposalChanges = {
    tagsAdded: [],
    tagsRemoved: [],
    linksAdded: [],
    linksRemoved: [],
  };
  if (!organize) return changes;
  const current: CurrentDoc = doc ?? {
    title: '',
    tags: [],
    links: [],
    sectionId: null,
  };

  if (doc && organize.title && organize.title !== doc.title) {
    changes.title = { from: doc.title, to: organize.title };
  }
  if (organize.tags) {
    changes.tagsAdded = organize.tags.filter(
      (tag) => !current.tags.includes(tag),
    );
    changes.tagsRemoved = current.tags.filter(
      (tag) => !organize.tags!.includes(tag),
    );
  }
  if (organize.links) {
    const before = new Set(current.links.map(linkKey));
    const after = new Set(organize.links.map(linkKey));
    changes.linksAdded = organize.links
      .filter((link) => !before.has(linkKey(link)))
      .map(({ type, label }) => ({ type, label }));
    changes.linksRemoved = current.links
      .filter((link) => !after.has(linkKey(link)))
      .map(({ type, label }) => ({ type, label }));
  }
  if (organize.section) {
    const from = sectionName(current.sectionId);
    if ('name' in organize.section) {
      changes.section = { from, to: organize.section.name, isNew: true };
    } else if (organize.section.id !== current.sectionId) {
      changes.section = {
        from,
        to: sectionName(organize.section.id),
        isNew: false,
      };
    }
  }
  return changes;
}

/** Junta ligações sem repetir (a mesma coisa duas vezes conta uma). */
export function mergeLinks(
  current: { type: DocLinkType; targetId: string; label: string }[],
  add: { type: DocLinkType; targetId: string; label: string }[] = [],
  remove: string[] = [],
) {
  const removed = new Set(remove);
  const result = current.filter(
    (link) => !removed.has(link.targetId) && !removed.has(linkKey(link)),
  );
  for (const link of add) {
    if (!result.some((item) => linkKey(item) === linkKey(link)))
      result.push(link);
  }
  return result;
}
