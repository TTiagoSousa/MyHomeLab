import { useTranslation } from 'react-i18next';
import type { EChartsOption } from 'echarts';
import EChart from '../../../../Components/Charts/EChart/EChart';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { NutritionDay } from '../../../../Hooks/Health/healthLogTypes';
import { colorDot, formatDay } from '../Shared/healthFormat';
import { NUTRITION_COLORS, formatGrams, formatKcal } from './nutritionFormat';

interface Nutrition_Kcal_Chart_Props {
  nutritionDays: NutritionDay[];
}

const VISIBLE_DAYS = 45;

const Nutrition_Kcal_Chart = ({ nutritionDays }: Nutrition_Kcal_Chart_Props) => {
  const { t } = useTranslation('health');
  const colors = useChartColors();
  const days = nutritionDays.filter((day) => day.meals > 0).reverse();
  if (!days.length) return null;

  const option: EChartsOption = {
    grid: { left: 52, right: 12, top: 14, bottom: 30 },
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
          `${colorDot(NUTRITION_COLORS.kcal)}${t('nutrition.series.kcal')}: <b>${formatKcal(day.kcal)}</b>`,
          `${colorDot(NUTRITION_COLORS.protein)}${t('nutrition.fields.proteinG')}: ${formatGrams(day.proteinG)}`,
          `${colorDot(NUTRITION_COLORS.carbs)}${t('nutrition.fields.carbsG')}: ${formatGrams(day.carbsG)}`,
          `${colorDot(NUTRITION_COLORS.fat)}${t('nutrition.fields.fatG')}: ${formatGrams(day.fatG)}`,
          t('nutrition.mealsCount', { count: day.meals }),
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
      axisLabel: { color: colors.textFaint, fontSize: 10.5 },
      splitLine: { lineStyle: { color: colors.line, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        name: t('nutrition.series.kcal'),
        barMaxWidth: 18,
        data: days.map((day) => ({
          value: day.kcal,
          itemStyle: { color: NUTRITION_COLORS.kcal, opacity: 0.8, borderRadius: [3, 3, 0, 0] },
        })),
      },
    ],
  };

  return <EChart option={option} height={240} />;
};

export default Nutrition_Kcal_Chart;
