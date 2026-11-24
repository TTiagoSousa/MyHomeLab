import { useTranslation } from 'react-i18next';
import type { HealthMetric, MetricAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import { FIELD_INFO, formatField, formatFieldChange } from './metricCatalog';

interface Metric_Average_Tiles_Props {
  metric: HealthMetric;
  averages: MetricAverages;
}

const Metric_Average_Tiles = ({ metric, averages }: Metric_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const onDay = (day: string | null) => (day ? t('weight.metrics.onDay', { date: formatDay(day, false) }) : undefined);
  const range =
    averages.min == null
      ? '—'
      : `${averages.min.toFixed(FIELD_INFO[metric].decimals)} – ${formatField(metric, averages.max)}`;

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('bodyMetrics.latest')} value={formatField(metric, averages.latest)} sub={onDay(averages.latestDay)} />
        <Health_Stat
          label={t('weight.metrics.change')}
          value={formatFieldChange(metric, averages.change)}
          sub={averages.from ? t('weight.metrics.changeSub', { date: formatDay(averages.from, false) }) : undefined}
        />
        <Health_Stat label={t('weight.metrics.average')} value={formatField(metric, averages.avg)} />
        <Health_Stat label={t('weight.metrics.range')} value={range} />
      </div>
    </div>
  );
};

export default Metric_Average_Tiles;
