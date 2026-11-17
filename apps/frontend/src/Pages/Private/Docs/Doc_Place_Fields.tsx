import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { DocSection, DocSummary } from '../../../Hooks/Docs/docTypes';
import { descendantIds, sectionOptions, sectionPath } from './docTree';
import type { DocPlace } from './docDraft';

interface Doc_Place_Fields_Props {
  value: DocPlace;
  docId?: string;
  sections: DocSection[];
  docs: DocSummary[];
  onChange: (place: DocPlace) => void;
}

const NONE = '';

const Doc_Place_Fields = ({ value, docId, sections, docs, onChange }: Doc_Place_Fields_Props) => {
  const { t } = useTranslation('docs');
  const blocked = docId ? descendantIds(docs, docId) : new Set<string>();
  const parent = docs.find((doc) => doc.id === value.parentId);

  const sectionChoices = [{ value: NONE, label: t('place.automatic') }, ...sectionOptions(sections)];
  const parentChoices = [
    { value: NONE, label: t('place.noParent') },
    ...docs
      .filter((doc) => doc.kind !== 'LOG' && !blocked.has(doc.id))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((doc) => {
        const path = sectionPath(sections, doc.sectionId).map((section) => section.name);
        return { value: doc.id, label: path.length ? `${doc.title} · ${path.join(' › ')}` : doc.title };
      }),
  ];

  return (
    <div className='Doc_Form_Row'>
      <div className='Doc_Form_Field'>
        <label htmlFor='doc-section'>{t('place.section')}</label>
        {parent ? (
          <span className='Doc_Form_Static'>
            {t('place.followsParent', {
              section: sectionPath(sections, parent.sectionId).map((section) => section.name).join(' › ') || t('place.automatic'),
            })}
          </span>
        ) : (
          <Global_Dropdown
            id='doc-section'
            value={value.sectionId ?? NONE}
            options={sectionChoices}
            onChange={(sectionId) => onChange({ ...value, sectionId: sectionId || null })}
            searchable={sectionChoices.length > 8}
          />
        )}
        <span className='Doc_Form_Hint'>{t('place.sectionHint')}</span>
      </div>
      <div className='Doc_Form_Field'>
        <label htmlFor='doc-parent'>{t('place.parent')}</label>
        <Global_Dropdown
          id='doc-parent'
          value={value.parentId ?? NONE}
          options={parentChoices}
          onChange={(parentId) => {
            const chosen = docs.find((doc) => doc.id === parentId);
            onChange({ parentId: parentId || null, sectionId: chosen ? chosen.sectionId : value.sectionId });
          }}
          searchable
          maxVisibleOptions={9}
        />
        <span className='Doc_Form_Hint'>{t('place.parentHint')}</span>
      </div>
    </div>
  );
};

export default Doc_Place_Fields;
