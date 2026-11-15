import { useTranslation } from 'react-i18next';
import type { MealEstimate } from '../../../../Hooks/Health/healthLogTypes';
import { formatKcal } from './nutritionFormat';

interface Nutrition_Estimate_Result_Props {
  estimate: MealEstimate;
}

const Nutrition_Estimate_Result = ({ estimate }: Nutrition_Estimate_Result_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Nutrition_Estimate'>
      <span className='Nutrition_Estimate_Title'>{t('nutrition.estimateTitle')}</span>
      {estimate.items.length > 0 && (
        <ul className='Nutrition_Estimate_Items'>
          {estimate.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <span>{item.portion ? `${item.name} · ${item.portion}` : item.name}</span>
              <em>{formatKcal(item.kcal)}</em>
            </li>
          ))}
        </ul>
      )}
      {estimate.note && <p className='Nutrition_Estimate_Note'>{estimate.note}</p>}
    </div>
  );
};

export default Nutrition_Estimate_Result;
