import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { IntakeEntry, IntakeKind, IntakePayload, IntakeValues } from '../../../../Hooks/Health/intakesTypes';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import Intakes_Values_Fields from './Intakes_Values_Fields';
import { INTAKE_KINDS, parseDecimal, roundTo, valuesLabel } from './intakesFormat';
import { EMPTY_VALUES_FORM, parseValues, valuesForm, type IntakeValuesForm } from './intakesForm';

export interface IntakeSource {
  kind: IntakeKind;
  presetId: string | null;
  itemId: string | null;
  label: string;
  dose: IntakeValues & { abv?: number | null };
}

interface Intakes_Entry_Form_Props {
  entry?: IntakeEntry | null;
  source?: IntakeSource | null;
  itemIds: string[];
  saving: boolean;
  onSave: (payload: IntakePayload, id?: string) => Promise<string | null>;
  onCancel: () => void;
}

const scaled = (value: number | null, quantity: number, digits: number) => (value == null ? null : roundTo(value * quantity, digits));

const Intakes_Entry_Form = ({ entry, source, itemIds, saving, onSave, onCancel }: Intakes_Entry_Form_Props) => {
  const { t } = useTranslation('health');
  const start = entry ? new Date(entry.at) : new Date();
  const idPrefix = `intake-${entry?.id ?? source?.presetId ?? source?.itemId ?? 'custom'}`;
  const linkedItem = entry?.itemId && itemIds.includes(entry.itemId) ? entry.itemId : null;
  const linked = Boolean(entry?.presetId || linkedItem);
  const isCustom = !source && !linked;
  const [kind, setKind] = useState<IntakeKind>(entry?.kind ?? source?.kind ?? 'CAFFEINE');
  const [name, setName] = useState(entry && !linked ? entry.name : '');
  const [quantity, setQuantity] = useState(String(entry?.quantity ?? 1));
  const [date, setDate] = useState(dateInput(start));
  const [time, setTime] = useState(timeInput(start));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [values, setValues] = useState<IntakeValuesForm>(entry ? valuesForm(entry) : EMPTY_VALUES_FORM);
  const [valuesTouched, setValuesTouched] = useState(false);
  const [error, setError] = useState('');

  const at = new Date(`${date}T${time}`);
  const quantityValue = parseDecimal(quantity);
  const validQuantity = quantityValue != null && !Number.isNaN(quantityValue) && quantityValue >= 0.25 && quantityValue <= 50;
  const parsed = parseValues(kind, values);
  const showValues = !source;
  const showQuantity = Boolean(entry || source);
  const canSave =
    !saving &&
    !Number.isNaN(at.getTime()) &&
    (!showQuantity || validQuantity) &&
    (!showValues || parsed.valid) &&
    (!isCustom || name.trim().length > 0);
  const preview =
    source && validQuantity && quantityValue != null
      ? valuesLabel(source.kind, {
          volumeMl: scaled(source.dose.volumeMl, quantityValue, 0),
          caffeineMg: scaled(source.dose.caffeineMg, quantityValue, 1),
          alcoholG: scaled(source.dose.alcoholG, quantityValue, 1),
        })
      : '';

  const handleValue = (field: keyof IntakeValuesForm, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setValuesTouched(true);
    setError('');
  };

  const buildPayload = (): IntakePayload => {
    const payload: IntakePayload = {
      at: at.toISOString(),
      timeZone: browserTimeZone(at),
      notes: notes.trim() || null,
    };
    if (showQuantity && quantityValue != null) payload.quantity = roundTo(quantityValue, 2);
    if (source) {
      if (source.presetId) payload.presetId = source.presetId;
      if (source.itemId) payload.itemId = source.itemId;
      return payload;
    }
    if (entry?.presetId) payload.presetId = entry.presetId;
    else if (linkedItem) payload.itemId = linkedItem;
    else {
      payload.kind = kind;
      payload.name = name.trim();
    }
    if (isCustom || valuesTouched) Object.assign(payload, parsed.values);
    return payload;
  };

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave(buildPayload(), entry?.id);
    if (failure) {
      setError(failure);
      return;
    }
    onCancel();
  };

  return (
    <div className='Intakes_Entry_Form'>
      {source && <span className='Intakes_Entry_Form_Title'>{source.label}</span>}

      {!entry && isCustom && (
        <div className='Diary_Kinds'>
          {INTAKE_KINDS.map((option) => (
            <button key={option} type='button' className={option === kind ? 'active' : ''} onClick={() => setKind(option)}>
              {t(`intakes.kinds.${option}`)}
            </button>
          ))}
        </div>
      )}

      <div className='Health_Form intakes-form'>
        {isCustom && (
          <div className='Health_Form_Field wide'>
            <label htmlFor={`${idPrefix}-name`}>{t('intakes.fields.name')}</label>
            <Global_Input
              id={`${idPrefix}-name`}
              value={name}
              maxLength={80}
              placeholder={t('intakes.fields.namePlaceholder')}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
            />
          </div>
        )}
        {showQuantity && (
          <div className='Health_Form_Field'>
            <label htmlFor={`${idPrefix}-quantity`}>{t('intakes.fields.quantity')}</label>
            <Global_Input
              id={`${idPrefix}-quantity`}
              type='number'
              min='0.25'
              max='50'
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        )}
        <div className='Health_Form_Field'>
          <label htmlFor={`${idPrefix}-date`}>{t('intakes.fields.date')}</label>
          <Global_Input id={`${idPrefix}-date`} type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor={`${idPrefix}-time`}>{t('intakes.fields.time')}</label>
          <Global_Input id={`${idPrefix}-time`} type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {showValues && <Intakes_Values_Fields idPrefix={idPrefix} kind={kind} form={values} onChange={handleValue} />}
        <div className='Health_Form_Field wide'>
          <label htmlFor={`${idPrefix}-notes`}>{t('intakes.fields.notes')}</label>
          <Global_Input id={`${idPrefix}-notes`} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {preview && <span className='Intakes_Preview'>{t('intakes.form.total', { value: preview })}</span>}
      {entry && linked && <span className='Intakes_Preview'>{t('intakes.form.totalsHint')}</span>}
      {showQuantity && !validQuantity && <p className='Health_Form_Error'>{t('intakes.form.quantityInvalid')}</p>}
      {showValues && !parsed.valid && <p className='Health_Form_Error'>{t('intakes.form.valuesInvalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_see_all' onClick={onCancel}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('intakes.saving') : t('intakes.save')}
        </button>
      </div>
    </div>
  );
};

export default Intakes_Entry_Form;
