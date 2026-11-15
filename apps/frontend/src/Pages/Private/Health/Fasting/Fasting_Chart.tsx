import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { Fast } from '../../../../Hooks/Health/healthLogTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { FAST_REACHED_COLOR, fastDay, fastReached, formatHours } from './fastingFormat';

interface Fasting_Chart_Props {
  fasts: Fast[];
}

const VISIBLE_FASTS = 40;

const Fasting_Chart = ({ fasts }: Fasting_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const finished = fasts.filter((fast) => fast.hours != null).reverse();
  if (!finished.length) return null;

  const option: EChartsOption = {
    grid: { left: 36, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const fast = finished[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!fast) return '';
        return [
          `<b>${formatDay(fastDay(fast))}</b>`,
          `${colorDot(fastReached(fast) ? FAST_REACHED_COLOR : colors.accent)}${t('fasting.stats.duration')}: <b>${formatHours(fast.hours)}</b>`,
          `${colorDot(colors.textFaint)}${t('fasting.targetOf', { value: fast.targetHours })}`,
        ].join('<br/>');
      },
    },
    dataZoom:
      finished.length > VISIBLE_FASTS
        ? [
            {
              type: 'inside',
              startValue: finished.length - VISIBLE_FASTS,
              endValue: finished.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: finished.map((fast) => formatDay(fastDay(fast), false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: '{value} h' },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('fasting.stats.duration'),
        barMaxWidth: 26,
        data: finished.map((fast) => ({
          value: fast.hours ?? 0,
          itemStyle: { color: fastReached(fast) ? FAST_REACHED_COLOR : colors.accent, borderRadius: [3, 3, 0, 0] },
        })),
      },
      {
        type: 'line',
        name: t('fasting.form.target'),
        step: 'middle',
        symbol: 'none',
        data: finished.map((fast) => fast.targetHours),
        lineStyle: { color: colors.textFaint, width: 1.5, type: 'dashed' },
        itemStyle: { color: colors.textFaint },
      },
    ],
  };

  return <EChart option={option} height={240} />;
};

export default Fasting_Chart;
