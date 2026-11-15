import { useTranslation } from 'react-i18next';
import type { SkinTemperatureDay } from '../../../../Hooks/Health/healthTypes';
import Health_Range_Chart from '../Shared/Health_Range_Chart';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { SKIN_COLORS, formatTemp, temperatureYMin } from './skinFormat';

interface Skin_Trend_Chart_Props {
  temperatureDays: SkinTemperatureDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Skin_Trend_Chart = ({ temperatureDays, selectedId, onSelect }: Skin_Trend_Chart_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Range_Chart
      items={temperatureDays.slice().reverse()}
      labelOf={(day) => formatDay(day.day, false)}
      minOf={(day) => day.minTemp}
      maxOf={(day) => day.maxTemp}
      rangeName={t('skin.series.range')}
      rangeColor={SKIN_COLORS.range}
      selectedColor={SKIN_COLORS.line}
      yMin={temperatureYMin}
      axisLabel={(value) => `${value}°`}
      lines={[
        { name: t('skin.series.average'), color: SKIN_COLORS.line, valueOf: (day) => day.avgTemp },
        { name: t('skin.series.night'), color: SKIN_COLORS.night, valueOf: (day) => day.nightAvg, dashed: true },
      ]}
      tooltip={(day) =>
        [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(SKIN_COLORS.night)}${t('skin.series.night')}: <b>${formatTemp(day.nightAvg)}</b>`,
          `${colorDot(SKIN_COLORS.line)}${t('skin.series.average')}: <b>${formatTemp(day.avgTemp)}</b>`,
          `${colorDot(SKIN_COLORS.range)}${t('skin.series.range')}: <b>${formatTemp(day.minTemp)} – ${formatTemp(day.maxTemp)}</b>`,
        ].join('<br/>')
      }
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
};

export default Skin_Trend_Chart;
