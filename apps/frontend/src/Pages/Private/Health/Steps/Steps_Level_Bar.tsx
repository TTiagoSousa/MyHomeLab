import { useTranslation } from 'react-i18next';
import type { StepsLevels } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { LEVEL_ORDER } from './stepsFormat';

interface Steps_Level_Bar_Props {
  levels: StepsLevels;
}

const Steps_Level_Bar = ({ levels }: Steps_Level_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend
      parts={LEVEL_ORDER.map((key) => ({
        key,
        label: t(`steps.levels.${key}`),
        value: levels[key] ?? 0,
        className: `steps-${key}`,
        display: t('steps.metrics.daysCount', { count: levels[key] ?? 0 }),
      }))}
    />
  );
};

export default Steps_Level_Bar;
