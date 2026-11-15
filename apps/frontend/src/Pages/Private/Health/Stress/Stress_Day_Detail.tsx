import { useTranslation } from 'react-i18next';
import { useStressDay } from '../../../../Hooks/Health/useStressDay';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Day_Chart from '../Shared/Health_Day_Chart';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, minuteClock, percentOf } from '../Shared/healthFormat';
import Stress_Level_Bar from './Stress_Level_Bar';
import { LEVEL_ORDER, STRESS_COLORS, formatScore, levelOf, levelsTotal } from './stressFormat';

interface Stress_Day_Detail_Props {
  dayId: string | null;
}

const Stress_Day_Detail = ({ dayId }: Stress_Day_Detail_Props) => {
  const { t } = useTranslation('health');
  const { stressDay, loading, error } = useStressDay(dayId);

  if (!dayId) return <section className='Health_card empty'>{t('stress.selectDay')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!stressDay) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const total = levelsTotal(stressDay.levels);

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('stress.dayOf', { date: formatDay(stressDay.day) })}</span>
          <p className='Health_card_description'>
            {t('stress.dayDescription', { average: formatScore(stressDay.avgScore), count: stressDay.samples })}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('stress.chartTitle')}</span>
        {stressDay.points.length ? (
          <Error_Boundary>
            <Health_Day_Chart
              name={t('stress.series.score')}
              points={stressDay.points}
              color={STRESS_COLORS.line}
              areaColor={STRESS_COLORS.area}
              format={(value) => `${value} · ${t(`stress.levels.${levelOf(value)}`)}`}
              yMin={0}
              gapMinutes={240}
              showPoints
            />
          </Error_Boundary>
        ) : (
          <span className='Health_chart_empty'>{t('stress.noPoints')}</span>
        )}
        <Stress_Level_Bar levels={stressDay.levels} showLegend />
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('stress.metrics.average')}
          value={formatScore(stressDay.avgScore)}
          sub={t(`stress.levels.${levelOf(stressDay.avgScore)}`)}
        />
        <Health_Stat
          label={t('stress.metrics.min')}
          value={String(stressDay.minScore)}
          sub={t('stress.metrics.at', { time: minuteClock(stressDay.minAt) })}
        />
        <Health_Stat
          label={t('stress.metrics.max')}
          value={String(stressDay.maxScore)}
          sub={t('stress.metrics.at', { time: minuteClock(stressDay.maxAt) })}
        />
        <Health_Stat label={t('stress.metrics.samples')} value={String(stressDay.samples)} />
      </div>

      <div className='Health_Stats columns-4'>
        {LEVEL_ORDER.map((key) => (
          <Health_Stat
            key={key}
            label={t(`stress.levels.${key}`)}
            value={`${percentOf(stressDay.levels[key] ?? 0, total)}%`}
            sub={t('stress.metrics.readings', { count: stressDay.levels[key] ?? 0 })}
          />
        ))}
      </div>
    </section>
  );
};

export default Stress_Day_Detail;
