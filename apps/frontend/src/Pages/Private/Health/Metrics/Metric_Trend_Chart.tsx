import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { HealthMetric, MetricPoint } from '../../../../Hooks/Health/healthTypes';
import { colorDot, formatDay, localClock } from '../Shared/healthFormat';
import { FIELD_INFO, METRIC_COLORS, formatField, formatFieldChange, isTapeMetric } from './metricCatalog';

interface Metric_Trend_Chart_Props {
  metric: HealthMetric;
  points: MetricPoint[];
  average: number | null;
}

const Metric_Trend_Chart = ({ metric, points, average }: Metric_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const series = points.slice().reverse();
  if (series.length < 2) return null;

  const name = t(`bodyMetrics.names.${metric}`);
  const values = series.map((point) => point.value);
  const spread = Math.max(...values) - Math.min(...values);
  const margin = Math.max(spread * 0.15, metric === 'bmrKcal' ? 20 : 1);
  const unit = FIELD_INFO[metric].unit;

  const option: EChartsOption = {
    grid: { left: 58, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const point = series[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!point) return '';
        const when = isTapeMetric(metric) ? formatDay(point.day) : `${formatDay(point.day)} · ${localClock(point.at, point.timeZone)}`;
        return [
          `<b>${when}</b>`,
          `${colorDot(METRIC_COLORS.line)}${name}: <b>${formatField(metric, point.value)}</b>`,
          point.change != null ? formatFieldChange(metric, point.change) : '',
          point.device ?? '',
        ]
          .filter(Boolean)
          .join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: series.map((point) => formatDay(point.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: Math.floor(Math.min(...values) - margin),
      max: Math.ceil(Math.max(...values) + margin),
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => (unit ? `${value} ${unit}` : `${value}`) },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        name,
        data: values,
        smooth: 0.3,
        symbolSize: 7,
        lineStyle: { color: METRIC_COLORS.line, width: 2 },
        itemStyle: { color: METRIC_COLORS.line },
        areaStyle: { color: METRIC_COLORS.area },
      },
      ...(average == null
        ? []
        : [
            {
              type: 'line' as const,
              name: t('weight.series.average'),
              data: series.map(() => average),
              silent: true,
              showSymbol: false,
              lineStyle: { color: METRIC_COLORS.average, width: 1.5, type: 'dashed' as const },
            },
          ]),
    ],
  };

  return <EChart option={option} height={260} />;
};

export default Metric_Trend_Chart;
