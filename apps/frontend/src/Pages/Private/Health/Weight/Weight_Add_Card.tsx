import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { WeightPayload } from '../../../../Hooks/Health/useWeight';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';

interface Weight_Add_Card_Props {
  saving: boolean;
  onAdd: (payload: WeightPayload) => Promise<string | null>;
}

const Weight_Add_Card = ({ saving, onAdd }: Weight_Add_Card_Props) => {
  const { t } = useTranslation('health');
  const now = new Date();
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [error, setError] = useState('');

  const weightKg = Number(kg.replace(',', '.'));
  const measuredAt = new Date(`${date}T${time}`);
  const canSave =
    !saving && kg.trim() !== '' && Number.isFinite(weightKg) && weightKg >= 20 && weightKg <= 400 && !Number.isNaN(measuredAt.getTime());

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onAdd({
      weightKg: Math.round(weightKg * 100) / 100,
      measuredAt: measuredAt.toISOString(),
      timeZone: browserTimeZone(measuredAt),
    });
    if (failure) setError(failure);
    else {
      setKg('');
      setError('');
    }
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('weight.addTitle')}</span>
          <p className='Health_card_description'>{t('weight.addDescription')}</p>
        </div>
      </div>

      <div className='Health_Form'>
        <div className='Health_Form_Field'>
          <label htmlFor='weight-kg'>{t('weight.kg')}</label>
          <Global_Input
            id='weight-kg'
            value={kg}
            placeholder='72.5'
            onChange={(e) => {
              setKg(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='weight-date'>{t('weight.date')}</label>
          <Global_Input id='weight-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='weight-time'>{t('weight.time')}</label>
          <Global_Input id='weight-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('weight.saving') : t('weight.save')}
        </button>
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Weight_Add_Card;
