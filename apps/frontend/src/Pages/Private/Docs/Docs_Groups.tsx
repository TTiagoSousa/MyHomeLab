import { useTranslation } from 'react-i18next';
import type { DocKind, DocLinkType, DocSummary, DocTarget } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_List_Item from './Doc_List_Item';

const THING_TYPES: DocLinkType[] = ['SERVER', 'GUEST', 'APP', 'MONITOR'];
const UPDATABLE_APPS = ['NEXTCLOUD', 'FORGEJO', 'TREK', 'HOME_ASSISTANT', 'ADGUARD', 'OPENGYM'];

const suggested = (target: DocTarget) =>
  target.type === 'SERVER' || (target.type === 'APP' && UPDATABLE_APPS.includes(target.provider ?? ''));

interface Docs_Group {
  key: string;
  label: string;
  docs: DocSummary[];
}

interface Docs_Groups_Props {
  docs: DocSummary[];
  targets: DocTarget[];
  showMissing: boolean;
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

const rulesFirst = (a: DocSummary, b: DocSummary) => (a.kind === b.kind ? 0 : a.kind === 'RULES' ? -1 : 1);

const Docs_Groups = ({ docs, targets, showMissing, onSelect, onCreate }: Docs_Groups_Props) => {
  const { t } = useTranslation('docs');

  const hasLink = (doc: DocSummary, types: DocLinkType[]) => doc.links.some((link) => types.includes(link.type));
  const things = groupBy(docs, THING_TYPES);
  const projects = groupBy(docs.filter((doc) => !hasLink(doc, THING_TYPES)), ['PROJECT']);
  const general = docs.filter((doc) => !hasLink(doc, THING_TYPES) && !hasLink(doc, ['PROJECT']));

  const covered = new Set(docs.flatMap((doc) => doc.links.map((link) => targetKey(link.type, link.targetId))));
  const missing = showMissing
    ? targets
        .filter((target) => suggested(target) && !covered.has(targetKey(target.type, target.targetId)))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];

  const renderDocs = (items: DocSummary[], groupKey?: string) =>
    [...items].sort(rulesFirst).map((doc) => (
      <Doc_List_Item key={doc.id} doc={doc} hiddenLink={groupKey} onSelect={() => onSelect(doc.id)} />
    ));

  const renderGroups = (groups: Docs_Group[]) =>
    groups.map((group) => {
      const kinds = new Set(group.docs.map((doc) => doc.kind));
      const target = targets.find((item) => targetKey(item.type, item.targetId) === group.key);
      return (
        <div key={group.key} className='Docs_Group_Target'>
          <div className='Docs_Group_Target_Head'>
            <span className='Docs_Group_Target_Name'>{group.label}</span>
            {target && !kinds.has('MAP') && (
              <button type='button' className='Docs_Group_Add' onClick={() => onCreate(target, 'MAP')}>
                <Icon.Plus />
                {t('groups.addMap')}
              </button>
            )}
          </div>
          {renderDocs(group.docs, group.key)}
        </div>
      );
    });

  return (
    <>
      {general.length > 0 && (
        <section className='Docs_Group'>
          <span className='Docs_Group_Title'>{t('groups.general')}</span>
          {renderDocs(general)}
        </section>
      )}
      {(things.length > 0 || missing.length > 0) && (
        <section className='Docs_Group'>
          <span className='Docs_Group_Title'>{t('groups.things')}</span>
          {renderGroups(things)}
          {missing.map((target) => (
            <div key={targetKey(target.type, target.targetId)} className='Docs_Group_Target missing'>
              <div className='Docs_Group_Target_Head'>
                <span className='Docs_Group_Target_Name'>{target.label}</span>
                <span className='Docs_Group_Missing'>{t('groups.missing')}</span>
                <button type='button' className='Docs_Group_Add' onClick={() => onCreate(target, 'RULES')}>
                  <Icon.Plus />
                  {t('groups.addRules')}
                </button>
                <button type='button' className='Docs_Group_Add' onClick={() => onCreate(target, 'MAP')}>
                  <Icon.Plus />
                  {t('groups.addMap')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {projects.length > 0 && (
        <section className='Docs_Group'>
          <span className='Docs_Group_Title'>{t('groups.projects')}</span>
          {renderGroups(projects)}
        </section>
      )}
    </>
  );
};

export default Docs_Groups;
