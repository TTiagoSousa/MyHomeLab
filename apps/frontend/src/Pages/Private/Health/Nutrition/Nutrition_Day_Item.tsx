import { useTranslation } from 'react-i18next';
import type { Meal, NutritionDay } from '../../../../Hooks/Health/healthLogTypes';
import { formatDay } from '../Shared/healthFormat';
import Nutrition_Meal_Item from './Nutrition_Meal_Item';
import { formatGrams, formatKcal } from './nutritionFormat';

interface Nutrition_Day_Item_Props {
  day: NutritionDay;
  meals: Meal[];
  confirmId: string | null;
  onEdit: (meal: Meal) => void;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Nutrition_Day_Item = ({ day, meals, confirmId, onEdit, onRemove, onCancelRemove }: Nutrition_Day_Item_Props) => {
  const { t } = useTranslation('health');
  const extras = [
    day.caffeineMg > 0 ? `${t('nutrition.metrics.caffeine')} ${Math.round(day.caffeineMg)} mg` : null,
    day.alcoholUnits > 0 ? `${t('nutrition.metrics.alcohol')} ${t('nutrition.alcoholUnits', { count: day.alcoholUnits })}` : null,
  ].filter(Boolean);

  return (
    <div className='Nutrition_Day'>
      <div className='Nutrition_Day_Head'>
        <span className='Health_Section_Label'>{formatDay(day.day)}</span>
        <em>{formatKcal(day.kcal)}</em>
        <span>{t('nutrition.macrosLine', { protein: formatGrams(day.proteinG), carbs: formatGrams(day.carbsG), fat: formatGrams(day.fatG) })}</span>
      </div>
      {extras.length > 0 && <span className='Nutrition_Day_Extras'>{extras.join(' · ')}</span>}
      {meals.map((meal) => (
        <Nutrition_Meal_Item
          key={meal.id}
          meal={meal}
          confirming={confirmId === meal.id}
          onEdit={onEdit}
          onRemove={onRemove}
          onCancelRemove={onCancelRemove}
        />
      ))}
    </div>
  );
};

export default Nutrition_Day_Item;
