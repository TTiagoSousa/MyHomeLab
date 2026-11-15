import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import type { Fast } from '../../../../Hooks/Health/healthLogTypes';
import Health_Stat from '../Shared/Health_Stat';
import { changeOf, formatChange } from '../Wellbeing/wellbeingFormat';
import Fasting_Chart from './Fasting_Chart';
import { fastStats, formatHours } from './fastingFormat';

interface Fasting_Stats_Card_Props {
  fasts: Fast[];
  previous: Fast[];
  days: number;
}

const Fasting_Stats_Card = ({ fasts, previous, days }: Fasting_Stats_Card_Props) => {
  const { t } = useTranslation('health');
  const stats = fastStats(fasts);
  const averageChange = changeOf(stats.averageHours, fastStats(previous).averageHours);

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('fasting.stats.title')}</span>
          <p className='Health_card_description'>{t('fasting.stats.description', { period: t(`periods.${days}`) })}</p>
        </div>
      </div>

      {!stats.count ? (
        <span className='Health_chart_empty'>{t('fasting.stats.empty')}</span>
      ) : (
        <>
          <div className='Health_Stats columns-4'>
            <Health_Stat
              highlight
              label={t('fasting.stats.average')}
              value={formatHours(stats.averageHours)}
              sub={averageChange == null ? undefined : t('wellbeing.vsPrevious', { value: `${formatChange(averageChange)} h` })}
            />
            <Health_Stat label={t('fasting.stats.longest')} value={formatHours(stats.longest)} />
            <Health_Stat
              label={t('fasting.stats.success')}
              value={stats.successRate == null ? '—' : `${stats.successRate}%`}
              sub={t('fasting.stats.successSub', { done: stats.reached, total: stats.count })}
            />
            <Health_Stat label={t('fasting.stats.count')} value={String(stats.count)} />
          </div>
          <Error_Boundary>
            <Fasting_Chart fasts={fasts} />
          </Error_Boundary>
        </>
      )}
    </section>
  );
};

export default Fasting_Stats_Card;
