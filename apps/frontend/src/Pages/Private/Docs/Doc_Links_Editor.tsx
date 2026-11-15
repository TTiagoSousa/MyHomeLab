import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Doc_Link_Chip } from '../../../Components/Doc_Chips/Doc_Chips';
import type { DocLinkInput } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_Link_Picker from './Doc_Link_Picker';
import { sameLink } from './docDraft';

interface Doc_Links_Editor_Props {
  links: DocLinkInput[];
  docId?: string;
  onChange: (links: DocLinkInput[]) => void;
}

const Doc_Links_Editor = ({ links, docId, onChange }: Doc_Links_Editor_Props) => {
  const { t } = useTranslation('docs');
  const [picking, setPicking] = useState(false);

  const toggleLink = (link: DocLinkInput) =>
    onChange(links.some((item) => sameLink(item, link)) ? links.filter((item) => !sameLink(item, link)) : [...links, link]);

  return (
    <div className='Doc_Links_Editor'>
      {links.length === 0 && <span className='Doc_Links_Editor_None'>{t('links.none')}</span>}
      {links.map((link) => (
        <Doc_Link_Chip key={`${link.type}:${link.targetId}`} link={link} onRemove={() => toggleLink(link)} />
      ))}
      <button type='button' className='Doc_Links_Editor_Add' onClick={() => setPicking(true)}>
        <Icon.Plus />
        <span>{t('links.add')}</span>
      </button>

      {picking && <Doc_Link_Picker links={links} docId={docId} onToggle={toggleLink} onClose={() => setPicking(false)} />}
    </div>
  );
};

export default Doc_Links_Editor;
