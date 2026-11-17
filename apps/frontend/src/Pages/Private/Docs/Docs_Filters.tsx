import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { ATTEMPT_KIND, DOC_LINK_TYPES, LIBRARY_KINDS, type DocLinkType, type DocTarget } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';

export interface DocsFilterValues {
  search: string;
  kind: string;
  linkType: DocLinkType | '';
  targetId: string;
  author: '' | 'USER' | 'AGENT';
  sort: 'recent' | 'title';
}

interface Docs_Filters_Props {
  values: DocsFilterValues;
  history: boolean;
  targets: DocTarget[];
  onSearch: (value: string) => void;
  onChange: (name: string, value: string) => void;
  onTarget: (target: DocTarget | null) => void;
  onClear: () => void;
}

const Docs_Filters = ({ values, history, targets, onSearch, onChange, onTarget, onClear }: Docs_Filters_Props) => {
  const { t } = useTranslation('docs');

  const kindOptions = history
    ? [
        { value: '', label: t('filters.allHistory') },
        { value: 'LOG', label: t('kinds.LOG') },
        { value: ATTEMPT_KIND, label: t('kinds.ATTEMPT') },
      ]
    : [{ value: '', label: t('filters.allKinds') }, ...LIBRARY_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))];

  const linkOptions = [
    { value: '', label: t('filters.allLinks') },
    ...DOC_LINK_TYPES.map((value) => ({ value, label: t(`linkFilter.${value}`) })),
  ];

  const ofType = targets.filter((target) => target.type === values.linkType);
  const targetOptions = [
    { value: '', label: t('filters.anyTarget') },
    ...ofType.map((target) => ({ value: target.targetId, label: target.label })),
  ];

  const authorOptions = [
    { value: '', label: t('filters.anyAuthor') },
    { value: 'USER', label: t('filters.mine') },
    { value: 'AGENT', label: t('filters.agents') },
  ];

  const sortOptions = [
    { value: 'recent', label: t('filters.sortRecent') },
    { value: 'title', label: t('filters.sortTitle') },
  ];

  const active = Boolean(values.search || values.kind || values.linkType || values.author || values.sort !== 'recent');
  const extraActive = Boolean(values.linkType || values.author || values.sort !== 'recent');
  const [moreOpen, setMoreOpen] = useState(extraActive);
  const showMore = moreOpen || extraActive;

  return (
    <section className='Docs_filters'>
      <label className='Docs_search'>
        <Icon.Search />
        <input
          type='search'
          value={values.search}
          placeholder={t('filters.search')}
          aria-label={t('filters.search')}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>

      <div className='Docs_filter_field'>
        <span>{t('filters.kindLabel')}</span>
        <Global_Dropdown value={values.kind} options={kindOptions} onChange={(value) => onChange('kind', value)} searchable={false} />
      </div>

      <button
        type='button'
        className={`Docs_filter_more${showMore ? ' open' : ''}`}
        aria-expanded={showMore}
        onClick={() => setMoreOpen(!showMore)}
        disabled={extraActive}
      >
        <span>{t(showMore ? 'filters.fewer' : 'filters.more')}</span>
        <Icon.Chevron />
      </button>

      {showMore && (
        <>
          <div className='Docs_filter_field'>
            <span>{t('filters.linkLabel')}</span>
            <Global_Dropdown value={values.linkType} options={linkOptions} onChange={(value) => onChange('link', value)} maxVisibleOptions={9} />
          </div>

          {values.linkType && (
            <div className='Docs_filter_field'>
              <span>{t(`linkFilter.${values.linkType}`)}</span>
              <Global_Dropdown
                value={values.targetId}
                options={targetOptions}
                onChange={(value) => onTarget(ofType.find((target) => target.targetId === value) ?? null)}
                maxVisibleOptions={9}
                searchable={ofType.length > 8}
              />
            </div>
          )}

          <div className='Docs_filter_field'>
            <span>{t('filters.authorLabel')}</span>
            <Global_Dropdown value={values.author} options={authorOptions} onChange={(value) => onChange('author', value)} searchable={false} />
          </div>

          <div className='Docs_filter_field'>
            <span>{t('filters.sortLabel')}</span>
            <Global_Dropdown value={values.sort} options={sortOptions} onChange={(value) => onChange('sort', value)} searchable={false} />
          </div>
        </>
      )}

      {active && (
        <button type='button' className='Docs_filter_clear' onClick={onClear}>
          <Icon.Close />
          <span>{t('filters.clear')}</span>
        </button>
      )}
    </section>
  );
};

export default Docs_Filters;
