import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { HealthMetric } from '../../../../Hooks/Health/healthTypes';
import { useHealthMetric } from '../../../../Hooks/Health/useHealthMetric';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Metric_Average_Tiles from './Metric_Average_Tiles';
import Metric_Trend_Chart from './Metric_Trend_Chart';
import Metric_Points_Panel from './Metric_Points_Panel';
import Metric_Add_Card from './Metric_Add_Card';
import { isBeforePeriod } from '../Shared/healthFormat';
import { isHealthMetric } from './metricCatalog';
import type { MetricValuePayload } from '../../../../Hooks/Health/useHealthMetric';

const Metric_Dashboard = ({ metric }: { metric: HealthMetric }) => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const { averages, points, loading, saving, error, addValue, removeValue } = useHealthMetric(metric, days);

  const handleAdd = async (payload: MetricValuePayload) => {
    const failure = await addValue(payload);
    if (!failure && isBeforePeriod(payload.measuredAt, days)) setDays(0);
    return failure;
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t(`bodyMetrics.names.${metric}`)} days={days} onDays={setDays} />

      <p className='Health_card_description'>{t(`bodyMetrics.descriptions.${metric}`)}</p>

      <Metric_Add_Card metric={metric} saving={saving} onAdd={handleAdd} />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !averages && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('bodyMetrics.emptyTitle')}</span>
          <span>{t('bodyMetrics.emptyHere')}</span>
        </div>
      )}

      {averages && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('averages.title')}</span>
              {averages.from && averages.to && (
                <p className='Health_card_description'>
                  {t('bodyMetrics.basedOn', {
                    count: averages.entries,
                    from: formatDay(averages.from, false),
                    to: formatDay(averages.to, false),
                  })}
                </p>
              )}
            </div>
          </div>
          <Metric_Average_Tiles metric={metric} averages={averages} />
        </section>
      )}

      {points.length > 1 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('bodyMetrics.trendTitle')}</span>
              <p className='Health_card_description'>{t('weight.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Metric_Trend_Chart metric={metric} points={points} average={averages?.avg ?? null} />
          </Error_Boundary>
        </section>
      )}

      {points.length > 0 && <Metric_Points_Panel metric={metric} points={points} onRemove={(id) => void removeValue(id)} />}
    </div>
  );
};

const Metric = () => {
  const { metric } = useParams();
  if (!isHealthMetric(metric)) return <Navigate to='/MyHomeLab/Health' replace />;
  return <Metric_Dashboard key={metric} metric={metric} />;
};

export default Metric;
