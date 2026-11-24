import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VitalKind, VitalReading } from '../../../../Hooks/Health/healthLogTypes';
import { formatDay, localClock } from '../Shared/healthFormat';
import { formatVital, levelTone, vitalLevel } from './bodyFormat';

interface Body_Vitals_List_Props {
  kind: VitalKind;
  readings: VitalReading[];
  onRemove: (id: string) => void;
}

const Body_Vitals_List = ({ kind, readings, onRemove }: Body_Vitals_List_Props) => {
  const { t } = useTranslation('health');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    onRemove(id);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.vitals.history', { count: readings.length })}</span>
          <p className='Health_card_description'>{t(`body.vitals.kinds.${kind}`)}</p>
        </div>
      </div>

      <div className='Body_Vitals'>
        {readings.map((reading) => {
          const level = vitalLevel(reading);
          return (
            <div key={reading.id} className='Body_Vital'>
              <div className='Body_Vital_Main'>
                <span className='Body_Vital_When'>
                  {formatDay(reading.day)} · {localClock(reading.at, reading.timeZone)}
                </span>
                <span className='Body_Vital_Value'>{formatVital(reading)}</span>
                {reading.pulse != null && <span className='Body_Vital_Extra'>{t('body.vitals.pulseValue', { value: reading.pulse })}</span>}
                {reading.context && <span className='Body_Vital_Extra'>{t(`body.vitals.contexts.${reading.context}`)}</span>}
                {reading.device && <span className='Body_Vital_Extra'>{reading.device}</span>}
                <span className={`Body_Level ${levelTone(level)}`}>{t(`body.vitals.levels.${level}`)}</span>
              </div>
              {reading.notes && <p className='Body_Vital_Notes'>{reading.notes}</p>}
              <button
                type='button'
                className={`Health_see_all danger${confirmId === reading.id ? ' confirm' : ''}`}
                onClick={() => handleRemove(reading.id)}
                onBlur={() => setConfirmId(null)}
              >
                {confirmId === reading.id ? t('body.confirmRemove') : t('body.remove')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Body_Vitals_List;
