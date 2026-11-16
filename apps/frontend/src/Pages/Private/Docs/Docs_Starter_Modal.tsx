import { useTranslation } from 'react-i18next';
import '../../../Components/Modals/Server_Modal/Server_Modal.scss';
import type { DocTemplateSet } from '../../../Hooks/Docs/docTypes';
import { currentLanguage } from '../../../i18n';

interface Docs_Starter_Modal_Props {
  sets: DocTemplateSet[];
  loading: boolean;
  busy: boolean;
  onGeneric: () => void;
  onSet: (id: string) => void;
  onClose: () => void;
}

const Docs_Starter_Modal = ({ sets, loading, busy, onGeneric, onSet, onClose }: Docs_Starter_Modal_Props) => {
  const { t } = useTranslation('docs');
  const language = currentLanguage();
  const text = (texts: DocTemplateSet['name']) => texts[language] ?? texts['pt-PT'] ?? texts.en ?? '';
  const examples = sets.filter((set) => set.author === 'MyHomeLab');
  const community = sets.filter((set) => set.author !== 'MyHomeLab');

  const renderSet = (set: DocTemplateSet) => (
    <button key={set.id} type='button' className='Docs_Starter_Option' onClick={() => onSet(set.id)} disabled={busy}>
      <span className='Docs_Starter_Option_Name'>{text(set.name)}</span>
      <span className='Docs_Starter_Option_Text'>{text(set.description)}</span>
      <span className='Docs_Starter_Option_Meta'>{t('starter.meta', { count: set.files.length, author: set.author })}</span>
    </button>
  );

  return (
    <div className='Server_Modal_Overlay' onClick={() => !busy && onClose()}>
      <div className='Server_Modal Docs_Starter_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>D</span>
          <div>
            <span className='Server_Modal_Title'>{t('starter.title')}</span>
            <span className='Server_Modal_Kind'>{t('starter.kind')}</span>
          </div>
        </div>

        <p className='Server_Modal_Text'>{t('starter.text')}</p>

        <span className='Docs_Starter_Group'>{t('starter.generic')}</span>
        <button type='button' className='Docs_Starter_Option' onClick={onGeneric} disabled={busy}>
          <span className='Docs_Starter_Option_Name'>{t('starter.genericName')}</span>
          <span className='Docs_Starter_Option_Text'>{t('starter.genericText')}</span>
        </button>

        {examples.length > 0 && <span className='Docs_Starter_Group'>{t('starter.examples')}</span>}
        {examples.map(renderSet)}

        <span className='Docs_Starter_Group'>{t('starter.community')}</span>
        {loading && <p className='Server_Modal_Hint'>{t('starter.loading')}</p>}
        {!loading && community.length === 0 && <p className='Server_Modal_Hint'>{t('starter.noCommunity')}</p>}
        {community.map(renderSet)}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Save_Button' onClick={onClose} disabled={busy}>
            {busy ? t('actions.starterBusy') : t('starter.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Docs_Starter_Modal;
