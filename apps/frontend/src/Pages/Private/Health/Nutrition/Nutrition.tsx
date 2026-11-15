import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Nutrition.scss';
import { useNutrition } from '../../../../Hooks/Health/useNutrition';
import type { Meal } from '../../../../Hooks/Health/healthLogTypes';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import Nutrition_Meal_Card from './Nutrition_Meal_Card';
import Nutrition_Today_Card from './Nutrition_Today_Card';
import Nutrition_Average_Tiles from './Nutrition_Average_Tiles';
import Nutrition_Kcal_Chart from './Nutrition_Kcal_Chart';
import Nutrition_Days_Panel from './Nutrition_Days_Panel';

const Nutrition = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const [editing, setEditing] = useState<Meal | null>(null);
  const { data, loading, saving, estimating, error, estimateMeal, saveMeal, removeMeal } = useNutrition(days);
  const todayKey = dateInput(new Date());
  const today = data?.days.find((day) => day.day === todayKey) ?? null;
  const hasMeals = Boolean(data?.meals.length);

  const handleEdit = (meal: Meal) => {
    setEditing(meal);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('nutrition.title')} days={days} onDays={setDays} />

      <Nutrition_Meal_Card
        key={editing?.id ?? 'new'}
        editing={editing}
        saving={saving}
        estimating={estimating}
        onEstimate={estimateMeal}
        onSave={saveMeal}
        onCancel={() => setEditing(null)}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {data && <Nutrition_Today_Card today={today} />}

      {!loading && !error && data && !data.days.length && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('nutrition.emptyTitle')}</span>
          <span>{t('nutrition.emptyText')}</span>
        </div>
      )}

      {data && hasMeals && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('averages.title')}</span>
              <p className='Health_card_description'>{t('nutrition.averagesDescription', { count: data.averages.days })}</p>
            </div>
          </div>
          <Nutrition_Average_Tiles averages={data.averages} />
        </section>
      )}

      {data && hasMeals && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('nutrition.trendTitle')}</span>
              <p className='Health_card_description'>{t('nutrition.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Nutrition_Kcal_Chart nutritionDays={data.days} />
          </Error_Boundary>
        </section>
      )}

      {data && data.days.length > 0 && (
        <Nutrition_Days_Panel nutritionDays={data.days} meals={data.meals} onEdit={handleEdit} onRemove={(id) => void removeMeal(id)} />
      )}
    </div>
  );
};

export default Nutrition;
