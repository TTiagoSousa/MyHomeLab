import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';

export interface Health_Range_Line<Item> {
  name: string;
  color: string;
  valueOf: (item: Item) => number | null;
  dashed?: boolean;
}

interface Health_Range_Chart_Props<Item extends { id: string }> {
  items: Item[];
  labelOf: (item: Item) => string;
  minOf: (item: Item) => number;
  maxOf: (item: Item) => number;
  rangeName: string;
  rangeColor: string;
  selectedColor: string;
  lines: Health_Range_Line<Item>[];
  yMin: number | ((value: { min: number }) => number);
  axisLabel?: (value: number) => string;
  tooltip: (item: Item) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const VISIBLE_ITEMS = 45;

const Health_Range_Chart = <Item extends { id: string }>({
  items,
  labelOf,
  minOf,
  maxOf,
  rangeName,
  rangeColor,
  selectedColor,
  lines,
  yMin,
  axisLabel,
  tooltip,
  selectedId,
  onSelect,
}: Health_Range_Chart_Props<Item>) => {
  const colors = useChartColors();
  if (!items.length) return null;

  const option: EChartsOption = {
    grid: { left: 44, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const item = items[(params as { dataIndex: number }[])[0]?.dataIndex];
        return item ? tooltip(item) : '';
      },
    },
    dataZoom:
      items.length > VISIBLE_ITEMS
        ? [
            {
              type: 'inside',
              startValue: items.length - VISIBLE_ITEMS,
              endValue: items.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: items.map(labelOf),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: axisLabel },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        stack: 'range',
        silent: true,
        barMaxWidth: 16,
        itemStyle: { color: 'transparent' },
        data: items.map(minOf),
      },
      {
        type: 'bar',
        stack: 'range',
        name: rangeName,
        barMaxWidth: 16,
        cursor: 'pointer',
        data: items.map((item) => ({
          value: Math.round((maxOf(item) - minOf(item)) * 10) / 10,
          itemStyle: {
            color: rangeColor,
            borderColor: item.id === selectedId ? selectedColor : 'transparent',
            borderWidth: 1,
            borderRadius: 3,
          },
        })),
      },
      ...lines.map((line) => ({
        type: 'line' as const,
        name: line.name,
        data: items.map(line.valueOf),
        connectNulls: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: items.length <= VISIBLE_ITEMS,
        lineStyle: { color: line.color, width: 2, type: line.dashed ? ('dashed' as const) : ('solid' as const) },
        itemStyle: { color: line.color },
        z: 3,
      })),
    ],
  };

  return (
    <EChart
      option={option}
      height={260}
      onClick={(params) => {
        const item = items[params.dataIndex];
        if (item) onSelect(item.id);
      }}
    />
  );
};

export default Health_Range_Chart;
