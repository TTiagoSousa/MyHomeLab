import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { WaterAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import { formatMl } from './waterFormat';

interface Water_Average_Tiles_Props {
  averages: WaterAverages;
}

const Water_Average_Tiles = ({ averages }: Water_Average_Tiles_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('water.metrics.average')}
          value={formatMl(averages.avgMl)}
          sub={t('water.metrics.goalSub', { count: averages.goalDays, days: averages.days })}
        />
        <Health_Stat
          label={t('water.metrics.best')}
          value={formatMl(averages.bestMl)}
          sub={averages.bestDay ? t('water.metrics.onDay', { date: formatDay(averages.bestDay, false) }) : undefined}
        />
        <Health_Stat label={t('water.metrics.total')} value={formatMl(averages.totalMl)} />
        <Health_Stat
          label={t('water.metrics.days')}
          value={String(averages.days)}
          sub={`${t('water.metrics.goal')}: ${formatMl(averages.goalMl)}`}
        />
      </div>
    </div>
  );
};

export default Water_Average_Tiles;
