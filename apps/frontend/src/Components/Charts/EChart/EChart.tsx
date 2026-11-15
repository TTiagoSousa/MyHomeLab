import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { DataZoomInsideComponent, GridComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  BarChart,
  CustomChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  DataZoomInsideComponent,
  MarkAreaComponent,
  CanvasRenderer,
]);

interface EChart_Props {
  option: EChartsOption;
  height: number | string;
  className?: string;
  onClick?: (params: { dataIndex: number; seriesIndex: number }) => void;
}

const EChart = ({ option, height, className, onClick }: EChart_Props) => (
  <ReactEChartsCore
    echarts={echarts}
    option={option}
    notMerge
    lazyUpdate
    className={className}
    style={{ height, width: '100%' }}
    opts={{ renderer: 'canvas' }}
    onEvents={onClick ? { click: onClick } : undefined}
  />
);

export default EChart;
