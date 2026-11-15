import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { Workout } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay, formatDistance, localClock, valueOrDash } from '../Shared/healthFormat';
import { SPORT_COLORS, formatWorkoutDuration, rankSports, typeName } from './exerciseFormat';

interface Exercise_Workouts_Chart_Props {
  workouts: Workout[];
  onOpen: (id: string) => void;
}

const VISIBLE_WORKOUTS = 40;

const Exercise_Workouts_Chart = ({ workouts, onOpen }: Exercise_Workouts_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const items = workouts.slice().reverse();
  if (!items.length) return <span className='Health_chart_empty'>{t('exercise.noWorkouts')}</span>;

  const counts: Record<string, number> = {};
  for (const workout of workouts) counts[workout.typeId] = (counts[workout.typeId] ?? 0) + 1;
  const sportOrder = rankSports(counts);
  const colorOf = (typeId: string) => SPORT_COLORS[sportOrder.indexOf(typeId) % SPORT_COLORS.length];

  const option: EChartsOption = {
    grid: { left: 44, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const workout = items[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!workout) return '';
        return [
          `${colorDot(colorOf(workout.typeId))}<b>${typeName(t, workout.typeId)}</b>`,
          `${formatDay(workout.day)} · ${localClock(workout.startAt, workout.timeZone)}`,
          `${formatWorkoutDuration(workout.durationSec)} · ${valueOrDash(workout.calories, ' kcal')} · ${formatDistance(workout.distanceM)}`,
          `${t('exercise.series.heartRate')}: <b>${valueOrDash(workout.avgHeartRate, ` ${t('units.bpm')}`)}</b>`,
        ].join('<br/>');
      },
    },
    dataZoom:
      items.length > VISIBLE_WORKOUTS
        ? [
            {
              type: 'inside',
              startValue: items.length - VISIBLE_WORKOUTS,
              endValue: items.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: items.map((workout) => formatDay(workout.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => `${value}′` },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('exercise.series.duration'),
        barMaxWidth: 22,
        cursor: 'pointer',
        data: items.map((workout) => ({
          value: Math.round(workout.durationSec / 60),
          itemStyle: {
            color: colorOf(workout.typeId),
            opacity: 0.8,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };

  return (
    <EChart
      option={option}
      height={260}
      onClick={(params) => {
        const workout = items[params.dataIndex];
        if (workout) onOpen(workout.id);
      }}
    />
  );
};

export default Exercise_Workouts_Chart;
