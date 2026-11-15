import { useTranslation } from 'react-i18next';
import type { HeartZones } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { ZONE_ORDER } from './heartFormat';

interface Heart_Zone_Bar_Props {
  zones: HeartZones;
  showLegend?: boolean;
}

const Heart_Zone_Bar = ({ zones, showLegend = false }: Heart_Zone_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={ZONE_ORDER.map((key) => ({
        key,
        label: t(`zones.${key}`),
        value: zones[key] ?? 0,
        className: `zone-${key}`,
      }))}
    />
  );
};

export default Heart_Zone_Bar;
