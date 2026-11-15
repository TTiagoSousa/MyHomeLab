import { useTranslation } from 'react-i18next';
import type { HeartZoneSeconds } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { EFFORT_ORDER, formatSeconds } from './exerciseFormat';

interface Exercise_Effort_Bar_Props {
  zones: HeartZoneSeconds | null;
  showLegend?: boolean;
}

const Exercise_Effort_Bar = ({ zones, showLegend = false }: Exercise_Effort_Bar_Props) => {
  const { t } = useTranslation('health');
  if (!zones) return null;

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={EFFORT_ORDER.map((key) => ({
        key,
        label: t(`exercise.effort.${key}`),
        value: zones[key] ?? 0,
        className: `effort-${key}`,
        display: formatSeconds(zones[key] ?? 0),
      }))}
    />
  );
};

export default Exercise_Effort_Bar;
