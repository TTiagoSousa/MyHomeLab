import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../Components/Modals/Server_Modal/Server_Modal.scss';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import type { DocUserType } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';

interface Doc_Types_Modal_Props {
  types: DocUserType[];
  saving: boolean;
  onCreate: (name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onClose: () => void;
}

const Doc_Types_Modal = ({ types, saving, onCreate, onDelete, onClose }: Doc_Types_Modal_Props) => {
  const { t } = useTranslation('docs');
  const [name, setName] = useState('');
  const [confirmingId, setConfirmingId] = useState('');

  const create = async () => {
    if (!name.trim() || saving) return;
    const created = await onCreate(name.trim());
    if (created) setName('');
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal Doc_Types_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>T</span>
          <div>
            <span className='Server_Modal_Title'>{t('types.title')}</span>
            <span className='Server_Modal_Kind'>{t('types.kind')}</span>
          </div>
        </div>

        <p className='Server_Modal_Text'>{t('types.text')}</p>

        <div className='Doc_Types_Modal_New'>
          <Global_Input
            id='doc-type-name'
            value={name}
            maxLength={40}
            placeholder={t('types.placeholder')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <button type='button' className='Doc_Types_Modal_Add' onClick={() => void create()} disabled={saving || !name.trim()}>
            <Icon.Plus />
            <span>{t('types.add')}</span>
          </button>
        </div>

        {types.length === 0 ? (
          <p className='Server_Modal_Hint'>{t('types.none')}</p>
        ) : (
          <ul className='Doc_Types_Modal_List'>
            {types.map((type) => (
              <li key={type.id}>
                <span className='Doc_Types_Modal_Name'>{type.name}</span>
                <span className='Doc_Types_Modal_Count'>{t('types.count', { count: type._count?.docs ?? 0 })}</span>
                {confirmingId === type.id ? (
                  <>
                    <button type='button' onClick={() => setConfirmingId('')} disabled={saving}>
                      {t('types.keep')}
                    </button>
                    <button type='button' className='danger' onClick={() => void onDelete(type.id).then(() => setConfirmingId(''))} disabled={saving}>
                      {t('types.confirmDelete')}
                    </button>
                  </>
                ) : (
                  <button type='button' onClick={() => setConfirmingId(type.id)} disabled={saving} title={t('types.deleteHint')}>
                    {t('types.delete')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Save_Button' onClick={onClose} disabled={saving}>
            {t('types.done')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Doc_Types_Modal;
