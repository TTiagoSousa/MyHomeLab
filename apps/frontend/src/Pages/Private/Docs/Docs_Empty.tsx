import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';

interface Docs_Empty_Props {
  creatingStarter: boolean;
  onStarter: () => void;
  onNew: () => void;
}

const Docs_Empty = ({ creatingStarter, onStarter, onNew }: Docs_Empty_Props) => {
  const { t } = useTranslation('docs');

  return (
    <div className='Docs_empty'>
      <span className='Docs_empty_icon'>
        <Icon.Doc />
      </span>
      <span className='Docs_empty_title'>{t('empty.title')}</span>
      <p>{t('empty.text')}</p>
      <button type='button' className='Docs_empty_primary' onClick={onStarter} disabled={creatingStarter}>
        {creatingStarter ? t('actions.starterBusy') : t('actions.starter')}
      </button>
      <button type='button' className='Docs_empty_secondary' onClick={onNew}>
        {t('empty.or')}
      </button>
    </div>
  );
};

export default Docs_Empty;
