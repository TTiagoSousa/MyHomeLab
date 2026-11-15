import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { BodyMeasurement, BodyMeasurementPayload } from '../../../../Hooks/Health/healthLogTypes';
import { dateInput } from '../Shared/healthFormat';
import { MEASUREMENT_FIELDS, numberText, parseNumber, type MeasurementField } from './bodyFormat';

interface Body_Measurements_Card_Props {
  measurements: BodyMeasurement[];
  saving: boolean;
  onSave: (payload: BodyMeasurementPayload) => Promise<string | null>;
}

type FieldTexts = Record<MeasurementField, string>;

const textsOf = (row: BodyMeasurement | undefined) =>
  Object.fromEntries(MEASUREMENT_FIELDS.map(({ key }) => [key, numberText(row?.[key])])) as FieldTexts;

const Body_Measurements_Card = ({ measurements, saving, onSave }: Body_Measurements_Card_Props) => {
  const { t } = useTranslation('health');
  const today = dateInput(new Date());
  const rowOf = (day: string) => measurements.find((row) => row.day === day);
  const [day, setDay] = useState(today);
  const [texts, setTexts] = useState<FieldTexts>(textsOf(rowOf(today)));
  const [notes, setNotes] = useState(rowOf(today)?.notes ?? '');
  const [error, setError] = useState('');

  const existing = rowOf(day);
  const values = MEASUREMENT_FIELDS.map(({ key, max }) => ({ key, value: parseNumber(texts[key]), max }));
  const invalid = values.some(({ value, max }) => value != null && (Number.isNaN(value) || value <= 0 || value > max));
  const filled = values.some(({ value }) => value != null);
  const canSave = !saving && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today && filled && !invalid;

  const pickDay = (next: string) => {
    setDay(next);
    setTexts(textsOf(rowOf(next)));
    setNotes(rowOf(next)?.notes ?? '');
    setError('');
  };

  const handleSave = async () => {
    if (!canSave) return;
    const fields = Object.fromEntries(values.map(({ key, value }) => [key, value])) as Record<MeasurementField, number | null>;
    const failure = await onSave({ day, ...fields, notes: notes.trim() || null });
    setError(failure ?? '');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{existing ? t('body.measurements.editTitle') : t('body.measurements.addTitle')}</span>
          <p className='Health_card_description'>{t('body.measurements.addDescription')}</p>
        </div>
      </div>

      <div className='Health_Form Body_Form'>
        <div className='Health_Form_Field'>
          <label htmlFor='body-day'>{t('body.date')}</label>
          <Global_Input id='body-day' type='date' value={day} max={today} onChange={(e) => pickDay(e.target.value)} />
        </div>
        {MEASUREMENT_FIELDS.map(({ key, unit }) => (
          <div key={key} className='Health_Form_Field'>
            <label htmlFor={`body-${key}`}>{t('body.measurements.fieldWithUnit', { field: t(`body.fields.${key}`), unit })}</label>
            <Global_Input
              id={`body-${key}`}
              value={texts[key]}
              placeholder='—'
              onChange={(e) => {
                setTexts({ ...texts, [key]: e.target.value });
                setError('');
              }}
            />
          </div>
        ))}
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='body-notes'>{t('body.notes')}</label>
        <textarea
          id='body-notes'
          className='Diary_Text'
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder={t('body.measurements.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {invalid && <p className='Health_Form_Error'>{t('body.measurements.invalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('body.saving') : existing ? t('body.measurements.update') : t('body.save')}
        </button>
      </div>
    </section>
  );
};

export default Body_Measurements_Card;
