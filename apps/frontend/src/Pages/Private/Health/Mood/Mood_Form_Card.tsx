import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { MoodEntry, MoodPayload } from '../../../../Hooks/Health/healthLogTypes';
import { formatDay } from '../Shared/healthFormat';
import Mood_Scale_Picker from './Mood_Scale_Picker';
import { MOOD_FIELDS, type MoodField } from './moodFormat';

interface Mood_Form_Card_Props {
  day: string;
  isToday: boolean;
  maxDay: string;
  entry: MoodEntry | null;
  saving: boolean;
  onDay: (day: string) => void;
  onSave: (day: string, payload: MoodPayload) => Promise<string | null>;
  onRemove: (day: string) => void;
}

const Mood_Form_Card = ({ day, isToday, maxDay, entry, saving, onDay, onSave, onRemove }: Mood_Form_Card_Props) => {
  const { t } = useTranslation('health');
  const [values, setValues] = useState<Record<MoodField, number>>({
    mood: entry?.mood ?? 0,
    energy: entry?.energy ?? 0,
    motivation: entry?.motivation ?? 0,
  });
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const canSave = !saving && MOOD_FIELDS.every((field) => values[field] > 0);

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave(day, { ...values, note: note.trim() || null });
    setError(failure ?? '');
  };

  const handleRemove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onRemove(day);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{isToday ? t('mood.form.todayTitle') : formatDay(day)}</span>
          <p className='Health_card_description'>{entry ? t('mood.form.editDescription') : t('mood.form.description')}</p>
        </div>
        <div className='Water_Day_Picker'>
          <label htmlFor='mood-day'>{t('mood.form.day')}</label>
          <Global_Input
            id='mood-day'
            type='date'
            value={day}
            max={maxDay}
            onChange={(e) => {
              if (e.target.value) onDay(e.target.value);
            }}
          />
        </div>
      </div>

      <div className='Mood_Scales'>
        {MOOD_FIELDS.map((field) => (
          <Mood_Scale_Picker
            key={field}
            field={field}
            value={values[field]}
            onChange={(value) => setValues({ ...values, [field]: value })}
          />
        ))}
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='mood-note'>{t('mood.form.note')}</label>
        <textarea
          id='mood-note'
          className='Diary_Text'
          rows={3}
          maxLength={2000}
          value={note}
          placeholder={t('mood.form.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        {entry && (
          <button
            type='button'
            className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
            onClick={handleRemove}
            onBlur={() => setConfirming(false)}
          >
            {confirming ? t('mood.confirmRemove') : t('mood.remove')}
          </button>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('mood.saving') : t('mood.save')}
        </button>
      </div>
    </section>
  );
};

export default Mood_Form_Card;
