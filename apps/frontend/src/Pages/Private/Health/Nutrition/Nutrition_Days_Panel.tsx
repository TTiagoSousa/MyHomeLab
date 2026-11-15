import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal, NutritionDay } from '../../../../Hooks/Health/healthLogTypes';
import Nutrition_Day_Item from './Nutrition_Day_Item';
import { mealsByDay } from './nutritionFormat';

interface Nutrition_Days_Panel_Props {
  nutritionDays: NutritionDay[];
  meals: Meal[];
  onEdit: (meal: Meal) => void;
  onRemove: (id: string) => void;
}

const INITIAL_DAYS = 14;

const Nutrition_Days_Panel = ({ nutritionDays, meals, onEdit, onRemove }: Nutrition_Days_Panel_Props) => {
  const { t } = useTranslation('health');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const grouped = mealsByDay(meals);
  const visible = showAll ? nutritionDays : nutritionDays.slice(0, INITIAL_DAYS);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    onRemove(id);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('nutrition.days', { count: nutritionDays.length })}</span>
          <p className='Health_card_description'>{t('nutrition.daysDescription')}</p>
        </div>
        {nutritionDays.length > INITIAL_DAYS && (
          <button type='button' className='Health_see_all' onClick={() => setShowAll(!showAll)}>
            {showAll ? t('nutrition.showLess') : t('nutrition.showAll')}
          </button>
        )}
      </div>

      <div className='Nutrition_Days'>
        {visible.map((day) => (
          <Nutrition_Day_Item
            key={day.day}
            day={day}
            meals={grouped.get(day.day) ?? []}
            confirmId={confirmId}
            onEdit={onEdit}
            onRemove={handleRemove}
            onCancelRemove={() => setConfirmId(null)}
          />
        ))}
      </div>
    </section>
  );
};

export default Nutrition_Days_Panel;
