import { useTranslation } from 'react-i18next';
import type { HeartDayDetail } from '../../../../Hooks/Health/healthTypes';
import Health_Day_Chart from '../Shared/Health_Day_Chart';
import { HEART_COLORS } from './heartFormat';

interface Heart_Day_Chart_Props {
  heartDay: HeartDayDetail;
}

const Heart_Day_Chart = ({ heartDay }: Heart_Day_Chart_Props) => {
  const { t } = useTranslation('health');
  if (!heartDay.points.length) return <span className='Health_chart_empty'>{t('heart.noPoints')}</span>;

  const hrvPoints = heartDay.hrvPoints ?? [];

  return (
    <Health_Day_Chart
      name={t('heart.series.heartRate')}
      points={heartDay.points}
      color={HEART_COLORS.line}
      areaColor={HEART_COLORS.area}
      format={(value) => `${value} ${t('units.bpm')}`}
      yMin={30}
      gapMinutes={20}
      references={
        heartDay.restingBpm != null
          ? [{ name: t('heart.series.resting'), value: heartDay.restingBpm, color: HEART_COLORS.resting }]
          : []
      }
      scatter={
        hrvPoints.length
          ? {
              name: t('heart.series.hrv'),
              points: hrvPoints,
              color: HEART_COLORS.hrv,
              format: (value) => `${value} ${t('units.ms')}`,
            }
          : null
      }
    />
  );
};

export default Heart_Day_Chart;
