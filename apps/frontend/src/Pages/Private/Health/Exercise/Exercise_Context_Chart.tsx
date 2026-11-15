import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';

interface Exercise_Context_Chart_Props {
  name: string;
  points: [number, number][];
  color: string;
  durationSec: number;
  format: (value: number) => string;
}

const elapsed = (minutes: number) => `${Math.floor(minutes)}′`;

const Exercise_Context_Chart = ({ name, points, color, durationSec, format }: Exercise_Context_Chart_Props) => {
  const colors = useChartColors();
  const data = points.map(([second, value]) => [Math.round((second / 60) * 10) / 10, value]);

  const option: EChartsOption = {
    grid: { left: 44, right: 16, top: 12, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const entry = (params as unknown as { value: [number, number] }[])[0];
        return entry ? `<b>${elapsed(entry.value[0])}</b><br/>${name}: <b>${format(entry.value[1])}</b>` : '';
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: Math.ceil(durationSec / 60),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      splitLine: { show: true, lineStyle: { color: colors.line, type: 'dashed' } },
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => elapsed(value) },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        name,
        data,
        showSymbol: data.length < 40,
        symbolSize: 5,
        lineStyle: { color, width: 1.5 },
        itemStyle: { color },
      },
    ],
  };

  return <EChart option={option} height={170} />;
};

export default Exercise_Context_Chart;
