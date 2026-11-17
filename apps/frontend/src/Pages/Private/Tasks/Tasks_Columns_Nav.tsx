import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';

interface Tasks_Columns_Nav_Props {
  hideEmpty: boolean;
  onStep: (direction: 1 | -1) => void;
  onHideEmpty: (hide: boolean) => void;
}

const Tasks_Columns_Nav = ({ hideEmpty, onStep, onHideEmpty }: Tasks_Columns_Nav_Props) => {
  const { t } = useTranslation('tasks');

  return (
    <div className='Tasks_Columns_Nav'>
      <label className='Tasks_Nav_Toggle'>
        <input type='checkbox' checked={hideEmpty} onChange={(e) => onHideEmpty(e.target.checked)} />
        <span>{t('columns.hideEmpty')}</span>
      </label>
      <button type='button' className='Tasks_Nav_Step' onClick={() => onStep(-1)} aria-label={t('columns.previous')} title={t('columns.previous')}>
        <Icon.Chevron />
      </button>
      <button type='button' className='Tasks_Nav_Step next' onClick={() => onStep(1)} aria-label={t('columns.next')} title={t('columns.next')}>
        <Icon.Chevron />
      </button>
    </div>
  );
};

export default Tasks_Columns_Nav;
