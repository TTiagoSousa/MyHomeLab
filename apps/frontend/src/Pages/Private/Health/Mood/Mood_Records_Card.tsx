import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import Mood_Filters from './Mood_Filters';
import Mood_Record_Row from './Mood_Record_Row';
import { DEFAULT_MOOD_FILTERS, filterMoods } from './moodFormat';

interface Mood_Records_Card_Props {
  moods: MoodEntry[];
  selectedDay: string;
  onEdit: (day: string) => void;
  onRemove: (day: string) => void;
}

const Mood_Records_Card = ({ moods, selectedDay, onEdit, onRemove }: Mood_Records_Card_Props) => {
  const { t } = useTranslation('health');
  const [filters, setFilters] = useState(DEFAULT_MOOD_FILTERS);
  const [confirmDay, setConfirmDay] = useState<string | null>(null);
  const visible = filterMoods(moods, filters);

  const handleRemove = (day: string) => {
    if (confirmDay !== day) {
      setConfirmDay(day);
      return;
    }
    setConfirmDay(null);
    onRemove(day);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('mood.records.title')}</span>
          <p className='Health_card_description'>{t('mood.records.description')}</p>
        </div>
        {moods.length > 0 && <span className='Mood_Records_Count'>{t('mood.records.count', { count: visible.length })}</span>}
      </div>

      {!moods.length ? (
        <span className='Health_chart_empty'>{t('mood.records.empty')}</span>
      ) : (
        <>
          <Mood_Filters filters={filters} onChange={setFilters} />
          {visible.length ? (
            <div className='Mood_Records'>
              {visible.map((entry) => (
                <Mood_Record_Row
                  key={entry.day}
                  entry={entry}
                  selected={entry.day === selectedDay}
                  confirming={confirmDay === entry.day}
                  onEdit={() => onEdit(entry.day)}
                  onRemove={() => handleRemove(entry.day)}
                  onCancelRemove={() => setConfirmDay(null)}
                />
              ))}
            </div>
          ) : (
            <span className='Health_chart_empty'>{t('mood.records.noMatch')}</span>
          )}
        </>
      )}
    </section>
  );
};

export default Mood_Records_Card;
