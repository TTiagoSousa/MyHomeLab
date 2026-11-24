import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { WeightEntry } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay, localClock } from '../Shared/healthFormat';
import { WEIGHT_COLORS, formatKg, formatKgChange } from './weightFormat';

interface Weight_Trend_Chart_Props {
  entries: WeightEntry[];
  averageKg: number | null;
}

const Weight_Trend_Chart = ({ entries, averageKg }: Weight_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const points = entries.filter((entry) => entry.weightKg != null).reverse();
  if (points.length < 2) return null;

  const values = points.map((entry) => entry.weightKg ?? 0);
  const low = Math.floor(Math.min(...values) - 1);
  const high = Math.ceil(Math.max(...values) + 1);

  const option: EChartsOption = {
    grid: { left: 52, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const entry = points[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!entry) return '';
        return [
          `<b>${formatDay(entry.day)} · ${localClock(entry.measuredAt, entry.timeZone)}</b>`,
          `${colorDot(WEIGHT_COLORS.line)}${t('weight.series.weight')}: <b>${formatKg(entry.weightKg)}</b>`,
          entry.changeKg != null ? formatKgChange(entry.changeKg) : '',
        ]
          .filter(Boolean)
          .join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((entry) => formatDay(entry.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: low,
      max: high,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => `${value} kg` },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        name: t('weight.series.weight'),
        data: values,
        smooth: 0.3,
        symbolSize: 7,
        lineStyle: { color: WEIGHT_COLORS.line, width: 2 },
        itemStyle: { color: WEIGHT_COLORS.line },
        areaStyle: { color: WEIGHT_COLORS.area },
      },
      ...(averageKg == null
        ? []
        : [
            {
              type: 'line' as const,
              name: t('weight.series.average'),
              data: points.map(() => averageKg),
              silent: true,
              showSymbol: false,
              lineStyle: { color: WEIGHT_COLORS.average, width: 1.5, type: 'dashed' as const },
            },
          ]),
    ],
  };

  return <EChart option={option} height={260} />;
};

export default Weight_Trend_Chart;
