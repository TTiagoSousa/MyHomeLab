import { useTranslation } from 'react-i18next';
import '../Health/Shared/Health_Dashboard.scss';
import '../Health/Intakes/Intakes.scss';
import { useIntakes } from '../../../Hooks/Health/useIntakes';
import Intakes_Quick_Card from '../Health/Intakes/Intakes_Quick_Card';

interface Today_Intakes_Modal_Props {
  onClose: () => void;
}

const Today_Intakes_Modal = ({ onClose }: Today_Intakes_Modal_Props) => {
  const { t } = useTranslation('tasks');
  const { data, saving, error, saveEntry } = useIntakes(1);

  return (
    <div className='Today_Modal_Overlay' onClick={onClose}>
      <div className='Today_Modal wide' role='dialog' aria-modal='true' aria-label={t('today.shortcuts.kinds.INTAKES')} onClick={(e) => e.stopPropagation()}>
        <div className='Health_Dashboard Today_Intakes'>
          {error && <div className='Health_empty'>{error}</div>}
          {data && <Intakes_Quick_Card data={data} saving={saving} onSave={saveEntry} />}
        </div>

        <div className='Today_Modal_Actions'>
          <button type='button' className='Today_Ghost_Button' onClick={onClose}>
            {t('common:actions.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Today_Intakes_Modal;
