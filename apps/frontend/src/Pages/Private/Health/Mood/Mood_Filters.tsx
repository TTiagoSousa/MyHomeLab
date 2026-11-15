import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { DEFAULT_MOOD_FILTERS, SCALE, SCALE_FACES, type MoodFilters } from './moodFormat';

interface Mood_Filters_Props {
  filters: MoodFilters;
  onChange: (filters: MoodFilters) => void;
}

const Mood_Filters = ({ filters, onChange }: Mood_Filters_Props) => {
  const { t } = useTranslation('health');
  const update = (changes: Partial<MoodFilters>) => onChange({ ...filters, ...changes });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_MOOD_FILTERS);

  return (
    <div className='Diary_Filters'>
      <div className='Diary_Filters_Row'>
        <span className='Diary_Filters_Label'>{t('mood.fields.mood')}</span>
        <div className='Diary_Kinds'>
          <button type='button' className={!filters.mood ? 'active' : ''} onClick={() => update({ mood: 0 })}>
            {t('mood.records.all')}
          </button>
          {SCALE.map((level) => (
            <button
              key={level}
              type='button'
              className={filters.mood === level ? 'active' : ''}
              title={t(`mood.levels.${level}`)}
              onClick={() => update({ mood: level })}
            >
              {SCALE_FACES.mood[level - 1]} {level}
            </button>
          ))}
          <button type='button' className={filters.withNote ? 'active' : ''} onClick={() => update({ withNote: !filters.withNote })}>
            {t('mood.records.withNote')}
          </button>
        </div>
      </div>

      <div className='Diary_Filters_Row'>
        <span className='Diary_Filters_Label'>{t('mood.records.search')}</span>
        <div className='Diary_Filters_Search'>
          <Global_Input
            value={filters.search}
            placeholder={t('mood.records.searchPlaceholder')}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        {!isDefault && (
          <button type='button' className='Health_see_all' onClick={() => onChange(DEFAULT_MOOD_FILTERS)}>
            {t('mood.records.clear')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Mood_Filters;
