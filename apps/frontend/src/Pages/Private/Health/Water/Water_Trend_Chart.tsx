import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { WaterDay } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { WATER_COLORS, formatMl } from './waterFormat';

interface Water_Trend_Chart_Props {
  waterDays: WaterDay[];
  goal: number;
}

const VISIBLE_DAYS = 45;

const Water_Trend_Chart = ({ waterDays, goal }: Water_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const days = waterDays.slice().reverse();
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
          `${colorDot(WATER_COLORS.bar)}${t('water.series.water')}: <b>${formatMl(day.ml)}</b>`,
          t('water.entriesCount', { count: day.entries.length }),
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
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => formatMl(value) },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('water.series.water'),
        barMaxWidth: 18,
        data: days.map((day) => ({
          value: day.ml,
          itemStyle: {
            color: day.ml >= goal ? WATER_COLORS.goalBar : WATER_COLORS.bar,
            opacity: day.ml >= goal ? 0.95 : 0.6,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
      {
        type: 'line',
        name: t('water.series.goal'),
        data: days.map(() => goal),
        silent: true,
        showSymbol: false,
        lineStyle: { color: WATER_COLORS.goal, width: 1.5, type: 'dashed' },
      },
    ],
  };

  return <EChart option={option} height={240} />;
};

export default Water_Trend_Chart;
