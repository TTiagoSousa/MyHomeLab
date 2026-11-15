import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { IntakeDay } from '../../../../Hooks/Health/intakesTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { INTAKE_COLORS, formatDrinks, formatNumber } from './intakesFormat';

interface Intakes_Chart_Props {
  intakeDays: IntakeDay[];
}

const VISIBLE_DAYS = 45;

const Intakes_Chart = ({ intakeDays }: Intakes_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const days = [...intakeDays].sort((a, b) => a.day.localeCompare(b.day));
  if (!days.length) return null;

  const option: EChartsOption = {
    grid: { left: 58, right: 36, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const day = days[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!day) return '';
        return [
          `<b>${formatDay(day.day)}</b>`,
          `${colorDot(INTAKE_COLORS.caffeine)}${t('intakes.series.caffeine')}: <b>${formatNumber(day.caffeineMg, 0)} mg</b>`,
          t('intakes.today.coffees', { count: day.coffees }),
          `${colorDot(INTAKE_COLORS.alcohol)}${t('intakes.series.drinks')}: <b>${formatDrinks(t, day.drinks)}</b>`,
        ].join('<br/>');
      },
    },
    dataZoom:
      days.length > VISIBLE_DAYS
        ? [
            {
              type: 'inside',
              startValue: days.length - VISIBLE_DAYS,
              endValue: days.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: days.map((day) => formatDay(day.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: '{value} mg' },
        splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
      },
      {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: colors.textFaint, fontSize: 10.5 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: 'bar',
        name: t('intakes.series.caffeine'),
        barMaxWidth: 14,
        itemStyle: { color: INTAKE_COLORS.caffeine, opacity: 0.85, borderRadius: [3, 3, 0, 0] },
        data: days.map((day) => day.caffeineMg),
      },
      {
        type: 'bar',
        name: t('intakes.series.drinks'),
        yAxisIndex: 1,
        barMaxWidth: 14,
        itemStyle: { color: INTAKE_COLORS.alcohol, opacity: 0.85, borderRadius: [3, 3, 0, 0] },
        data: days.map((day) => day.drinks),
      },
    ],
  };

  return (
    <div className='Health_Block'>
      <EChart option={option} height={260} />
      <div className='Health_Chart_Legend'>
        <span>
          <i className='dot intakes-caffeine' />
          {t('intakes.series.caffeine')}
        </span>
        <span>
          <i className='dot intakes-alcohol' />
          {t('intakes.series.drinks')}
        </span>
      </div>
    </div>
  );
};

export default Intakes_Chart;
