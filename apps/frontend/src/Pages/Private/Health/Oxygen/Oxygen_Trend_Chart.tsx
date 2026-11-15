import { useTranslation } from 'react-i18next';
import type { BloodOxygenDay } from '../../../../Hooks/Health/healthTypes';
import Health_Range_Chart from '../Shared/Health_Range_Chart';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { OXYGEN_COLORS, formatSpo2, oxygenYMin } from './oxygenFormat';

interface Oxygen_Trend_Chart_Props {
  oxygenDays: BloodOxygenDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Oxygen_Trend_Chart = ({ oxygenDays, selectedId, onSelect }: Oxygen_Trend_Chart_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Range_Chart
      items={oxygenDays.slice().reverse()}
      labelOf={(day) => formatDay(day.day, false)}
      minOf={(day) => day.minSpo2}
      maxOf={(day) => day.maxSpo2}
      rangeName={t('oxygen.series.range')}
      rangeColor={OXYGEN_COLORS.range}
      selectedColor={OXYGEN_COLORS.line}
      yMin={oxygenYMin}
      axisLabel={(value) => `${value}%`}
      lines={[
        { name: t('oxygen.series.average'), color: OXYGEN_COLORS.line, valueOf: (day) => day.avgSpo2 },
        { name: t('oxygen.series.night'), color: OXYGEN_COLORS.night, valueOf: (day) => day.nightAvg, dashed: true },
      ]}
      tooltip={(day) =>
        [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(OXYGEN_COLORS.line)}${t('oxygen.series.average')}: <b>${formatSpo2(day.avgSpo2, 1)}</b>`,
          `${colorDot(OXYGEN_COLORS.night)}${t('oxygen.series.night')}: <b>${formatSpo2(day.nightAvg, 1)}</b>`,
          `${colorDot(OXYGEN_COLORS.range)}${t('oxygen.series.range')}: <b>${formatSpo2(day.minSpo2)} – ${formatSpo2(day.maxSpo2)}</b>`,
          t('oxygen.series.samples', { count: day.samples }),
        ].join('<br/>')
      }
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
};

export default Oxygen_Trend_Chart;
