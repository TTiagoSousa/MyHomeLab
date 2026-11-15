import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import { EXERCISE_COLORS, formatPace } from './exerciseFormat';

interface Exercise_Splits_Chart_Props {
  splits: [number, number][];
}

const Exercise_Splits_Chart = ({ splits }: Exercise_Splits_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const fastest = Math.min(...splits.map((split) => split[1]));

  const option: EChartsOption = {
    grid: { left: 52, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const split = splits[(params as { dataIndex: number }[])[0]?.dataIndex];
        return split ? `<b>${t('exercise.splits.km', { km: split[0] })}</b><br/>${formatPace(split[1])}` : '';
      },
    },
    xAxis: {
      type: 'category',
      data: splits.map((split) => t('exercise.splits.km', { km: split[0] })),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => formatPace(value).replace(' /km', '') },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 28,
        data: splits.map((split) => ({
          value: split[1],
          itemStyle: {
            color: split[1] === fastest ? EXERCISE_COLORS.start : EXERCISE_COLORS.route,
            opacity: split[1] === fastest ? 1 : 0.7,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };

  return <EChart option={option} height={220} />;
};

export default Exercise_Splits_Chart;
