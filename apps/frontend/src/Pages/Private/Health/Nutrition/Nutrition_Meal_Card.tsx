import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { BASE_URL } from '../../../../config/urls';
import { End_Points } from '../../../../Service/endPoints';
import type { Meal, MealEstimate, MealPayload, MealType } from '../../../../Hooks/Health/healthLogTypes';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import Nutrition_Estimate_Result from './Nutrition_Estimate_Result';
import Nutrition_Photo_Field from './Nutrition_Photo_Field';
import { MEAL_TYPES, mealTypeForHour, numberField, parseDecimal, roundOne } from './nutritionFormat';

interface Nutrition_Meal_Card_Props {
  editing: Meal | null;
  saving: boolean;
  estimating: boolean;
  onEstimate: (text: string, photo: File | null) => Promise<{ estimate: MealEstimate | null; error: string | null }>;
  onSave: (payload: MealPayload, options: { id?: string; photo?: File | null }) => Promise<string | null>;
  onCancel: () => void;
}

type MacroField = 'kcal' | 'proteinG' | 'carbsG' | 'fatG';

const MACRO_LIMITS: Record<MacroField, number> = { kcal: 10000, proteinG: 1000, carbsG: 1000, fatG: 1000 };

const MACRO_FIELDS: MacroField[] = ['kcal', 'proteinG', 'carbsG', 'fatG'];

const Nutrition_Meal_Card = ({ editing, saving, estimating, onEstimate, onSave, onCancel }: Nutrition_Meal_Card_Props) => {
  const { t } = useTranslation('health');
  const start = editing ? new Date(editing.at) : new Date();
  const [mealType, setMealType] = useState<MealType>(editing?.mealType ?? mealTypeForHour(start.getHours()));
  const [date, setDate] = useState(dateInput(start));
  const [time, setTime] = useState(timeInput(start));
  const [text, setText] = useState(editing?.text ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [macros, setMacros] = useState<Record<MacroField, string>>({
    kcal: numberField(editing?.kcal),
    proteinG: numberField(editing?.proteinG),
    carbsG: numberField(editing?.carbsG),
    fatG: numberField(editing?.fatG),
  });
  const [estimated, setEstimated] = useState(editing?.estimated ?? false);
  const [estimate, setEstimate] = useState<MealEstimate | null>(null);
  const [error, setError] = useState('');

  const at = new Date(`${date}T${time}`);
  const parsed = Object.fromEntries(MACRO_FIELDS.map((field) => [field, parseDecimal(macros[field])])) as Record<MacroField, number | null>;
  const macrosValid = MACRO_FIELDS.every((field) => {
    const value = parsed[field];
    return value == null || (!Number.isNaN(value) && value >= 0 && value <= MACRO_LIMITS[field]);
  });
  const canEstimate = !estimating && !saving && text.trim().length > 0;
  const canSave = !saving && !estimating && text.trim().length > 0 && !Number.isNaN(at.getTime()) && macrosValid;
  const savedPhotoUrl = editing?.hasPhoto ? `${BASE_URL}${End_Points.Health_Meal_Photo_Endpoint(editing.id)}` : null;

  const handlePhoto = (file: File | null) => {
    setPhoto(file);
    setPhotoPreview(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleMacro = (field: MacroField, value: string) => {
    setMacros((current) => ({ ...current, [field]: value }));
    setEstimated(false);
    setError('');
  };

  const handleEstimate = async () => {
    if (!canEstimate) return;
    setError('');
    const result = await onEstimate(text.trim(), photo);
    if (result.error || !result.estimate) {
      setError(result.error ?? '');
      return;
    }
    setEstimate(result.estimate);
    setMacros({
      kcal: numberField(result.estimate.kcal),
      proteinG: numberField(result.estimate.proteinG),
      carbsG: numberField(result.estimate.carbsG),
      fatG: numberField(result.estimate.fatG),
    });
    setEstimated(true);
  };

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave(
      {
        at: at.toISOString(),
        timeZone: browserTimeZone(at),
        mealType,
        text: text.trim(),
        kcal: parsed.kcal == null ? null : Math.round(parsed.kcal),
        proteinG: parsed.proteinG == null ? null : roundOne(parsed.proteinG),
        carbsG: parsed.carbsG == null ? null : roundOne(parsed.carbsG),
        fatG: parsed.fatG == null ? null : roundOne(parsed.fatG),
        estimated,
      },
      { id: editing?.id, photo },
    );
    if (failure) {
      setError(failure);
      return;
    }
    if (editing) {
      onCancel();
      return;
    }
    const now = new Date();
    setError('');
    setText('');
    setPhoto(null);
    setPhotoPreview(null);
    setMacros({ kcal: '', proteinG: '', carbsG: '', fatG: '' });
    setEstimated(false);
    setEstimate(null);
    setDate(dateInput(now));
    setTime(timeInput(now));
    setMealType(mealTypeForHour(now.getHours()));
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{editing ? t('nutrition.editTitle') : t('nutrition.addTitle')}</span>
          <p className='Health_card_description'>{t('nutrition.addDescription')}</p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {MEAL_TYPES.map((option) => (
          <button key={option} type='button' className={option === mealType ? 'active' : ''} onClick={() => setMealType(option)}>
            {t(`nutrition.mealTypes.${option}`)}
          </button>
        ))}
      </div>

      <div className='Health_Form nutrition-when'>
        <div className='Health_Form_Field'>
          <label htmlFor='meal-date'>{t('nutrition.date')}</label>
          <Global_Input id='meal-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='meal-time'>{t('nutrition.time')}</label>
          <Global_Input id='meal-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Nutrition_Photo_Field preview={photoPreview ?? savedPhotoUrl} fileName={photo?.name ?? null} onPhoto={handlePhoto} />
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='meal-text'>{t('nutrition.text')}</label>
        <textarea
          id='meal-text'
          className='Diary_Text'
          rows={3}
          maxLength={2000}
          value={text}
          placeholder={t('nutrition.textPlaceholder')}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
        />
      </div>

      <div className='Nutrition_Estimate_Action'>
        <button type='button' className='Health_see_all' disabled={!canEstimate} onClick={() => void handleEstimate()}>
          {estimating ? t('nutrition.estimating') : t('nutrition.estimate')}
        </button>
        <span>{t('nutrition.estimateHint')}</span>
      </div>

      {estimate && <Nutrition_Estimate_Result estimate={estimate} />}

      <div className='Health_Form nutrition-macros'>
        {MACRO_FIELDS.map((field) => (
          <div key={field} className='Health_Form_Field'>
            <label htmlFor={`meal-${field}`}>{t(`nutrition.fields.${field}`)}</label>
            <Global_Input
              id={`meal-${field}`}
              type='number'
              min='0'
              max={String(MACRO_LIMITS[field])}
              value={macros[field]}
              onChange={(e) => handleMacro(field, e.target.value)}
            />
          </div>
        ))}
      </div>

      {estimated && <span className='Nutrition_Estimated_Flag'>{t('nutrition.estimatedFlag')}</span>}

      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        {editing && (
          <button type='button' className='Health_see_all' onClick={onCancel}>
            {t('common:actions.cancel')}
          </button>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('nutrition.saving') : t('nutrition.save')}
        </button>
      </div>
    </section>
  );
};

export default Nutrition_Meal_Card;
