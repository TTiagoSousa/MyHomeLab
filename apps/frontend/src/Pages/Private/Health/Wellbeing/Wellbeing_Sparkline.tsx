import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';

interface Wellbeing_Sparkline_Props {
  values: number[];
  colors: string[];
  kind: 'line' | 'bar';
  min?: number;
  max?: number;
}

const Wellbeing_Sparkline = ({ values, colors, kind, min, max }: Wellbeing_Sparkline_Props) => {
  if (values.length < 2) return null;

  const option: EChartsOption = {
    animation: false,
    grid: { left: 2, right: 2, top: 4, bottom: 2 },
    xAxis: { type: 'category', show: false, data: values.map((_, index) => index) },
    yAxis: { type: 'value', show: false, min, max },
    series: [
      kind === 'line'
        ? {
            type: 'line',
            silent: true,
            data: values,
            smooth: 0.3,
            symbol: 'none',
            lineStyle: { color: colors[0], width: 2 },
            areaStyle: { color: colors[0], opacity: 0.12 },
          }
        : {
            type: 'bar',
            silent: true,
            barMaxWidth: 10,
            data: values.map((value, index) => ({ value, itemStyle: { color: colors[index] ?? colors[0], borderRadius: [2, 2, 0, 0] } })),
          },
    ],
  };

  return <EChart option={option} height={56} className='Wellbeing_Sparkline' />;
};

export default Wellbeing_Sparkline;
