import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HealthMetric } from '../../../../Hooks/Health/healthTypes';
import { metricPath } from './metricCatalog';

interface Metric_Links_Props {
  title: string;
  metrics: HealthMetric[];
}

const Metric_Links = ({ title, metrics }: Metric_Links_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{title}</span>
          <p className='Health_card_description'>{t('bodyMetrics.linksHint')}</p>
        </div>
      </div>
      <div className='Metric_Links'>
        {metrics.map((metric) => (
          <button key={metric} type='button' className='Metric_Link' onClick={() => navigate(metricPath(metric))}>
            {t(`bodyMetrics.names.${metric}`)} →
          </button>
        ))}
      </div>
    </section>
  );
};

export default Metric_Links;
