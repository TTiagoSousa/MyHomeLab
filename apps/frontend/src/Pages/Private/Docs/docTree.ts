import type { DocSection, DocSummary } from '../../../Hooks/Docs/docTypes';

const byName = (a: DocSection, b: DocSection) => a.position - b.position || a.name.localeCompare(b.name);
const byTitle = (a: DocSummary, b: DocSummary) => a.title.localeCompare(b.title);

export const childSections = (sections: DocSection[], parentId: string | null) =>
  sections.filter((section) => section.parentId === parentId).sort(byName);

export const sectionPath = (sections: DocSection[], id: string | null) => {
  const path: DocSection[] = [];
  let current = sections.find((section) => section.id === id);
  while (current && path.length < 20) {
    path.unshift(current);
    current = sections.find((section) => section.id === current?.parentId);
  }
  return path;
};

export const sectionOptions = (sections: DocSection[], excludeId?: string) => {
  const options: { value: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const section of childSections(sections, parentId)) {
      if (section.id === excludeId) continue;
      options.push({ value: section.id, label: `${'— '.repeat(depth)}${section.name}` });
      walk(section.id, depth + 1);
    }
  };
  walk(null, 0);
  return options;
};

export const childrenByParent = (docs: DocSummary[]) => {
  const ids = new Set(docs.map((doc) => doc.id));
  const map = new Map<string, DocSummary[]>();
  for (const doc of docs) {
    if (!doc.parentId || !ids.has(doc.parentId)) continue;
    map.set(doc.parentId, [...(map.get(doc.parentId) ?? []), doc]);
  }
  for (const list of map.values()) list.sort(byTitle);
  return map;
};

export const isTopLevel = (doc: DocSummary, docs: DocSummary[]) =>
  !doc.parentId || !docs.some((item) => item.id === doc.parentId);

export const descendantIds = (docs: DocSummary[], id: string) => {
  const found = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const doc of docs) {
      if (doc.parentId && found.has(doc.parentId) && !found.has(doc.id)) {
        found.add(doc.id);
        grew = true;
      }
    }
  }
  return found;
};

export const countInSection = (sections: DocSection[], docs: DocSummary[], id: string): number =>
  docs.filter((doc) => doc.sectionId === id).length +
  childSections(sections, id).reduce((total, child) => total + countInSection(sections, docs, child.id), 0);

export const plainText = (markdown: string) =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
