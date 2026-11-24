import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeightEntry } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay, localClock } from '../Shared/healthFormat';
import { changeClass, formatKg, formatKgChange } from './weightFormat';
import { COMPOSITION_METRICS } from '../Metrics/metricCatalog';

interface Weight_Entries_Panel_Props {
  entries: WeightEntry[];
  onRemove: (id: string) => void;
}

const compositionCount = (entry: WeightEntry) => COMPOSITION_METRICS.filter((field) => entry[field] != null).length;

const Weight_Entries_Panel = ({ entries, onRemove }: Weight_Entries_Panel_Props) => {
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
          <span className='Health_card_title'>{t('weight.entries', { count: entries.length })}</span>
          <p className='Health_card_description'>{t('weight.entriesDescription')}</p>
        </div>
      </div>

      <div className='Health_Table weight'>
        <Health_Table_Head
          columns={[
            { key: 'date', label: t('weight.columns.date') },
            { key: 'weight', label: t('weight.columns.weight') },
            { key: 'change', label: t('weight.columns.change') },
            { key: 'device', label: t('bodyMetrics.columns.device'), optional: true },
            { key: 'composition', label: t('weight.columns.composition'), optional: true },
            { key: 'actions', label: t('weight.columns.actions') },
          ]}
        />
        <div className='Health_Table_Body'>
          {entries.map((entry) => (
            <div key={entry.id} className='Health_Table_Row static'>
              <span className='Health_Table_Day'>
                {formatDay(entry.day)} · {localClock(entry.measuredAt, entry.timeZone)}
              </span>
              <span className='Health_Table_Strong'>{formatKg(entry.weightKg)}</span>
              <span className={`Health_Change ${changeClass(entry.changeKg)}`}>{formatKgChange(entry.changeKg)}</span>
              <span className='Health_Table_Optional'>{entry.device ?? '—'}</span>
              <span className='Health_Table_Optional'>{compositionCount(entry) ? t('weight.compositionCount', { count: compositionCount(entry) }) : '—'}</span>
              <span className='Health_Table_Actions'>
                <button
                  type='button'
                  className={`Health_see_all danger${confirmId === entry.id ? ' confirm' : ''}`}
                  onClick={() => handleRemove(entry.id)}
                  onBlur={() => setConfirmId(null)}
                >
                  {confirmId === entry.id ? t('weight.confirmRemove') : t('weight.remove')}
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Weight_Entries_Panel;
