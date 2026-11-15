import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { BodyMeasurement } from '../../../../Hooks/Health/healthLogTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { BODY_COLORS, MEASUREMENT_FIELDS, formatMeasure, unitOf, type MeasurementField } from './bodyFormat';

interface Body_Measurement_Chart_Props {
  measurements: BodyMeasurement[];
}

const Body_Measurement_Chart = ({ measurements }: Body_Measurement_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const available = MEASUREMENT_FIELDS.filter(({ key }) => measurements.filter((row) => row[key] != null).length > 1);
  const [field, setField] = useState<MeasurementField>(available[0]?.key ?? 'waistCm');
  if (available.length === 0) return null;

  const active = available.some(({ key }) => key === field) ? field : available[0].key;
  const unit = unitOf(active);
  const points = measurements
    .filter((row) => row[active] != null)
    .slice()
    .reverse();
  const values = points.map((row) => row[active] as number);
  const spread = Math.max(1, (Math.max(...values) - Math.min(...values)) * 0.2);
  const label = t(`body.fields.${active}`);

  const option: EChartsOption = {
    grid: { left: 56, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const row = points[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!row) return '';
        return `<b>${formatDay(row.day)}</b><br/>${colorDot(BODY_COLORS.line)}${label}: <b>${formatMeasure(row[active], unit)}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: points.map((row) => formatDay(row.day, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      min: Math.floor(Math.min(...values) - spread),
      max: Math.ceil(Math.max(...values) + spread),
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => `${value} ${unit}` },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        name: label,
        data: values,
        smooth: 0.3,
        symbolSize: 7,
        lineStyle: { color: BODY_COLORS.line, width: 2 },
        itemStyle: { color: BODY_COLORS.line },
        areaStyle: { color: BODY_COLORS.area },
      },
    ],
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.measurements.trendTitle')}</span>
          <p className='Health_card_description'>{t('body.measurements.trendHint')}</p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {available.map(({ key }) => (
          <button key={key} type='button' className={key === active ? 'active' : ''} onClick={() => setField(key)}>
            {t(`body.fields.${key}`)}
          </button>
        ))}
      </div>

      <EChart option={option} height={260} />
    </section>
  );
};

export default Body_Measurement_Chart;
