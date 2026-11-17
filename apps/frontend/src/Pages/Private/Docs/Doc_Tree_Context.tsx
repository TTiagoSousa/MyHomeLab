import { useTranslation } from 'react-i18next';
import type { Doc, DocSection, DocSummary } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import { plainText, sectionPath } from './docTree';

interface Doc_Breadcrumb_Props {
  doc: Doc;
  sections: DocSection[];
  docs: DocSummary[];
  onOpen: (id: string) => void;
}

export const Doc_Breadcrumb = ({ doc, sections, docs, onOpen }: Doc_Breadcrumb_Props) => {
  const { t } = useTranslation('docs');
  const parents: DocSummary[] = [];
  let current = docs.find((item) => item.id === doc.parentId);
  while (current && parents.length < 10) {
    parents.unshift(current);
    current = docs.find((item) => item.id === current?.parentId);
  }
  const path = sectionPath(sections, doc.sectionId);
  if (!path.length && !parents.length) return null;

  return (
    <nav className='Doc_Breadcrumb' aria-label={t('place.where')}>
      <Icon.Folder />
      {path.map((section) => (
        <span key={section.id} className='Doc_Breadcrumb_Part'>
          {section.name}
        </span>
      ))}
      {parents.map((parent) => (
        <button key={parent.id} type='button' className='Doc_Breadcrumb_Part link' onClick={() => onOpen(parent.id)}>
          {parent.title}
        </button>
      ))}
    </nav>
  );
};

interface Doc_Subdocs_Props {
  doc: Doc;
  docs: DocSummary[];
  onOpen: (id: string) => void;
  onNewChild: () => void;
}

export const Doc_Subdocs = ({ doc, docs, onOpen, onNewChild }: Doc_Subdocs_Props) => {
  const { t } = useTranslation('docs');
  const children = docs.filter((item) => item.parentId === doc.id).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <section className='Doc_Subdocs'>
      <div className='Doc_Subdocs_Head'>
        <span className='Doc_Subdocs_Title'>{t('tree.subdocsTitle', { count: children.length })}</span>
        <button type='button' className='Docs_Group_Add' onClick={onNewChild}>
          <Icon.Plus />
          {t('tree.addSubdoc')}
        </button>
      </div>
      {children.length === 0 ? (
        <p className='Doc_Subdocs_Empty'>{t('tree.noSubdocs')}</p>
      ) : (
        children.map((child) => (
          <button key={child.id} type='button' className='Doc_Subdocs_Item' onClick={() => onOpen(child.id)}>
            <span className='Doc_Subdocs_Name'>{child.title}</span>
            <span className='Doc_Subdocs_Text'>{child.summary || plainText(child.snippet)}</span>
          </button>
        ))
      )}
    </section>
  );
};
