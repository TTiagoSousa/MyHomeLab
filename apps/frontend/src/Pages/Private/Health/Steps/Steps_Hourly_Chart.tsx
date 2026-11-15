import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import { formatSteps } from '../Shared/healthFormat';
import { STEPS_COLORS, busiestHour } from './stepsFormat';

interface Steps_Hourly_Chart_Props {
  hourly: number[];
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const Steps_Hourly_Chart = ({ hourly }: Steps_Hourly_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const peak = busiestHour(hourly);

  const option: EChartsOption = {
    grid: { left: 52, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const hour = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        return `<b>${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}</b><br/>${t('steps.series.steps')}: <b>${formatSteps(hourly[hour])}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: hourly.map((_, hour) => hourLabel(hour)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5, interval: 1 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('steps.series.steps'),
        barMaxWidth: 22,
        data: hourly.map((steps, hour) => ({
          value: steps,
          itemStyle: {
            color: hour === peak ? STEPS_COLORS.goalBar : STEPS_COLORS.bar,
            opacity: hour === peak ? 1 : 0.6,
            borderRadius: [3, 3, 0, 0],
          },
        })),
      },
    ],
  };

  return <EChart option={option} height={240} />;
};

export default Steps_Hourly_Chart;
