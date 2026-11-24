import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { GlucoseContext, VitalKind, VitalPayload } from '../../../../Hooks/Health/healthLogTypes';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import { GLUCOSE_CONTEXTS, parseNumber } from './bodyFormat';
import { useMeasurementDevices } from '../../../../Hooks/Health/useMeasurementDevices';
import Health_Device_Field, { NO_DEVICE } from '../Shared/Health_Device_Field';
import { VITAL_DEVICE_KIND } from '../Metrics/metricCatalog';

interface Body_Vitals_Card_Props {
  kind: VitalKind;
  saving: boolean;
  onAdd: (payload: VitalPayload) => Promise<string | null>;
}

const inRange = (value: number | null, min: number, max: number) => value != null && value >= min && value <= max;

const Body_Vitals_Card = ({ kind, saving, onAdd }: Body_Vitals_Card_Props) => {
  const { t } = useTranslation('health');
  const now = new Date();
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [pulse, setPulse] = useState('');
  const [context, setContext] = useState<GlucoseContext>('FASTING');
  const [notes, setNotes] = useState('');
  const devices = useMeasurementDevices();
  const [deviceChoice, setDeviceChoice] = useState<string | null>(null);
  const deviceKind = VITAL_DEVICE_KIND[kind];
  const deviceId = deviceChoice ?? devices.defaultOf(deviceKind)?.id ?? NO_DEVICE;
  const [error, setError] = useState('');

  const at = new Date(`${date}T${time}`);
  const main = parseNumber(value);
  const second = parseNumber(value2);
  const pulseValue = parseNumber(pulse);
  const valid =
    kind === 'BLOOD_PRESSURE'
      ? inRange(main, 50, 260) && inRange(second, 30, 180) && (pulseValue == null || inRange(pulseValue, 25, 250))
      : kind === 'GLUCOSE'
        ? inRange(main, 20, 600)
        : inRange(main, 30, 45);
  const canSave = !saving && valid && !Number.isNaN(at.getTime());

  const handleSave = async () => {
    if (!canSave || main == null) return;
    const failure = await onAdd({
      at: at.toISOString(),
      timeZone: browserTimeZone(at),
      kind,
      value: kind === 'TEMPERATURE' ? Math.round(main * 10) / 10 : Math.round(main),
      value2: kind === 'BLOOD_PRESSURE' && second != null ? Math.round(second) : null,
      pulse: kind === 'BLOOD_PRESSURE' && pulseValue != null ? Math.round(pulseValue) : null,
      context: kind === 'GLUCOSE' ? context : null,
      notes: notes.trim() || null,
      deviceId: deviceId === NO_DEVICE ? null : deviceId,
    });
    if (failure) setError(failure);
    else {
      setValue('');
      setValue2('');
      setPulse('');
      setNotes('');
      setError('');
    }
  };

  const numberField = (id: string, label: string, text: string, onChange: (text: string) => void, placeholder: string) => (
    <div className='Health_Form_Field'>
      <label htmlFor={id}>{label}</label>
      <Global_Input
        id={id}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
        }}
      />
    </div>
  );

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t(`body.vitals.addTitles.${kind}`)}</span>
          <p className='Health_card_description'>{t(`body.vitals.references.${kind}`)}</p>
        </div>
      </div>

      <div className='Health_Form Body_Vitals_Form'>
        {kind === 'BLOOD_PRESSURE' && (
          <>
            {numberField('vital-systolic', t('body.vitals.systolic'), value, setValue, '120')}
            {numberField('vital-diastolic', t('body.vitals.diastolic'), value2, setValue2, '80')}
            {numberField('vital-pulse', t('body.vitals.pulse'), pulse, setPulse, '70')}
          </>
        )}
        {kind === 'GLUCOSE' && (
          <>
            {numberField('vital-glucose', t('body.vitals.glucose'), value, setValue, '95')}
            <div className='Health_Form_Field'>
              <label htmlFor='vital-context'>{t('body.vitals.context')}</label>
              <Global_Dropdown
                id='vital-context'
                value={context}
                onChange={(next) => setContext(next as GlucoseContext)}
                options={GLUCOSE_CONTEXTS.map((option) => ({ value: option, label: t(`body.vitals.contexts.${option}`) }))}
              />
            </div>
          </>
        )}
        {kind === 'TEMPERATURE' && numberField('vital-temperature', t('body.vitals.temperature'), value, setValue, '36.6')}
        <div className='Health_Form_Field'>
          <label htmlFor='vital-date'>{t('body.date')}</label>
          <Global_Input id='vital-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='vital-time'>{t('body.time')}</label>
          <Global_Input id='vital-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Health_Device_Field id='vital-device' devices={devices.devicesOf(deviceKind)} value={deviceId} onChange={setDeviceChoice} />
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='vital-notes'>{t('body.notes')}</label>
        <textarea
          id='vital-notes'
          className='Diary_Text'
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder={t('body.vitals.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('body.saving') : t('body.save')}
        </button>
      </div>
    </section>
  );
};

export default Body_Vitals_Card;
