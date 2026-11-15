import { useTranslation } from 'react-i18next';
import type { NutritionData } from '../../../../Hooks/Health/healthLogTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatGrams, formatKcal } from './nutritionFormat';

interface Nutrition_Average_Tiles_Props {
  averages: NutritionData['averages'];
}

const Nutrition_Average_Tiles = ({ averages }: Nutrition_Average_Tiles_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('nutrition.metrics.avgKcal')}
          value={formatKcal(averages.kcal)}
          sub={t('nutrition.metrics.daysWithMeals', { count: averages.days })}
        />
        <Health_Stat
          label={t('nutrition.metrics.avgMacros')}
          value={formatGrams(averages.proteinG)}
          sub={t('nutrition.metrics.macrosSub', { carbs: formatGrams(averages.carbsG), fat: formatGrams(averages.fatG) })}
        />
        <Health_Stat label={t('nutrition.metrics.avgCaffeine')} value={averages.caffeineMg == null ? '—' : `${Math.round(averages.caffeineMg)} mg`} />
        <Health_Stat label={t('nutrition.metrics.avgAlcohol')} value={averages.alcoholUnits == null ? '—' : t('nutrition.alcoholUnits', { count: averages.alcoholUnits })} />
      </div>
    </div>
  );
};

export default Nutrition_Average_Tiles;
