import { useTranslation } from 'react-i18next';
import type { BloodOxygenRanges } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { RANGE_ORDER } from './oxygenFormat';

interface Oxygen_Range_Bar_Props {
  ranges: BloodOxygenRanges;
  showLegend?: boolean;
}

const Oxygen_Range_Bar = ({ ranges, showLegend = false }: Oxygen_Range_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={RANGE_ORDER.map((key) => ({
        key,
        label: t(`oxygen.ranges.${key}`),
        value: ranges[key] ?? 0,
        className: `spo2-${key}`,
      }))}
    />
  );
};

export default Oxygen_Range_Bar;
