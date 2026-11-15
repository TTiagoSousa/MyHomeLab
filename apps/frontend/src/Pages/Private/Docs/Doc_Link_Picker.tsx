import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocTargets } from '../../../Hooks/Docs/useDocTargets';
import { DOC_LINK_TYPES, type DocLinkInput, type DocLinkType, type DocTarget } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import { sameLink } from './docDraft';
import './Doc_Link_Picker.scss';

const GROUPED_TYPES: DocLinkType[] = ['GUEST', 'APP', 'MONITOR', 'DOC'];

interface Doc_Link_Picker_Props {
  links: DocLinkInput[];
  docId?: string;
  onToggle: (link: DocLinkInput) => void;
  onClose: () => void;
}

const groupBy = (targets: DocTarget[]) =>
  targets.reduce<Record<string, DocTarget[]>>((groups, target) => {
    (groups[target.group] ??= []).push(target);
    return groups;
  }, {});

const Doc_Link_Picker = ({ links, docId, onToggle, onClose }: Doc_Link_Picker_Props) => {
  const { t, i18n } = useTranslation('docs');
  const { targets, loading, error } = useDocTargets();
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const visible = targets.filter(
    (target) =>
      !(target.type === 'DOC' && target.targetId === docId) &&
      (!needle || `${target.label} ${target.group}`.toLowerCase().includes(needle)),
  );

  const groupLabel = (type: DocLinkType, group: string) =>
    type === 'DOC' && i18n.exists(`docs:kinds.${group}`) ? t(`kinds.${group}`) : group;

  const shortLabel = (target: DocTarget) =>
    target.type === 'APP' && target.label.startsWith(`${target.group} · `) ? target.label.slice(target.group.length + 3) : target.label;

  const renderTarget = (target: DocTarget) => {
    const linked = links.some((link) => sameLink(link, target));
    return (
      <li key={`${target.type}:${target.targetId}`}>
        <button
          type='button'
          className={linked ? 'linked' : ''}
          aria-pressed={linked}
          onClick={() => onToggle({ type: target.type, targetId: target.targetId, label: target.label })}
        >
          <span className='Doc_Link_Picker_Check' />
          <span className='Doc_Link_Picker_Label'>{shortLabel(target)}</span>
        </button>
      </li>
    );
  };

  const sections = DOC_LINK_TYPES.map((type) => ({ type, items: visible.filter((target) => target.type === type) })).filter(
    (section) => section.items.length > 0,
  );

  return (
    <div className='Doc_Link_Picker_Overlay' onClick={onClose}>
      <div className='Doc_Link_Picker' role='dialog' aria-label={t('links.pickerTitle')} onClick={(e) => e.stopPropagation()}>
        <div className='Doc_Link_Picker_Head'>
          <span className='Doc_Link_Picker_Title'>{t('links.pickerTitle')}</span>
          <span className='Doc_Link_Picker_Count'>{t('links.selected', { count: links.length })}</span>
        </div>

        <label className='Doc_Link_Picker_Search'>
          <Icon.Search />
          <input
            type='search'
            value={query}
            autoFocus
            placeholder={t('links.pickerSearch')}
            aria-label={t('links.pickerSearch')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className='Doc_Link_Picker_Body'>
          {loading && <p className='Doc_Link_Picker_Note'>{t('links.pickerLoading')}</p>}
          {error && <p className='Doc_Link_Picker_Note error'>{error}</p>}
          {!loading && !error && sections.length === 0 && <p className='Doc_Link_Picker_Note'>{t('links.pickerEmpty')}</p>}

          {sections.map((section) => (
            <section key={section.type} className='Doc_Link_Picker_Section'>
              <span className='Doc_Link_Picker_Section_Title'>{t(`linkGroups.${section.type}`)}</span>
              {GROUPED_TYPES.includes(section.type) ? (
                Object.entries(groupBy(section.items)).map(([group, items]) => (
                  <div key={group} className='Doc_Link_Picker_Group'>
                    <span className='Doc_Link_Picker_Group_Title'>{groupLabel(section.type, group)}</span>
                    <ul>{items.map(renderTarget)}</ul>
                  </div>
                ))
              ) : (
                <ul>{section.items.map(renderTarget)}</ul>
              )}
            </section>
          ))}
        </div>

        <div className='Doc_Link_Picker_Footer'>
          <button type='button' onClick={onClose}>
            {t('links.done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Doc_Link_Picker;
