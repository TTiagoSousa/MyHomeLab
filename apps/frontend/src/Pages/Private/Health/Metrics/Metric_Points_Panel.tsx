import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthMetric, MetricPoint } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay, localClock } from '../Shared/healthFormat';
import { changeClass } from '../Weight/weightFormat';
import { formatField, formatFieldChange, isTapeMetric } from './metricCatalog';

interface Metric_Points_Panel_Props {
  metric: HealthMetric;
  points: MetricPoint[];
  onRemove: (id: string) => void;
}

const Metric_Points_Panel = ({ metric, points, onRemove }: Metric_Points_Panel_Props) => {
  const { t } = useTranslation('health');
  const tape = isTapeMetric(metric);
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
          <span className='Health_card_title'>{t('bodyMetrics.history', { count: points.length })}</span>
          <p className='Health_card_description'>{t(tape ? 'bodyMetrics.historyTape' : 'bodyMetrics.historyScale')}</p>
        </div>
      </div>

      <div className={`Health_Table metric${tape ? ' tape' : ''}`}>
        <Health_Table_Head
          columns={[
            { key: 'date', label: t('weight.columns.date') },
            { key: 'value', label: t('bodyMetrics.columns.value') },
            { key: 'change', label: t('weight.columns.change') },
            ...(tape ? [] : [{ key: 'device', label: t('bodyMetrics.columns.device'), optional: true }]),
            { key: 'actions', label: t('weight.columns.actions') },
          ]}
        />
        <div className='Health_Table_Body'>
          {points.map((point) => (
            <div key={point.id} className='Health_Table_Row static'>
              <span className='Health_Table_Day'>
                {tape ? formatDay(point.day) : `${formatDay(point.day)} · ${localClock(point.at, point.timeZone)}`}
              </span>
              <span className='Health_Table_Strong'>{formatField(metric, point.value)}</span>
              <span className={`Health_Change ${changeClass(point.change)}`}>{formatFieldChange(metric, point.change)}</span>
              {!tape && <span className='Health_Table_Optional'>{point.device ?? '—'}</span>}
              <span className='Health_Table_Actions'>
                <button
                  type='button'
                  className={`Health_see_all danger${confirmId === point.id ? ' confirm' : ''}`}
                  onClick={() => handleRemove(point.id)}
                  onBlur={() => setConfirmId(null)}
                >
                  {confirmId === point.id ? t('weight.confirmRemove') : t('weight.remove')}
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Metric_Points_Panel;
