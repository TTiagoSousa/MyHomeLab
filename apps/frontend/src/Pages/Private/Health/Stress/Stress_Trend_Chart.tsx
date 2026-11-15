import { useTranslation } from 'react-i18next';
import type { StressDay } from '../../../../Hooks/Health/healthTypes';
import Health_Range_Chart from '../Shared/Health_Range_Chart';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { STRESS_COLORS, formatScore, levelOf } from './stressFormat';

interface Stress_Trend_Chart_Props {
  stressDays: StressDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Stress_Trend_Chart = ({ stressDays, selectedId, onSelect }: Stress_Trend_Chart_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Range_Chart
      items={stressDays.slice().reverse()}
      labelOf={(day) => formatDay(day.day, false)}
      minOf={(day) => day.minScore}
      maxOf={(day) => day.maxScore}
      rangeName={t('stress.series.range')}
      rangeColor={STRESS_COLORS.range}
      selectedColor={STRESS_COLORS.line}
      yMin={0}
      lines={[{ name: t('stress.series.average'), color: STRESS_COLORS.line, valueOf: (day) => day.avgScore }]}
      tooltip={(day) =>
        [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(STRESS_COLORS.line)}${t('stress.series.average')}: <b>${formatScore(day.avgScore)}</b> · ${t(`stress.levels.${levelOf(day.avgScore)}`)}`,
          `${colorDot(STRESS_COLORS.range)}${t('stress.series.range')}: <b>${day.minScore} – ${day.maxScore}</b>`,
          t('stress.series.samples', { count: day.samples }),
        ].join('<br/>')
      }
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
};

export default Stress_Trend_Chart;
