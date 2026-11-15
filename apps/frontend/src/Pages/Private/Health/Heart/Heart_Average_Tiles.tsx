import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { HeartAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Heart_Zone_Bar from './Heart_Zone_Bar';
import { elevatedShare, zonesTotal } from './heartFormat';

interface Heart_Average_Tiles_Props {
  averages: HeartAverages;
  detailed?: boolean;
}

const Heart_Average_Tiles = ({ averages, detailed = false }: Heart_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const bpm = ` ${t('units.bpm')}`;
  const onDay = (day: string | null) => (day ? t('heart.metrics.onDay', { date: formatDay(day, false) }) : undefined);

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('heart.metrics.resting')}
          value={valueOrDash(averages.restingBpm, bpm)}
          sub={
            averages.restingMin != null && averages.restingMax != null
              ? t('heart.metrics.restingSub', { min: averages.restingMin, max: averages.restingMax })
              : undefined
          }
        />
        <Health_Stat label={t('heart.metrics.average')} value={valueOrDash(averages.avgBpm, bpm)} />
        <Health_Stat label={t('heart.metrics.min')} value={valueOrDash(averages.minBpm, bpm)} sub={onDay(averages.minDay)} />
        <Health_Stat label={t('heart.metrics.max')} value={valueOrDash(averages.maxBpm, bpm)} sub={onDay(averages.maxDay)} />
      </div>

      {zonesTotal(averages.zones) > 0 && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('heart.metrics.zonesTitle')}</span>
          <Heart_Zone_Bar zones={averages.zones} showLegend />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat label={t('heart.metrics.hrv')} value={valueOrDash(averages.avgHrv, ` ${t('units.ms')}`)} />
          <Health_Stat label={t('heart.metrics.days')} value={String(averages.days)} />
          <Health_Stat label={t('heart.metrics.samplesPerDay')} value={valueOrDash(averages.samplesPerDay)} />
          <Health_Stat label={t('heart.metrics.above100')} value={valueOrDash(elevatedShare(averages.zones), '%')} />
        </div>
      )}
    </div>
  );
};

export default Heart_Average_Tiles;
