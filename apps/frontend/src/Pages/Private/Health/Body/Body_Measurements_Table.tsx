import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BodyMeasurement } from '../../../../Hooks/Health/healthLogTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay } from '../Shared/healthFormat';
import { MEASUREMENT_FIELDS, changeClass, formatMeasure, formatMeasureChange, measurementChange } from './bodyFormat';

interface Body_Measurements_Table_Props {
  measurements: BodyMeasurement[];
  onRemove: (id: string) => void;
}

const Body_Measurements_Table = ({ measurements, onRemove }: Body_Measurements_Table_Props) => {
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
          <span className='Health_card_title'>{t('body.measurements.history', { count: measurements.length })}</span>
          <p className='Health_card_description'>{t('body.measurements.historyDescription')}</p>
        </div>
      </div>

      <div className='Body_Table_Scroll'>
        <div className='Health_Table body-measurements'>
          <Health_Table_Head
            columns={[
              { key: 'date', label: t('body.date') },
              ...MEASUREMENT_FIELDS.map(({ key }) => ({ key, label: t(`body.fields.${key}`) })),
              { key: 'actions', label: t('body.actions') },
            ]}
          />
          <div className='Health_Table_Body'>
            {measurements.map((row, index) => (
              <div key={row.id} className='Health_Table_Row static'>
                <span className='Health_Table_Day' title={row.notes ?? undefined}>
                  {formatDay(row.day)}
                </span>
                {MEASUREMENT_FIELDS.map(({ key, unit }) => {
                  const change = measurementChange(measurements, index, key);
                  return (
                    <span key={key} className='Body_Cell'>
                      <b>{formatMeasure(row[key], unit)}</b>
                      {change != null && <small className={`Health_Change ${changeClass(change)}`}>{formatMeasureChange(change, unit)}</small>}
                    </span>
                  );
                })}
                <span className='Health_Table_Actions'>
                  <button
                    type='button'
                    className={`Health_see_all danger${confirmId === row.id ? ' confirm' : ''}`}
                    onClick={() => handleRemove(row.id)}
                    onBlur={() => setConfirmId(null)}
                  >
                    {confirmId === row.id ? t('body.confirmRemove') : t('body.remove')}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Body_Measurements_Table;
