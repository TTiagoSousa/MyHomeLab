import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { ActivityDay } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay, formatDistance, formatDuration, formatSteps } from '../Shared/healthFormat';
import { STEPS_COLORS, STEP_GOAL } from './stepsFormat';

interface Steps_Trend_Chart_Props {
  stepsDays: ActivityDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const VISIBLE_DAYS = 45;

const Steps_Trend_Chart = ({ stepsDays, selectedId, onSelect }: Steps_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const days = stepsDays.slice().reverse();
  if (!days.length) return null;

  const option: EChartsOption = {
    grid: { left: 52, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const day = days[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!day) return '';
        return [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(STEPS_COLORS.bar)}${t('steps.series.steps')}: <b>${formatSteps(day.steps)}</b>`,
          `${formatDistance(day.distanceM)} · ${day.calories} kcal · ${formatDuration(day.activeMinutes)}`,
        ].join('<br/>');
      },
    },
    dataZoom:
      days.length > VISIBLE_DAYS
        ? [
            {
              type: 'inside',
              startValue: days.length - VISIBLE_DAYS,
              endValue: days.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: days.map((day) => formatDay(day.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: colors.textFaint,
        fontSize: 10.5,
        formatter: (value: number) => (value >= 1000 ? `${value / 1000}k` : String(value)),
      },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('steps.series.steps'),
        barMaxWidth: 18,
        cursor: 'pointer',
        data: days.map((day) => ({
          value: day.steps,
          itemStyle: {
            color: day.steps >= STEP_GOAL ? STEPS_COLORS.goalBar : STEPS_COLORS.bar,
            opacity: day.id === selectedId ? 1 : day.steps >= STEP_GOAL ? 0.9 : 0.55,
            borderColor: day.id === selectedId ? STEPS_COLORS.goalBar : 'transparent',
            borderWidth: 1,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
      {
        type: 'line',
        name: t('steps.series.goal'),
        data: days.map(() => STEP_GOAL),
        silent: true,
        showSymbol: false,
        lineStyle: { color: STEPS_COLORS.goal, width: 1.5, type: 'dashed' },
      },
    ],
  };

  return (
    <EChart
      option={option}
      height={260}
      onClick={(params) => {
        const day = days[params.dataIndex];
        if (day) onSelect(day.id);
      }}
    />
  );
};

export default Steps_Trend_Chart;
