import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocKind, DocSection, DocSummary, DocTarget } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Docs_Groups from './Docs_Groups';
import Docs_Name_Input from './Docs_Name_Input';
import Docs_Section_Node, { type Docs_Section_Actions } from './Docs_Section_Node';
import { childSections, childrenByParent, isTopLevel } from './docTree';
import { useTreeState } from './useTreeState';

interface Docs_Tree_Props {
  docs: DocSummary[];
  sections: DocSection[];
  targets: DocTarget[];
  actions: Docs_Section_Actions;
  addingSection: boolean;
  onAddingSection: (adding: boolean) => void;
  onSelect: (id: string) => void;
  onCreate: (target: DocTarget, kind: DocKind) => void;
}

const Docs_Tree = ({ docs, sections, targets, actions, addingSection, onAddingSection, onSelect, onCreate }: Docs_Tree_Props) => {
  const { t } = useTranslation('docs');
  const { isOpen, toggle } = useTreeState();
  const [hintClosed, setHintClosed] = useState(false);
  const childrenOf = childrenByParent(docs);
  const roots = childSections(sections, null);
  const automatic = docs.filter((doc) => !doc.sectionId && isTopLevel(doc, docs));

  return (
    <div className='Docs_Tree'>
      {roots.map((section) => (
        <Docs_Section_Node
          key={section.id}
          section={section}
          sections={sections}
          docs={docs}
          childrenOf={childrenOf}
          actions={actions}
          isOpen={isOpen}
          onToggle={toggle}
          onSelect={onSelect}
        />
      ))}

      {addingSection ? (
        <Docs_Name_Input
          placeholder={t('tree.sectionName')}
          onSave={async (name) => {
            await actions.createSection(name, null);
            onAddingSection(false);
          }}
          onCancel={() => onAddingSection(false)}
        />
      ) : (
        <button type='button' className='Docs_Tree_Add' onClick={() => onAddingSection(true)}>
          <Icon.Plus />
          {t('tree.newSection')}
        </button>
      )}

      {roots.length === 0 && !hintClosed && (
        <p className='Docs_Tree_Hint'>
          <span>{t('tree.sectionsHint')}</span>
          <button type='button' onClick={() => setHintClosed(true)} aria-label={t('intro.close')}>
            <Icon.Close />
          </button>
        </p>
      )}

      {automatic.length > 0 && (
        <>
          <div className='Docs_Tree_Divider'>
            <span>{t('tree.automatic')}</span>
            <span className='Docs_Tree_Divider_Hint'>{t('tree.automaticHint')}</span>
          </div>
          <Docs_Groups
            docs={automatic}
            childrenOf={childrenOf}
            targets={targets}
            isOpen={isOpen}
            onToggle={toggle}
            onSelect={onSelect}
            onCreate={onCreate}
          />
        </>
      )}
    </div>
  );
};

export default Docs_Tree;
