import { useTranslation } from 'react-i18next';
import type { StressLevels } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { LEVEL_ORDER } from './stressFormat';

interface Stress_Level_Bar_Props {
  levels: StressLevels;
  showLegend?: boolean;
}

const Stress_Level_Bar = ({ levels, showLegend = false }: Stress_Level_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={LEVEL_ORDER.map((key) => ({
        key,
        label: t(`stress.levels.${key}`),
        value: levels[key] ?? 0,
        className: `stress-${key}`,
      }))}
    />
  );
};

export default Stress_Level_Bar;
