import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { SkinTemperatureAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Skin_Range_Bar from './Skin_Range_Bar';
import { coldShare, formatTemp, rangesTotal } from './skinFormat';

interface Skin_Average_Tiles_Props {
  averages: SkinTemperatureAverages;
  detailed?: boolean;
}

const Skin_Average_Tiles = ({ averages, detailed = false }: Skin_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const onDay = (day: string | null) => (day ? t('skin.metrics.onDay', { date: formatDay(day, false) }) : undefined);

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('skin.metrics.night')}
          value={formatTemp(averages.nightAvg)}
          sub={t('skin.metrics.nightSub')}
        />
        <Health_Stat label={t('skin.metrics.average')} value={formatTemp(averages.avgTemp)} />
        <Health_Stat label={t('skin.metrics.min')} value={formatTemp(averages.minTemp)} sub={onDay(averages.minDay)} />
        <Health_Stat label={t('skin.metrics.max')} value={formatTemp(averages.maxTemp)} sub={onDay(averages.maxDay)} />
      </div>

      {rangesTotal(averages.ranges) > 0 && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('skin.metrics.rangesTitle')}</span>
          <Skin_Range_Bar ranges={averages.ranges} showLegend />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat
            label={t('skin.metrics.spread')}
            value={averages.avgSpread == null ? '—' : `${averages.avgSpread.toFixed(1)} °C`}
          />
          <Health_Stat label={t('skin.metrics.days')} value={String(averages.days)} />
          <Health_Stat label={t('skin.metrics.samplesPerDay')} value={valueOrDash(averages.samplesPerDay)} />
          <Health_Stat
            label={t('skin.metrics.cold')}
            value={valueOrDash(coldShare(averages.ranges), '%')}
            sub={t('skin.metrics.coldSub')}
          />
        </div>
      )}
    </div>
  );
};

export default Skin_Average_Tiles;
