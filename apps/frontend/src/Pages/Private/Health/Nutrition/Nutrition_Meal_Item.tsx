import { useTranslation } from 'react-i18next';
import { BASE_URL } from '../../../../config/urls';
import { End_Points } from '../../../../Service/endPoints';
import type { Meal } from '../../../../Hooks/Health/healthLogTypes';
import { localClock } from '../Shared/healthFormat';
import { formatGrams, formatKcal } from './nutritionFormat';

interface Nutrition_Meal_Item_Props {
  meal: Meal;
  confirming: boolean;
  onEdit: (meal: Meal) => void;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Nutrition_Meal_Item = ({ meal, confirming, onEdit, onRemove, onCancelRemove }: Nutrition_Meal_Item_Props) => {
  const { t } = useTranslation('health');
  const photoUrl = `${BASE_URL}${End_Points.Health_Meal_Photo_Endpoint(meal.id)}`;

  return (
    <div className='Nutrition_Meal'>
      {meal.hasPhoto && (
        <a className='Nutrition_Meal_Photo' href={photoUrl} target='_blank' rel='noreferrer'>
          <img src={photoUrl} alt={t('nutrition.photoAlt')} loading='lazy' />
        </a>
      )}
      <div className='Nutrition_Meal_Body'>
        <div className='Diary_Entry_Head'>
          <em>{localClock(meal.at, meal.timeZone)}</em>
          <span className='Diary_Kind'>{t(`nutrition.mealTypes.${meal.mealType}`)}</span>
          <span className='Nutrition_Meal_Kcal'>{formatKcal(meal.kcal)}</span>
          {meal.estimated && <span className='Nutrition_Meal_Estimated'>{t('nutrition.estimatedShort')}</span>}
          <span className='Diary_Entry_Actions'>
            <button type='button' className='Health_see_all' onClick={() => onEdit(meal)}>
              {t('nutrition.edit')}
            </button>
            <button
              type='button'
              className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
              onClick={() => onRemove(meal.id)}
              onBlur={onCancelRemove}
            >
              {confirming ? t('nutrition.confirmRemove') : t('nutrition.remove')}
            </button>
          </span>
        </div>
        <p>{meal.text}</p>
        {(meal.proteinG != null || meal.carbsG != null || meal.fatG != null) && (
          <span className='Nutrition_Meal_Macros'>
            {t('nutrition.macrosLine', { protein: formatGrams(meal.proteinG), carbs: formatGrams(meal.carbsG), fat: formatGrams(meal.fatG) })}
          </span>
        )}
      </div>
    </div>
  );
};

export default Nutrition_Meal_Item;
