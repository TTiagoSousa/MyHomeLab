import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { docAutoGroup } from '@myhomelab/shared';
import type { DocKind, DocLinkType, DocSummary, DocTarget } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_Tree_Item from './Doc_Tree_Item';

const THING_TYPES: DocLinkType[] = ['SERVER', 'GUEST', 'APP', 'MONITOR'];
const KIND_ORDER: DocKind[] = ['MAP', 'RULES'];

interface Docs_Group {
  key: string;
  label: string;
  docs: DocSummary[];
}

interface Docs_Groups_Props {
  docs: DocSummary[];
  childrenOf: Map<string, DocSummary[]>;
  targets: DocTarget[];
  isOpen: (key: string, openByDefault?: boolean) => boolean;
  onToggle: (key: string, openByDefault?: boolean) => void;
  onSelect: (id: string) => void;
  onCreate: (target: DocTarget, kind: DocKind) => void;
}

const targetKey = (type: DocLinkType, targetId: string) => `${type}:${targetId}`;

const groupBy = (docs: DocSummary[], types: DocLinkType[]) => {
  const groups = new Map<string, Docs_Group>();
  for (const doc of docs) {
    const link = doc.links.find((item) => types.includes(item.type));
    if (!link) continue;
    const key = targetKey(link.type, link.targetId);
    const group = groups.get(key) ?? { key, label: link.label, docs: [] };
    group.docs.push(doc);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
};

const mapFirst = (a: DocSummary, b: DocSummary) =>
  KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title);

const Docs_Groups = ({ docs, childrenOf, targets, isOpen, onToggle, onSelect, onCreate }: Docs_Groups_Props) => {
  const { t } = useTranslation('docs');

  const things = groupBy(docs.filter((doc) => docAutoGroup(doc) === 'things'), THING_TYPES);
  const projects = groupBy(docs.filter((doc) => docAutoGroup(doc) === 'projects'), ['PROJECT']);
  const general = docs.filter((doc) => docAutoGroup(doc) === 'general');

  const renderDocs = (items: DocSummary[], groupKey?: string) =>
    [...items].sort(mapFirst).map((doc) => (
      <Doc_Tree_Item
        key={doc.id}
        doc={doc}
        childrenOf={childrenOf}
        hiddenLink={groupKey}
        isOpen={isOpen}
        onToggle={onToggle}
        onSelect={onSelect}
      />
    ));

  const caret = (key: string, label: string, openByDefault = true) => {
    const open = isOpen(key, openByDefault);
    return (
      <button
        type='button'
        className={`Docs_Tree_Caret${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-label={t(open ? 'tree.collapse' : 'tree.expand', { name: label })}
        onClick={() => onToggle(key, openByDefault)}
      >
        <Icon.Chevron />
      </button>
    );
  };

  const renderGroups = (groups: Docs_Group[]) =>
    groups.map((group) => {
      const kinds = new Set(group.docs.map((doc) => doc.kind));
      const target = targets.find((item) => targetKey(item.type, item.targetId) === group.key);
      const missing = KIND_ORDER.filter((kind) => !kinds.has(kind));
      const key = `group:${group.key}`;
      return (
        <div key={group.key} className='Docs_Group_Target'>
          <div className='Docs_Group_Target_Head'>
            {caret(key, group.label)}
            <button type='button' className='Docs_Group_Target_Name' onClick={() => onToggle(key)}>
              {group.label}
              <span className='Docs_Section_Count'>{group.docs.length}</span>
            </button>
            {target &&
              missing.map((kind) => (
                <button key={kind} type='button' className='Docs_Group_Add' onClick={() => onCreate(target, kind)}>
                  <Icon.Plus />
                  {t(kind === 'MAP' ? 'groups.addMap' : 'groups.addRules')}
                </button>
              ))}
          </div>
          {isOpen(key) && <div className='Docs_Group_Body'>{renderDocs(group.docs, group.key)}</div>}
        </div>
      );
    });

  const renderSection = (id: string, title: string, count: number, body: () => ReactNode) => {
    const key = `auto:${id}`;
    return (
      <section className='Docs_Group'>
        <div className='Docs_Group_Head'>
          {caret(key, title)}
          <button type='button' className='Docs_Group_Title' onClick={() => onToggle(key)}>
            {title}
            <span className='Docs_Section_Count'>{count}</span>
          </button>
        </div>
        {isOpen(key) && body()}
      </section>
    );
  };

  const total = (groups: Docs_Group[]) => groups.reduce((sum, group) => sum + group.docs.length, 0);

  return (
    <>
      {things.length > 0 && renderSection('things', t('groups.things'), total(things), () => renderGroups(things))}
      {projects.length > 0 && renderSection('projects', t('groups.projects'), total(projects), () => renderGroups(projects))}
      {general.length > 0 && renderSection('general', t('groups.general'), general.length, () => renderDocs(general))}
    </>
  );
};

export default Docs_Groups;
