import { useTranslation } from 'react-i18next';
import type { NutritionDay } from '../../../../Hooks/Health/healthLogTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatGrams, formatKcal } from './nutritionFormat';

interface Nutrition_Today_Card_Props {
  today: NutritionDay | null;
}

const Nutrition_Today_Card = ({ today }: Nutrition_Today_Card_Props) => {
  const { t } = useTranslation('health');
  const meals = today?.meals ?? 0;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('nutrition.todayTitle')}</span>
          <p className='Health_card_description'>{t('nutrition.todayDescription')}</p>
        </div>
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('nutrition.metrics.kcal')} value={formatKcal(today?.kcal ?? 0)} sub={t('nutrition.mealsCount', { count: meals })} />
        <Health_Stat
          label={t('nutrition.metrics.macros')}
          value={formatGrams(today?.proteinG ?? 0)}
          sub={t('nutrition.metrics.macrosSub', { carbs: formatGrams(today?.carbsG ?? 0), fat: formatGrams(today?.fatG ?? 0) })}
        />
        <Health_Stat
          label={t('nutrition.metrics.caffeine')}
          value={`${Math.round(today?.caffeineMg ?? 0)} mg`}
        />
        <Health_Stat label={t('nutrition.metrics.alcohol')} value={t('nutrition.alcoholUnits', { count: today?.alcoholUnits ?? 0 })} />
      </div>
    </section>
  );
};

export default Nutrition_Today_Card;
