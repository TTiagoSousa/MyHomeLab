import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { SleepAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDuration, valueOrDash } from '../Shared/healthFormat';
import Sleep_Stage_Bar from './Sleep_Stage_Bar';

interface Sleep_Average_Tiles_Props {
  averages: SleepAverages;
  detailed?: boolean;
}

const Sleep_Average_Tiles = ({ averages, detailed = false }: Sleep_Average_Tiles_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('metrics.duration')}
          value={formatDuration(averages.asleepMin)}
          sub={averages.awakeMin == null ? undefined : t('averages.awakeSub', { value: averages.awakeMin })}
        />
        <Health_Stat
          label={t('metrics.fallAsleep')}
          value={averages.bedtime ?? '—'}
          sub={averages.latencyMin == null ? undefined : t('averages.latencySub', { value: averages.latencyMin })}
        />
        <Health_Stat label={t('metrics.wakeTime')} value={averages.wakeTime ?? '—'} />
        <Health_Stat label={t('metrics.efficiency')} value={valueOrDash(averages.efficiency, '%')} />
      </div>

      {averages.deepPct != null && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('sleep.stagesTitle')}</span>
          <Sleep_Stage_Bar
            showLegend
            parts={[
              { stage: 'DEEP', value: averages.deepPct },
              { stage: 'LIGHT', value: averages.lightPct ?? 0 },
              { stage: 'REM', value: averages.remPct ?? 0 },
            ]}
          />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-5'>
          <Health_Stat label={t('metrics.heartRate')} value={valueOrDash(averages.avgHeartRate, ` ${t('units.bpm')}`)} />
          <Health_Stat label={t('metrics.hrv')} value={valueOrDash(averages.avgHrv, ` ${t('units.ms')}`)} />
          <Health_Stat label={t('metrics.spo2')} value={valueOrDash(averages.avgSpo2, '%')} />
          <Health_Stat
            label={t('metrics.breathRate')}
            value={valueOrDash(averages.avgBreathRate, ` ${t('units.perMinute')}`)}
          />
          <Health_Stat
            label={t('metrics.naps')}
            value={String(averages.naps.count)}
            sub={averages.naps.count ? t('averages.napsSub', { duration: formatDuration(averages.naps.avgMin) }) : undefined}
          />
        </div>
      )}
    </div>
  );
};

export default Sleep_Average_Tiles;
