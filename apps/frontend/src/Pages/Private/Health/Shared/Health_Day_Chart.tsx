import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import { minuteClock } from './healthFormat';

export interface Health_Day_Reference {
  name: string;
  value: number;
  color: string;
}

export interface Health_Day_Scatter {
  name: string;
  points: [number, number][];
  color: string;
  format: (value: number) => string;
}

interface Health_Day_Chart_Props {
  name: string;
  points: [number, number][];
  color: string;
  areaColor: string;
  format: (value: number) => string;
  yMin: number | ((value: { min: number }) => number);
  gapMinutes: number;
  references?: Health_Day_Reference[];
  scatter?: Health_Day_Scatter | null;
  showPoints?: boolean;
}

const DAY_MINUTES = 1440;

const withGaps = (points: [number, number][], gapMinutes: number) => {
  const result: [number, number | null][] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && point[0] - previous[0] > gapMinutes) result.push([previous[0] + 1, null]);
    result.push(point);
  });
  return result;
};

const Health_Day_Chart = ({
  name,
  points,
  color,
  areaColor,
  format,
  yMin,
  gapMinutes,
  references = [],
  scatter = null,
  showPoints = false,
}: Health_Day_Chart_Props) => {
  const colors = useChartColors();

  const option: EChartsOption = {
    grid: { left: 44, right: scatter ? 44 : 16, top: 16, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const list = (params as unknown as { seriesName: string; value: [number, number | null] }[]).filter(
          (entry) => entry.value?.[1] != null,
        );
        if (!list.length) return '';
        const rows = list.map((entry) => {
          const value = entry.value[1] as number;
          const text = scatter && entry.seriesName === scatter.name ? scatter.format(value) : format(value);
          return `${entry.seriesName}: <b>${text}</b>`;
        });
        return [`<b>${minuteClock(list[0].value[0])}</b>`, ...rows].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: DAY_MINUTES,
      interval: 120,
      axisLine: { lineStyle: { color: colors.lineStrong } },
      splitLine: { show: true, lineStyle: { color: colors.line, type: 'dashed' } },
      axisLabel: { color: colors.textFaint, fontSize: 11, formatter: (value: number) => minuteClock(value) },
    },
    yAxis: [
      {
        type: 'value',
        min: yMin,
        axisLabel: { color: colors.textFaint, fontSize: 10.5 },
        splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
      },
      {
        type: 'value',
        show: !!scatter,
        position: 'right',
        axisLabel: { color: scatter?.color, fontSize: 10.5 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: 'line',
        name,
        data: withGaps(points, gapMinutes),
        showSymbol: showPoints,
        symbolSize: 5,
        lineStyle: { color, width: 1.5 },
        itemStyle: { color },
        areaStyle: { color: areaColor },
      },
      ...references.map((reference) => ({
        type: 'line' as const,
        name: reference.name,
        data: [
          [0, reference.value],
          [DAY_MINUTES, reference.value],
        ],
        showSymbol: false,
        silent: true,
        lineStyle: { color: reference.color, width: 1.5, type: 'dashed' as const },
        itemStyle: { color: reference.color },
      })),
      ...(scatter
        ? [
            {
              type: 'scatter' as const,
              name: scatter.name,
              yAxisIndex: 1,
              data: scatter.points,
              symbolSize: 6,
              itemStyle: { color: scatter.color },
            },
          ]
        : []),
    ],
  };

  return <EChart option={option} height={280} />;
};

export default Health_Day_Chart;
