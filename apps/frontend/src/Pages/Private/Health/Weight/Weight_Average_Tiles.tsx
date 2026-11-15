import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { WeightAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import { formatKg, formatKgChange } from './weightFormat';

interface Weight_Average_Tiles_Props {
  averages: WeightAverages;
}

const Weight_Average_Tiles = ({ averages }: Weight_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const onDay = (day: string | null) => (day ? t('weight.metrics.onDay', { date: formatDay(day, false) }) : undefined);

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('weight.metrics.latest')} value={formatKg(averages.latestKg)} sub={onDay(averages.latestDay)} />
        <Health_Stat
          label={t('weight.metrics.change')}
          value={formatKgChange(averages.changeKg)}
          sub={averages.from ? t('weight.metrics.changeSub', { date: formatDay(averages.from, false) }) : undefined}
        />
        <Health_Stat label={t('weight.metrics.average')} value={formatKg(averages.avgKg)} />
        <Health_Stat
          label={t('weight.metrics.range')}
          value={averages.minKg == null ? '—' : `${averages.minKg.toFixed(1)} – ${formatKg(averages.maxKg)}`}
        />
      </div>
    </div>
  );
};

export default Weight_Average_Tiles;
