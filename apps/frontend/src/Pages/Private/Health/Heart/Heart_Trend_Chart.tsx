import { useTranslation } from 'react-i18next';
import type { HeartDay } from '../../../../Hooks/Health/healthTypes';
import Health_Range_Chart from '../Shared/Health_Range_Chart';
import { colorDot, formatDay, valueOrDash } from '../Shared/healthFormat';
import { HEART_COLORS } from './heartFormat';

interface Heart_Trend_Chart_Props {
  heartDays: HeartDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Heart_Trend_Chart = ({ heartDays, selectedId, onSelect }: Heart_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const bpm = ` ${t('units.bpm')}`;

  return (
    <Health_Range_Chart
      items={heartDays.slice().reverse()}
      labelOf={(day) => formatDay(day.day, false)}
      minOf={(day) => day.minBpm}
      maxOf={(day) => day.maxBpm}
      rangeName={t('heart.series.range')}
      rangeColor={HEART_COLORS.range}
      selectedColor={HEART_COLORS.line}
      yMin={30}
      lines={[
        { name: t('heart.series.average'), color: HEART_COLORS.line, valueOf: (day) => day.avgBpm },
        { name: t('heart.series.resting'), color: HEART_COLORS.resting, valueOf: (day) => day.restingBpm, dashed: true },
      ]}
      tooltip={(day) =>
        [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(HEART_COLORS.resting)}${t('heart.series.resting')}: <b>${valueOrDash(day.restingBpm, bpm)}</b>`,
          `${colorDot(HEART_COLORS.line)}${t('heart.series.average')}: <b>${day.avgBpm}${bpm}</b>`,
          `${colorDot(HEART_COLORS.range)}${t('heart.series.range')}: <b>${day.minBpm}–${day.maxBpm}${bpm}</b>`,
          `${colorDot(HEART_COLORS.hrv)}${t('heart.series.hrv')}: <b>${valueOrDash(day.avgHrv, ` ${t('units.ms')}`)}</b>`,
        ].join('<br/>')
      }
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
};

export default Heart_Trend_Chart;
