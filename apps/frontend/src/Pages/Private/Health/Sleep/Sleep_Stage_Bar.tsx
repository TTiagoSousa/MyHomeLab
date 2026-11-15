import { useTranslation } from 'react-i18next';
import type { SleepStage } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';

interface Sleep_Stage_Bar_Props {
  parts: { stage: SleepStage; value: number }[];
  showLegend?: boolean;
  unit?: 'pct' | 'min';
}

const Sleep_Stage_Bar = ({ parts, showLegend = false, unit = 'pct' }: Sleep_Stage_Bar_Props) => {
  const { t } = useTranslation('health');

  return (
    <Health_Split_Bar
      showLegend={showLegend}
      parts={parts.map((part) => ({
        key: part.stage,
        label: t(`stages.${part.stage}`),
        value: part.value,
        className: `stage-${part.stage}`,
        display: unit === 'pct' ? `${Math.round(part.value)}%` : t('units.minutes', { value: part.value }),
      }))}
    />
  );
};

export default Sleep_Stage_Bar;
