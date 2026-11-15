import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { StressAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Stress_Level_Bar from './Stress_Level_Bar';
import { formatScore, levelOf, levelShare, levelsTotal } from './stressFormat';

interface Stress_Average_Tiles_Props {
  averages: StressAverages;
  detailed?: boolean;
}

const Stress_Average_Tiles = ({ averages, detailed = false }: Stress_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const onDay = (day: string | null) => (day ? t('stress.metrics.onDay', { date: formatDay(day, false) }) : undefined);

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('stress.metrics.average')}
          value={formatScore(averages.avgScore)}
          sub={averages.avgScore == null ? undefined : t(`stress.levels.${levelOf(averages.avgScore)}`)}
        />
        <Health_Stat label={t('stress.metrics.max')} value={formatScore(averages.maxScore)} sub={onDay(averages.maxDay)} />
        <Health_Stat
          label={t('stress.metrics.calmest')}
          value={formatScore(averages.calmestAvg)}
          sub={onDay(averages.calmestDay)}
        />
        <Health_Stat
          label={t('stress.metrics.stressed')}
          value={valueOrDash(levelShare(averages.levels, ['medium', 'high']), '%')}
          sub={t('stress.metrics.stressedSub')}
        />
      </div>

      {levelsTotal(averages.levels) > 0 && (
        <div className='Health_Box'>
          <span className='Health_Section_Label'>{t('stress.metrics.levelsTitle')}</span>
          <Stress_Level_Bar levels={averages.levels} showLegend />
        </div>
      )}

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat
            label={t('stress.metrics.relaxed')}
            value={valueOrDash(levelShare(averages.levels, ['relaxed']), '%')}
            sub={t('stress.metrics.relaxedSub')}
          />
          <Health_Stat label={t('stress.metrics.min')} value={formatScore(averages.minScore)} />
          <Health_Stat label={t('stress.metrics.days')} value={String(averages.days)} />
          <Health_Stat label={t('stress.metrics.samplesPerDay')} value={valueOrDash(averages.samplesPerDay)} />
        </div>
      )}
    </div>
  );
};

export default Stress_Average_Tiles;
