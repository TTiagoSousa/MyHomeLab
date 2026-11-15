import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { BloodOxygenAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Oxygen_Range_Bar from './Oxygen_Range_Bar';
import { belowNormalShare, formatSpo2, rangesTotal } from './oxygenFormat';

interface Oxygen_Average_Tiles_Props {
  averages: BloodOxygenAverages;
  detailed?: boolean;
}

const Oxygen_Average_Tiles = ({ averages, detailed = false }: Oxygen_Average_Tiles_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('oxygen.metrics.average')} value={formatSpo2(averages.avgSpo2, 1)} />
        <Health_Stat
          label={t('oxygen.metrics.night')}
          value={formatSpo2(averages.nightAvg, 1)}
          sub={t('oxygen.metrics.nightSub')}
        />
        <Health_Stat
          label={t('oxygen.metrics.min')}
          value={formatSpo2(averages.minSpo2)}
          sub={averages.minDay ? t('oxygen.metrics.onDay', { date: formatDay(averages.minDay, false) }) : undefined}
        />
        <Health_Stat
          label={t('oxygen.metrics.below')}
          value={valueOrDash(belowNormalShare(averages.ranges), '%')}
          sub={t('oxygen.metrics.belowSub')}
        />
      </div>

      {rangesTotal(averages.ranges) > 0 && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('oxygen.metrics.rangesTitle')}</span>
          <Oxygen_Range_Bar ranges={averages.ranges} showLegend />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat label={t('oxygen.metrics.max')} value={formatSpo2(averages.maxSpo2)} />
          <Health_Stat label={t('oxygen.metrics.days')} value={String(averages.days)} />
          <Health_Stat label={t('oxygen.metrics.samplesPerDay')} value={valueOrDash(averages.samplesPerDay)} />
          <Health_Stat
            label={t('oxygen.metrics.lowReadings')}
            value={String(averages.ranges.low)}
            sub={t('oxygen.metrics.lowReadingsSub')}
          />
        </div>
      )}
    </div>
  );
};

export default Oxygen_Average_Tiles;
