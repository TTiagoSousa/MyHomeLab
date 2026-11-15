import { useTranslation } from 'react-i18next';
import { useHeartDay } from '../../../../Hooks/Health/useHeartDay';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, minuteClock, percentOf, valueOrDash } from '../Shared/healthFormat';
import Heart_Day_Chart from './Heart_Day_Chart';
import Heart_Zone_Bar from './Heart_Zone_Bar';
import { ZONE_ORDER, zonesTotal } from './heartFormat';

interface Heart_Day_Detail_Props {
  dayId: string | null;
}

const Heart_Day_Detail = ({ dayId }: Heart_Day_Detail_Props) => {
  const { t } = useTranslation('health');
  const { heartDay, loading, error } = useHeartDay(dayId);

  if (!dayId) return <section className='Health_card empty'>{t('heart.selectDay')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!heartDay) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const bpm = ` ${t('units.bpm')}`;
  const total = zonesTotal(heartDay.zones);

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('heart.dayOf', { date: formatDay(heartDay.day) })}</span>
          <p className='Health_card_description'>
            {t('heart.dayDescription', { average: heartDay.avgBpm, count: heartDay.samples })}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('heart.chartTitle')}</span>
        <Error_Boundary>
          <Heart_Day_Chart heartDay={heartDay} />
        </Error_Boundary>
        <div className='Health_Chart_Legend'>
          <span>
            <i className='line heart' />
            {t('heart.series.heartRate')}
          </span>
          {heartDay.restingBpm != null && (
            <span>
              <i className='line resting' />
              {t('heart.series.resting')}
            </span>
          )}
          {heartDay.hrvPoints?.length ? (
            <span>
              <i className='dot hrv' />
              {t('heart.series.hrvAxis')}
            </span>
          ) : null}
        </div>
        <Heart_Zone_Bar zones={heartDay.zones} showLegend />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat highlight label={t('heart.metrics.resting')} value={valueOrDash(heartDay.restingBpm, bpm)} />
        <Health_Stat label={t('heart.metrics.average')} value={`${heartDay.avgBpm}${bpm}`} />
        <Health_Stat
          label={t('heart.metrics.min')}
          value={`${heartDay.minBpm}${bpm}`}
          sub={t('heart.metrics.at', { time: minuteClock(heartDay.minAt) })}
        />
        <Health_Stat
          label={t('heart.metrics.max')}
          value={`${heartDay.maxBpm}${bpm}`}
          sub={t('heart.metrics.at', { time: minuteClock(heartDay.maxAt) })}
        />
        <Health_Stat label={t('heart.metrics.hrv')} value={valueOrDash(heartDay.avgHrv, ` ${t('units.ms')}`)} />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat label={t('heart.metrics.samples')} value={String(heartDay.samples)} />
        {ZONE_ORDER.map((key) => (
          <Health_Stat
            key={key}
            label={t(`zones.${key}`)}
            value={`${percentOf(heartDay.zones[key] ?? 0, total)}%`}
            sub={t('heart.metrics.readings', { count: heartDay.zones[key] ?? 0 })}
          />
        ))}
      </div>
    </section>
  );
};

export default Heart_Day_Detail;
