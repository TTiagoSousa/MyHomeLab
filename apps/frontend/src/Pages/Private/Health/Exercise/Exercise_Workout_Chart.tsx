import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { WorkoutDetail } from '../../../../Hooks/Health/healthTypes';
import { EXERCISE_COLORS } from './exerciseFormat';

interface Exercise_Workout_Chart_Props {
  workout: WorkoutDetail;
}

const toMinutes = (points: [number, number][] | null) =>
  (points ?? []).map(([second, value]) => [Math.round((second / 60) * 10) / 10, value]);

const elapsed = (minutes: number) => `${Math.floor(minutes)}′`;

const Exercise_Workout_Chart = ({ workout }: Exercise_Workout_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const heartRate = toMinutes(workout.heartRate);
  const altitude = toMinutes(workout.altitude);
  if (!heartRate.length && !altitude.length) {
    return <span className='Health_chart_empty'>{t('exercise.noSeries')}</span>;
  }

  const option: EChartsOption = {
    grid: { left: 44, right: altitude.length ? 48 : 16, top: 16, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const list = params as unknown as { seriesName: string; value: [number, number] }[];
        if (!list.length) return '';
        const rows = list.map((entry) => {
          const unit = entry.seriesName === t('exercise.series.altitude') ? ' m' : ` ${t('units.bpm')}`;
          return `${entry.seriesName}: <b>${entry.value[1]}${unit}</b>`;
        });
        return [`<b>${elapsed(list[0].value[0])}</b>`, ...rows].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(workout.durationSec / 60),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      splitLine: { show: true, lineStyle: { color: colors.line, type: 'dashed' } },
      axisLabel: { color: colors.textFaint, fontSize: 11, formatter: (value: number) => elapsed(value) },
    },
    yAxis: [
      {
        type: 'value',
        min: (value: { min: number }) => Math.max(Math.floor(value.min / 10) * 10 - 10, 0),
        axisLabel: { color: colors.textFaint, fontSize: 10.5 },
        splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
      },
      {
        type: 'value',
        show: altitude.length > 0,
        position: 'right',
        scale: true,
        axisLabel: { color: EXERCISE_COLORS.altitude, fontSize: 10.5 },
        splitLine: { show: false },
      },
    ],
    series: [
      ...(heartRate.length
        ? [
            {
              type: 'line' as const,
              name: t('exercise.series.heartRate'),
              data: heartRate,
              showSymbol: false,
              lineStyle: { color: EXERCISE_COLORS.heart, width: 1.5 },
              itemStyle: { color: EXERCISE_COLORS.heart },
              areaStyle: { color: EXERCISE_COLORS.heartArea },
            },
          ]
        : []),
      ...(altitude.length
        ? [
            {
              type: 'line' as const,
              name: t('exercise.series.altitude'),
              yAxisIndex: 1,
              data: altitude,
              showSymbol: false,
              lineStyle: { color: EXERCISE_COLORS.altitude, width: 1.5, type: 'dashed' as const },
              itemStyle: { color: EXERCISE_COLORS.altitude },
            },
          ]
        : []),
    ],
  };

  return <EChart option={option} height={280} />;
};

export default Exercise_Workout_Chart;
