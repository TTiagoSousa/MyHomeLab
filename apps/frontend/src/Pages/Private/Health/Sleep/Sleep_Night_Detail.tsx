import { useTranslation } from 'react-i18next';
import { useSleepNight } from '../../../../Hooks/Health/useSleepNight';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDuration, localClock, valueOrDash } from '../Shared/healthFormat';
import Sleep_Hypnogram from './Sleep_Hypnogram';
import Sleep_Stage_Bar from './Sleep_Stage_Bar';

interface Sleep_Night_Detail_Props {
  sessionId: string | null;
}

const Sleep_Night_Detail = ({ sessionId }: Sleep_Night_Detail_Props) => {
  const { t } = useTranslation('health');
  const { night, loading, error } = useSleepNight(sessionId);

  if (!sessionId) return <section className='Health_card empty'>{t('sleep.selectNight')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!night) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const minutes = (value: number | null) => (value == null ? '—' : t('units.minutes', { value }));
  const bpm = ` ${t('units.bpm')}`;
  const heartRange =
    night.minHeartRate != null && night.maxHeartRate != null ? `${night.minHeartRate}–${night.maxHeartRate}${bpm}` : '—';

  const metrics = [
    { key: 'bedtime', value: localClock(night.bedAt ?? night.asleepAt, night.timeZone) },
    { key: 'asleepAt', value: localClock(night.asleepAt, night.timeZone) },
    { key: 'wakeTime', value: localClock(night.wakeAt, night.timeZone) },
    { key: 'riseAt', value: localClock(night.riseAt, night.timeZone) },
    { key: 'latency', value: minutes(night.latencyMin) },
    { key: 'efficiency', value: valueOrDash(night.efficiency, '%') },
    { key: 'wakeCount', value: valueOrDash(night.wakeCount) },
    { key: 'heartRate', value: valueOrDash(night.avgHeartRate, bpm) },
    { key: 'heartRange', value: heartRange },
    { key: 'hrv', value: valueOrDash(night.avgHrv, ` ${t('units.ms')}`) },
    { key: 'spo2', value: valueOrDash(night.avgSpo2, '%') },
    { key: 'minSpo2', value: valueOrDash(night.minSpo2, '%') },
    { key: 'breathRate', value: valueOrDash(night.avgBreathRate, ` ${t('units.perMinute')}`) },
    { key: 'deepContinuity', value: valueOrDash(night.deepContinuity) },
  ];

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>
            {t(night.isNap ? 'sleep.napOf' : 'sleep.nightOf', { date: formatDay(night.night) })}
          </span>
          <p className='Health_card_description'>
            {localClock(night.asleepAt, night.timeZone)} → {localClock(night.wakeAt, night.timeZone)} ·{' '}
            {formatDuration(night.asleepMin)}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('sleep.stagesTitle')}</span>
        <Error_Boundary>
          <Sleep_Hypnogram stages={night.stages} timeZone={night.timeZone} />
        </Error_Boundary>
        {!night.isNap && (
          <Sleep_Stage_Bar
            showLegend
            unit='min'
            parts={[
              { stage: 'DEEP', value: night.deepMin },
              { stage: 'LIGHT', value: night.lightMin },
              { stage: 'REM', value: night.remMin },
              { stage: 'AWAKE', value: night.awakeMin },
            ]}
          />
        )}
      </div>

      {!night.isNap && (
        <div className='Health_Stats columns-7'>
          {metrics.map((metric) => (
            <Health_Stat key={metric.key} label={t(`metrics.${metric.key}`)} value={metric.value} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Sleep_Night_Detail;
