import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { DiaryKind } from '../../../../Hooks/Health/healthTypes';
import { DEFAULT_FILTERS, DIARY_KINDS, DIARY_PERIODS, type DiaryFilters } from './diaryFormat';

interface Diary_Filters_Props {
  filters: DiaryFilters;
  today: string;
  onChange: (filters: DiaryFilters) => void;
}

const Diary_Filters = ({ filters, today, onChange }: Diary_Filters_Props) => {
  const { t } = useTranslation('health');
  const update = (changes: Partial<DiaryFilters>) => onChange({ ...filters, ...changes });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  const toggleKind = (kind: DiaryKind) =>
    update({ kinds: filters.kinds.includes(kind) ? filters.kinds.filter((item) => item !== kind) : [...filters.kinds, kind] });

  return (
    <div className='Diary_Filters'>
      <div className='Diary_Filters_Row'>
        <span className='Diary_Filters_Label'>{t('diary.filters.period')}</span>
        <div className='Diary_Kinds'>
          {DIARY_PERIODS.map((period) => (
            <button key={period} type='button' className={filters.period === period ? 'active' : ''} onClick={() => update({ period })}>
              {t(`periods.${period}`)}
            </button>
          ))}
          <button type='button' className={filters.period === 'custom' ? 'active' : ''} onClick={() => update({ period: 'custom' })}>
            {t('diary.filters.custom')}
          </button>
        </div>
        {filters.period === 'custom' && (
          <div className='Diary_Filters_Dates'>
            <Global_Input
              type='date'
              value={filters.from}
              max={filters.to || today}
              onChange={(e) => update({ from: e.target.value })}
            />
            <span>→</span>
            <Global_Input
              type='date'
              value={filters.to}
              min={filters.from}
              max={today}
              onChange={(e) => update({ to: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className='Diary_Filters_Row'>
        <span className='Diary_Filters_Label'>{t('diary.filters.kinds')}</span>
        <div className='Diary_Kinds'>
          <button type='button' className={!filters.kinds.length ? 'active' : ''} onClick={() => update({ kinds: [] })}>
            {t('diary.filters.allKinds')}
          </button>
          {DIARY_KINDS.map((kind) => (
            <button key={kind} type='button' className={filters.kinds.includes(kind) ? 'active' : ''} onClick={() => toggleKind(kind)}>
              {t(`diary.kinds.${kind}`)}
            </button>
          ))}
        </div>
      </div>

      <div className='Diary_Filters_Row'>
        <span className='Diary_Filters_Label'>{t('diary.filters.search')}</span>
        <div className='Diary_Filters_Search'>
          <Global_Input
            value={filters.search}
            placeholder={t('diary.filters.searchPlaceholder')}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>
        {!isDefault && (
          <button type='button' className='Health_see_all' onClick={() => onChange(DEFAULT_FILTERS)}>
            {t('diary.filters.clear')}
          </button>
        )}
      </div>
    </div>
  );
};

export default Diary_Filters;
