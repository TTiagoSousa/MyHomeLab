import { useTranslation } from 'react-i18next';
import type { SkinTemperatureRanges } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { RANGE_ORDER } from './skinFormat';

interface Skin_Range_Bar_Props {
  ranges: SkinTemperatureRanges;
  showLegend?: boolean;
}

const Skin_Range_Bar = ({ ranges, showLegend = false }: Skin_Range_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={RANGE_ORDER.map((key) => ({
        key,
        label: t(`skin.ranges.${key}`),
        value: ranges[key] ?? 0,
        className: `range-${key}`,
      }))}
    />
  );
};

export default Skin_Range_Bar;
