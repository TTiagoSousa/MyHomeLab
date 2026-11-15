import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Fast, FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import Fasting_Form from './Fasting_Form';
import Fasting_Timer from './Fasting_Timer';
import { finishPayload } from './fastingFormat';

interface Fasting_Now_Card_Props {
  open: Fast | null;
  defaultTarget: number;
  saving: boolean;
  onSave: (payload: FastPayload, id?: string) => Promise<string | null>;
}

const Fasting_Now_Card = ({ open, defaultTarget, saving, onSave }: Fasting_Now_Card_Props) => {
  const { t } = useTranslation('health');
  const [finishError, setFinishError] = useState('');

  const handleFinish = async (fast: Fast) => {
    const failure = await onSave(finishPayload(fast), fast.id);
    setFinishError(failure ?? '');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{open ? t('fasting.now.openTitle') : t('fasting.now.title')}</span>
          <p className='Health_card_description'>{open ? t('fasting.now.openDescription') : t('fasting.now.description')}</p>
        </div>
      </div>

      {open ? (
        <Fasting_Timer fast={open} saving={saving} onFinish={() => void handleFinish(open)} />
      ) : (
        <Fasting_Form mode='start' fast={null} defaultTarget={defaultTarget} saving={saving} onSave={(payload) => onSave(payload)} />
      )}

      {open && finishError && <p className='Health_Form_Error'>{finishError}</p>}
    </section>
  );
};

export default Fasting_Now_Card;
