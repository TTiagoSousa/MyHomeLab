import { useTranslation } from 'react-i18next';
import type { CustomSeriesRenderItem, EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { SleepStage, SleepStageSegment } from '../../../../Hooks/Health/healthTypes';
import { STAGE_COLORS, STAGE_ORDER } from './sleepFormat';
import { localClock } from '../Shared/healthFormat';

interface Sleep_Hypnogram_Props {
  stages: SleepStageSegment[];
  timeZone: string | null;
}

const AXIS_STAGES = [...STAGE_ORDER].reverse();

const Sleep_Hypnogram = ({ stages, timeZone }: Sleep_Hypnogram_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  if (!stages.length) return <span className='Health_chart_empty'>{t('sleep.noStages')}</span>;

  const rowOf = (stage: SleepStage) => Math.max(AXIS_STAGES.indexOf(stage), 0);
  const clock = (time: number) => localClock(new Date(time).toISOString(), timeZone);

  const blocks = stages.map((segment) => {
    const start = Date.parse(segment.start);
    return { ...segment, from: start, to: start + segment.minutes * 60_000, row: rowOf(segment.stage) };
  });
  const last = blocks[blocks.length - 1];

  const renderBlock: CustomSeriesRenderItem = (_params, api) => {
    const start = api.coord([api.value(0), api.value(2)]);
    const end = api.coord([api.value(1), api.value(2)]);
    const height = (api.size?.([0, 1]) as number[])[1] * 0.62;
    return {
      type: 'rect',
      shape: { x: start[0], y: start[1] - height / 2, width: Math.max(end[0] - start[0], 1), height, r: 2 },
      style: { fill: STAGE_COLORS[blocks[api.value(3) as number].stage] },
    };
  };

  const option: EChartsOption = {
    grid: { left: 78, right: 16, top: 10, bottom: 28 },
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.panel,
      borderColor: colors.lineStrong,
      textStyle: { color: colors.text, fontSize: 12 },
      formatter: (params) => {
        const block = blocks[(params as { dataIndex: number }).dataIndex];
        if (!block) return '';
        const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:${STAGE_COLORS[block.stage]}"></span>`;
        return `${dot}<b>${t(`stages.${block.stage}`)}</b><br/>${clock(block.from)} – ${clock(block.to)} · ${t('units.minutes', { value: block.minutes })}`;
      },
    },
    xAxis: {
      type: 'time',
      min: blocks[0].from,
      max: last.to,
      axisLine: { lineStyle: { color: colors.lineStrong } },
      splitLine: { show: true, lineStyle: { color: colors.line, type: 'dashed' } },
      axisLabel: { color: colors.textFaint, fontSize: 11, formatter: (value: number) => clock(value) },
    },
    yAxis: {
      type: 'category',
      data: AXIS_STAGES.map((stage) => t(`stages.${stage}`)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: colors.textSoft, fontSize: 11.5 },
      splitLine: { show: true, lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        step: 'end',
        silent: true,
        symbol: 'none',
        lineStyle: { color: colors.lineStrong, width: 1 },
        data: [...blocks.map((block) => [block.from, block.row]), [last.to, last.row]],
        z: 1,
      },
      {
        type: 'custom',
        renderItem: renderBlock,
        encode: { x: [0, 1], y: 2 },
        data: blocks.map((block, index) => [block.from, block.to, block.row, index]),
        z: 2,
      },
    ],
  };

  return <EChart option={option} height={220} />;
};

export default Sleep_Hypnogram;
