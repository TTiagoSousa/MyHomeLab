import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Medication_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import type { HealthCondition, Medication, MedicationKind, MedicationPayload } from '../../../Hooks/Health/healthTypes';
import { DOSE_UNITS, MEDICATION_KINDS } from '../../../Pages/Private/Health/Medication/medicationFormat';

interface Medication_Modal_Props {
  existing: Medication | null;
  conditions: HealthCondition[];
  saving: boolean;
  onSave: (payload: MedicationPayload) => Promise<string | null>;
  onClose: () => void;
}

const Medication_Modal = ({ existing, conditions, saving, onSave, onClose }: Medication_Modal_Props) => {
  const { t } = useTranslation('health');
  const [kind, setKind] = useState<MedicationKind>(existing?.kind ?? 'MEDICATION');
  const [name, setName] = useState(existing?.name ?? '');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [substance, setSubstance] = useState(existing?.substance ?? '');
  const [doseAmount, setDoseAmount] = useState(existing?.doseAmount != null ? String(existing.doseAmount) : '');
  const [doseUnit, setDoseUnit] = useState(existing?.doseUnit ?? 'mg');
  const [times, setTimes] = useState<string[]>(existing?.times.length ? existing.times : ['08:00']);
  const [timesPerDay, setTimesPerDay] = useState(existing?.timesPerDay != null ? String(existing.timesPerDay) : '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? '');
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const [stillTaking, setStillTaking] = useState(!existing?.endDate);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [conditionId, setConditionId] = useState(existing?.condition?.id ?? '');
  const [error, setError] = useState('');

  const amount = Number(doseAmount.replace(',', '.'));
  const perDay = Number(timesPerDay);
  const validAmount = doseAmount.trim() === '' || (Number.isFinite(amount) && amount >= 0);
  const validPerDay = times.length > 0 || timesPerDay.trim() === '' || (Number.isInteger(perDay) && perDay >= 1 && perDay <= 24);
  const validEnd = stillTaking || endDate !== '';
  const canSave = !saving && name.trim().length > 0 && validAmount && validPerDay && validEnd && times.every((time) => /^\d{2}:\d{2}$/.test(time));

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave({
      kind,
      name: name.trim(),
      brand: brand.trim() || null,
      substance: substance.trim() || null,
      doseAmount: doseAmount.trim() === '' ? null : amount,
      doseUnit,
      times,
      timesPerDay: times.length ? times.length : timesPerDay.trim() === '' ? null : perDay,
      startDate: startDate || null,
      endDate: stillTaking ? null : endDate || null,
      notes: notes.trim() || null,
      conditionId: conditionId || null,
    });
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Medication_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Medication_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Medication_Modal_Head'>
          <span className='Medication_Modal_Title'>{existing ? t('medication.modal.editTitle') : t('medication.modal.title')}</span>
          <span className='Medication_Modal_Subtitle'>{t('medicationStatus.modal.subtitle')}</span>
        </div>

        <div className='Medication_Modal_Kinds' role='radiogroup' aria-label={t('medication.modal.kind')}>
          {MEDICATION_KINDS.map((option) => (
            <button
              key={option}
              type='button'
              role='radio'
              aria-checked={kind === option}
              className={kind === option ? 'active' : ''}
              onClick={() => setKind(option)}
            >
              {t(`medication.kinds.${option}`)}
            </button>
          ))}
        </div>

        <div className='Medication_Modal_Field'>
          <label htmlFor='medication-name'>{t('medication.modal.name')}</label>
          <Global_Input
            id='medication-name'
            value={name}
            placeholder={t(`medication.modal.namePlaceholder.${kind}`)}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className='Medication_Modal_Row'>
          <div className='Medication_Modal_Field'>
            <label htmlFor='medication-substance'>{t('medication.modal.substance')}</label>
            <Global_Input
              id='medication-substance'
              value={substance}
              placeholder={t(`medication.modal.substancePlaceholder.${kind}`)}
              onChange={(e) => setSubstance(e.target.value)}
            />
          </div>
          <div className='Medication_Modal_Field'>
            <label htmlFor='medication-brand'>{t('medication.modal.brand')}</label>
            <Global_Input
              id='medication-brand'
              value={brand}
              placeholder={t('medication.modal.brandPlaceholder')}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
        </div>

        <div className='Medication_Modal_Field'>
          <label htmlFor='medication-condition'>{t('medication.modal.condition')}</label>
          <Global_Dropdown
            id='medication-condition'
            value={conditionId}
            onChange={setConditionId}
            maxVisibleOptions={8}
            options={[
              { value: '', label: t('medication.modal.noCondition') },
              ...conditions.map((condition) => ({
                value: condition.id,
                label: `${condition.name} · ${t(`conditions.kinds.${condition.kind}`)}`,
              })),
            ]}
          />
          <small className='Medication_Modal_Hint'>
            {conditions.length ? t('medication.modal.conditionHint') : t('medication.modal.noConditionsHint')}
          </small>
        </div>

        <div className='Medication_Modal_Row'>
          <div className='Medication_Modal_Field'>
            <label htmlFor='medication-dose'>{t('medication.modal.dose')}</label>
            <Global_Input id='medication-dose' value={doseAmount} placeholder='1' onChange={(e) => setDoseAmount(e.target.value)} />
          </div>
          <div className='Medication_Modal_Field'>
            <label htmlFor='medication-unit'>{t('medication.modal.unit')}</label>
            <Global_Dropdown
              id='medication-unit'
              value={doseUnit}
              onChange={setDoseUnit}
              maxVisibleOptions={8}
              options={DOSE_UNITS.map((unit) => ({ value: unit, label: t(`medication.units.${unit}`) }))}
            />
          </div>
        </div>

        <div className='Medication_Modal_Times'>
          <div className='Medication_Modal_Section'>
            <span>{t('medication.modal.times')}</span>
            <small>{t('medication.modal.timesHint')}</small>
          </div>
          <div className='Medication_Modal_Time_List'>
            {times.map((time, index) => (
              <div key={index} className='Medication_Modal_Time'>
                <Global_Input
                  type='time'
                  value={time}
                  onChange={(e) => setTimes(times.map((value, position) => (position === index ? e.target.value : value)))}
                />
                <button
                  type='button'
                  aria-label={t('medication.modal.removeTime')}
                  title={t('medication.modal.removeTime')}
                  onClick={() => setTimes(times.filter((_, position) => position !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            <button type='button' className='Medication_Modal_Add' onClick={() => setTimes([...times, '20:00'])}>
              {t('medication.modal.addTime')}
            </button>
          </div>
          {!times.length && (
            <div className='Medication_Modal_Field'>
              <label htmlFor='medication-per-day'>{t('medication.modal.timesPerDay')}</label>
              <Global_Input id='medication-per-day' type='number' value={timesPerDay} placeholder='1' onChange={(e) => setTimesPerDay(e.target.value)} />
            </div>
          )}
        </div>

        <div className='Medication_Modal_Status' role='radiogroup' aria-label={t('medicationStatus.modal.status')}>
          <button
            type='button'
            role='radio'
            aria-checked={stillTaking}
            className={stillTaking ? 'active' : ''}
            onClick={() => setStillTaking(true)}
          >
            {t('medicationStatus.modal.stillTaking')}
          </button>
          <button
            type='button'
            role='radio'
            aria-checked={!stillTaking}
            className={stillTaking ? '' : 'active'}
            onClick={() => setStillTaking(false)}
          >
            {t('medicationStatus.modal.stoppedTaking')}
          </button>
        </div>

        <div className='Medication_Modal_Row'>
          <div className='Medication_Modal_Field'>
            <label htmlFor='medication-start'>{t('medicationStatus.modal.startedOn')}</label>
            <Global_Input id='medication-start' type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {!stillTaking && (
            <div className='Medication_Modal_Field'>
              <label htmlFor='medication-end'>{t('medicationStatus.modal.stoppedOn')}</label>
              <Global_Input id='medication-end' type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          )}
        </div>

        <div className='Medication_Modal_Field'>
          <label htmlFor='medication-notes'>{t('medication.modal.notes')}</label>
          <textarea
            id='medication-notes'
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder={t('medication.modal.notesPlaceholder')}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className='Medication_Modal_Error'>{error}</p>}

        <div className='Medication_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('medication.modal.saving') : t('medication.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Medication_Modal;
