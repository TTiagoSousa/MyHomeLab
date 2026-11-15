import { useTranslation } from 'react-i18next';
import type { FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import Fasting_Form from './Fasting_Form';

interface Fasting_Log_Card_Props {
  defaultTarget: number;
  saving: boolean;
  onSave: (payload: FastPayload) => Promise<string | null>;
}

const Fasting_Log_Card = ({ defaultTarget, saving, onSave }: Fasting_Log_Card_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('fasting.log.title')}</span>
          <p className='Health_card_description'>{t('fasting.log.description')}</p>
        </div>
      </div>

      <Fasting_Form mode='log' fast={null} defaultTarget={defaultTarget} saving={saving} onSave={onSave} />
    </section>
  );
};

export default Fasting_Log_Card;
