import { useTranslation } from 'react-i18next';
import type { DocKind, DocLinkInput, DocOwner } from '../../Hooks/Docs/docTypes';
import { Close } from '../../Imports/icons';
import './Doc_Chips.scss';

interface Doc_Meta_Chips_Props {
  kind: DocKind;
  typeName?: string;
  required: boolean;
  owner?: DocOwner;
}

export const Doc_Meta_Chips = ({ kind, typeName, required, owner }: Doc_Meta_Chips_Props) => {
  const { t } = useTranslation('docs');

  return (
    <>
      {typeName ? <span className='Doc_Chip kind custom'>{typeName}</span> : <span className={`Doc_Chip kind ${kind.toLowerCase()}`}>{t(`kinds.${kind}`)}</span>}
      {required && <span className='Doc_Chip required'>{t('chips.required')}</span>}
      {owner === 'AGENT' && <span className='Doc_Chip agent'>{t('chips.agentOwner')}</span>}
    </>
  );
};

interface Doc_Link_Chip_Props {
  link: DocLinkInput;
  onRemove?: () => void;
}

export const Doc_Link_Chip = ({ link, onRemove }: Doc_Link_Chip_Props) => {
  const { t } = useTranslation('docs');

  return (
    <span className='Doc_Chip link'>
      <small>{t(`linkTypes.${link.type}`)}</small>
      <span className='Doc_Chip_Label'>{link.label}</span>
      {onRemove && (
        <button type='button' onClick={onRemove} aria-label={t('links.remove', { label: link.label })} title={t('links.remove', { label: link.label })}>
          <Close />
        </button>
      )}
    </span>
  );
};
