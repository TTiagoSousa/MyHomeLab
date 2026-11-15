import { useTranslation } from 'react-i18next';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { VitalKind, VitalReading } from '../../../../Hooks/Health/healthLogTypes';
import { colorDot, formatDay, localClock } from '../Shared/healthFormat';
import { BODY_COLORS, formatVital } from './bodyFormat';

interface Body_Vitals_Chart_Props {
  kind: VitalKind;
  readings: VitalReading[];
}

const UNITS: Record<VitalKind, string> = { BLOOD_PRESSURE: 'mmHg', GLUCOSE: 'mg/dL', TEMPERATURE: '°C' };

const lineSeries = (name: string, data: (number | null)[], color: string): LineSeriesOption => ({
  type: 'line',
  name,
  data,
  smooth: 0.3,
  symbolSize: 7,
  connectNulls: true,
  lineStyle: { color, width: 2 },
  itemStyle: { color },
});

const Body_Vitals_Chart = ({ kind, readings }: Body_Vitals_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const points = readings.slice().reverse();
  const unit = UNITS[kind];

  const series: LineSeriesOption[] =
    kind === 'BLOOD_PRESSURE'
      ? [
          lineSeries(t('body.vitals.systolic'), points.map((reading) => reading.value), BODY_COLORS.systolic),
          lineSeries(t('body.vitals.diastolic'), points.map((reading) => reading.value2), BODY_COLORS.diastolic),
        ]
      : [
          lineSeries(
            t(`body.vitals.kinds.${kind}`),
            points.map((reading) => reading.value),
            kind === 'GLUCOSE' ? BODY_COLORS.glucose : BODY_COLORS.temperature,
          ),
        ];

  const option: EChartsOption = {
    grid: { left: 64, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const reading = points[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!reading) return '';
        const color = series[0].lineStyle?.color as string;
        return `<b>${formatDay(reading.day)} · ${localClock(reading.at, reading.timeZone)}</b><br/>${colorDot(color)}<b>${formatVital(reading)}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((reading) => formatDay(reading.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => `${value} ${unit}` },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series,
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.vitals.trendTitle')}</span>
          <p className='Health_card_description'>{t(`body.vitals.kinds.${kind}`)}</p>
        </div>
      </div>
      <EChart option={option} height={260} />
    </section>
  );
};

export default Body_Vitals_Chart;
