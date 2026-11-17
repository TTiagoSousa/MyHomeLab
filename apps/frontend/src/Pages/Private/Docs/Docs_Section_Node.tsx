import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocKind, DocSection, DocSummary } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_Tree_Item from './Doc_Tree_Item';
import Docs_Menu from './Docs_Menu';
import Docs_Name_Input from './Docs_Name_Input';
import { childSections, countInSection, isTopLevel } from './docTree';

export interface Docs_Section_Actions {
  createSection: (name: string, parentId: string | null) => Promise<unknown>;
  renameSection: (id: string, name: string) => Promise<unknown>;
  deleteSection: (id: string) => Promise<unknown>;
  newDocIn: (sectionId: string, kind: DocKind) => void;
}

interface Docs_Section_Node_Props {
  section: DocSection;
  sections: DocSection[];
  docs: DocSummary[];
  childrenOf: Map<string, DocSummary[]>;
  actions: Docs_Section_Actions;
  isOpen: (key: string, openByDefault?: boolean) => boolean;
  onToggle: (key: string, openByDefault?: boolean) => void;
  onSelect: (id: string) => void;
}

type Editing = 'rename' | 'child' | 'delete' | null;

const Docs_Section_Node = ({ section, sections, docs, childrenOf, actions, isOpen, onToggle, onSelect }: Docs_Section_Node_Props) => {
  const { t } = useTranslation('docs');
  const [editing, setEditing] = useState<Editing>(null);
  const key = `section:${section.id}`;
  const open = isOpen(key);
  const children = childSections(sections, section.id);
  const ownDocs = docs.filter((doc) => doc.sectionId === section.id && isTopLevel(doc, docs)).sort((a, b) => a.title.localeCompare(b.title));
  const total = countInSection(sections, docs, section.id);

  const menuItems = [
    { id: 'rules', label: t('tree.newRulesHere'), onSelect: () => actions.newDocIn(section.id, 'RULES') },
    { id: 'map', label: t('tree.newMapHere'), onSelect: () => actions.newDocIn(section.id, 'MAP') },
    { id: 'child', label: t('tree.newSubsection'), onSelect: () => setEditing('child') },
    { id: 'rename', label: t('tree.rename'), onSelect: () => setEditing('rename') },
    { id: 'delete', label: t('tree.deleteSection'), danger: true, onSelect: () => setEditing('delete') },
  ];

  return (
    <div className='Docs_Section_Node'>
      <div className='Docs_Section_Head'>
        <button
          type='button'
          className={`Docs_Tree_Caret${open ? ' open' : ''}`}
          aria-expanded={open}
          aria-label={t(open ? 'tree.collapse' : 'tree.expand', { name: section.name })}
          onClick={() => onToggle(key)}
        >
          <Icon.Chevron />
        </button>
        {editing === 'rename' ? (
          <Docs_Name_Input
            initial={section.name}
            placeholder={t('tree.sectionName')}
            onSave={async (name) => {
              await actions.renameSection(section.id, name);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button type='button' className='Docs_Section_Name' onClick={() => onToggle(key)}>
            <Icon.Folder />
            <span>{section.name}</span>
            <span className='Docs_Section_Count'>{total}</span>
          </button>
        )}
        <Docs_Menu label={t('tree.sectionActions', { name: section.name })} trigger={<span className='Docs_Dots' aria-hidden='true' />} items={menuItems} />
      </div>

      {editing === 'delete' && (
        <div className='Docs_Section_Confirm'>
          <span>{t('tree.confirmDelete', { name: section.name })}</span>
          <button
            type='button'
            className='danger'
            onClick={async () => {
              await actions.deleteSection(section.id);
              setEditing(null);
            }}
          >
            {t('actions.confirmDeleteYes')}
          </button>
          <button type='button' onClick={() => setEditing(null)}>
            {t('actions.confirmDeleteNo')}
          </button>
        </div>
      )}

      {open && (
        <div className='Docs_Section_Body'>
          {editing === 'child' && (
            <Docs_Name_Input
              placeholder={t('tree.subsectionName')}
              onSave={async (name) => {
                await actions.createSection(name, section.id);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
          {children.map((child) => (
            <Docs_Section_Node
              key={child.id}
              section={child}
              sections={sections}
              docs={docs}
              childrenOf={childrenOf}
              actions={actions}
              isOpen={isOpen}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
          {ownDocs.map((doc) => (
            <Doc_Tree_Item key={doc.id} doc={doc} childrenOf={childrenOf} isOpen={isOpen} onToggle={onToggle} onSelect={onSelect} />
          ))}
          {children.length === 0 && ownDocs.length === 0 && editing !== 'child' && (
            <div className='Docs_Section_Empty'>
              <span>{t('tree.emptySection')}</span>
              <button type='button' className='Docs_Group_Add' onClick={() => actions.newDocIn(section.id, 'RULES')}>
                <Icon.Plus />
                {t('tree.addDoc')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Docs_Section_Node;
