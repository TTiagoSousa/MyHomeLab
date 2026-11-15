import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { StepsAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDistance, formatDuration, formatSteps, valueOrDash } from '../Shared/healthFormat';
import Steps_Level_Bar from './Steps_Level_Bar';

interface Steps_Average_Tiles_Props {
  averages: StepsAverages;
  detailed?: boolean;
}

const Steps_Average_Tiles = ({ averages, detailed = false }: Steps_Average_Tiles_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('steps.metrics.steps')}
          value={formatSteps(averages.steps)}
          sub={t('steps.metrics.goalSub', { count: averages.goalDays, days: averages.days })}
        />
        <Health_Stat label={t('steps.metrics.distance')} value={formatDistance(averages.distanceM)} />
        <Health_Stat label={t('steps.metrics.calories')} value={valueOrDash(averages.calories, ' kcal')} />
        <Health_Stat label={t('steps.metrics.activeMinutes')} value={formatDuration(averages.activeMinutes)} />
      </div>

      {averages.days > 0 && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('steps.metrics.levelsTitle')}</span>
          <Steps_Level_Bar levels={averages.levels} />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat
            label={t('steps.metrics.bestDay')}
            value={formatSteps(averages.bestSteps)}
            sub={averages.bestDay ? t('steps.metrics.onDay', { date: formatDay(averages.bestDay, false) }) : undefined}
          />
          <Health_Stat label={t('steps.metrics.goalDays')} value={String(averages.goalDays)} sub={t('steps.metrics.goalDaysSub')} />
          <Health_Stat label={t('steps.metrics.totalSteps')} value={formatSteps(averages.totalSteps)} />
          <Health_Stat label={t('steps.metrics.totalDistance')} value={formatDistance(averages.totalDistanceM)} />
        </div>
      )}
    </div>
  );
};

export default Steps_Average_Tiles;
