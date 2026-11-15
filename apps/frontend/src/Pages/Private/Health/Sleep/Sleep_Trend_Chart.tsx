import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { SleepSession, SleepStage } from '../../../../Hooks/Health/healthTypes';
import { STAGE_COLORS } from './sleepFormat';
import { formatDay, formatDuration, localClock } from '../Shared/healthFormat';

interface Sleep_Trend_Chart_Props {
  sessions: SleepSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STACK: { stage: SleepStage; field: 'deepMin' | 'lightMin' | 'remMin' | 'awakeMin' }[] = [
  { stage: 'DEEP', field: 'deepMin' },
  { stage: 'LIGHT', field: 'lightMin' },
  { stage: 'REM', field: 'remMin' },
  { stage: 'AWAKE', field: 'awakeMin' },
];

const Sleep_Trend_Chart = ({ sessions, selectedId, onSelect }: Sleep_Trend_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const nights = sessions.filter((session) => !session.isNap).slice().reverse();
  if (!nights.length) return null;

  const option: EChartsOption = {
    grid: { left: 44, right: 12, top: 14, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const list = params as { dataIndex: number }[];
        const night = nights[list[0]?.dataIndex];
        if (!night) return '';
        const rows = STACK.map(({ stage, field }) => {
          const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:${STAGE_COLORS[stage]}"></span>`;
          return `${dot}${t(`stages.${stage}`)}: <b>${formatDuration(night[field])}</b>`;
        });
        return [
          `<b>${formatDay(night.night)}</b>`,
          `${localClock(night.asleepAt, night.timeZone)} → ${localClock(night.wakeAt, night.timeZone)} · <b>${formatDuration(night.asleepMin)}</b>`,
          ...rows,
        ].join('<br/>');
      },
    },
    dataZoom:
      nights.length > 45
        ? [
            {
              type: 'inside',
              startValue: nights.length - 45,
              endValue: nights.length - 1,
              zoomOnMouseWheel: false,
              moveOnMouseWheel: false,
              moveOnMouseMove: true,
            },
          ]
        : [],
    xAxis: {
      type: 'category',
      data: nights.map((night) => formatDay(night.night, false)),
      axisLine: { lineStyle: { color: colors.lineStrong } },
      axisTick: { show: false },
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
    },
    yAxis: {
      type: 'value',
      minInterval: 60,
      interval: 120,
      axisLabel: { color: colors.textFaint, fontSize: 10.5, formatter: (value: number) => `${value / 60}h` },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: STACK.map(({ stage, field }, index) => ({
      type: 'bar',
      name: t(`stages.${stage}`),
      stack: 'night',
      barMaxWidth: 22,
      cursor: 'pointer',
      data: nights.map((night) => ({
        value: night[field],
        itemStyle: {
          color: STAGE_COLORS[stage],
          opacity: selectedId && night.id !== selectedId ? 0.55 : 1,
          borderRadius: index === STACK.length - 1 ? [3, 3, 0, 0] : 0,
        },
      })),
    })),
  };

  return (
    <EChart
      option={option}
      height={240}
      onClick={(params) => {
        const night = nights[params.dataIndex];
        if (night) onSelect(night.id);
      }}
    />
  );
};

export default Sleep_Trend_Chart;
