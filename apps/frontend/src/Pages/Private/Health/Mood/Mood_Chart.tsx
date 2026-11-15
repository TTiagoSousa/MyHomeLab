import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { MOOD_COLORS, MOOD_FIELDS } from './moodFormat';

interface Mood_Chart_Props {
  moods: MoodEntry[];
}

const VISIBLE_DAYS = 45;

const Mood_Chart = ({ moods }: Mood_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const days = moods.slice().reverse();
  if (!days.length) return null;

  const option: EChartsOption = {
    grid: { left: 32, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const day = days[(params as { dataIndex: number }[])[0]?.dataIndex];
        if (!day) return '';
        return [
          `<b>${formatDay(day.day)}</b>`,
          ...MOOD_FIELDS.map((field) => `${colorDot(MOOD_COLORS[field])}${t(`mood.fields.${field}`)}: <b>${day[field]}</b>`),
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
    yAxis: {
      type: 'value',
      min: 1,
      max: 5,
      interval: 1,
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: MOOD_FIELDS.map((field) => ({
      type: 'line' as const,
      name: t(`mood.fields.${field}`),
      data: days.map((day) => day[field]),
      smooth: 0.3,
      symbolSize: 6,
      lineStyle: { color: MOOD_COLORS[field], width: 2 },
      itemStyle: { color: MOOD_COLORS[field] },
    })),
  };

  return (
    <>
      <div className='Mood_Legend'>
        {MOOD_FIELDS.map((field) => (
          <span key={field}>
            <i style={{ background: MOOD_COLORS[field] }} />
            {t(`mood.fields.${field}`)}
          </span>
        ))}
      </div>
      <EChart option={option} height={240} />
    </>
  );
};

export default Mood_Chart;
