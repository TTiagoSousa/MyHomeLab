import { useTranslation } from 'react-i18next';
import { Doc_Link_Chip, Doc_Meta_Chips } from '../../../Components/Doc_Chips/Doc_Chips';
import type { DocSummary } from '../../../Hooks/Docs/docTypes';
import { formatRelativeTime } from '../Apps/relativeTime';
import { authorLabel } from './docFormat';
import { plainText } from './docTree';

const LINKS_SHOWN = 3;

interface Doc_List_Item_Props {
  doc: DocSummary;
  hiddenLink?: string;
  onSelect: () => void;
}

const Doc_List_Item = ({ doc, hiddenLink, onSelect }: Doc_List_Item_Props) => {
  const { t } = useTranslation('docs');
  const links = doc.links.filter((link) => link.type !== 'DOC' && `${link.type}:${link.targetId}` !== hiddenLink);
  const preview = doc.summary || plainText(doc.snippet);
  const hiddenLinks = links.length - LINKS_SHOWN;

  return (
    <button type='button' className='Doc_List_Item' onClick={onSelect}>
      <span className='Doc_List_Item_Title'>{doc.title}</span>
      <span className='Doc_List_Item_Chips'>
        <Doc_Meta_Chips kind={doc.kind} owner={doc.owner} />
        {links.slice(0, LINKS_SHOWN).map((link) => (
          <Doc_Link_Chip key={link.id} link={link} />
        ))}
        {hiddenLinks > 0 && <span className='Doc_Chip'>+{hiddenLinks}</span>}
      </span>
      {preview && <span className='Doc_List_Item_Snippet'>{preview}</span>}
      <span className='Doc_List_Item_Meta'>
        {t('list.updated', { time: formatRelativeTime(doc.updatedAt, t), by: authorLabel(doc.updatedBy, t) })}
      </span>
    </button>
  );
};

export default Doc_List_Item;
