import { useTranslation } from 'react-i18next';
import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import { formatDay } from '../Shared/healthFormat';
import { MOOD_FIELDS, SCALE_FACES } from './moodFormat';

interface Mood_Record_Row_Props {
  entry: MoodEntry;
  selected: boolean;
  confirming: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
}

const Mood_Record_Row = ({ entry, selected, confirming, onEdit, onRemove, onCancelRemove }: Mood_Record_Row_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className={`Mood_Record level-${entry.mood}${selected ? ' selected' : ''}`}>
      <div className='Mood_Record_Head'>
        <em>{formatDay(entry.day)}</em>
        {MOOD_FIELDS.map((field) => (
          <span key={field} className='Mood_Record_Value' title={`${t(`mood.fields.${field}`)}: ${t(`mood.levels.${entry[field]}`)}`}>
            {SCALE_FACES[field][entry[field] - 1]} <b>{entry[field]}</b>
            <small>{t(`mood.fields.${field}`)}</small>
          </span>
        ))}
        <span className='Diary_Entry_Actions'>
          <button type='button' className='Health_see_all' onClick={onEdit}>
            {t('mood.edit')}
          </button>
          <button
            type='button'
            className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
            onClick={onRemove}
            onBlur={onCancelRemove}
          >
            {confirming ? t('mood.confirmRemove') : t('mood.remove')}
          </button>
        </span>
      </div>
      {entry.note && <p>{entry.note}</p>}
    </div>
  );
};

export default Mood_Record_Row;
