import { useTranslation } from 'react-i18next';
import type { DocSummary } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_List_Item from './Doc_List_Item';

interface Doc_Tree_Item_Props {
  doc: DocSummary;
  childrenOf: Map<string, DocSummary[]>;
  hiddenLink?: string;
  isOpen: (key: string, openByDefault?: boolean) => boolean;
  onToggle: (key: string, openByDefault?: boolean) => void;
  onSelect: (id: string) => void;
}

const Doc_Tree_Item = ({ doc, childrenOf, hiddenLink, isOpen, onToggle, onSelect }: Doc_Tree_Item_Props) => {
  const { t } = useTranslation('docs');
  const children = childrenOf.get(doc.id) ?? [];
  const key = `doc:${doc.id}`;
  const open = isOpen(key, false);

  return (
    <div className='Doc_Tree_Item'>
      <div className='Doc_Tree_Row'>
        {children.length > 0 ? (
          <button
            type='button'
            className={`Docs_Tree_Caret${open ? ' open' : ''}`}
            aria-expanded={open}
            aria-label={t(open ? 'tree.collapseDoc' : 'tree.expandDoc', { count: children.length })}
            title={t(open ? 'tree.collapseDoc' : 'tree.expandDoc', { count: children.length })}
            onClick={() => onToggle(key, false)}
          >
            <Icon.Chevron />
          </button>
        ) : (
          <span className='Docs_Tree_Caret_Space' aria-hidden='true' />
        )}
        <Doc_List_Item doc={doc} hiddenLink={hiddenLink} onSelect={() => onSelect(doc.id)} />
        {children.length > 0 && !open && <span className='Doc_Tree_Count'>{t('tree.subdocs', { count: children.length })}</span>}
      </div>
      {open && children.length > 0 && (
        <div className='Doc_Tree_Children'>
          {children.map((child) => (
            <Doc_Tree_Item
              key={child.id}
              doc={child}
              childrenOf={childrenOf}
              hiddenLink={hiddenLink}
              isOpen={isOpen}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Doc_Tree_Item;
