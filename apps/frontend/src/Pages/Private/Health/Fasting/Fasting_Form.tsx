import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { Fast, FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import { dateInput, timeInput } from '../Shared/healthFormat';
import Fasting_Target_Picker from './Fasting_Target_Picker';
import { FAST_TARGETS } from './fastingFormat';

export type Fasting_Form_Mode = 'start' | 'log' | 'edit';

interface Fasting_Form_Props {
  mode: Fasting_Form_Mode;
  fast: Fast | null;
  defaultTarget: number;
  saving: boolean;
  onSave: (payload: FastPayload) => Promise<string | null>;
  onCancel?: () => void;
}

const Fasting_Form = ({ mode, fast, defaultTarget, saving, onSave, onCancel }: Fasting_Form_Props) => {
  const { t } = useTranslation('health');
  const formId = fast?.id ?? mode;
  const start = fast ? new Date(fast.startAt) : new Date();
  const end = fast?.endAt ? new Date(fast.endAt) : null;
  const initialTarget = fast?.targetHours ?? defaultTarget;
  const [target, setTarget] = useState(FAST_TARGETS.includes(initialTarget) ? initialTarget : 0);
  const [custom, setCustom] = useState(FAST_TARGETS.includes(initialTarget) ? '' : String(initialTarget));
  const [startDate, setStartDate] = useState(dateInput(start));
  const [startTime, setStartTime] = useState(timeInput(start));
  const [endDate, setEndDate] = useState(end ? dateInput(end) : mode === 'log' ? dateInput(start) : '');
  const [endTime, setEndTime] = useState(end ? timeInput(end) : '');
  const [notes, setNotes] = useState(fast?.notes ?? '');
  const [error, setError] = useState('');

  const now = new Date();
  const targetHours = custom.trim() ? Number(custom) : target;
  const startAt = new Date(`${startDate}T${startTime}`);
  const hasEnd = Boolean(endDate && endTime);
  const endAt = hasEnd ? new Date(`${endDate}T${endTime}`) : null;
  const validTarget = Number.isInteger(targetHours) && targetHours >= 1 && targetHours <= 168;
  const validStart = !Number.isNaN(startAt.getTime()) && startAt <= now;
  const validEnd = !endAt || (!Number.isNaN(endAt.getTime()) && endAt > startAt);
  const endInFuture = Boolean(endAt && endAt > now);
  const missingEnd = mode === 'log' && !hasEnd;
  const canSave = !saving && validTarget && validStart && validEnd && !endInFuture && !missingEnd;

  const resetLog = () => {
    setStartTime(timeInput(new Date()));
    setEndTime('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave({
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : null,
      targetHours,
      notes: notes.trim() || null,
    });
    setError(failure ?? '');
    if (failure) return;
    if (mode === 'log') resetLog();
    if (mode === 'edit') onCancel?.();
  };

  const saveLabel = mode === 'start' ? t('fasting.now.start') : mode === 'log' ? t('fasting.log.save') : t('fasting.save');

  return (
    <div className={`Fasting_Form ${mode}`}>
      <Fasting_Target_Picker target={target} custom={custom} onTarget={setTarget} onCustom={setCustom} />

      <div className={`Health_Form Fasting_Form_Times ${mode === 'start' ? 'start-only' : ''}`}>
        <div className='Health_Form_Field'>
          <label htmlFor={`fast-start-date-${formId}`}>{t('fasting.form.startDate')}</label>
          <Global_Input
            id={`fast-start-date-${formId}`}
            type='date'
            value={startDate}
            max={dateInput(now)}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor={`fast-start-time-${formId}`}>{t('fasting.form.startTime')}</label>
          <Global_Input id={`fast-start-time-${formId}`} type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        {mode !== 'start' && (
          <>
            <div className='Health_Form_Field'>
              <label htmlFor={`fast-end-date-${formId}`}>{t('fasting.form.endDate')}</label>
              <Global_Input
                id={`fast-end-date-${formId}`}
                type='date'
                value={endDate}
                min={startDate}
                max={dateInput(now)}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className='Health_Form_Field'>
              <label htmlFor={`fast-end-time-${formId}`}>{t('fasting.form.endTime')}</label>
              <Global_Input id={`fast-end-time-${formId}`} type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor={`fast-notes-${formId}`}>{t('fasting.form.notes')}</label>
        <Global_Input
          id={`fast-notes-${formId}`}
          value={notes}
          maxLength={500}
          placeholder={t('fasting.form.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!validStart && <p className='Health_Form_Error'>{t('fasting.form.startFuture')}</p>}
      {!validEnd && <p className='Health_Form_Error'>{t('fasting.form.endBeforeStart')}</p>}
      {endInFuture && <p className='Health_Form_Error'>{t('fasting.form.endFuture')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        {onCancel && (
          <button type='button' className='Health_see_all' onClick={onCancel}>
            {t('common:actions.cancel')}
          </button>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('fasting.saving') : saveLabel}
        </button>
      </div>
    </div>
  );
};

export default Fasting_Form;
