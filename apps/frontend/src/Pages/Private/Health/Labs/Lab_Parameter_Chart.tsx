import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { LabHistoryPoint } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { formatLabReference, formatLabValue } from './labFormat';

interface Lab_Parameter_Chart_Props {
  history: LabHistoryPoint[];
}

const LINE = '#38bdf8';
const OUT = '#f43f5e';

const niceStep = (spread: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(spread));
  const ratio = spread / magnitude;
  return (ratio > 5 ? 2 : ratio > 2 ? 1 : 0.5) * magnitude;
};

const Lab_Parameter_Chart = ({ history }: Lab_Parameter_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const points = history.filter((point) => point.value != null);
  if (!points.length) return null;

  const latest = points[points.length - 1];
  const values = points.map((point) => point.value as number);
  const bounds = [...values, latest.refLow, latest.refHigh].filter((value): value is number => value != null);
  const spread = Math.max(...bounds) - Math.min(...bounds) || Math.abs(latest.value ?? 1) || 1;
  const step = niceStep(spread);
  const axisMin = Math.floor((Math.min(...bounds) - spread * 0.15) / step) * step;
  const axisMax = Math.ceil((Math.max(...bounds) + spread * 0.15) / step) * step;

  const option: EChartsOption = {
    grid: { left: 56, right: 16, top: 16, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const point = points[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!point) return '';
        return [
          `<b>${formatDay(point.date, false)}</b>${point.lab ? ` · ${point.lab}` : ''}`,
          `${colorDot(point.flag ? OUT : LINE)}<b>${formatLabValue(point)}</b>`,
          `${t('labs.columns.reference')}: ${formatLabReference(point)}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((point) => formatDay(point.date, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: axisMin,
      max: axisMax,
      interval: step,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => String(Math.round(value * 1000) / 1000) },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: points.map((point) => ({
          value: point.value as number,
          itemStyle: { color: point.flag ? OUT : LINE },
        })),
        symbolSize: 9,
        lineStyle: { color: LINE, width: 2 },
        markArea:
          latest.refLow != null || latest.refHigh != null
            ? {
                silent: true,
                itemStyle: { color: 'rgba(16, 185, 129, 0.16)', borderColor: 'rgba(16, 185, 129, 0.45)', borderWidth: 1, borderType: 'dashed' },
                data: [[{ yAxis: latest.refLow ?? axisMin }, { yAxis: latest.refHigh ?? axisMax }]],
              }
            : undefined,
      },
    ],
  };

  return <EChart option={option} height={220} />;
};

export default Lab_Parameter_Chart;
